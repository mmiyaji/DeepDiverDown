// 画面上の矩形を格子に分け、近くのラベルだけ重なりを調べる。
export class RectIndex {
  constructor(cellSize = 96) { this.cellSize = cellSize; this.cells = new Map(); }
  keys(rect, gap = 0) {
    const size = this.cellSize, keys = [];
    for (let x = Math.floor((rect.left - gap) / size); x <= Math.floor((rect.right + gap) / size); x++)
      for (let y = Math.floor((rect.top - gap) / size); y <= Math.floor((rect.bottom + gap) / size); y++) keys.push(`${x},${y}`);
    return keys;
  }
  add(rect) {
    for (const key of this.keys(rect)) {
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(rect);
    }
  }
  overlaps(rect, gap = 0) {
    for (const key of this.keys(rect, gap)) for (const r of this.cells.get(key) || [])
      if (r.left < rect.right + gap && r.right + gap > rect.left && r.top < rect.bottom + gap && r.bottom + gap > rect.top) return true;
    return false;
  }
}
