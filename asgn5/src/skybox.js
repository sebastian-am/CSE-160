import * as THREE from 'three';

export function createSkybox(scene) {
    const loader = new THREE.TextureLoader();
    loader.load(
        '../textures/skybox/skybox.jpg',
        (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            scene.background = texture;
        }
    );
} 