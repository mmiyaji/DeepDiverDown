/* Display coordinates belong to a projection, never to the source model.
   Groups, plates and nodes all use the same per-floor transform. */
export function buildDiagramLayout(view, { flat, expanded = false, compact = false, comparison = false, cardWidthPx = 128, width = 1000, height = 650, labelScale = 1 }) {
  const sx = flat ? 1.65 : 1.12, sz = flat ? 1.3 : 1;
  const autoLevels = view.tiers.filter(t => t.z == null).map(t => t.id).reverse();
  const specs = view.tiers.map(tier => {
    const members = Object.values(view.nodes).filter(n => n.tier === tier.id);
    const xs = members.map(n => n.x), zs = members.map(n => n.y);
    // An offset state store can still belong to a single left-to-right pipeline.
    // Keep its offset when transposing, but leave multi-row grids intact.
    const staggeredRow = comparison && new Set(xs).size === members.length &&
      Math.max(...zs) - Math.min(...zs) <= (Math.max(...xs) - Math.min(...xs)) / 6;
    const vertical = flat && compact && members.length >= 4 && (new Set(zs).size === 1 || staggeredRow)
      && new Set(xs).size >= 4;
    for (const g of view.groups || []) {
      if ([].concat(g.tier).includes(tier.id) && [g.x0, g.x1, g.y0, g.y1].every(Number.isFinite)) {
        xs.push(g.x0, g.x1); zs.push(g.y0, g.y1);
      } else if ([].concat(g.tier).includes(tier.id) && g.nodes?.length) {
        const grouped = g.nodes.map(id => view.nodes[id]).filter(n => n?.tier === tier.id);
        const padding = { cloud: 1.2, region: 1, cluster: 0.8, namespace: 0.6 }[g.kind] ?? 0.8;
        for (const n of grouped) {
          xs.push(n.x - padding, n.x + padding);
          zs.push(n.y - padding, n.y + padding);
        }
      }
    }
    if (!flat || !xs.length) {
      const [w, d] = tier.size || [0, 0];
      xs.push(0, Math.max(1, w)); zs.push(0, Math.max(1, d));
    }
    const [ox, oz] = tier.origin || [0, 0];
    const across = vertical ? zs : xs, along = vertical ? xs : zs;
    return {
      id: tier.id, level: tier.z ?? autoLevels.indexOf(tier.id), vertical,
      x: ox * sx, z: oz * sz, y: 0,
      left: Math.min(...across) * sx, right: Math.max(...across) * sx,
      back: Math.min(...along) * sz, front: Math.max(...along) * sz,
    };
  });
  const levels = [...new Set(specs.map(f => f.level))].sort((a, b) => b - a);
  const bands = levels.map(level => specs.filter(f => f.level === level).sort((a, b) => a.x - b.x));
  const stack = flat && compact;
  // CSS cards keep their pixel size while the orthographic camera fits world
  // coordinates. Reserve the card half-width and title space in those units.
  const usableWidth = Math.max(1, width - 2 * Math.min(width * 0.09, 20));
  const usableHeight = Math.max(1, height - 2 * Math.min(height * 0.12, 22));
  const maxAcross = stack ? 1 : Math.max(1, ...bands.map(b => b.length));
  const rows = Math.max(1, stack ? specs.length : bands.length);
  const sidePx = comparison ? (cardWidthPx / 2 + 6) * labelScale : Math.min(85 * labelScale + 10, usableWidth * 0.41 / maxAcross);
  const titlePx = comparison ? 63 * labelScale : Math.min(40 * labelScale + 14, usableHeight * 0.45 / rows);
  const bottomPx = comparison ? 46 * labelScale : Math.min(34 * labelScale + 12, usableHeight * 0.38 / rows);
  function arrange(unitsPerPixel) {
    const floors = new Map();
    let row = 0, elevation = 0;
    for (const band of bands) {
      const placed = [];
      for (const spec of band) {
        const f = { ...spec };
        f.left -= flat ? sidePx * unitsPerPixel : 1.1;
        f.right += flat ? sidePx * unitsPerPixel : 0.9;
        f.back -= flat ? titlePx * unitsPerPixel : 1.2;
        f.front += flat ? bottomPx * unitsPerPixel : 0.95;
        if (stack) {
          f.x = -(f.left + f.right) / 2;
          f.z = row - f.back;
          row = f.z + f.front + 1.2;
        } else {
          for (const previous of placed) {
            if (f.z + f.back < previous.z + previous.front && f.z + f.front > previous.z + previous.back)
              f.x = Math.max(f.x, previous.x + previous.right + 0.7 - f.left);
          }
        }
        floors.set(f.id, f);
        placed.push(f);
      }
      if (flat && !stack) {
        const start = Math.min(...placed.map(f => f.z + f.back));
        for (const f of placed) f.z += row - start;
        row = Math.max(...placed.map(f => f.z + f.front)) + 1.6;
      } else if (!flat) {
        for (const f of placed) f.y = elevation;
        const depth = Math.max(...placed.map(f => f.front - f.back));
        elevation -= Math.max(4, depth * 0.62 + 1.7) * (expanded ? 1.85 : 1);
      }
    }
    return floors;
  }
  let unitsPerPixel = 1 / 32, floors = arrange(unitsPerPixel);
  // A comparison can scroll. Stop shrinking when a pair of labels would
  // share the same screen rectangle. Floor headers and gutters keep their size.
  let scaleLimit = Infinity;
  if (comparison && flat) {
    for (const floor of specs) {
      const members = Object.values(view.nodes).filter(n => n.tier === floor.id);
      members.forEach((a, i) => {
        for (const b of members.slice(i + 1)) {
          const dx = Math.abs(floor.vertical ? a.y - b.y : a.x - b.x) * sx;
          const dz = Math.abs(floor.vertical ? a.x - b.x : a.y - b.y) * sz;
          // Cards can grow to 170 px for long names; include their gap as well.
          const limit = Math.max(dx / (190 * labelScale), dz / (104 * labelScale));
          if (limit > 0) scaleLimit = Math.min(scaleLimit, limit);
        }
      });
    }
    scaleLimit = Math.min(scaleLimit, 0.1);
  }
  if (flat && floors.size) {
    // Padding changes the fitted scale. Iterate only floor rectangles, never
    // the graph routes. A minimum span keeps a single-node floor readable.
    for (let i = 0; i < 20; i++) {
      const all = [...floors.values()];
      const w = Math.max(...all.map(f => f.x + f.right)) - Math.min(...all.map(f => f.x + f.left));
      const h = Math.max(...all.map(f => f.z + f.front)) - Math.min(...all.map(f => f.z + f.back));
      const next = Math.min(scaleLimit, Math.max(1 / 48, w / usableWidth, h / usableHeight));
      if (Math.abs(next - unitsPerPixel) < 0.00005) break;
      unitsPerPixel = next;
      floors = arrange(next);
    }
  } else if (floors.size) {
    const base = Math.min(...[...floors.values()].map(f => f.y));
    for (const floor of floors.values()) floor.y -= base;
  }
  function point(x, z, tier) {
    const f = floors.get(tier);
    return [f.x + (f.vertical ? z : x) * sx, f.y, f.z + (f.vertical ? x : z) * sz];
  }
  const centers = new Map(Object.entries(view.nodes).map(([id, n]) => [id, point(n.x, n.y, n.tier)]));
  const halfX = comparison ? cardWidthPx / 2 * labelScale * unitsPerPixel : flat ? Math.max(1.45, (sidePx - 5) * unitsPerPixel) : 0.72;
  const halfZ = comparison ? 41 * labelScale * unitsPerPixel : flat ? Math.max(0.58, bottomPx * unitsPerPixel) : 0.7;
  const routes = new Map(), pairs = new Map();
  for (const l of view.links) {
    const key = JSON.stringify([l.from, l.to].sort());
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(l);
  }
  const occupied = [], gap = 9 * unitsPerPixel;
  const groups = [...pairs.values()];
  if (flat) {
    // Lay out short local connections first so longer links can go around them.
    const span = ([link]) => {
      const a = centers.get(link.from), b = centers.get(link.to);
      return a && b ? Math.abs(a[0] - b[0]) + Math.abs(a[2] - b[2]) : Infinity;
    };
    groups.sort((a, b) => span(a) - span(b));
  }
  for (const siblings of groups) siblings.forEach((link, i) => {
    const a = centers.get(link.from), b = centers.get(link.to);
    if (!a || !b) return;
    const lane = (i - (siblings.length - 1) / 2) * 0.55;
    const obstacles = [];
    for (const [id, p] of centers) {
      if (id === link.from || id === link.to || p[1] < Math.min(a[1], b[1]) || p[1] > Math.max(a[1], b[1])) continue;
      if (!comparison && (p[0] < Math.min(a[0], b[0]) - halfX - 3 || p[0] > Math.max(a[0], b[0]) + halfX + 3 ||
          p[2] < Math.min(a[2], b[2]) - halfZ - 2 || p[2] > Math.max(a[2], b[2]) + halfZ + 2)) continue;
      obstacles.push(p);
    }
    const nearby = flat ? occupied.filter(s =>
      s.line >= Math.min(a[2-s.axis], b[2-s.axis]) - (s.axis ? halfX : halfZ) - 3 &&
      s.line <= Math.max(a[2-s.axis], b[2-s.axis]) + (s.axis ? halfX : halfZ) + 3 &&
      s.hi >= Math.min(a[s.axis], b[s.axis]) - (s.axis ? halfZ : halfX) - 3 &&
      s.lo <= Math.max(a[s.axis], b[s.axis]) + (s.axis ? halfZ : halfX) + 3) : [];
    const path = routeBetween(a, b, lane, obstacles, halfX, halfZ, flat ? 0.08 : 0.26, nearby, gap, link, comparison);
    routes.set(link.id, path);
    if (flat) for (let j = 1; j < path.length; j++) {
      occupied.push(segment(path[j - 1], path[j], link, j, path.length));
    }
  });
  const arrowPositions = new Map();
  if (flat) for (const [id, path] of routes) {
    arrowPositions.set(id, chooseArrow(path, id, occupied, centers, halfX, halfZ, gap));
  }
  return { floors, point, routes, arrowPositions, unitsPerPixel };
}

function segment(a, b, link, index, count) {
  const axis = a[0] === b[0] ? 2 : 0;
  return { axis, line: a[2-axis], lo: Math.min(a[axis], b[axis]), hi: Math.max(a[axis], b[axis]),
    sign: Math.sign(b[axis] - a[axis]), id: link.id,
    from: index === 1 ? link.from : null, to: index === count - 1 ? link.to : null };
}

function overlapCost(s, occupied, gap, sharedLength) {
  let cost = 0;
  for (const other of occupied) {
    const distance = Math.abs(other.line - s.line);
    if (s.axis !== other.axis || distance >= gap) continue;
    let overlap = Math.min(s.hi, other.hi) - Math.max(s.lo, other.lo);
    if (s.sign === other.sign && ((s.from && s.from === other.from) || (s.to && s.to === other.to))) {
      overlap -= sharedLength;
    }
    cost += 8 * Math.max(0, overlap) * (1 - distance / gap);
  }
  return cost;
}

// Prefer a clear portion of the downstream leg, away from crossings and cards.
function chooseArrow(path, id, occupied, centers, halfX, halfZ, gap) {
  let best, bestScore = -Infinity;
  for (let i = path.length - 2; i >= 0; i--) {
    const a = path[i], b = path[i + 1];
    const length = Math.hypot(a[0] - b[0], a[2] - b[2]);
    for (const fraction of [0.5, 0.65, 0.35, 0.8, 0.2]) {
      const p = [a[0] + fraction * (b[0] - a[0]), 0, a[2] + fraction * (b[2] - a[2])];
      let clearance = Math.min(length * Math.min(fraction, 1 - fraction), gap * 1.5);
      for (const c of centers.values()) {
        clearance = Math.min(clearance, Math.max(Math.abs(c[0]-p[0])-halfX, Math.abs(c[2]-p[2])-halfZ));
      }
      for (const s of occupied) {
        if (s.id === id) continue;
        clearance = Math.min(clearance, Math.hypot(p[2-s.axis] - s.line,
          Math.max(0, s.lo - p[s.axis], p[s.axis] - s.hi)));
      }
      if (clearance > bestScore) { bestScore = clearance; best = { segment: i, fraction }; }
      if (clearance >= gap * 1.5) return best;
    }
  }
  return best;
}

function routeBetween(a, b, lane, obstacles, halfX, halfZ, rise, occupied, gap, link, comparison) {
  const [ax, ay, az] = a, [bx, by, bz] = b;
  if (ax === bx && az === bz && ay === by) {
    const x = ax + halfX + 0.85 + Math.abs(lane), z = az - halfZ - 0.9 - lane;
    return [[ax, az], [x, az], [x, z], [ax, z], [ax, az]].map(([px, pz]) => [px, ay + rise, pz]);
  }
  const xTracks = new Set([(ax + bx) / 2 + lane]), zTracks = new Set([(az + bz) / 2 + lane]);
  for (const [x,, z] of [a, b, ...obstacles]) {
    xTracks.add(x - halfX - 0.35 + lane); xTracks.add(x + halfX + 0.35 + lane);
    zTracks.add(z - halfZ - 0.35 + lane); zTracks.add(z + halfZ + 0.35 + lane);
  }
  const start = [ax, ay + rise, az], end = [bx, by + rise, bz];
  for (const s of occupied) {
    const tracks = s.axis === 0 ? zTracks : xTracks;
    tracks.add(s.line - gap); tracks.add(s.line + gap);
  }
  let best, bestScore = Infinity;
  function consider(p, q) {
    scorePath(start, p, q, end, 0);
    // Use a second attachment point on the card when a corridor would
    // otherwise meet another arrow head-on at the same port.
    if (!occupied.length) return;
    const axis = p[0] === q[0] ? 2 : 0;
    if (p[axis] === q[axis] || (p[2-axis] === start[2-axis] && q[2-axis] === end[2-axis])) return;
    const shift = (point, delta) => point.map((v, i) => i === axis ? v + delta : v);
    for (const offset of [-gap, gap]) {
      scorePath(shift(start, offset), shift(p, offset), shift(q, offset), shift(end, offset), gap * 0.25);
    }
  }
  function scorePath(first, p, q, last, portCost) {
    const path = [first, p];
    if (ay !== by) path.push([p[0], by + rise, p[2]]);
    path.push(q, last);
    evaluate(path, portCost);
  }
  function evaluate(path, portCost) {
    const points = path.filter((v, i) => !i || v.some((n, k) => n !== path[i - 1][k]));
    let score = portCost;
    for (let i = 1; i < points.length; i++) {
      const [x, y, z] = points[i - 1], [u, v, w] = points[i];
      score += Math.abs(x-u) + Math.abs(y-v) + Math.abs(z-w) + 0.035;
      if (occupied.length) {
        const s = segment(points[i - 1], points[i], link, i, points.length);
        score += overlapCost(s, occupied, gap, (s.axis === 0 ? halfX : halfZ) + gap);
      }
      if (score >= bestScore) return;
      for (const [cx, cy, cz] of obstacles) {
        if (cy + rise < Math.min(y, v) - 0.01 || cy + rise > Math.max(y, v) + 0.01) continue;
        if (Math.max(x,u) > cx-halfX && Math.min(x,u) < cx+halfX &&
            Math.max(z,w) > cz-halfZ && Math.min(z,w) < cz+halfZ) score += 10000;
      }
    }
    if (score < bestScore) { best = points; bestScore = score; }
  }
  // Parallel links need distinct corridors, even when endpoints share an axis.
  if (az !== bz || !lane) for (const x of xTracks) consider([x, start[1], az], [x, end[1], bz]);
  if (ax !== bx || !lane) for (const z of zTracks) consider([ax, start[1], z], [bx, end[1], z]);
  if (comparison && bestScore >= 10000) {
    for (const x of xTracks) for (const z of zTracks) {
      evaluate([start, [x, start[1], az], [x, start[1], z], [bx, end[1], z], end], 0);
      evaluate([start, [ax, start[1], z], [x, start[1], z], [x, end[1], bz], end], 0);
    }
  }
  if (!best) consider([ax + 0.9 + lane, start[1], az], [ax + 0.9 + lane, end[1], bz]);
  // A straight path has one exposed gap between cards. Leaving a synthetic
  // midpoint would put the arrow halfway along its last leg, under the card.
  return best.filter((p, i) => {
    if (!i || i === best.length - 1) return true;
    const prev = best[i - 1], next = best[i + 1];
    return p.some((n, axis) => Math.sign(n - prev[axis]) !== Math.sign(next[axis] - n));
  });
}
