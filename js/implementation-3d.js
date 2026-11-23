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

// In a multi-provider diagram a floor can contain several distinct platforms.
// Bound each envelope by its own members, rather than claiming the entire floor.
export function platformFootprint(points, floors, separateProviders) {
  if (separateProviders) {
    const margin = 1.2;
    return [Math.min(...points.map(p => p[0])) - margin, Math.max(...points.map(p => p[0])) + margin,
      Math.min(...points.map(p => p[2])) - margin, Math.max(...points.map(p => p[2])) + margin];
  }
  return [Math.min(...floors.map(f => f.x + f.left)) - 1.2, Math.max(...floors.map(f => f.x + f.right)) + 1.2,
    Math.min(...floors.map(f => f.z + f.back)) - 1.2, Math.max(...floors.map(f => f.z + f.front)) + 1.2];
}
