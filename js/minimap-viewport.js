import * as THREE from 'three';

/* Project the visible screen corners onto the horizontal plane through the
   orbit target. On a rotated 3D view the footprint is a parallelogram. */
export function minimapViewport(camera, planeY, bounds, visible = { left: -1, right: 1, top: 1, bottom: -1 }) {
  if (!bounds || bounds.hw <= 0 || bounds.hh <= 0) return null;
  camera.updateMatrixWorld();
  const direction = camera.getWorldDirection(new THREE.Vector3());
  if (Math.abs(direction.y) < 1e-6) return null;
  const corners = [[visible.left, visible.top], [visible.right, visible.top],
    [visible.right, visible.bottom], [visible.left, visible.bottom]];
  const points = corners.map(([x, y]) => {
    const point = new THREE.Vector3(x, y, 0).unproject(camera);
    point.addScaledVector(direction, (planeY - point.y) / direction.y);
    return [(point.x - bounds.cx + bounds.hw) / (2 * bounds.hw) * 100,
      (point.z - bounds.cz + bounds.hh) / (2 * bounds.hh) * 100];
  });
  return points.every(point => point.every(Number.isFinite)) ? points : null;
}
