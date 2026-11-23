import { buildDiagramLayout } from './diagram-layout.js?v=compare-layout3';

// Render the model's functional view without loading the 3D viewer or its documentation.
export function drawThumbnail(container, model) {
  const view = { tiers: model.tiers, nodes: model.nodes, links: model.links || [], groups: model.groups || [] };
  if (!view.tiers?.length || !view.nodes || !Object.keys(view.nodes).length) throw new Error('empty model');
  const layout = buildDiagramLayout(view, { flat: true, compact: false, width: 800, height: 340 });
  const floors = [...layout.floors.values()];
  const left = Math.min(...floors.map(f => f.x + f.left));
  const right = Math.max(...floors.map(f => f.x + f.right));
  const top = Math.min(...floors.map(f => f.z + f.back));
  const bottom = Math.max(...floors.map(f => f.z + f.front));
  const scale = Math.min(750 / (right - left || 1), 298 / (bottom - top || 1));
  const ox = (800 - (right - left) * scale) / 2 - left * scale;
  const oy = (340 - (bottom - top) * scale) / 2 - top * scale;
  const x = value => ox + value * scale, y = value => oy + value * scale;
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 340;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b1c1f'; ctx.fillRect(0, 0, 800, 340);
  for (const floor of floors) {
    ctx.fillStyle = '#222427'; ctx.strokeStyle = '#414449'; ctx.lineWidth = 1;
    ctx.fillRect(x(floor.x + floor.left), y(floor.z + floor.back), (floor.right - floor.left) * scale, (floor.front - floor.back) * scale);
    ctx.strokeRect(x(floor.x + floor.left), y(floor.z + floor.back), (floor.right - floor.left) * scale, (floor.front - floor.back) * scale);
    const tier = view.tiers.find(t => t.id === floor.id);
    ctx.fillStyle = '#92969b'; ctx.font = '14px sans-serif'; ctx.textBaseline = 'top';
    ctx.fillText(tier?.label || '', x(floor.x + floor.left) + 8, y(floor.z + floor.back) + 6, Math.max(0, (floor.right - floor.left) * scale - 16));
  }
  for (const path of layout.routes.values()) {
    if (path.length < 2) continue;
    ctx.strokeStyle = '#8b969d'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]); ctx.beginPath();
    path.forEach((p, i) => i ? ctx.lineTo(x(p[0]), y(p[2])) : ctx.moveTo(x(p[0]), y(p[2])));
    ctx.stroke(); ctx.setLineDash([]);
    const a = path[path.length - 2], b = path[path.length - 1];
    const angle = Math.atan2(b[2] - a[2], b[0] - a[0]);
    const px = x((a[0] + b[0]) / 2), py = y((a[2] + b[2]) / 2);
    ctx.fillStyle = '#9aa6ad'; ctx.beginPath(); ctx.moveTo(px + 5 * Math.cos(angle), py + 5 * Math.sin(angle));
    ctx.lineTo(px - 4 * Math.cos(angle) + 3 * Math.sin(angle), py - 4 * Math.sin(angle) - 3 * Math.cos(angle));
    ctx.lineTo(px - 4 * Math.cos(angle) - 3 * Math.sin(angle), py - 4 * Math.sin(angle) + 3 * Math.cos(angle)); ctx.closePath(); ctx.fill();
  }
  const width = Math.min(142, Math.max(55, 2.9 * scale)), height = Math.min(36, Math.max(19, 1.15 * scale));
  for (const node of Object.values(view.nodes)) {
    const p = layout.point(node.x, node.y, node.tier), px = x(p[0]), py = y(p[2]);
    ctx.fillStyle = '#17191b'; ctx.strokeStyle = '#afb5b8'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(px - width / 2, py - height / 2, width, height, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f1f1f1'; ctx.font = `${Math.max(9, Math.min(14, height * 0.4))}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let label = String(node.label || '');
    while (label.length > 1 && ctx.measureText(label).width > width - 14) label = label.slice(0, -1);
    if (label !== node.label) label += '…';
    ctx.fillText(label, px, py, width - 8); ctx.textAlign = 'start';
  }
  container.replaceChildren(canvas);
}
