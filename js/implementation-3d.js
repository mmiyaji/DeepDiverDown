// Optional presentation-only positions. Relationships and source models remain unchanged.
export function implementation3D(view, layout, { flat = false } = {}) {
  if (!layout?.tiers || !layout?.nodes) return view;
  const tiers = new Set(layout.tiers.map(t => t.id));
  const nodes = Object.fromEntries(Object.entries(view.nodes).map(([id, node]) => {
    const position = layout.nodes[id];
    return [id, position && tiers.has(position.tier) ? { ...node, ...position } : node];
  }));
  if (Object.values(nodes).some(node => !tiers.has(node.tier))) return view;
  return { ...view, tiers: layout.tiers, nodes, groups: layout.groups || view.groups,
    platformStack: !flat, platform2D: flat };
}
