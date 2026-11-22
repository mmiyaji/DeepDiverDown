/* モデル解析：指摘ルール（lint）・障害影響の伝播・実環境との差分 */
(function () {
  const INFRA = ['client', 'external', 'cdn', 'actor'];
  const syncLinks = m => m.links.filter(l => l.sync);

  const RULES = [
    { id: 'SPOF', sev: 'high', title: '単一障害点',
      run: m => Object.entries(m.nodes)
        .filter(([, n]) => !INFRA.includes(n.kind) && (n.replicas ?? 1) < 2)
        .map(([id, n]) => ({ nodes: [id], msg: `${n.label} が ${n.replicas ?? 1} 台構成（${n.src || '出典なし'}）` })) },

    { id: 'NO_TIMEOUT', sev: 'high', title: 'タイムアウト未定義',
      run: m => syncLinks(m).filter(l => l.timeoutMs == null)
        .map(l => ({ links: [l.id], nodes: [l.from, l.to], msg: `${m.nodes[l.from].label} → ${m.nodes[l.to].label} の同期呼び出しにタイムアウトがない` })) },

    { id: 'CYCLE', sev: 'high', title: '同期呼び出しの循環',
      run: m => {
        const out = [], adj = {}, seen = new Set();
        syncLinks(m).forEach(l => (adj[l.from] = adj[l.from] || []).push(l));
        const dfs = (n, path) => {
          for (const l of adj[n] || []) {
            const i = path.findIndex(p => p.from === l.to);
            if (l.to === path[0]?.from || i >= 0) {
              const cyc = [...path.slice(Math.max(i, 0)), l], key = cyc.map(c => c.id).sort().join();
              if (!seen.has(key)) { seen.add(key); out.push({ links: cyc.map(c => c.id), nodes: cyc.map(c => c.from),
                msg: cyc.map(c => m.nodes[c.from].label).join(' → ') + ' → ' + m.nodes[cyc[0].from].label + ' が循環（デッドロック・連鎖タイムアウトの危険）' }); }
            } else if (path.length < 12) dfs(l.to, [...path, l]);
          }
        };
        Object.keys(m.nodes).forEach(n => dfs(n, []));
        return out;
      } },

    { id: 'SYNC_CHAIN', sev: 'mid', title: '長い同期チェーン',
      run: m => {
        const adj = {}; syncLinks(m).forEach(l => (adj[l.from] = adj[l.from] || []).push(l));
        let best = [];
        const walk = (n, path, vis) => {
          if (path.length > best.length) best = path;
          for (const l of adj[n] || []) if (!vis.has(l.to)) walk(l.to, [...path, l], new Set([...vis, l.to]));
        };
        Object.entries(m.nodes).filter(([, n]) => n.tier !== 'edge' && !['external', 'actor'].includes(n.kind)).forEach(([id]) => walk(id, [], new Set([id])));
        return best.length >= 3 ? [{ links: best.map(l => l.id), nodes: [best[0].from, ...best.map(l => l.to)],
          msg: `同期呼び出しが ${best.length} 段連鎖：` + [best[0].from, ...best.map(l => l.to)].map(id => m.nodes[id].label).join(' → ') + '。末端の遅延・障害がすべて上流に波及する' }] : [];
      } },

    { id: 'SHARED_DB', sev: 'mid', title: '共有データベース',
      run: m => Object.entries(m.nodes).filter(([, n]) => ['db', 'cache'].includes(n.kind)).flatMap(([id, n]) => {
        const ls = m.links.filter(l => l.to === id), users = [...new Set(ls.map(l => l.from))];
        return users.length > 1 ? [{ nodes: [id, ...users], links: ls.map(l => l.id),
          msg: `${n.label} に ${users.map(u => m.nodes[u].label).join('・')} が直接アクセス。スキーマ変更が独立にできない` }] : [];
      }) },

    { id: 'RETRY_STORM', sev: 'mid', title: 'タイムアウト / リトライの不整合',
      run: m => syncLinks(m).filter(up => !m.links.some(b => b.from === up.to && b.to === up.from)) // コールバック往復は除外
        .flatMap(up => syncLinks(m).filter(dn => dn.from === up.to && up.timeoutMs && dn.timeoutMs)
        .filter(dn => dn.timeoutMs * (1 + (dn.retry || 0)) > up.timeoutMs)
        .map(dn => ({ links: [up.id, dn.id], nodes: [up.from, up.to, dn.to],
          msg: `${m.nodes[dn.from].label} → ${m.nodes[dn.to].label} は最大 ${dn.timeoutMs * (1 + (dn.retry || 0)) / 1000} 秒かかりうるが、上流は ${up.timeoutMs / 1000} 秒で打ち切る（無駄な処理・二重決済の危険）` }))) },
  ];

  /* ---- AWS 構成向け ---- */
  RULES.push(
    { id: 'SINGLE_AZ', sev: 'high', title: '単一 AZ 配置',
      run: m => Object.entries(m.nodes).filter(([, n]) => n.az && n.az.length < 2)
        .map(([id, n]) => ({ nodes: [id], msg: `${n.label} が AZ ${n.az.join(',')} のみに配置。AZ 障害で停止する` })) },
    { id: 'PUBLIC_DATA', sev: 'high', title: 'データストアがパブリック',
      run: m => Object.entries(m.nodes).filter(([, n]) => n.subnet === 'public' && (['db', 'cache'].includes(n.kind) || ['cyl'].includes(window.AWS?.[n.svc]?.shape)))
        .map(([id, n]) => ({ nodes: [id], msg: `${n.label} がパブリックサブネットにある` })) },
  );

  /* ---- CI/CD パイプライン向け（for: 'pipeline'） ---- */
  const sources = m => Object.keys(m.nodes).filter(id => !m.links.some(l => l.to === id && l.sync));
  const reach = (m, avoid) => {
    const seen = new Set(sources(m)), q = [...seen];
    while (q.length) { const n = q.shift(); for (const l of m.links) if (l.sync && l.from === n && !seen.has(l.to) && !avoid(l.to)) { seen.add(l.to); q.push(l.to); } }
    return seen;
  };
  const deploys = (m, env) => Object.entries(m.nodes).filter(([, n]) => n.stage === 'deploy' && (!env || n.tier === env)).map(([id]) => id);
  RULES.push(
    { id: 'NO_APPROVAL', for: 'pipeline', sev: 'high', title: '承認なしで本番に到達',
      run: m => { const r = reach(m, id => m.nodes[id].stage === 'approval');
        return deploys(m, 'prod').filter(id => r.has(id)).map(id => ({ nodes: [id], links: m.links.filter(l => l.to === id && m.nodes[l.from].stage !== 'approval').map(l => l.id),
          msg: `${m.nodes[id].label} に手動承認を経ずに到達できる経路がある` })); } },
    { id: 'NO_TEST', for: 'pipeline', sev: 'high', title: 'テストを経ないデプロイ',
      run: m => { const r = reach(m, id => m.nodes[id].stage === 'test');
        return deploys(m).filter(id => r.has(id)).map(id => ({ nodes: [id], msg: `${m.nodes[id].label} にテストを通らずに到達できる経路がある` })); } },
    { id: 'NO_ROLLBACK', for: 'pipeline', sev: 'mid', title: '自動ロールバックなし',
      run: m => deploys(m, 'prod').filter(id => !m.links.some(l => l.to === id && l.kind === 'rollback' && m.nodes[l.from].kind !== 'actor'))
        .map(id => { const man = m.links.find(l => l.to === id && l.kind === 'rollback');
          return { nodes: [id, ...(man ? [man.from] : [])], links: man ? [man.id] : [],
            msg: man ? `${m.nodes[id].label} のロールバックは ${m.nodes[man.from].label} の手作業のみ。夜間・休日の検知から復旧までが人に依存する` : `${m.nodes[id].label} に監視アラームからのロールバック経路がない` }; }) },
    { id: 'SOD', for: 'any', sev: 'high', title: '職務分掌の欠如',
      run: m => Object.entries(m.nodes).filter(([, n]) => n.kind === 'actor').flatMap(([id, n]) => {
        const tgt = m.links.filter(l => l.from === id).map(l => m.nodes[l.to].stage), team = n.team;
        const self = tgt.includes('source') && tgt.includes('approval');
        const sameTeam = team && tgt.includes('approval') && Object.entries(m.nodes).some(([j, o]) => j !== id && o.kind === 'actor' && o.team === team && m.links.some(l => l.from === j && m.nodes[l.to].stage === 'source'));
        return self || sameTeam ? [{ nodes: [id], msg: `${n.label} が${self ? '自分のコード' : '同じチーム（' + team + '）のコード'}を本番リリース承認できる` }] : [];
      }) },
    { id: 'SINGLE_PERSON', for: 'any', sev: 'mid', title: '属人化',
      run: m => Object.entries(m.nodes).filter(([, n]) => n.kind === 'actor' && n.role !== 'user' && (n.headcount ?? 1) < 2)
        .map(([id, n]) => ({ nodes: [id], msg: `${n.label} の担当が ${n.headcount ?? 1} 名。不在時に${m.links.filter(l => l.from === id).map(l => m.nodes[l.to].label).join('・')}への作業が誰もできなくなる` })) },
    { id: 'SLOW_PIPELINE', for: 'pipeline', sev: 'mid', title: 'リードタイムが長い',
      run: m => {
        const memo = {}, best = id => memo[id] ?? (memo[id] = (m.nodes[id].metrics?.duration || 0) + Math.max(0, ...m.links.filter(l => l.sync && l.from === id).map(l => best(l.to))));
        const total = Math.max(...sources(m).map(best)), limit = m.leadTimeLimit || 30;
        return total > limit ? [{ nodes: Object.entries(m.nodes).filter(([, n]) => (n.metrics?.duration || 0) >= 10).map(([id]) => id),
          msg: `push から本番まで最長 ${total} 分（目標 ${limit} 分）。10 分以上のステージがボトルネック` }] : [];
      } },
  );

  function lint(m) {
    const type = m.type || 'system';
    return RULES.filter(r => r.for === 'any' || (r.for || 'system') === type).flatMap(r => r.run(m).map(x => ({ rule: r.id, title: r.title, sev: r.sev, nodes: [], links: [], ...x })));
  }

  /* 障害伝播：同期で依存しているノードは影響を受ける（非同期は滞留のみ） */
  function impact(m, down) {
    if (m.type === 'pipeline') { // パイプラインは下流へ伝播（実行されない）
      // join: 'all'（既定：前段が1つでも失敗したら実行されない）/ 'any'（別経路が生きていれば実行される）
      const skip = new Set(), bad = id => down.includes(id) || skip.has(id);
      let changed = true;
      while (changed) {
        changed = false;
        for (const id of Object.keys(m.nodes)) {
          if (bad(id)) continue;
          const pre = m.links.filter(l => l.sync && l.to === id).map(l => l.from);
          if (pre.length && (m.nodes[id].join === 'any' ? pre.every(bad) : pre.some(bad))) { skip.add(id); changed = true; }
        }
      }
      const broken = (m.scenarios || []).filter(s => s.steps.some(st => st.links.some(id => { const l = m.links.find(x => x.id === id); return l && bad(l.from); })));
      return { impacted: [...skip], delayed: [], brokenScenarios: broken };
    }
    const hit = new Set(down), delayed = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const l of m.links) {
        if (!hit.has(l.to)) continue;
        if (l.sync && !hit.has(l.from)) { hit.add(l.from); changed = true; }
        if (!l.sync) delayed.add(l.from);
      }
    }
    m.links.filter(l => !l.sync && hit.has(l.from)).forEach(l => delayed.add(l.to));
    down.forEach(d => hit.delete(d));
    const brokenScenarios = (m.scenarios || []).filter(s => s.steps.some(st => st.links.some(id => {
      const l = m.links.find(x => x.id === id); return l && l.sync && (down.includes(l.to) || down.includes(l.from));
    })));
    return { impacted: [...hit], delayed: [...delayed].filter(x => !down.includes(x) && !hit.has(x)), brokenScenarios };
  }

  /* 設計（MODEL）と実環境（ACTUAL）の差分 */
  function diff(m, a) {
    if (!a) return { nodes: {}, links: {}, extraNodes: {}, extraLinks: [], items: [] };
    const nodes = {}, links = {}, items = [], extraNodes = {}, extraLinks = [];
    const al = (a.links || []).map(l => Array.isArray(l) ? l : [l.from, l.to]);
    const actor = id => m.nodes[id]?.kind === 'actor';
    for (const [id, n] of Object.entries(m.nodes)) {
      if (n.kind === 'actor') continue;
      const x = a.nodes[id];
      if (!x) { nodes[id] = 'missing'; items.push({ kind: 'missing', nodes: [id], msg: `${n.label} が実環境に存在しない` }); }
      else if (n.replicas != null && x.replicas != null && x.replicas !== n.replicas) {
        nodes[id] = 'replicas'; items.push({ kind: 'replicas', nodes: [id], msg: `${n.label}：設計 ${n.replicas} 台 → 実環境 ${x.replicas} 台` });
      }
    }
    for (const [id, x] of Object.entries(a.nodes)) if (!m.nodes[id]) {
      extraNodes[id] = x; items.push({ kind: 'extra', nodes: [id], msg: `${x.label || id} が設計書にない（実環境のみ）` });
    }
    for (const l of m.links) if (!actor(l.from) && !actor(l.to) && !al.some(([f, t]) => f === l.from && t === l.to)) {
      links[l.id] = 'missing';
      if (!nodes[l.from] && !nodes[l.to]) items.push({ kind: 'missing', links: [l.id], msg: `${m.nodes[l.from].label} → ${m.nodes[l.to].label} の接続が実環境にない` });
    }
    al.filter(([f, t]) => !m.links.some(l => l.from === f && l.to === t)).forEach(([f, t]) => {
      const id = `x_${f}_${t}`; extraLinks.push({ id, from: f, to: t, sync: true });
      items.push({ kind: 'extra', links: [id], msg: `${(m.nodes[f] || a.nodes[f]).label || f} → ${(m.nodes[t] || a.nodes[t]).label || t} の接続が設計書にない` });
    });
    return { nodes, links, extraNodes, extraLinks, items };
  }

  window.Analyze = { lint, impact, diff, RULES };
})();
