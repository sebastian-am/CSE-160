import * as THREE from 'three';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';

// Create noise generator
const noise2D = createNoise2D();

function updateTerrain(plane, noiseOffset, terrainPlane) {
    if (!terrainPlane || !terrainPlane.geometry) {
        console.log('Terrain plane or geometry is missing:', terrainPlane);
        return;
    }

    // Update noise offset based on plane's orientation
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(plane.quaternion);
    
    // Update noise offset (invert the direction)
    noiseOffset.x -= forwardVector.x * 0.1;
    noiseOffset.z -= forwardVector.z * 0.1;

    // Update terrain vertices with noise
    const vertices = terrainPlane.geometry.attributes.position.array;
    const colors = terrainPlane.geometry.attributes.color.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        // Use multiple layers of noise for more jagged terrain
        const noise1 = noise2D((x + noiseOffset.x) * 0.008, (y + noiseOffset.z) * 0.008) * 60;
        const noise2 = noise2D((x + noiseOffset.x) * 0.02, (y + noiseOffset.z) * 0.02) * 20;
        const noise3 = noise2D((x + noiseOffset.x) * 0.04, (y + noiseOffset.z) * 0.04) * 5;
        const noise4 = noise2D((x + noiseOffset.x) * 0.08, (y + noiseOffset.z) * 0.08) * 2;
        const height = noise1 + noise2 + noise3 + noise4;
        
        // Set vertex height
        vertices[i + 2] = height;
        
        // Update vertex color based on height
        const color = height < 5 ? new THREE.Color(0x0077be) : new THREE.Color(0x228B22);
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
    }
    terrainPlane.geometry.attributes.position.needsUpdate = true;
    terrainPlane.geometry.attributes.color.needsUpdate = true;
    terrainPlane.geometry.computeVertexNormals();
}

export { updateTerrain }; 