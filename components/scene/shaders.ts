// From the mockup (exploracion/pruebas/mix/scene.js), trimmed to the mint palette. scripts/og-template.html
// carries the same two shaders for the share image.

// Each bubble's light, like a soap bubble: bright rim (fresnel), a highlight, a touch of diffuse, dimmer far away.
export const lightVert = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;

export const lightFrag = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.5, 0.75, 0.6));
    float spec = pow(max(dot(n, normalize(l + v)), 0.0), 40.0);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);
    float light = (0.02 + 0.8 * fres + 0.9 * spec + 0.06 * max(dot(n, l), 0.0)) * mix(0.5, 1.0, smoothstep(25.5, 18.0, length(vV)));
    gl_FragColor = vec4(clamp(light, 0.0, 1.0), 0.0, 0.0, 1.0);
  }`;

// One ring per cell: the brighter the light at the cell's center, the wider the ring; past 0.82 it fills in.
export const ringFrag = /* glsl */ `
  uniform sampler2D tLight;
  uniform vec2 uRes, uCell;
  uniform vec3 uBg, uInk;
  uniform float uInkA;
  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 cell = floor(frag / uCell), local = fract(frag / uCell);
    float b = texture2D(tLight, (cell + 0.5) * uCell / uRes).r;
    float side = min(uCell.x, uCell.y);
    float d = length((local - 0.5) * uCell / side);
    float aa = 1.2 / side;
    float rad = 0.1 + 0.34 * b;
    float t = max(0.055, 1.1 / side);
    float ink = 1.0 - smoothstep(t - aa, t + aa, abs(d - rad));
    if (b > 0.82) ink = max(ink, 1.0 - smoothstep(rad - aa, rad + aa, d));
    ink *= step(0.04, b) * uInkA;
    gl_FragColor = vec4(mix(uBg, uInk, ink), 1.0);
  }`;

export const quadVert = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
