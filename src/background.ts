import { ShaderMaterial, Vector2, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const vertexShader = `
    varying vec2 vUv;

    void main(void) {
      vUv = position.xy * 0.5 + 0.5;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

const fragmentShader = `
    varying vec2 vUv;
    uniform vec2 iResolution;
    uniform float iTime;

    void main(void) {
      vec2 p = vUv - 0.5;
      p.x *= iResolution.x / max(iResolution.y, 1.0);

      vec3 navy = vec3(0.045, 0.063, 0.105);
      vec3 slate = vec3(0.115, 0.160, 0.222);
      vec3 color = mix(navy, slate, smoothstep(0.0, 1.0, vUv.y));

      // Broad diagonal washes drift gently behind the board.
      float drift = iTime * 0.11;
      float curve = p.y + p.x * 0.24 + sin(p.x * 2.0 + drift) * 0.10;
      float mist = exp(-5.0 * curve * curve);
      float tint = smoothstep(-0.65, 0.65, p.x + sin(drift) * 0.15);
      vec3 teal = vec3(0.035, 0.106, 0.110);
      vec3 lavender = vec3(0.090, 0.052, 0.110);
      color += mix(teal, lavender, tint) * mist * 0.55;

      gl_FragColor = vec4(color * 0.85, 1.0);
    }
  `;

class BackgroundRenderer {
  private uniforms = {
    iResolution: { value: new Vector2() },
    iTime: { value: 0 },
  };

  private material = new ShaderMaterial({
    vertexShader, fragmentShader, uniforms: this.uniforms,
    depthTest: false, depthWrite: false,
  });
  private quad = new FullScreenQuad(this.material);

  dispose() {
    this.quad.dispose();
    this.material.dispose();
  }

  render(renderer: WebGLRenderer, time: number) {
    renderer.getDrawingBufferSize(this.uniforms.iResolution.value);
    this.uniforms.iTime.value = time;
    this.quad.render(renderer);
  }
}

export const Background = new BackgroundRenderer();
