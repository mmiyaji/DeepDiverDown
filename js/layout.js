/* 自動配置：座標（x, y）のない部品を、フロアごとに処理の流れ（リンクの向き）に沿って並べる
 *   - 列（x）：リンクをたどった深さ（最長経路）。循環する辺は無視
 *   - 行（y）：同じ列の中で、前段の部品の行の平均に近い順
 *   - フロアの size が未指定なら、並べた結果から決める
 * model.layout: 'auto' なら座標があっても全部並べ直す。ブラウザと Node（tools/）で共用 */
(function () {
  const GAP_X = 2.6, GAP_Y = 1.8;

  function ranks(m) {
    const ids = Object.keys(m.nodes), out = {}, state = {}, back = new Set();
    for (const id of ids) out[id] = [];
    for (const l of m.links) if (out[l.from] && m.nodes[l.to]) out[l.from].push(l);
    // 深さ優先で循環する辺（戻り辺）を見つける
    const visit = id => {
      state[id] = 1;
      for (const l of out[id]) {
        if (state[l.to] === 1) back.add(l);
        else if (!state[l.to]) visit(l.to);
      }
      state[id] = 2;
    };
    ids.forEach(id => state[id] || visit(id));
    // 最長経路で列を決める（戻り辺を除いた DAG 上）
    const rank = Object.fromEntries(ids.map(id => [id, 0]));
    for (let i = 0; i < ids.length; i++) {
      let changed = false;
      for (const l of m.links) if (!back.has(l) && rank[l.from] != null && rank[l.to] != null && rank[l.to] < rank[l.from] + 1) { rank[l.to] = rank[l.from] + 1; changed = true; }
      if (!changed) break;
    }
    return rank;
  }

  function apply(m) {
    if (!m?.nodes || !m.tiers) return m;
    const all = m.layout === 'auto';
    const todo = id => all || m.nodes[id].x == null || m.nodes[id].y == null;
    if (!Object.keys(m.nodes).some(todo)) return m;
    const rank = ranks(m), pos = {};
    for (const t of m.tiers) {
      const ids = Object.keys(m.nodes).filter(id => m.nodes[id].tier === t.id);
      const free = ids.filter(todo);
      if (!free.length) continue;
      const fixed = ids.filter(id => !todo(id));
      const cols = [...new Set(free.map(id => rank[id]))].sort((a, b) => a - b);
      const startX = fixed.length ? Math.max(...fixed.map(id => m.nodes[id].x)) + GAP_X : 0;
      let maxRow = 0;
      cols.forEach((r, ci) => {
        const col = free.filter(id => rank[id] === r);
        // 前段（このフロアで配置済み）の行の平均で並べる
        const bary = id => {
          const ys = m.links.filter(l => l.to === id && pos[l.from] != null).map(l => pos[l.from]);
          return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Infinity;
        };
        col.sort((a, b) => bary(a) - bary(b) || a.localeCompare(b));
        col.forEach((id, row) => {
          m.nodes[id].x = +(startX + ci * GAP_X).toFixed(2);
          m.nodes[id].y = +(row * GAP_Y).toFixed(2);
          pos[id] = row; maxRow = Math.max(maxRow, row);
        });
      });
      if (!t.size) {
        const xs = ids.map(id => m.nodes[id].x), ys = ids.map(id => m.nodes[id].y);
        t.size = [Math.max(3, Math.ceil(Math.max(...xs)) + 1), Math.max(2, Math.ceil(Math.max(...ys)) + 1)];
      }
    }
    return m;
  }

  window.Layout = { apply, ranks };
})();
