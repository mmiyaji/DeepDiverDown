/* Three.js による 3D 描画：正射影カメラ + OrbitControls（回転・拡大縮小・移動）+ CSS2D ラベル */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SHAPE_OVERRIDES, nodeGlyph } from './node-kinds.js';
import { minimapViewport } from './minimap-viewport.js';

const LABEL_PRIORITY = new Map(['n-lbl', 'n-badge', 'g-lbl', 't-lbl', 'abbr', 'n-sub'].map((name, index) => [name, index]));
const LABEL_GAP = 2;
const overlaps = (a, b, gap = 0) => a.left < b.right + gap && a.right + gap > b.left &&
  a.top < b.bottom + gap && a.bottom + gap > b.top;

const VIEWS = { iso: [0.6, 0.83, 1.4], top: [0, 1, 0.0001], side: [0.05, 0.35, 1], back: [-1, 1.05, -1] };

export class Scene3D {
  constructor(el, { onPick, onDrill, onPickEdge } = {}) {
    this.el = el; this.onPick = onPick; this.onDrill = onDrill;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); // PNG 書き出しのため保持
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1' });
    el.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-4, 10, 6); this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(6, 3, -4); this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 0.35)); // 上面を明るく、側面を少し落として立体感を出す

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.12, screenSpacePanning: true, minZoom: 0.3, maxZoom: 6 });
    this.setDragMode('rotate');

    this.root = new THREE.Group(); this.lbl = new THREE.Group();
    this.scene.add(this.root, this.lbl);
    this.pick = []; this.edgePaths = []; this.packets = []; this.frustum = 10; this.fitted = false;

    this.ray = new THREE.Raycaster();
    let down = null;
    this.renderer.domElement.addEventListener('pointerdown', e => {
      down = e.isPrimary && e.button === 0 ? [e.clientX, e.clientY] : null;
    });
    this.renderer.domElement.addEventListener('pointercancel', () => { down = null; });
    this.renderer.domElement.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      down = null;
      const r = this.renderer.domElement.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera);
      const hit = this.ray.intersectObjects(this.pick, false)[0];
      if (hit) return this.onPick?.(hit.object.userData.id);
      const edge = this.pickEdge(e.pointerType === 'touch' ? 11 : 6, r.height);
      if (edge != null) onPickEdge?.(edge);
      else this.onPick?.(null);
    });
    this.renderer.domElement.addEventListener('dblclick', e => {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera);
      const hit = this.ray.intersectObjects(this.pick, false)[0];
      if (hit) this.onDrill?.(hit.object.userData.id);
    });
    /* ホバー：部品の上ではカーソルを変え、その部品のラベルを優先して表示する */
    let hoverQueued = null;
    this.renderer.domElement.addEventListener('pointermove', e => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) down = null;
      if (e.buttons) return;
      hoverQueued = e;
      requestAnimationFrame(() => {
        if (!hoverQueued) return;
        const ev = hoverQueued; hoverQueued = null;
        const r = this.renderer.domElement.getBoundingClientRect();
        this.ray.setFromCamera(new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1), this.camera);
        const id = this.ray.intersectObjects(this.pick, false)[0]?.object.userData.id ?? null;
        if (id !== this.hoverId) { this.hoverId = id; this.labelsDirty = true; }
        this.renderer.domElement.style.cursor = id || this.pickEdge(6, r.height) != null ? 'pointer' : '';
      });
    });
    this.renderer.domElement.addEventListener('pointerleave', () => { if (this.hoverId) { this.hoverId = null; this.labelsDirty = true; } });
    this.controls.addEventListener('start', () => { this.usingControls = true; });
    this.controls.addEventListener('end', () => { this.usingControls = false; });
    this.controls.addEventListener('change', () => {
      if (this.usingControls) this.fitView = null;
    });
    new ResizeObserver(() => {
      if (this.flat) this.onFlatResize?.();
      if (this.fitView && this.root.children.length) this.fit(this.fitView);
      else this.resize();
    }).observe(el);
    this.resize();
    this.labelProjection = new THREE.Matrix4();
    this.lastLabelProjection = new THREE.Matrix4();
    document.fonts.ready.then(() => { this.labelsDirty = true; });
    const clock = new THREE.Clock();
    this.speed = 1; this.phase = 0;
    this.renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      this.phase += dt * 1.6 * this.speed;
      for (const p of this.packets) p.meshes.forEach((m, i) => m.position.copy(at(p, (this.phase / p.len + i / p.meshes.length) % 1)));
      if (this.anim) { // 視点のなめらかな移動
        const a = this.anim, k = Math.min(1, (performance.now() - a.t0) / 450), e = 1 - (1 - k) ** 3;
        const tgt = a.from.clone().lerp(a.to, e), d = tgt.clone().sub(this.controls.target);
        this.controls.target.copy(tgt); this.camera.position.add(d);
        this.camera.zoom = a.z0 + (a.z1 - a.z0) * e; this.camera.updateProjectionMatrix();
        if (k >= 1) this.anim = null;
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
      this.renderMinimap();
      // ラベルの重なりは 2D・3D とも解消する（3D は動かしている間の負荷を抑えて間引く）
      this.labelProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      const moved = !this.labelProjection.equals(this.lastLabelProjection), now = performance.now();
      if (this.labelsDirty || (moved && (this.flat || now - (this.lastPlace || 0) > 120))) {
        this.placeLabels();
        if (this.revealComparisonNode) {
          const card = [...this.labels.domElement.children].find(el =>
            el.classList.contains('n-card') && el.dataset.node === this.revealComparisonNode);
          if (card) {
            const viewport = this.el.parentElement, r = card.getBoundingClientRect(), v = viewport.getBoundingClientRect();
            if (r.left < v.left || r.right > v.left + viewport.clientWidth || r.top < v.top || r.bottom > v.top + viewport.clientHeight)
              viewport.scrollBy((r.left + r.right) / 2 - v.left - viewport.clientWidth / 2,
                (r.top + r.bottom) / 2 - v.top - viewport.clientHeight / 2);
          }
          this.revealComparisonNode = null;
        }
        if (this.labelFocus) {
          const { node, action } = this.labelFocus;
          const label = Array.from(this.labels.domElement.children).find(el =>
            el.dataset.node === node && el.dataset.action === action);
          if (document.activeElement === document.body && label?.style.visibility !== 'hidden') {
            label?.focus({ preventScroll: true });
          }
          this.labelFocus = null;
        }
        this.lastLabelProjection.copy(this.labelProjection);
        this.labelsDirty = false; this.lastPlace = now;
      }
    });
  }

  /* ミニマップ：右下に真上からの全体図。クリックでその場所へ視点を移す */
  setMinimap(on) {
    this.miniOn = on;
    this.labelsDirty = true;
    if (!this.miniEl) {
      this.miniEl = document.createElement('button');
      this.miniEl.className = 'minimap'; this.miniEl.type = 'button';
      this.miniEl.title = '全体図：クリックした場所へ移動';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      this.miniViewport = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      svg.appendChild(this.miniViewport); this.miniEl.appendChild(svg);
      this.miniEl.addEventListener('click', e => {
        const b = this.miniBounds; if (!b) return;
        const r = this.miniEl.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        this.focusOn([b.cx - b.hw + fx * b.hw * 2, this.controls.target.y, b.cz - b.hh + fy * b.hh * 2], this.camera.zoom);
      });
      this.el.appendChild(this.miniEl);
    }
    this.miniEl.hidden = !on;
  }
  updateMinimapCamera() {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), aspect = 180 / 130;
    let hw = s.x / 2 + 0.8, hh = s.z / 2 + 0.8;
    if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
    this.miniCam = this.miniCam || new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
    Object.assign(this.miniCam, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.miniCam.up.set(0, 0, -1); // 画面の上 = 奥（-z）
    this.miniCam.position.set(c.x, box.max.y + 50, c.z); this.miniCam.lookAt(c.x, 0, c.z);
    this.miniCam.updateProjectionMatrix();
    this.miniBounds = { cx: c.x, cz: c.z, hw, hh };
  }
  renderMinimap() {
    if (!this.miniOn || !this.miniCam || this.el.clientWidth < 520 || (this.flat && this.fitView && this.miniCoversOverview)) {
      if (this.miniEl) this.miniEl.style.visibility = 'hidden';
      return;
    }
    this.miniEl.style.visibility = '';
    const frame = this.el.getBoundingClientRect();
    const parent = this.el.parentElement;
    const scrolling = parent?.classList.contains('compare-viewport');
    const clip = scrolling ? parent.getBoundingClientRect() : frame;
    const left = Math.max(frame.left, clip.left), right = Math.min(frame.right, scrolling ? clip.left + parent.clientWidth : clip.right);
    const top = Math.max(frame.top, clip.top), bottom = Math.min(frame.bottom, scrolling ? clip.top + parent.clientHeight : clip.bottom);
    const visible = { left: (left - frame.left) / frame.width * 2 - 1, right: (right - frame.left) / frame.width * 2 - 1,
      top: 1 - (top - frame.top) / frame.height * 2, bottom: 1 - (bottom - frame.top) / frame.height * 2 };
    const points = right > left && bottom > top ? minimapViewport(this.camera, this.controls.target.y, this.miniBounds, visible) : null;
    this.miniViewport.setAttribute('points', points ? points.map(([x, y]) => `${x},${y}`).join(' ') : '');
    const r = this.renderer, W = this.el.clientWidth, w = 180, h = 130, x = W - w - 12, y = 12;
    r.autoClear = false; r.setScissorTest(true); r.setScissor(x, y, w, h); r.setViewport(x, y, w, h);
    r.setClearColor(this.color('--card'), 0.94); r.clear();
    r.render(this.scene, this.miniCam);
    r.setScissorTest(false); r.setViewport(0, 0, W, this.el.clientHeight); r.setClearColor(0x000000, 0); r.autoClear = true;
  }

  /* 2D では画面上のラベルを測り、優先順に重なりのないものを表示する */
  placeLabels(layer = this.labels.domElement, camera = this.camera) {
    const frame = layer.getBoundingClientRect();
    const elements = Array.from(layer.children).filter(el => el.style.display !== 'none');
    const cards = new Map(elements.filter(el => el.classList.contains('n-card')).map(el => [el.dataset.node, el]));
    const cardCenters = [...cards.values()].map(el => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    for (const card of cardCenters) {
      const pixelsPerUnit = frame.height * camera.zoom / (camera.top - camera.bottom);
      const span = Number(card.el.dataset.floorSpan);
      let space = Number.isFinite(span) ? Math.min(frame.width, span * pixelsPerUnit - 8) : frame.width;
      for (const other of cardCenters) {
        if (other === card || Math.abs(card.y - other.y) > 26) continue;
        space = Math.min(space, Math.abs(card.x - other.x) - 22);
      }
      card.el.style.setProperty('--card-room', Math.max(38, space) + 'px');
    }
    // Keep the card anchored to its ports. A solid's name may move a
    // short distance vertically, leaving room for a nearby name or plate.
    for (const el of elements) if (el.dataset.labelOffset) {
      el.style.translate = ''; delete el.dataset.labelOffset;
    }
    const badgeOffsets = elements.filter(el => el.dataset.cardBadge).map(el =>
      [el, -(cards.get(el.dataset.node)?.offsetHeight || 0) / 2 - 4]);
    for (const [el, offset] of badgeOffsets) el.style.marginTop = offset + 'px';
    const labels = elements.map(el => ({
      el,
      rect: el.getBoundingClientRect(),
      priority: el === layer.ownerDocument.activeElement ? -3 : el.dataset.selected ? -2 :
        (this.hoverId && el.dataset.node === this.hoverId) ? -1.7 : el.dataset.outlined ? -1.5 :
          this.comparisonScale && el.classList.contains('n-card') ? -1 :
          el.classList.contains('g-parallel') ? -0.8 : el.dataset.icon ? -0.5 : LABEL_PRIORITY.get(el.classList[0]),
    }));
    labels.sort((a, b) => a.priority - b.priority);
    const occupied = [];
    if (layer === this.labels.domElement && this.miniOn && this.miniEl && !this.miniEl.hidden && this.miniEl.style.visibility !== 'hidden')
      occupied.push(this.miniEl.getBoundingClientRect());
    for (const { el, rect } of labels) {
      const groupLabel = el.classList.contains('g-cloud');
      const floorLabel = el.classList.contains('t-lbl');
      const movable = el.classList.contains('n-3d') || floorLabel;
      const offsets = groupLabel ? [0, -rect.height - 3, rect.height + 3, -rect.height * 2 - 6, rect.height * 2 + 6]
        : movable ? [0, rect.height + 3, -rect.height - 3, rect.height * 2 + 4] : [0];
      let placed = false;
      const horizontalOffsets = groupLabel || floorLabel ? [0, rect.width / 2, -rect.width / 2, rect.width, -rect.width] : [0];
      if (overlaps(rect, frame)) for (const [dx, dy] of horizontalOffsets.flatMap(dx => offsets.map(dy => [dx, dy]))) {
        const candidate = { left: rect.left + dx, right: rect.right + dx, top: rect.top + dy, bottom: rect.bottom + dy };
        if (((groupLabel || floorLabel) && (candidate.left < frame.left || candidate.right > frame.right)) || candidate.bottom < frame.top ||
            candidate.top > frame.bottom || occupied.some(r => overlaps(r, candidate, LABEL_GAP))) continue;
        if (dx || dy) {
          el.style.translate = dx + 'px ' + dy + 'px';
          el.style.setProperty('--leader-length', Math.abs(dy) + 'px');
          el.dataset.labelOffset = String(dy);
        }
        occupied.push(candidate);
        placed = true;
        break;
      }
      el.style.visibility = placed ? '' : 'hidden';
    }
  }

  /* 左ドラッグ（1 本指）の役割を切り替える。右ドラッグ（2 本指）は常にもう一方 */
  setDragMode(mode) {
    this.dragMode = mode;
    const rot = mode === 'rotate';
    this.controls.mouseButtons = { LEFT: rot ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: rot || !this.controls.enableRotate ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: rot ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN, TWO: rot || !this.controls.enableRotate ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE };
    this.el.dataset.drag = mode;
  }

  /* 指定した位置を画面中央へ（なめらかに）。zoom は倍率 */
  focusOn(pos, zoom = Math.max(this.camera.zoom, 1.8)) {
    this.fitView = null;
    this.anim = { from: this.controls.target.clone(), to: new THREE.Vector3(...pos), z0: this.camera.zoom, z1: zoom, t0: performance.now() };
  }
  /* 部品の中心位置（ワールド座標）。ドリルダウンのズーム演出に使う */
  nodePos(id) {
    const m = this.pick.find(p => p.userData.id === id); if (!m) return null;
    const v = new THREE.Vector3(); m.getWorldPosition(v); return v.toArray();
  }
  /* 部品の画面上の位置（0〜1）。CSS のズーム演出の基点に使う */
  nodeScreen(id) {
    const p = this.nodePos(id); if (!p) return null;
    const v = new THREE.Vector3(...p).project(this.camera);
    return [(v.x + 1) / 2, (1 - v.y) / 2];
  }
  /* 共有リンク用：視点の保存と復元 */
  getView() {
    const r = v => v.toArray().map(x => +x.toFixed(2));
    return { p: r(this.camera.position), t: r(this.controls.target), z: +this.camera.zoom.toFixed(2) };
  }
  setView(v) {
    if (!v?.p || !v?.t) return;
    this.fitView = null;
    this.camera.position.fromArray(v.p); this.controls.target.fromArray(v.t);
    if (!this.controls.enableRotate) {
      this.camera.position.copy(this.controls.target).addScaledVector(new THREE.Vector3(...VIEWS.top).normalize(), 100);
    }
    this.camera.zoom = v.z || 1; this.camera.lookAt(this.controls.target); this.camera.updateProjectionMatrix(); this.fitted = true;
  }

  fullSvgLayout() {
    const bounds = new THREE.Box3().setFromObject(this.root);
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const pixelsPerUnit = 96;
    const width = Math.ceil(size.x * pixelsPerUnit) + 320;
    const height = Math.ceil(size.z * pixelsPerUnit) + 128;
    const halfWidth = width / (2 * pixelsPerUnit), halfHeight = height / (2 * pixelsPerUnit);
    const camera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 200);
    camera.up.set(0, 0, -1);
    camera.position.copy(center).y += 100;
    camera.lookAt(center);
    camera.updateMatrixWorld();
    return { width, height, camera };
  }

  *fullSvgLabels(camera, width, height) {
    // 書き出し用の領域で DOM ラベルを測り、画面のカメラとラベルには触れない。
    const renderer = new CSS2DRenderer();
    const layer = renderer.domElement;
    Object.assign(layer.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
    layer.setAttribute('aria-hidden', 'true');
    renderer.setSize(width, height);
    const labels = new THREE.Scene();
    labels.add(this.lbl.clone());
    document.body.append(layer);
    try {
      renderer.render(labels, camera);
      this.placeLabels(layer, camera);
      yield* this.exportLabels(layer);
    } finally {
      layer.remove();
    }
  }

  async snapshotSvg(bg, title, { full = false } = {}) {
    const { SVGRenderer } = await import('three/addons/renderers/SVGRenderer.js');
    const { width, height, camera } = full ? this.fullSvgLayout()
      : { width: this.el.clientWidth, height: this.el.clientHeight, camera: this.camera };
    const labels = full ? this.fullSvgLabels(camera, width, height) : this.exportLabels();
    const renderer = new SVGRenderer();
    renderer.setSize(width, height);
    renderer.setPrecision(2);
    camera.updateMatrixWorld();
    const exportScene = new THREE.Scene();
    exportScene.add(this.root.clone());
    // SVGRenderer は WebGL と光量の扱いが異なるため、書き出し用のライトを調整する。
    for (const light of this.scene.children.filter(child => child.isLight)) {
      const copy = light.clone();
      if (copy.isAmbientLight) copy.color.multiplyScalar(0.62);
      else copy.intensity *= 0.32;
      exportScene.add(copy);
    }
    renderer.render(exportScene, camera);
    const svg = renderer.domElement;
    const pixelsPerUnit = height * camera.zoom / (camera.top - camera.bottom);
    for (const path of svg.querySelectorAll('path')) {
      const dash = path.style.strokeDasharray;
      if (dash) path.style.strokeDasharray = dash.split(/[ ,]+/).map(n => Math.max(1, parseFloat(n) * pixelsPerUnit)).join(' ');
    }
    svg.removeAttribute('style');
    svg.setAttribute('overflow', 'hidden');
    const element = (tag, attributes, parent = svg) => {
      const node = document.createElementNS(svg.namespaceURI, tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      parent.appendChild(node);
      return node;
    };
    const background = element('rect', { x: -width / 2, y: -height / 2, width, height, fill: bg });
    svg.prepend(background);
    const heading = element('title', {});
    heading.textContent = title;
    svg.prepend(heading);
    const overlay = element('g', { transform: `translate(${-width / 2} ${-height / 2})` });
    for (const { x, y, width, height, style, img, text } of labels) {
      const group = element('g', { opacity: style.opacity }, overlay);
      if (img) {
        const icon = document.createElement('canvas');
        icon.width = Math.ceil(width * 2); icon.height = Math.ceil(height * 2);
        icon.getContext('2d').drawImage(img, 0, 0, icon.width, icon.height);
        element('image', { x, y, width, height, href: icon.toDataURL() }, group);
        continue;
      }
      const border = parseFloat(style.borderTopWidth);
      if (border || style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        element('rect', { x, y, width, height, fill: style.backgroundColor,
          stroke: border ? style.borderTopColor : 'none', 'stroke-width': border,
          rx: parseFloat(style.borderTopLeftRadius) || 0,
          ...(style.borderTopStyle === 'dashed' ? { 'stroke-dasharray': '4 3' } : {}) }, group);
      }
      if (!text) continue;
      element('text', { x: x + width / 2, y: y + height / 2, fill: style.color,
        'font-family': style.fontFamily, 'font-size': style.fontSize, 'font-weight': style.fontWeight,
        'text-anchor': 'middle', 'dominant-baseline': 'central' }, group).textContent = text;
    }
    return new XMLSerializer().serializeToString(svg);
  }

  *exportLabels(layer = this.labels.domElement) {
    const base = layer.getBoundingClientRect();
    for (const el of layer.children) {
      if (el.style.display === 'none' || el.style.visibility === 'hidden') continue;
      if (el.dataset.labelOffset) {
        const r = el.getBoundingClientRect(), offset = Number(el.dataset.labelOffset);
        yield { x: r.left + r.width / 2 - base.left, y: (offset > 0 ? r.top - offset : r.bottom) - base.top,
          width: 1, height: Math.abs(offset), text: '',
          style: { backgroundColor: getComputedStyle(el, '::before').backgroundColor, opacity: getComputedStyle(el).opacity, borderTopWidth: '0' } };
      }
      const image = el.querySelector('img'), img = image?.complete && image.naturalWidth ? image : null;
      if (el.classList.contains('n-render-parts')) {
        const r = el.getBoundingClientRect();
        if (r.right < base.left || r.left > base.right || r.bottom < base.top || r.top > base.bottom) continue;
        yield* this.exportCard(el, base);
        continue;
      }
      if (!img && !el.textContent) continue;
      const r = (img || el).getBoundingClientRect();
      if (r.right < base.left || r.left > base.right || r.bottom < base.top || r.top > base.bottom) continue;
      // CSS の object-fit: contain と同じ縦横比で書き出す。
      const scale = img ? Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight) : 1;
      const width = img ? img.naturalWidth * scale : r.width;
      const height = img ? img.naturalHeight * scale : r.height;
      yield { x: r.left - base.left + (r.width - width) / 2,
        y: r.top - base.top + (r.height - height) / 2, width, height,
        style: getComputedStyle(el), img, text: el.textContent };
    }
  }

  *exportCard(card, base) {
    const opacity = getComputedStyle(card).opacity;
    const bounds = (rect, style, extra = {}) => ({
      x: rect.left - base.left, y: rect.top - base.top, width: rect.width, height: rect.height, style, ...extra,
    });
    yield bounds(card.getBoundingClientRect(), getComputedStyle(card), { text: '' });
    for (const part of card.children) {
      const style = getComputedStyle(part);
      const ink = { opacity, color: style.color, fontFamily: style.fontFamily, fontSize: style.fontSize,
        fontWeight: style.fontWeight, borderTopWidth: style.borderTopWidth, borderTopColor: style.borderTopColor,
        borderTopStyle: style.borderTopStyle, borderTopLeftRadius: style.borderTopLeftRadius, backgroundColor: style.backgroundColor };
      const img = part.querySelector('img');
      if (img?.complete && img.naturalWidth) {
        const rect = img.getBoundingClientRect(), scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
        const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
        yield bounds({ left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height }, ink, { img });
        continue;
      }
      const text = part.firstChild;
      if (!text?.length) continue;
      if (parseFloat(style.borderTopWidth) || style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        yield bounds(part.getBoundingClientRect(), ink, { text: text.data });
        continue;
      }
      const range = document.createRange(), lines = new Map();
      let offset = 0;
      for (const character of text.data) {
        range.setStart(text, offset);
        offset += character.length;
        range.setEnd(text, offset);
        const rect = range.getBoundingClientRect(), line = lines.get(rect.top);
        if (line) {
          line.text += character;
          line.width = rect.right - base.left - line.x;
        } else lines.set(rect.top, bounds(rect, ink, { text: character }));
      }
      yield* lines.values();
    }
  }

  /* PNG 書き出し：WebGL の画像に HTML ラベルを重ねて 1 枚にする */
  snapshot(bg) {
    const src = this.renderer.domElement, dpr = src.width / src.clientWidth, c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0);
    g.scale(dpr, dpr); g.textBaseline = 'middle';
    for (const { x, y, width, height, style, img, text } of this.exportLabels()) {
      g.globalAlpha = Number(style.opacity);
      if (img) { g.drawImage(img, x, y, width, height); continue; }
      if (style.backgroundColor !== 'rgba(0, 0, 0, 0)') { g.fillStyle = style.backgroundColor; g.fillRect(x, y, width, height); }
      if (parseFloat(style.borderTopWidth)) {
        g.strokeStyle = style.borderTopColor; g.lineWidth = parseFloat(style.borderTopWidth);
        g.setLineDash(style.borderTopStyle === 'dashed' ? [4, 3] : []);
        g.strokeRect(x + .5, y + .5, width - 1, height - 1);
      }
      if (!text) continue;
      g.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`; g.fillStyle = style.color; g.textAlign = 'center';
      g.fillText(text, x + width / 2, y + height / 2 + 0.5);
    }
    return c;
  }

  /* ---------- 基本 ---------- */
  css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'; }
  color(c) { return new THREE.Color(c.startsWith('--') ? this.css(c) : c); }
  mix(a, b, p) { return this.color(b).lerp(this.color(a), p); } // b に a を p の割合で混ぜる

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight || 1, a = w / h;
    this.labelsDirty = true;
    this.renderer.setSize(w, h); this.labels.setSize(w, h);
    Object.assign(this.camera, { left: -this.frustum * a, right: this.frustum * a, top: this.frustum, bottom: -this.frustum });
    this.camera.updateProjectionMatrix();
  }

  begin() {
    this.floorBounds = new Map();
    const active = document.activeElement;
    if (this.labels.domElement.contains(active) && active.dataset.action) this.labelFocus = active.dataset;
    this.root.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); });
    this.root.clear(); this.lbl.clear(); this.pick = []; this.edgePaths = []; this.packets = [];
  }
  end(flat) {
    this.flat = flat;
    this.labelsDirty = true;
    if (!this.fitted || (flat && this.fitView)) { this.fit(flat ? 'top' : this.initialView || 'iso'); this.fitted = true; }
    this.updateMinimapCamera();
  }

  fit(view = 'iso') {
    this.anim = null;
    const box = new THREE.Box3().setFromObject(this.root), c = box.getCenter(new THREE.Vector3());
    if (box.isEmpty()) return;
    this.fitView = view;
    const d = new THREE.Vector3(...VIEWS[view]).normalize();
    this.camera.position.copy(c).addScaledVector(d, 100);
    this.camera.zoom = 1; this.controls.target.copy(c); this.camera.lookAt(c); this.camera.updateMatrixWorld();
    // Project each occupied part separately. An empty corner between two
    // offset floors should not force the entire drawing to shrink.
    this.root.updateMatrixWorld(true);
    const inv = this.camera.matrixWorldInverse;
    const bounds = new THREE.Box2(), projected = new THREE.Vector3(), matrix = new THREE.Matrix4();
    this.root.traverse(object => {
      const geometry = object.geometry;
      if (!geometry) return;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (!box || box.isEmpty()) return;
      matrix.multiplyMatrices(inv, object.matrixWorld);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        projected.set(x, y, z).applyMatrix4(matrix);
        bounds.expandByPoint(projected);
      }
    });
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector2());
    const shift = new THREE.Vector3(center.x, center.y, 0).applyQuaternion(this.camera.quaternion);
    this.camera.position.add(shift); this.controls.target.add(shift);
    const size = bounds.getSize(new THREE.Vector2());
    if (this.comparisonScale) {
      // Give routes that run outside their floor the same margin as cards.
      this.el.style.minWidth = Math.ceil(size.x / this.comparisonScale + 40) + 'px';
      this.el.style.minHeight = Math.ceil(size.y / this.comparisonScale + 44) + 'px';
    }
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    const insetX = Math.min(w * 0.09, this.flat ? 20 : 56), insetY = Math.min(h * 0.12, this.flat ? 22 : 46);
    this.frustum = Math.max(size.y * h / (h - 2 * insetY), size.x * h / (w - 2 * insetX), 1) / 2;
    const px = h / (2 * this.frustum);
    this.miniCoversOverview = (w - size.x * px) / 2 < 192 && (h - size.y * px) / 2 < 142;
    this.resize();
  }

  label(text, pos, cls, anchor = [0.5, 0.5], style = {}, interactive = false) {
    const div = document.createElement(interactive ? 'button' : 'div'); div.className = cls; div.textContent = text; Object.assign(div.style, style);
    if (interactive) div.type = 'button';
    const o = new CSS2DObject(div); o.position.set(...pos); o.center.set(...anchor); this.lbl.add(o); return div;
  }
  edges(geo, color, opacity = 1, dashed = false) {
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08, transparent: opacity < 1, opacity })
      : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), m); if (dashed) l.computeLineDistances(); return l;
  }

  /* ---------- フロア・グループ ---------- */
  floor({ id, style, insetLabel, x0, z0, x1, z1, y, origin, label }) {
    if (insetLabel) this.floorBounds.set(id, { x0, x1 });
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (!origin) {
      const geo = new THREE.BoxGeometry(w, 0.06, d);
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
        color: this.color('--plate'), emissive: this.color('--plate'), emissiveIntensity: 0.45, // 床は暗くしすぎない
        transparent: true, opacity: style === 'flow' ? 0.5 : 0.72,
      }));
      mesh.position.set(cx, y - 0.03, cz); this.root.add(mesh);
      mesh.add(this.edges(geo, this.color('--line')));
      const pts = [];
      for (let x = Math.ceil(x0); x <= x1; x++) pts.push(x, y + 0.002, z0, x, y + 0.002, z1);
      for (let z = Math.ceil(z0); z <= z1; z++) pts.push(x0, y + 0.002, z, x1, y + 0.002, z);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        color: this.color('--grid'), transparent: true, opacity: style === 'flow' ? 0.45 : 0.55,
      })));
    } else this.loop([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, '--mute', 'dash');
    const corner = [x0 + 0.14, y, z0 + 0.1];
    this.label(label, corner, style ? 't-lbl t-3d' : 't-lbl', [0, 0],
      { marginLeft: '4px', marginTop: insetLabel ? '3px' : '-19px' });
  }
  loop(pts, y, color, style, fill) {
    const v = [...pts, pts[0]].map(([x, z]) => new THREE.Vector3(x, y + 0.01, z));
    const geo = new THREE.BufferGeometry().setFromPoints(v);
    if (style === 'dashdot') {
      const segments = [], pattern = [0.28, 0.1, 0.05, 0.1];
      for (let i = 1; i < v.length; i++) {
        const a = v[i - 1], b = v[i], length = a.distanceTo(b);
        for (let offset = 0, part = 0; offset < length; part++) {
          const end = Math.min(length, offset + pattern[part % pattern.length]);
          if (part % 2 === 0) segments.push(a.clone().lerp(b, offset / length), a.clone().lerp(b, end / length));
          offset = end;
        }
      }
      geo.setFromPoints(segments);
      this.root.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: this.color(color) })));
      return;
    }
    const mat = style ? new THREE.LineDashedMaterial({ color: this.color(color), dashSize: style === 'dot' ? 0.06 : 0.22, gapSize: style === 'dot' ? 0.1 : 0.12 })
      : new THREE.LineBasicMaterial({ color: this.color(color) });
    const line = new THREE.Line(geo, mat); if (style) line.computeLineDistances(); this.root.add(line);
    if (fill) {
      const [a, , c] = pts, g = new THREE.PlaneGeometry(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: this.color(fill), transparent: true, opacity: 0.7, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set((a[0] + c[0]) / 2, y + 0.005, (a[1] + c[1]) / 2); this.root.add(m);
    }
  }
  group({ pts, y, kind, label, color, brandIcon, labelY }) {
    const vpc = ['--ink', 'dash'];
    const [fallback, style, fill] = {
      vpc, vnet: vpc, vcn: vpc, az: ['--mute', 'dot'], subnet: ['--line', null, '--grid'],
      cloud: ['--mute'], region: ['--mute', 'dash'], cluster: ['#326CE5', 'dashdot'], parallel: ['--par', 'dash'],
      namespace: ['--mute', 'dot'], nodegroup: ['--mute', 'dot'], datacenter: ['#6d6a63'],
    }[kind] || ['--mute', 'dash'];
    const ink = ['cluster', 'datacenter', 'parallel'].includes(kind) ? fallback : color || fallback;
    this.loop(pts, y, ink, style, fill);
    // クラウド・データセンター・クラスタは、枠の内側を淡く塗って入れ子が分かるようにする
    const tint = { cloud: 0.07, datacenter: 0.07, cluster: 0.05, region: 0.03, parallel: 0.08 }[kind];
    if (tint) {
      const [a, , c] = pts, w = Math.abs(c[0] - a[0]), d = Math.abs(c[1] - a[1]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: this.color(ink), transparent: true, opacity: tint, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set((a[0] + c[0]) / 2, y + 0.004 + (kind === 'cluster' ? 0.002 : 0), (a[1] + c[1]) / 2); m.renderOrder = -1;
      this.root.add(m);
    }
    if (!label) return; // 複数フロアにまたがる枠は、ラベルを 1 か所だけに出す
    const [x, z] = kind === 'az' ? pts[1] : kind === 'cloud' ? pts[0] : pts[3];
    const text = this.label(label, [x, (labelY ?? y) + 0.02, z], `g-lbl g-${kind}`, kind === 'az' || kind === 'cloud' ? [0, 1] : [0, 0], { color: this.color(ink).getStyle(), borderColor: this.color(ink).getStyle() });
    if (brandIcon) {
      const icon = document.createElement('img');
      icon.className = 'group-brand-icon';
      icon.alt = '';
      icon.addEventListener('load', () => { this.labelsDirty = true; }, { once: true });
      icon.src = brandIcon;
      text.prepend(icon);
    }
  }

  // A light frame makes the provider boundary surround the full stack in 3D.
  platformEnvelope({ pts, bottom, top, color }) {
    const vertices = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], [nx, nz] = pts[(i + 1) % pts.length];
      vertices.push(x, bottom, z, x, top, z, x, top, z, nx, top, nz);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.root.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: this.color(color || '--mute'), transparent: true, opacity: 0.58 })));
  }

  /* ---------- ノード ---------- */
  node(s) {
    if (s.flatStyle === 'card') return this.nodeCard(s);
    const [x, y, z] = s.pos, g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const mat = c => new THREE.MeshLambertMaterial({ color: c, transparent: s.opacity < 1, opacity: s.opacity, depthWrite: s.opacity >= 0.5 });
    const external = s.kind === 'external';
    const edge = this.color(s.outline ? '--accent' : external ? '--diagram-external' : '--ink');
    const eo = Math.min(1, s.opacity + 0.25);
    const add = (geo, py, color = s.color, rx = 0) => {
      const m = new THREE.Mesh(geo, mat(color)); m.position.y = py; m.rotation.x = rx; m.userData.id = s.id; g.add(m); this.pick.push(m);
      const e = this.edges(geo, edge, eo, external || s.dashed); e.position.y = py; e.rotation.x = rx; g.add(e);
      if (s.outline) { const e2 = this.edges(geo, edge, 1); e2.scale.setScalar(1.04); e2.position.y = py; e2.rotation.x = rx; g.add(e2); }
    };
    const silhouette = s.flatStyle === 'silhouette';
    const customShape = silhouette || s.solidStyle === 'components' ? s.shape3D : null;
    const raised = height => silhouette ? Math.min(height, 0.16) : height;
    const box = (w, h, d, x = 0, z = 0, base = 0, color = s.color) =>
      add(new THREE.BoxGeometry(w, h, d).translate(x, 0, z), base + h / 2, color);
    const plate = (points, height) => {
      const profile = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
      const geometry = new THREE.ExtrudeGeometry(profile, { depth: height, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      add(geometry, 0);
    };
    let top = s.h;
    if (customShape === 'plug') {
      if (silhouette) g.rotation.y = Math.PI / 2;
      const metal = this.color('--paper-l');
      add(new THREE.BoxGeometry(0.86, s.h * 0.66, 0.70).translate(0, 0, -0.10), s.h * 0.33);
      add(new THREE.BoxGeometry(0.64, s.h * 0.49, 0.15).translate(0, 0, 0.31), s.h * 0.28);
      for (const px of [-0.18, 0.18]) {
        add(new THREE.BoxGeometry(0.11, s.h * 0.14, 0.34).translate(px, 0, 0.52), s.h * 0.28, metal);
      }
      top = s.h * 0.66;
    } else if (customShape === 'crate') {
      const lid = s.color.clone().lerp(this.color('--paper'), 0.26);
      add(new THREE.BoxGeometry(0.96, s.h * 0.72, 0.75), s.h * 0.36);
      add(new THREE.BoxGeometry(1.04, s.h * 0.12, 0.83), s.h * 0.75, lid);
      if (silhouette) {
        const rib = s.color;
        for (const offset of [-0.23, 0, 0.23]) {
          add(new THREE.BoxGeometry(0.065, s.h * 0.035, 0.54).translate(offset, 0, 0), s.h * 0.83, rib);
        }
      } else {
        for (const offset of [-0.29, 0, 0.29]) {
          add(new THREE.BoxGeometry(0.06, s.h * 0.52, 0.045).translate(offset, 0, 0.385), s.h * 0.36, lid);
        }
        for (const offset of [-0.22, 0, 0.22]) {
          add(new THREE.BoxGeometry(0.045, s.h * 0.52, 0.06).translate(0.49, 0, offset), s.h * 0.36, lid);
        }
      }
      top = s.h * 0.81;
    } else if (s.shape === 'catalog') {
      top = raised(s.h * 0.76);
      box(0.22, top, 0.88, -0.38);
      box(0.7, top * 0.84, 0.76, 0.09, 0, 0, this.color('--paper-l'));
      box(0.53, top * 0.13, 0.12, 0.08, -0.17, top * 0.84);
      box(0.36, top * 0.13, 0.12, 0.08, 0.12, top * 0.84);
    } else if (s.shape === 'file') {
      top = raised(s.h * 0.48);
      plate([[-0.36, -0.51], [0.12, -0.51], [0.36, -0.27], [0.36, 0.51], [-0.36, 0.51]], top);
      box(0.26, 0.035, 0.035, -0.07, -0.03, top, this.color('--ink'));
      box(0.36, 0.035, 0.035, -0.02, 0.18, top, this.color('--ink'));
      top += 0.035;
    } else if (s.shape === 'table') {
      top = raised(s.h * 0.54);
      box(1.06, top, 0.78);
      const grid = this.color('--ink');
      for (const x of [-0.17, 0.17]) box(0.025, 0.025, 0.5, x, 0.12, top, grid);
      for (const z of [-0.15, 0.1]) box(1.01, 0.025, 0.025, 0, z, top, grid);
      top += 0.025;
    } else if (s.shape === 'policy') {
      top = raised(s.h * 0.78);
      plate([[-0.46, -0.34], [0, -0.52], [0.46, -0.34], [0.42, 0.18], [0, 0.54], [-0.42, 0.18]], top);
    } else if (s.shape === 'workflow') {
      top = raised(s.h * 0.66);
      box(0.33, top, 0.34, -0.34, -0.25);
      box(0.33, top, 0.34, 0.34, 0.25);
      box(0.42, top * 0.42, 0.1, -0.05, -0.25);
      box(0.1, top * 0.42, 0.5, 0.11);
      box(0.18, top * 0.42, 0.1, 0.15, 0.25);
    } else if (s.shape === 'monitor') {
      top = raised(s.h * 0.77);
      box(1, top, 0.68, 0, -0.1);
      box(0.83, 0.025, 0.49, 0, -0.1, top, this.color('--paper-l'));
      for (const [x, d] of [[-0.24, 0.15], [0, 0.31], [0.24, 0.22]]) {
        box(0.095, 0.03, d, x, 0.07 - d / 2, top + 0.025, this.color('--ink'));
      }
      box(0.38, top * 0.24, 0.25, 0, 0.34);
      top += 0.055;
    } else if (s.solidStyle === 'components' && s.shape === 'cyl') {
      const levels = s.partitions ? Math.min(8, Number(s.partitions) || 3) : 3; // 分割数があればその数だけ段にする
      for (let level = 0; level < levels; level++) {
        const height = s.h / levels;
        add(new THREE.CylinderGeometry(0.43, 0.43, height * 0.9, 28), height * (level + 0.5));
      }
    } else if (s.solidStyle === 'components' && s.shape === 'box' && ['gateway', 'lb'].includes(s.kind)) {
      // An open portal reads as an entry point, including at low zoom.
      box(0.19, s.h, 0.62, -0.36);
      box(0.19, s.h, 0.62, 0.36);
      box(0.92, s.h * 0.22, 0.62, 0, 0, s.h * 0.78);
    } else if (s.solidStyle === 'components' && s.shape === 'box' && s.kind === 'cdn') {
      add(new THREE.CylinderGeometry(0.48, 0.52, s.h * 0.3, 6), s.h * 0.15);
      add(new THREE.SphereGeometry(0.36, 16, 12), s.h * 0.3 + 0.28);
      top = s.h * 0.3 + 0.64;
    } else if (s.solidStyle === 'components' && s.kind === 'worker' && s.shape === 'box') {
      add(new THREE.BoxGeometry(0.9, s.h * 0.7, 0.72), s.h * 0.35);
      add(new THREE.BoxGeometry(0.63, s.h * 0.24, 0.5), s.h * 0.82);
    } else if (s.shape === 'cyl') add(new THREE.CylinderGeometry(0.42, 0.42, s.h, 28), s.h / 2);
    else if (s.flatStyle === 'silhouette' && s.shape === 'queue') {
      for (let i = 0; i < 3; i++) {
        add(new THREE.BoxGeometry(0.94, 0.22, 0.23).translate(0, 0, (i - 1) * 0.31), 0.11);
      }
      top = 0.22;
    }
    else if (s.shape === 'slab') { // ファイル内の区画：薄い板に区切り線を入れる
      add(new THREE.BoxGeometry(1.5, 0.2, 0.9), 0.1);
      const tick = this.edges(new THREE.BoxGeometry(0.001, 0.2, 0.9), this.color('--ink'), 0.5);
      for (const px of [-0.4, 0, 0.4]) { const t = tick.clone(); t.position.set(px, 0.1, 0); g.add(t); }
      top = 0.2;
    }
    else if (s.shape === 'queue') { for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.92, 0.22, 0.92), 0.11 + i * 0.3); top = 0.85; }
    else if (s.shape === 'person') {
      add(new THREE.CylinderGeometry(0.16, 0.28, 0.62, 20), 0.31);
      add(new THREE.SphereGeometry(0.17, 20, 14), 0.84); top = 1.02;
    } else add(new THREE.BoxGeometry(s.w || 0.86, s.h, s.w || 0.86), s.h / 2);
    /* ---- 並列表現 ---- */
    const par = this.color('--par');
    // parallel：同じ実行単位が複数あることを、後ろに重ねた写しで示す（最大 3 枚）
    if (s.parallel && !s.flat) {
      const copies = Math.min(3, (Number(s.parallel) || 3) - 1);
      for (let i = 1; i <= copies; i++) {
        const geo = s.shape === 'cyl' ? new THREE.CylinderGeometry(0.42, 0.42, s.h, 28) : new THREE.BoxGeometry(0.86, s.h, 0.86);
        const ghost = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: s.color, transparent: true, opacity: s.opacity * (0.55 - i * 0.12), depthWrite: false }));
        ghost.position.set(-0.2 * i, s.h / 2, -0.2 * i); g.add(ghost);
        const e = this.edges(geo, par, s.opacity * (0.7 - i * 0.15)); e.position.copy(ghost.position); g.add(e);
      }
    }
    // slots：同時に走る Task を、上面に並べた小さな立方体で示す
    if (s.slots && !s.flat) {
      const n = Math.min(8, Number(s.slots) || 4), cols = Math.min(4, n), size = 0.15, gap = 0.05;
      for (let i = 0; i < n; i++) {
        const cx = (i % cols - (cols - 1) / 2) * (size + gap), cz = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * (size + gap);
        const geo = new THREE.BoxGeometry(size, size, size), cube = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: par, transparent: s.opacity < 1, opacity: s.opacity }));
        cube.position.set(cx, top + size / 2 + 0.01, cz); g.add(cube);
        const e = this.edges(geo, this.color('--ink'), s.opacity * 0.6); e.position.copy(cube.position); g.add(e);
      }
      top += 0.2;
    }
    // partitions：分割されたデータを、側面の帯（区切り線）で示す
    if (s.partitions && !s.flat && !(s.solidStyle === 'components' && s.shape === 'cyl')) {
      const n = Math.min(8, Number(s.partitions) || 4), r = s.shape === 'cyl' ? 0.425 : 0.44;
      for (let i = 1; i < n; i++) {
        const ring = s.shape === 'cyl'
          ? new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.035, 28, 1, true), new THREE.MeshBasicMaterial({ color: par, transparent: true, opacity: s.opacity * 0.9, side: THREE.DoubleSide }))
          : new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.03, 0.88), new THREE.MeshBasicMaterial({ color: par, transparent: true, opacity: s.opacity * 0.9 }));
        ring.position.y = (s.h / n) * i; g.add(ring);
      }
    }

    if (silhouette && s.shape === 'cyl' && customShape !== 'crate') {
      for (const radius of [0.31, 0.21]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.018, 32),
          new THREE.MeshBasicMaterial({ color: edge, transparent: true, opacity: s.opacity }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = top + 0.01;
        g.add(ring);
      }
    }
    if (s.solidStyle) {
      const scale = s.solidStyle === 'components' ? 1.23 : 1.12;
      g.scale.setScalar(scale);
      top *= scale;
    }
    if (s.flat) { g.scale.y = 0.25 / top; top = 0.25; }
    else if (s.opacity >= 0.3) { // 接地影：床に置かれていることが分かるように
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 * s.opacity, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.set(x + 0.08, y + 0.006, z + 0.08); shadow.scale.set(1, 0.85, 1); shadow.renderOrder = -1;
      this.root.add(shadow);
    }
    if (s.abbr) {
      const mark = this.label(s.abbr.text, [x, y + top + 0.02, z], 'abbr', [0.5, 0.5],
        { color: s.abbr.color, opacity: s.opacity < 0.5 ? 0.4 : 1 });
      if (s.icon) {
        const img = document.createElement('img');
        img.className = 'n-icon'; img.alt = s.abbr.text;
        img.addEventListener('load', () => {
          mark.replaceChildren(img);
          mark.dataset.icon = 'true';
          this.labelsDirty = true;
        }, { once: true });
        img.src = s.icon;
      }
    }
    const nameClass = s.solidStyle ? 'n-lbl n-3d n-3d-' + s.solidStyle
      : s.flatStyle === 'silhouette' ? 'n-lbl n-silhouette' : 'n-lbl';
    const name = this.label('', [x, y, z + (s.solidStyle ? 0.68 : 0.5)], nameClass + ' n-role n-render-parts', [0.5, -0.3]);
    name.dataset.node = s.id;
    if (s.selected) name.dataset.selected = 'true';
    if (s.outline) name.dataset.outlined = 'true';
    if (external) name.dataset.external = 'true';
    const symbolInk = external ? '--diagram-external' : silhouette ? (s.labelAccent ? '--card' : '--bg') : '--ink';
    name.append(this.nodeSymbol(s, symbolInk), this.nodeText(s.label));
    const managementLabel = { aws: 'AWS管理', shared: '共同管理', customer: '利用者管理' }[s.management?.type];
    if (managementLabel) {
      const badge = document.createElement('span');
      badge.className = 'n-management n-management-' + s.management.type;
      badge.textContent = managementLabel;
      badge.title = s.management.scope || managementLabel;
      name.append(badge);
    }
    if (s.flat && s.icon) name.style.marginTop = '10px';
    if (s.sub) {
      const sub = this.label(s.sub.text, [x, y, z + (s.solidStyle ? 0.68 : 0.5)], 'n-sub', [0.5, -0.3],
        { color: s.sub.color, opacity: s.opacity < 0.5 ? 0.35 : 1 });
      sub.dataset.node = s.id;
      sub.style.marginTop = s.flat ? `calc(19px * var(--lbl-scale) + ${s.icon ? 10 : 0}px)` : 'calc(20px * var(--lbl-scale))';
    }
    if (s.labelAccent) name.classList.add('acc');
    if (s.opacity < 0.5) name.style.opacity = 0.35;
    if (s.badge) {
      const badge = this.nodeBadge(s, [x, y + top + 0.25, z]);
      // 真上からは高さの差が画面に出ないので、公式アイコンの上に離して配置する。
      if (s.flat && s.icon) badge.style.marginTop = '-16px';
      if (s.opacity < 0.5) badge.style.opacity = 0.4;
    }
  }

  nodeSymbol(s, ink = '--ink') {
    const mark = document.createElement('span');
    mark.className = 'n-card-mark';
    if (s.comparisonRole) {
      const [number, role, difference] = s.comparisonRole;
      mark.classList.add('comparison-mark');
      mark.dataset.roleNumber = String(number);
      mark.textContent = number ? String(number) + (difference ? '△' : '') : '◇';
      mark.title = number ? `共通の役割 ${number}・${role}` : role;
      if (difference) mark.title += '・' + difference;
      mark.setAttribute('aria-hidden', 'true');
      return mark;
    }
    mark.setAttribute('aria-hidden', 'true');
    const shape = Object.hasOwn(SHAPE_OVERRIDES, s.shape3D) ? s.shape3D : s.shape;
    const override = Object.hasOwn(SHAPE_OVERRIDES, shape) && s.kind !== 'external';
    const glyph = nodeGlyph(shape, override ? undefined : s.kind);
    const symbol = document.createElement('img');
    symbol.className = 'n-card-symbol';
    symbol.alt = '';
    symbol.addEventListener('load', () => { this.labelsDirty = true; }, { once: true });
    const drawing = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${this.css(ink)}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
    symbol.src = 'data:image/svg+xml,' + encodeURIComponent(drawing);
    mark.append(symbol);
    return mark;
  }

  nodeText(text) {
    const name = document.createElement('span');
    name.className = 'n-card-text';
    name.textContent = text;
    return name;
  }

  nodeBadge(s, pos) {
    const drill = s.badge.tone === 'drill';
    const badge = this.label(s.badge.text, pos, 'n-badge ' + (s.badge.tone || ''), [0.5, 1], {}, drill);
    badge.dataset.node = s.id;
    if (s.selected) badge.dataset.selected = 'true';
    if (s.outline) badge.dataset.outlined = 'true';
    if (drill) {
      badge.dataset.action = 'drill';
      badge.title = '詳細図を開く';
      badge.setAttribute('aria-label', `${s.label}の詳細図を開く`);
      badge.addEventListener('click', () => this.onDrill?.(s.id));
    }
    return badge;
  }

  nodeCard(s) {
    const [x, y, z] = s.pos;
    const external = s.kind === 'external';
    const ink = s.outline ? '--accent' : external ? '--diagram-external' : '--ink';
    const footprint = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.24),
      new THREE.MeshBasicMaterial({ color: this.color(ink), opacity: s.opacity, transparent: s.opacity < 1 }));
    footprint.position.set(x, y + 0.08, z);
    footprint.userData.id = s.id;
    this.root.add(footprint);
    this.pick.push(footprint);

    const card = this.label('', [x, y + 0.25, z], 'n-lbl n-card n-render-parts', [0.5, 0.5], {}, true);
    const bounds = this.floorBounds.get(s.tier);
    if (bounds) card.dataset.floorSpan = String(2 * Math.min(x - bounds.x0, bounds.x1 - x));
    card.dataset.node = s.id;
    card.dataset.action = 'pick';
    card.title = s.sub ? s.label + ' · ' + s.sub.text : s.label;
    if (s.comparisonRole) {
      const [number, role, difference] = s.comparisonRole;
      card.setAttribute('aria-label', [s.label, number ? `共通の役割 ${number}・${role}` : role, difference].filter(Boolean).join('・'));
    }
    card.style.opacity = s.opacity < 0.5 ? 0.4 : 1;
    if (s.selected) card.dataset.selected = 'true';
    if (s.outline) card.dataset.outlined = 'true';
    if (external) card.dataset.external = 'true';
    if (s.dashed || external) card.dataset.dashed = 'true';
    if (s.cardTint) card.style.backgroundColor = `color-mix(in srgb, ${s.cardTint} 25%, var(--card))`;
    if (s.labelAccent) card.classList.add('acc');

    card.append(this.nodeSymbol(s, external ? '--diagram-external' : '--ink'), this.nodeText(s.label));
    const managementLabel = { aws: 'AWS管理', shared: '共同管理', customer: '利用者管理' }[s.management?.type];
    if (managementLabel) {
      const badge = document.createElement('span');
      badge.className = 'n-management n-management-' + s.management.type;
      badge.textContent = managementLabel;
      badge.title = s.management.scope || managementLabel;
      card.dataset.managed = 'true';
      card.append(badge);
    }
    if (s.icon) {
      const mark = document.createElement('span');
      mark.className = 'n-card-mark n-card-provider';
      mark.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('img');
      icon.className = 'n-icon';
      icon.alt = '';
      icon.addEventListener('load', () => {
        mark.append(icon);
        card.append(mark);
        this.labelsDirty = true;
      }, { once: true });
      icon.src = s.icon;
    }
    card.addEventListener('click', () => this.onPick?.(s.id));
    if (s.badge?.tone === 'replicas') {
      const replicas = document.createElement('span');
      replicas.className = 'n-card-replicas';
      replicas.textContent = s.badge.text;
      card.append(replicas);
    } else if (s.badge) {
      const badge = this.nodeBadge(s, [x, y + 0.25, z]);
      badge.dataset.cardBadge = 'true';
    }
  }

  /* ---------- リンク・パケット ---------- */
  pickEdge(radiusPx, height) {
    const radius = radiusPx * (this.camera.top - this.camera.bottom) / (this.camera.zoom * height);
    let best = null, closest = radius * radius, depth = Infinity;
    const onRay = new THREE.Vector3();
    for (const { id, points } of this.edgePaths) {
      for (let i = 1; i < points.length; i++) {
        const distance = this.ray.ray.distanceSqToSegment(points[i - 1], points[i], onRay);
        const alongRay = onRay.distanceToSquared(this.ray.ray.origin);
        if (distance < closest || (distance === closest && alongRay < depth)) {
          best = id; closest = distance; depth = alongRay;
        }
      }
    }
    return best;
  }

  link(s) {
    const v = s.points.map(p => new THREE.Vector3(...p));
    this.edgePaths.push({ id: s.id, points: v });
    const color = this.color(s.color);
    if (s.solid) {
      this.linkBand(v, color, s);
    } else if (s.thick && !s.dashed) {
      const path = new THREE.CurvePath(); for (let i = 1; i < v.length; i++) path.add(new THREE.LineCurve3(v[i - 1], v[i]));
      const geo = new THREE.TubeGeometry(path, v.length * 12, 0.035, 6, false);
      this.root.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: s.opacity < 1, opacity: s.opacity })));
    } else {
      const geo = new THREE.BufferGeometry().setFromPoints(v);
      const mat = s.dashed ? new THREE.LineDashedMaterial({ color, dashSize: s.dashed === 'dot' ? 0.05 : 0.2, gapSize: s.dashed === 'dot' ? 0.1 : 0.14, transparent: true, opacity: s.opacity })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: s.opacity });
      const line = new THREE.Line(geo, mat); if (s.dashed) line.computeLineDistances(); this.root.add(line);
    }
    if (s.arrow) {
      // Put the arrow on an exposed leg. A tip at the destination center
      // disappears behind a fixed-size HTML card or a solid 3D node.
      const legs = v.slice(1).map((end, i) => ({ end, start: v[i], length: end.distanceTo(v[i]) }));
      const leg = legs[s.arrowPosition?.segment] || legs.findLast(l => l.length > (s.flat ? 2.5 : 1.5))
        || legs.reduce((best, l) => !best || best.length < l.length ? l : best, null);
      if (leg && leg.length > (s.flat ? 0 : 0.5)) {
        const direction = leg.end.clone().sub(leg.start).normalize();
        const tip = leg.start.clone().lerp(leg.end, s.arrowPosition?.fraction ?? (s.flat ? 0.5 : 0.57));
        tip.y += 0.02;
        const arrowLength = s.flat ? Math.min((s.thick ? 9 : 7) * s.unitsPerPixel, leg.length * (s.arrowPosition?.fraction ?? 0.5))
          : s.thick ? 0.36 : 0.25;
        const back = tip.clone().addScaledVector(direction, -arrowLength);
        const wing = new THREE.Vector3(-direction.z, 0, direction.x);
        if (!wing.lengthSq()) wing.set(1, 0, 0);
        wing.normalize().multiplyScalar(arrowLength * 0.5);
        const arrow = new THREE.BufferGeometry().setFromPoints([back.clone().add(wing), tip, back.sub(wing)]);
        this.root.add(new THREE.Mesh(arrow, new THREE.MeshBasicMaterial({
          color, side: THREE.DoubleSide, transparent: true, opacity: s.opacity,
        })));
      }
    }
    if (s.packets) {
      const seg = []; let len = 0;
      for (let i = 1; i < v.length; i++) { const d = v[i].distanceTo(v[i - 1]); seg.push([v[i - 1], v[i], len, d]); len += d; }
      const meshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color })); this.root.add(m); return m; });
      this.packets.push({ seg, len, meshes });
    }
  }
  linkBand(points, color, { dashed, thick, opacity }) {
    const vertices = [];
    const dash = dashed === 'dot' ? 0.10 : 0.28;
    const gap = dashed === 'dot' ? 0.16 : 0.14;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], len = a.distanceTo(b);
      if (len < 0.001) continue;
      const along = b.clone().sub(a).normalize();
      const across = new THREE.Vector3(-along.z, 0, along.x);
      if (!across.lengthSq()) across.set(1, 0, -1);
      across.normalize().multiplyScalar(thick ? 0.043 : 0.024);
      for (let start = 0; start < len; start += dashed ? dash + gap : len) {
        const p = a.clone().addScaledVector(along, start);
        const q = a.clone().addScaledVector(along, dashed ? Math.min(len, start + dash) : len);
        const corners = [p.clone().sub(across), p.add(across), q.clone().sub(across), q.add(across)];
        for (const index of [0, 1, 2, 2, 1, 3]) vertices.push(...corners[index].toArray());
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.root.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, side: THREE.DoubleSide, transparent: opacity < 1, opacity,
    })));
  }
}

function at(p, t) {
  const L = p.len * t;
  for (const [a, b, s, d] of p.seg) if (L <= s + d) return a.clone().lerp(b, d ? (L - s) / d : 0);
  return p.seg[p.seg.length - 1][1].clone();
}
