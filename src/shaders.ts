import { GLSL3, Matrix4, ShaderMaterial, Vector3, Vector4 } from 'three';
import { shadowResolution } from './board-shadows';

const shadowSampling = `
  uniform highp sampler2DShadow shadowMap;
  uniform mat4 shadowMatrix;
  uniform vec3 shadowLightPosition;

  float shadowVisibility(vec3 worldPosition, vec3 normal) {
    vec3 lightDirection = normalize(shadowLightPosition - worldPosition);
    float facing = abs(dot(normal, lightDirection));
    vec3 receiver = worldPosition + normal * mix(0.035, 0.012, facing);
    vec4 clip = shadowMatrix * vec4(receiver, 1.0);
    vec3 uv = clip.xyz / clip.w * 0.5 + 0.5;
    // Compare each filter tap against the depth of the same receiver plane.
    vec3 dx = dFdx(uv);
    vec3 dy = dFdy(uv);
    float det = dx.x * dy.y - dx.y * dy.x;
    vec2 depthSlope = vec2(0.0);
    if (abs(det) > 1e-10) {
      depthSlope = vec2(dx.z * dy.y - dy.z * dx.y, dx.x * dy.z - dy.x * dx.z) / det;
    }
    if (clip.w <= 0.0) return 1.0;
    if (any(lessThan(uv, vec3(0.0))) || any(greaterThan(uv, vec3(1.0)))) return 1.0;

    float bias = mix(0.0010, 0.00045, facing);
    float lit = 0.0;
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec2 tap = vec2(float(x), float(y));
        vec2 offset = tap * (1.6 / ${shadowResolution.toFixed(1)});
        float weight = (3.0 - abs(tap.x)) * (3.0 - abs(tap.y));
        float tapDepth = uv.z + clamp(dot(depthSlope, offset), -0.003, 0.003);
        lit += weight * texture(shadowMap, vec3(uv.xy + offset, tapDepth - bias));
      }
    }
    float coverage = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float fade = smoothstep(0.0, 0.025, coverage);
    return mix(1.0, mix(0.40, 1.0, lit / 81.0), fade);
  }
`;

const vertexShader = `
  in vec3 aColor;
  in float aLuminance;

  out vec3 Normal;
  out vec3 BoardUp;
  out vec3 localPosition;
  out vec4 FragPos;
  out vec3 color;
  out float materialLuminance;

  void main(void) {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    FragPos = modelMatrix * vec4(position, 1.0);
    Normal = mat3(modelMatrix) * normal;
    BoardUp = mat3(modelMatrix) * vec3(0.0, 1.0, 0.0);
    localPosition = position;
    color = aColor;
    materialLuminance = aLuminance;
  }
`;

const fragmentShaders = {
  platform: `
    in vec3 Normal;
    in vec3 BoardUp;
    in vec3 color;
    in vec4 FragPos;
    in float materialLuminance;
    in vec3 localPosition;

    out vec4 fragmentColor;
    uniform vec4 contactSphere;
    ${shadowSampling}

    float grainHash(vec2 cell) {
      return fract(sin(dot(cell, vec2(93.7, 157.3))) * 43758.5453);
    }

    float grainNoise(vec2 p) {
      vec2 cell = floor(p);
      vec2 t = smoothstep(vec2(0.0), vec2(1.0), fract(p));
      return mix(
        mix(grainHash(cell), grainHash(cell + vec2(1.0, 0.0)), t.x),
        mix(grainHash(cell + vec2(0.0, 1.0)), grainHash(cell + vec2(1.0, 1.0)), t.x),
        t.y
      );
    }

    void main(void) {
      vec2 grain = vec2(localPosition.x, localPosition.z + localPosition.y * 0.73);
      float warp = grainNoise(grain * vec2(0.42, 1.9));
      grain.y += (warp - 0.5) * 0.29;
      float bands = grainNoise(grain * vec2(0.85, 12.0));
      float fibers = grainNoise(grain * vec2(3.5, 34.0));
      float fineDetail = 1.0 - smoothstep(0.25, 0.75, fwidth(grain.y * 34.0));
      vec3 woodTone = mix(vec3(0.76, 0.65, 0.49), vec3(1.11, 1.06, 0.95),
        0.30 + 0.53 * bands + 0.12 * fibers * fineDetail);
      vec3 materialColor = color * woodTone;
      vec3 ambient = vec3(0.35) * materialColor * materialLuminance;
      vec3 up = normalize(BoardUp);
      vec3 normal = normalize(Normal);
      float diffuse = max(dot(normal, up), 0.0);
      float visibility = shadowVisibility(FragPos.xyz, normal);
      float contact = 0.0;
      if (contactSphere.w > 0.0 && diffuse > 0.5) {
        vec3 toBall = contactSphere.xyz - FragPos.xyz;
        float height = dot(toBall, up);
        if (height > 0.0) {
          float gap = max(0.0, height - contactSphere.w);
          float distance = length(toBall - up * height);
          float spread = contactSphere.w * 1.22 + gap * 0.12;
          contact = (1.0 - smoothstep(spread * 0.52, spread, distance))
            * (1.0 - smoothstep(0.0, 0.95, gap))
            * smoothstep(0.0, contactSphere.w * 0.85, height);
        }
      }
      vec3 result = materialColor * mix(0.14, 0.59, diffuse) * visibility;
      fragmentColor = vec4((result + ambient) * (1.0 - 0.34 * contact), 1.0);
    }
    `,
  ball: `
    in vec3 Normal;
    in vec4 FragPos;
    in vec3 localPosition;

    out vec4 fragmentColor;
    uniform vec3 lightPos;
    ${shadowSampling}

    void main(void) {
      vec3 normal = normalize(Normal);
      vec3 unitPos = normalize(localPosition);
      float equator = 1.0 - smoothstep(0.15, 0.185, abs(unitPos.y));
      vec3 ballColor = mix(vec3(0.78, 0.48, 0.34), vec3(1.0, 0.88, 0.68), equator);
      vec3 lightDir = normalize(lightPos - FragPos.xyz);
      vec3 viewDir = normalize(cameraPosition - FragPos.xyz);
      vec3 halfDir = normalize(lightDir + viewDir);
      float diffuse = max(dot(normal, lightDir), 0.0);
      float specular = pow(max(dot(normal, halfDir), 0.0), 48.0) * 0.40 * diffuse;
      float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0) * 0.16;
      float ambient = 0.32;
      float visibility = shadowVisibility(FragPos.xyz, normal);
      vec3 result = ballColor * (ambient + rim) + (ballColor * diffuse * 0.8 + vec3(specular)) * visibility;
      fragmentColor = vec4(result, 1.0);
    }
    `,
};

export type Surface = keyof typeof fragmentShaders;

export function createSurfaceMaterial(surface: Surface) {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader,
    fragmentShader: fragmentShaders[surface],
    uniforms: {
      lightPos: { value: new Vector3(15, 35, 15) },
      shadowMap: { value: null },
      shadowMatrix: { value: new Matrix4() },
      shadowLightPosition: { value: new Vector3() },
      contactSphere: { value: new Vector4(0, 0, 0, 0) },
    },
  });
}
