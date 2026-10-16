// The halftone look: the bubbles' light goes into a small target (2× the cell grid), then one full-screen
// pass draws a ring per 6 px cell. Mint page, dark ink.
import * as THREE from "three";
import { quadVert, ringFrag } from "./shaders";

export const CELL = 6; // CSS px
const PAPER = "#8cfeb8";
const INK = "#062a17";
const INK_ALPHA = 0.92;

const vec3 = (hex: string) => new THREE.Vector3(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));

export function createRings(gl: THREE.WebGLRenderer) {
  const target = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const res = new THREE.Vector2();
  const uniforms = {
    tLight: { value: target.texture },
    uRes: { value: new THREE.Vector2() },
    uCell: { value: new THREE.Vector2() },
    uBg: { value: vec3(PAPER) },
    uInk: { value: vec3(INK) },
    uInkA: { value: INK_ALPHA },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: quadVert, fragmentShader: ringFrag, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const pass = new THREE.Scene();
  pass.add(quad);
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Follows the drawing buffer, so size and pixel-ratio changes need no wiring.
  function fit() {
    gl.getDrawingBufferSize(res);
    if (res.equals(uniforms.uRes.value)) return;
    const c = Math.round(CELL * gl.getPixelRatio());
    uniforms.uRes.value.copy(res);
    uniforms.uCell.value.set(c, c);
    target.setSize(Math.ceil(res.x / c) * 2, Math.ceil(res.y / c) * 2);
  }

  return {
    // Compiles both programs before the first frame, so the scene doesn't stutter when it appears. The light
    // program is compiled with the target bound, since that is where it draws.
    compile(scene: THREE.Scene, camera: THREE.Camera) {
      gl.setRenderTarget(target);
      const light = gl.compileAsync(scene, camera);
      gl.setRenderTarget(null);
      return Promise.all([light, gl.compileAsync(pass, passCamera)]);
    },
    render(scene: THREE.Scene, camera: THREE.Camera) {
      fit();
      gl.setRenderTarget(target);
      gl.setClearColor(0x000000, 0);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      gl.render(pass, passCamera);
    },
    dispose() {
      target.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
