import * as THREE from 'three';

const pixelShader = {
    uniforms: {
        tDiffuse: { value: null },
        pixelSize: { value: 4.0 },
        resolution: { value: new THREE.Vector2(800, 600) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float pixelSize;
        uniform vec2 resolution;
        varying vec2 vUv;

        void main() {
            vec2 dxy = pixelSize / resolution;
            vec2 coord = dxy * floor(vUv / dxy);
            gl_FragColor = texture2D(tDiffuse, coord);
        }
    `
};

export { pixelShader }; 