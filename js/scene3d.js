/* Three.js による 3D 描画：正射影カメラ + OrbitControls（回転・拡大縮小・移動）+ CSS2D ラベル */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const LABEL_PRIORITY = new Map(['n-lbl', 'n-badge', 'g-lbl', 't-lbl', 'abbr', 'n-sub'].map((name, index) => [name, index]));
const LABEL_GAP = 2;
const overlaps = (a, b, gap = 0) => a.left < b.right + gap && a.right + gap > b.left &&
  a.top < b.bottom + gap && a.bottom + gap > b.top;

const VIEWS = { iso: [1, 1.05, 1], top: [0, 1, 0.0001], side: [0.05, 0.35, 1], back: [-1, 1.05, -1] };

export class Scene3D {
  constructor(el, { onPick } = {}) {
    this.el = el; this.onPick = onPick;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); // PNG 書き出しのため保持
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    el.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-4, 10, 6); this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(6, 3, -4); this.scene.add(fill);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.12, screenSpacePanning: true, minZoom: 0.3, maxZoom: 6 });
    this.setDragMode('rotate');

    this.root = new THREE.Group(); this.lbl = new THREE.Group();
    this.scene.add(this.root, this.lbl);
    this.pick = []; this.packets = []; this.frustum = 10; this.fitted = false;

    this.ray = new THREE.Raycaster();
    let down = null;
    this.renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
    this.renderer.domElement.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = this.renderer.domElement.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera);
      const hit = this.ray.intersectObjects(this.pick, false)[0];
      this.onPick?.(hit?.object.userData.id ?? null);
    });
    this.controls.addEventListener('start', () => { this.usingControls = true; });
    this.controls.addEventListener('end', () => { this.usingControls = false; });
    this.controls.addEventListener('change', () => {
      if (this.usingControls) this.fitView = null;
    });
    new ResizeObserver(() => {
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
      if (this.flat) {
        this.labelProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        if (this.labelsDirty || !this.labelProjection.equals(this.lastLabelProjection)) {
          this.placeLabels();
          this.lastLabelProjection.copy(this.labelProjection);
          this.labelsDirty = false;
        }
      }
    });
  }

  /* 2D では画面上のラベルを測り、優先順に重なりのないものを表示する */
  placeLabels(layer = this.labels.domElement) {
    const frame = layer.getBoundingClientRect();
    const labels = Array.from(layer.children).filter(el => el.style.display !== 'none').map(el => ({
      el,
      rect: el.getBoundingClientRect(),
      priority: el.dataset.selected ? -1 : el.dataset.icon ? -0.5 : LABEL_PRIORITY.get(el.classList[0]),
    }));
    labels.sort((a, b) => a.priority - b.priority);
    const occupied = [];
    for (const { el, rect } of labels) {
      const visible = overlaps(rect, frame) && !occupied.some(other => overlaps(rect, other, LABEL_GAP));
      el.style.visibility = visible ? '' : 'hidden';
      if (visible) occupied.push(rect);
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
      this.placeLabels(layer);
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
          stroke: border ? style.borderTopColor : 'none', 'stroke-width': border }, group);
      }
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
      const image = el.querySelector('img'), img = image?.complete && image.naturalWidth ? image : null;
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
      if (parseFloat(style.borderTopWidth)) { g.strokeStyle = style.borderTopColor; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, width - 1, height - 1); }
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
    this.root.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); });
    this.root.clear(); this.lbl.clear(); this.pick = []; this.packets = [];
  }
  end(flat) {
    this.flat = flat;
    this.labelsDirty = true;
    if (!this.fitted) { this.fit(flat ? 'top' : this.initialView || 'iso'); this.fitted = true; }
  }

  fit(view = 'iso') {
    this.anim = null;
    const box = new THREE.Box3().setFromObject(this.root), c = box.getCenter(new THREE.Vector3());
    if (box.isEmpty()) return;
    this.fitView = view;
    const d = new THREE.Vector3(...VIEWS[view]).normalize();
    this.camera.position.copy(c).addScaledVector(d, 100);
    this.camera.zoom = 1; this.controls.target.copy(c); this.camera.lookAt(c); this.camera.updateMatrixWorld();
    // 箱の 8 頂点をカメラ座標に投影し、縦横どちらも収まる大きさにする
    const inv = this.camera.matrixWorldInverse, aspect = this.el.clientWidth / (this.el.clientHeight || 1);
    let hx = 0, hy = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(inv), q = c.clone().applyMatrix4(inv);
      hx = Math.max(hx, Math.abs(p.x - q.x)); hy = Math.max(hy, Math.abs(p.y - q.y));
    }
    this.frustum = Math.max(hy, hx / aspect) * 1.08 + 0.6;
    this.resize();
  }

  label(text, pos, cls, anchor = [0.5, 0.5], style = {}) {
    const div = document.createElement('div'); div.className = cls; div.textContent = text; Object.assign(div.style, style);
    const o = new CSS2DObject(div); o.position.set(...pos); o.center.set(...anchor); this.lbl.add(o); return div;
  }
  edges(geo, color, opacity = 1, dashed = false) {
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08, transparent: opacity < 1, opacity })
      : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), m); if (dashed) l.computeLineDistances(); return l;
  }

  /* ---------- フロア・グループ ---------- */
  floor({ x0, z0, x1, z1, y, origin, label, labelAt }) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (!origin) {
      const geo = new THREE.BoxGeometry(w, 0.06, d);
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: this.color('--plate'), transparent: true, opacity: 0.82 }));
      mesh.position.set(cx, y - 0.03, cz); this.root.add(mesh);
      mesh.add(this.edges(geo, this.color('--line')));
      const pts = [];
      for (let x = Math.ceil(x0); x <= x1; x++) pts.push(x, y + 0.002, z0, x, y + 0.002, z1);
      for (let z = Math.ceil(z0); z <= z1; z++) pts.push(x0, y + 0.002, z, x1, y + 0.002, z);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: this.color('--grid') })));
    } else this.loop([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, '--mute', 'dash');
    this.label(label, labelAt, 't-lbl', origin ? [1, 0.5] : [0, 0.5]);
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
  group({ pts, y, kind, label, color }) {
    const vpc = ['--ink', 'dash'];
    const [fallback, style, fill] = {
      vpc, vnet: vpc, vcn: vpc, az: ['--mute', 'dot'], subnet: ['--line', null, '--grid'],
      cloud: ['--mute'], region: ['--mute', 'dash'], cluster: ['#326CE5', 'dashdot'],
      namespace: ['--mute', 'dot'], datacenter: ['#6d6a63'],
    }[kind] || ['--mute', 'dash'];
    const ink = ['cluster', 'datacenter'].includes(kind) ? fallback : color || fallback;
    this.loop(pts, y, ink, style, fill);
    const [x, z] = kind === 'az' ? pts[1] : kind === 'cloud' ? pts[0] : pts[3];
    this.label(label, [x, y + 0.02, z], 'g-lbl', kind === 'az' || kind === 'cloud' ? [0, 1] : [0, 0], { color: this.color(ink).getStyle() });
  }

  /* ---------- ノード ---------- */
  node(s) {
    const [x, y, z] = s.pos, g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
    const mat = c => new THREE.MeshLambertMaterial({ color: c, transparent: s.opacity < 1, opacity: s.opacity, depthWrite: s.opacity >= 0.5 });
    const edge = this.color(s.outline ? '--accent' : '--ink'), eo = Math.min(1, s.opacity + 0.25);
    const add = (geo, py, color = s.color, rx = 0) => {
      const m = new THREE.Mesh(geo, mat(color)); m.position.y = py; m.rotation.x = rx; m.userData.id = s.id; g.add(m); this.pick.push(m);
      const e = this.edges(geo, edge, eo, s.dashed); e.position.y = py; e.rotation.x = rx; g.add(e);
      if (s.outline) { const e2 = this.edges(geo, edge, 1); e2.scale.setScalar(1.04); e2.position.y = py; g.add(e2); }
    };
    let top = s.h;
    if (s.shape === 'cyl') add(new THREE.CylinderGeometry(0.42, 0.42, s.h, 28), s.h / 2);
    else if (s.shape === 'queue') { for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.92, 0.22, 0.92), 0.11 + i * 0.3); top = 0.85; }
    else if (s.shape === 'person') {
      add(new THREE.CylinderGeometry(0.16, 0.28, 0.62, 20), 0.31);
      add(new THREE.SphereGeometry(0.17, 20, 14), 0.84); top = 1.02;
    } else add(new THREE.BoxGeometry(s.w || 0.86, s.h, s.w || 0.86), s.h / 2);
    if (s.flat) { g.scale.y = 0.25 / top; top = 0.25; }
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
    const name = this.label(s.label, [x, y, z + 0.5], 'n-lbl', [0.5, -0.3]);
    if (s.selected) name.dataset.selected = 'true';
    if (s.flat && s.icon) name.style.marginTop = '10px';
    if (s.sub) {
      const sub = this.label(s.sub.text, [x, y, z + 0.5], 'n-sub', [0.5, -0.3],
        { color: s.sub.color, opacity: s.opacity < 0.5 ? 0.35 : 1 });
      sub.style.marginTop = s.flat ? `calc(19px * var(--lbl-scale) + ${s.icon ? 10 : 0}px)` : 'calc(15px * var(--lbl-scale))';
    }
    if (s.labelAccent) name.classList.add('acc');
    if (s.opacity < 0.5) name.style.opacity = 0.35;
    if (s.badge) {
      const badge = this.label(s.badge.text, [x, y + top + 0.25, z], 'n-badge ' + (s.badge.tone || ''), [0.5, 1]);
      // 真上からは高さの差が画面に出ないので、公式アイコンの上に離して配置する。
      if (s.flat && s.icon) badge.style.marginTop = '-16px';
      if (s.opacity < 0.5) badge.style.opacity = 0.4;
    }
  }

  /* ---------- リンク・パケット ---------- */
  link(s) {
    const v = s.points.map(p => new THREE.Vector3(...p));
    const color = this.color(s.color);
    if (s.thick && !s.dashed) {
      const path = new THREE.CurvePath(); for (let i = 1; i < v.length; i++) path.add(new THREE.LineCurve3(v[i - 1], v[i]));
      const geo = new THREE.TubeGeometry(path, v.length * 12, 0.035, 6, false);
      this.root.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: s.opacity < 1, opacity: s.opacity })));
    } else {
      const geo = new THREE.BufferGeometry().setFromPoints(v);
      const mat = s.dashed ? new THREE.LineDashedMaterial({ color, dashSize: s.dashed === 'dot' ? 0.05 : 0.2, gapSize: s.dashed === 'dot' ? 0.1 : 0.14, transparent: true, opacity: s.opacity })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: s.opacity });
      const line = new THREE.Line(geo, mat); if (s.dashed) line.computeLineDistances(); this.root.add(line);
    }
    if (s.packets) {
      const seg = []; let len = 0;
      for (let i = 1; i < v.length; i++) { const d = v[i].distanceTo(v[i - 1]); seg.push([v[i - 1], v[i], len, d]); len += d; }
      const meshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color })); this.root.add(m); return m; });
      this.packets.push({ seg, len, meshes });
    }
  }
}

function at(p, t) {
  const L = p.len * t;
  for (const [a, b, s, d] of p.seg) if (L <= s + d) return a.clone().lerp(b, d ? (L - s) / d : 0);
  return p.seg[p.seg.length - 1][1].clone();
}
