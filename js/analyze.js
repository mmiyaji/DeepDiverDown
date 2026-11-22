/* モデル解析：指摘ルール（lint）・障害影響の伝播・実環境との差分 */
(function () {
  const INFRA = ['client', 'external', 'cdn'];
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
        Object.entries(m.nodes).filter(([, n]) => n.tier !== 'edge' && n.kind !== 'external').forEach(([id]) => walk(id, [], new Set([id])));
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

  function lint(m) {
    return RULES.flatMap(r => r.run(m).map(x => ({ rule: r.id, title: r.title, sev: r.sev, nodes: [], links: [], ...x })));
  }

  /* 障害伝播：同期で依存しているノードは影響を受ける（非同期は滞留のみ） */
  function impact(m, down) {
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
    for (const [id, n] of Object.entries(m.nodes)) {
      const x = a.nodes[id];
      if (!x) { nodes[id] = 'missing'; items.push({ kind: 'missing', nodes: [id], msg: `${n.label} が実環境に存在しない` }); }
      else if (n.replicas != null && x.replicas != null && x.replicas !== n.replicas) {
        nodes[id] = 'replicas'; items.push({ kind: 'replicas', nodes: [id], msg: `${n.label}：設計 ${n.replicas} 台 → 実環境 ${x.replicas} 台` });
      }
    }
    for (const [id, x] of Object.entries(a.nodes)) if (!m.nodes[id]) {
      extraNodes[id] = x; items.push({ kind: 'extra', nodes: [id], msg: `${x.label || id} が設計書にない（実環境のみ）` });
    }
    for (const l of m.links) if (!al.some(([f, t]) => f === l.from && t === l.to)) {
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
