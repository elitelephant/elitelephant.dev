// A halftone bubble as an SVG, for the share image (next/og has no WebGL). It reproduces the scene's two shaders
// (components/scene/shaders.ts) on the CPU: the soap-bubble light of a sphere, read at the center of each cell,
// then one ring per cell, wider where the light is brighter and filled past 0.82.
type Vec3 = [number, number, number];

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// The scene's light: from the upper left, slightly in front (y points up).
export const SCENE_LIGHT: Vec3 = [-0.5, 0.75, 0.6];
const DISTANCE_DIM = 0.9; // the scene dims bubbles with distance; at the camera's distance that is about 0.9

export type BubbleOptions = { size: number; cell: number; ink: string; alpha?: number; light?: Vec3 };

export function bubbleSvg({ size, cell, ink, alpha = 0.92, light = SCENE_LIGHT }: BubbleOptions) {
  const l = norm(light);
  const half = norm([l[0], l[1], l[2] + 1]);
  const r = size / 2;
  const stroke = (Math.max(0.055, 1.1 / cell) * cell).toFixed(2);
  let rings = "";
  for (let y = cell / 2; y < size; y += cell) {
    for (let x = cell / 2; x < size; x += cell) {
      const nx = (x - r) / r;
      const ny = -(y - r) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const n: Vec3 = [nx, ny, Math.sqrt(1 - d2)];
      const fresnel = Math.pow(1 - n[2], 2.2);
      const spec = Math.pow(Math.max(0, dot(n, half)), 40);
      const diffuse = Math.max(0, dot(n, l));
      const b = Math.min(1, (0.02 + 0.8 * fresnel + 0.9 * spec + 0.06 * diffuse) * DISTANCE_DIM);
      if (b < 0.04) continue;
      const radius = ((0.1 + 0.34 * b) * cell).toFixed(2);
      rings += b > 0.82
        ? `<circle cx="${x}" cy="${y}" r="${radius}" fill="${ink}"/>`
        : `<circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${ink}" stroke-width="${stroke}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g opacity="${alpha}">${rings}</g></svg>`;
}

export const bubbleDataUrl = (options: BubbleOptions) => `data:image/svg+xml;base64,${Buffer.from(bubbleSvg(options)).toString("base64")}`;
