import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset,
  ToneMappingEffect, ToneMappingMode, DepthOfFieldEffect, Effect, BlendFunction,
} from 'postprocessing';

// Colour grade + vignette + a whisper of grain, tuned for a soft pink "toy photo" look.
const GRADE_FRAG = /* glsl */`
uniform float uSat;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform vec3 uHighTint;
uniform float uSplit;
uniform float uVignette;
uniform float uGrain;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = max((c - 0.21) * uContrast + 0.21, 0.0);
  vec3 tint = mix(uShadowTint, uHighTint, smoothstep(0.02, 0.55, l));
  c *= mix(vec3(1.0), tint, uSplit);
  vec2 d = uv - 0.5;
  d.x *= resolution.x / resolution.y;
  c *= 1.0 - smoothstep(0.35, 1.25, length(d)) * uVignette;
  float n = fract(sin(dot(uv * resolution + fract(time) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uGrain;
  outputColor = vec4(c, inputColor.a);
}`;

// Safety net: replace NaN / Inf pixels before bloom so a bad pixel can never grow into a black block.
class SanitizeEffect extends Effect {
  constructor() {
    super('SanitizeEffect', `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      vec3 c = inputColor.rgb;
      bool bad = any(isnan(c)) || any(isinf(c));
      outputColor = vec4(bad ? vec3(0.9, 0.8, 0.85) : min(c, vec3(64.0)), inputColor.a);
    }`, { blendFunction: BlendFunction.SRC });
  }
}

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', GRADE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uSat', new THREE.Uniform(1.1)],
        ['uContrast', new THREE.Uniform(1.06)],
        ['uShadowTint', new THREE.Uniform(new THREE.Color('#8a78c8'))],
        ['uHighTint', new THREE.Uniform(new THREE.Color('#ffe2cc'))],
        ['uSplit', new THREE.Uniform(0.1)],
        ['uVignette', new THREE.Uniform(0.32)],
        ['uGrain', new THREE.Uniform(0.012)],
      ]),
    });
  }
  u(name) { return this.uniforms.get(name); }
}

// Quality presets (auto-picked by device, can be changed from the ✨ button, and step down if the device struggles)
export const PRESETS = {
  low: { level: 'low', pixelRatioCap: 1, shadowMap: 1024, bloom: false, smaa: SMAAPreset.LOW, dof: false, envSize: 64 },
  medium: { level: 'medium', pixelRatioCap: 1.5, shadowMap: 2048, bloom: true, smaa: SMAAPreset.MEDIUM, dof: true, envSize: 128 },
  high: { level: 'high', pixelRatioCap: 2, shadowMap: 4096, bloom: true, smaa: SMAAPreset.HIGH, dof: true, envSize: 256 },
};

export function autoPreset() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 500;
  if (small) return 'medium';
  return coarse ? 'medium' : 'high';
}

export class Pipeline {
  constructor(renderer, scene, camera, sun) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the effect chain
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));

    this.composer.addPass(new EffectPass(camera, new SanitizeEffect()));

    this.dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 2, worldFocusRange: 1.4, bokehScale: 3.2, resolutionScale: 0.5 });
    this.dofPass = new EffectPass(camera, this.dof);
    this.dofPass.enabled = false;
    this.composer.addPass(this.dofPass);

    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.1, luminanceSmoothing: 0.35, intensity: 0.7, radius: 0.7, levels: 6 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.grade = new GradeEffect();
    this.mainPass = new EffectPass(camera, this.bloom, this.tone, this.grade);
    this.composer.addPass(this.mainPass);

    this.smaa = new SMAAEffect({ preset: SMAAPreset.HIGH });
    this.smaaPass = new EffectPass(camera, this.smaa);
    this.composer.addPass(this.smaaPass);

    this.focus = null; // {object, yOff}
    this.preset = PRESETS.high;
  }

  apply(name) {
    const p = PRESETS[name] || PRESETS.high;
    this.preset = p;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatioCap));
    this.bloom.blendMode.opacity.value = p.bloom ? 1 : 0;
    this.smaa.applyPreset(p.smaa);
    if (this.sun.shadow.mapSize.x !== p.shadowMap) {
      this.sun.shadow.mapSize.set(p.shadowMap, p.shadowMap);
      this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    }
    this.dofPass.enabled = !!(p.dof && this.focus);
  }

  // soft blurred background behind the subject (salon / boutique / pet shop close-ups and photos)
  setFocus(object, yOff = 1.4) {
    this.focus = object ? { object, yOff } : null;
    this.dofPass.enabled = !!(this.preset.dof && this.focus);
  }

  setSize(w, h) { this.composer.setSize(w, h, false); }

  render(dt) {
    if (this.dofPass.enabled && this.focus) {
      const p = this.focus.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, this.focus.yOff, 0));
      const d = this.camera.position.distanceTo(p);
      this.dof.cocMaterial.worldFocusDistance = d;
      this.dof.cocMaterial.worldFocusRange = Math.max(0.8, d * 0.45);
    }
    this.composer.render(dt);
  }
}

// Bake the sky into an environment map so every shiny thing (car paint, gems, nail polish, water) reflects it.
export function bakeEnvironment(renderer, skyMaterial, size = 128) {
  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial);
  envScene.add(sky);
  // soft pink "ground bounce" + a couple of bright panels for pretty highlights
  const ground = new THREE.Mesh(new THREE.CircleGeometry(100, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f7c9dc').multiplyScalar(0.8), side: THREE.DoubleSide }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -2;
  envScene.add(ground);
  for (const [x, z, c] of [[60, 20, '#ffffff'], [-50, 40, '#ffe0ef'], [10, -70, '#fff4e0']]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), side: THREE.DoubleSide }));
    panel.position.set(x, 25, z); panel.lookAt(0, 0, 0);
    envScene.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.02, 0.1, 300, { size });
  pmrem.dispose();
  sky.geometry.dispose(); ground.geometry.dispose();
  return rt;
}
