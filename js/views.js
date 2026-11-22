/* ビュー：同じモデルを 3 つの見せ方に変換する（解析は常に物理モデルで行い、表示だけを変える）
 *   logical  論理構成（機能配置）：基盤部品（CDN / LB / NAT / WAF …）を隠し、機能どうしの関係にまとめる
 *   cloud    物理構成（サービス）：クラウドサービス単位。VPC の境界まで
 *   network  物理構成（ネットワーク）：VPC / AZ / サブネットと、複数 AZ の部品を AZ ごとの実体に展開
 * 変換結果は { tiers, groups, nodes, links, from, linkFrom }。from[ビューの部品] = [物理の部品 ID …] */
(function () {
  const INFRA_KIND = ['cdn', 'lb'];
  const INFRA_SVC = ['cloudfront', 'route53', 'waf', 'alb', 'nat', 'apigw', 'secrets', 'cloudwatch'];
  const isInfra = n => INFRA_KIND.includes(n.kind) || INFRA_SVC.includes(n.svc) || n.role === 'infra';
  const VIEWS = {
    logical: { label: '論理構成', sub: '機能配置' },
    cloud: { label: '物理構成', sub: 'サービス' },
    network: { label: '物理構成', sub: 'ネットワーク' },
  };
  const clone = o => JSON.parse(JSON.stringify(o));

  function available(m) {
    const v = ['logical', 'cloud'];
    if ((m.groups || []).some(g => g.kind === 'az' || g.kind === 'subnet') || Object.values(m.nodes).some(n => n.az)) v.push('network');
    return v;
  }

  /* 物理（サービス）：AZ / サブネットの枠は出さない */
  function cloud(base) {
    return {
      tiers: base.tiers, groups: (base.groups || []).filter(g => !['az', 'subnet'].includes(g.kind)), nodes: base.nodes, links: base.links,
      from: Object.fromEntries(Object.keys(base.nodes).map(id => [id, [id]])), linkFrom: Object.fromEntries(base.links.map(l => [l.id, [l.id]])),
    };
  }

  /* 物理（ネットワーク）：AZ の帯の中に、部品を AZ ごとに置く */
  function network(base) {
    const groups = base.groups || [], nodes = {}, from = {}, linkFrom = {}, links = [];
    const azBand = (tier, az) => groups.find(g => g.kind === 'az' && g.az === az && [].concat(g.tier).includes(tier));
    const inst = {}; // 物理 ID → [ビュー ID]
    for (const [id, n] of Object.entries(base.nodes)) {
      const zones = (n.az || []).filter(z => azBand(n.tier, z));
      if (!zones.length) { nodes[id] = n; from[id] = [id]; inst[id] = [{ id }]; continue; }
      const t = base.tiers.find(x => x.id === n.tier), h = (t?.size || [10, 4])[1];
      inst[id] = zones.map(z => {
        const g = azBand(n.tier, z), f = Math.min(1, Math.max(0, (n.y + 0.5) / (h + 1)));
        const vid = zones.length > 1 ? `${id}@${z}` : id;
        const per = n.replicas && n.replicas < 99 ? Math.ceil(n.replicas / zones.length) : n.replicas;
        nodes[vid] = { ...n, label: zones.length > 1 ? `${n.label}（${z}）` : n.label, replicas: per, y: +(g.y0 + 0.5 + f * (g.y1 - g.y0 - 1)).toFixed(2), az: [z] };
        from[vid] = [id];
        return { id: vid, az: z };
      });
    }
    for (const l of base.links) {
      const A = inst[l.from], B = inst[l.to];
      if (!A || !B) continue;
      const pairs = [];
      for (const a of A) {
        const same = B.filter(b => b.az && a.az && b.az === a.az);
        for (const b of (same.length ? same : B)) pairs.push([a, b]); // 同じ AZ に相手がいればその AZ 内で、いなければ AZ をまたぐ
      }
      for (const [a, b] of pairs) {
        const id = pairs.length > 1 ? `${l.id}@${a.az || '-'}${b.az || '-'}` : l.id;
        const cross = a.az && b.az && a.az !== b.az;
        links.push({ ...l, id, from: a.id, to: b.id, ...(cross ? { crossAz: true } : {}) });
        linkFrom[id] = [l.id];
      }
    }
    return { tiers: base.tiers, groups, nodes, links, from, linkFrom };
  }

  /* 論理（機能配置）：components の指定、なければ基盤部品を隠した部品をそのまま機能とみなす */
  function logical(base, spec = {}) {
    const comps = spec.components || {}, owner = {};
    for (const [cid, c] of Object.entries(comps)) for (const p of c.realizedBy || []) owner[p] = cid;
    const nodes = {}, from = {};
    for (const [id, n] of Object.entries(base.nodes)) {
      if (owner[id] || isInfra(n)) continue;
      nodes[id] = stripPos({ ...n }); from[id] = [id];
    }
    for (const [cid, c] of Object.entries(comps)) {
      const parts = (c.realizedBy || []).filter(p => base.nodes[p]);
      if (!parts.length) continue;
      const first = base.nodes[parts[0]];
      nodes[cid] = stripPos({ label: c.label, kind: c.kind || 'service', tier: c.tier || first.tier, component: true, realizedBy: parts, description: c.description });
      from[cid] = parts;
    }
    const comp = p => owner[p] || (nodes[p] ? p : null);
    // 隠した部品（基盤）を通り抜けて、見える機能どうしの接続を作る
    const out = {};
    base.links.forEach(l => (out[l.from] = out[l.from] || []).push(l));
    const agg = {};
    for (const l of base.links) {
      const A = comp(l.from);
      if (!A) continue;
      const seen = new Set(), stack = [[l, [l.id]]];
      while (stack.length) {
        const [x, path] = stack.pop();
        const B = comp(x.to);
        if (B) {
          if (B !== A) {
            const key = `${A}>${B}`, e = agg[key] = agg[key] || { id: `L:${key}`, from: A, to: B, sync: false, ids: new Set(), labels: new Set() };
            e.sync ||= x.sync && l.sync; path.forEach(i => e.ids.add(i)); if (l.label) e.labels.add(l.label);
          }
          continue;
        }
        if (seen.has(x.to)) continue; seen.add(x.to);
        for (const y of out[x.to] || []) stack.push([y, [...path, y.id]]);
      }
    }
    const links = Object.values(agg).map(e => ({ id: e.id, from: e.from, to: e.to, sync: e.sync, ...(e.labels.size ? { label: [...e.labels].join(' / ') } : {}) }));
    const linkFrom = Object.fromEntries(Object.values(agg).map(e => [e.id, [...e.ids]]));
    // フロア：指定があればそれ、なければ物理のフロアから空になったものを除く
    let tiers = spec.tiers ? clone(spec.tiers) : base.tiers.map(t => ({ ...t, size: undefined })).filter(t => Object.values(nodes).some(n => n.tier === t.id));
    tiers = tiers.map(t => { const x = { ...t }; if (x.size === undefined) delete x.size; return x; });
    for (const n of Object.values(nodes)) if (!tiers.some(t => t.id === n.tier)) n.tier = tiers.find(t => !t.origin)?.id || tiers[0].id;
    const v = { tiers, groups: [], nodes, links, from, linkFrom };
    window.Layout.apply(v);
    return v;
  }
  function stripPos(n) { delete n.x; delete n.y; return n; }

  function project(base, m, view) {
    if (view === 'network') return network(base);
    if (view === 'logical') return logical(base, m.views?.logical);
    return cloud(base);
  }

  /* 物理部品の表示状態を、ビューの部品にまとめる（停止 > 影響 > 滞留、ずれ > 不明 > 主張 > 事実） */
  const FILL = ['down', 'impact', 'delay'], STAT = ['drift', 'unknown', 'claim', 'fact'];
  const TONE = ['acc', 'warn', 'ok', undefined];
  function mergeNode(states) {
    const s = states.filter(Boolean);
    if (!s.length) return {};
    const best = (k, order) => s.map(x => x[k]).filter(v => v != null).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
    const badge = s.map(x => x.badge).filter(Boolean).sort((a, b) => TONE.indexOf(a.tone) - TONE.indexOf(b.tone))[0];
    const heats = s.map(x => x.heat).filter(v => v != null), hs = s.map(x => x.h).filter(v => v != null);
    return {
      fill: best('fill', FILL), status: best('status', STAT), badge, outline: s.some(x => x.outline),
      dim: s.every(x => x.dim), ghost: s.every(x => x.ghost), heat: heats.length ? Math.max(...heats) : undefined, h: hs.length ? Math.max(...hs) : undefined,
    };
  }
  function mergeLink(states) {
    const s = states.filter(Boolean), on = s.find(x => x.on);
    return on ? { ...on, packets: s.some(x => x.packets) } : { dim: s.length > 0 && s.every(x => x.dim), dashed: s.find(x => x.dashed)?.dashed };
  }

  window.Views = { VIEWS, available, project, mergeNode, mergeLink, isInfra };
})();
