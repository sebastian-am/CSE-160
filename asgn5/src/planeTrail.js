import * as THREE from 'three';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';

//===============================================
// Global Variables
//===============================================
/** @type {Array<THREE.Mesh>} */ let trailParticles = [];  // Array to track active trail particles
/** @type {number} */ let lastSpawnTime = 0;    // Track last spawn time
/** @type {Object} */ let lastNoiseOffset = { x: 0, z: 0 };  // Track last offset for smooth movement

// Constants and Configuration
const TRAIL_CONFIG = {
    MAX_PARTICLES: 50,            // Maximum number of trail particles
    SPAWN_INTERVAL: 100,          // Milliseconds between spawns
    LIFETIME: 2000,               // How long each particle lives (ms)
    SIZE: { min: 0.3, max: 0.5 }, // Size range for trail particles
    COLOR: 0xE0E0E0,              // Light grey color
    FADE_START: 0.7,              // When to start fading (percentage of lifetime)
    SPAWN_DISTANCE: -1,           // Distance behind airplane to spawn particles
    SPAWN_OFFSET: { y: -0.5 },    // Vertical offset relative to spawn position
    POSITION_VARIANCE: 0.3,       // How much to vary x,y position
    MOVE_SPEED: 1.0 * (1/2)       // Match terrain speed normalization
};

// Helper Functions
const noise2D = createNoise2D();
const createNoiseTexture = () => {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    
    // randomize offset
    const offsetX = Math.random() * 1000;
    const offsetY = Math.random() * 1000;
    
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const index = (i * size + j) * 4;
            const noise = (noise2D((i + offsetX) * 0.05, (j + offsetY) * 0.05) + 1) * 0.5;
            data[index] = 255;     // R
            data[index + 1] = 255; // G
            data[index + 2] = 255; // B
            data[index + 3] = noise * 255; // A - opacity
        }
    }
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
};
function createTrailParticle(x, y, z) {
    const size = Math.random() * (TRAIL_CONFIG.SIZE.max - TRAIL_CONFIG.SIZE.min) + TRAIL_CONFIG.SIZE.min;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
        color: TRAIL_CONFIG.COLOR,
        transparent: true,
        opacity: 0.8,
        roughness: 0.7,
        metalness: 0.2,
        depthWrite: false,
        map: createNoiseTexture(),
        alphaMap: createNoiseTexture()
    });

    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(x, y, z);
    particle.userData = { createdAt: Date.now() };
    return particle;
}

//===============================================
// Main Functions
//===============================================
export function updateTrail(scene, airplane, noiseOffset) {
    if (!airplane) return;

    const currentTime = Date.now();

    // Calculate the change in offset
    const deltaX = noiseOffset.x - lastNoiseOffset.x;
    const deltaZ = noiseOffset.z - lastNoiseOffset.z;
    const deltaY = (noiseOffset.y || 0) - (lastNoiseOffset.y || 0);
    lastNoiseOffset.x = noiseOffset.x;
    lastNoiseOffset.z = noiseOffset.z;
    lastNoiseOffset.y = noiseOffset.y || 0;

    // Spawn new particle if enough time has passed
    if (currentTime - lastSpawnTime > TRAIL_CONFIG.SPAWN_INTERVAL && 
        trailParticles.length < TRAIL_CONFIG.MAX_PARTICLES) {
        
        // Get airplane's position and rotation
        const airplanePos = new THREE.Vector3();
        airplane.getWorldPosition(airplanePos);
        
        // Calculate spawn position behind the airplane with random variation
        const spawnOffset = new THREE.Vector3(
            (Math.random() - 0.5) * TRAIL_CONFIG.POSITION_VARIANCE,
            TRAIL_CONFIG.SPAWN_OFFSET.y,
            TRAIL_CONFIG.SPAWN_DISTANCE
        );
        spawnOffset.applyQuaternion(airplane.quaternion);
        
        // Calculate spawn position
        const spawnPos = airplanePos.clone().add(spawnOffset);
        
        const particle = createTrailParticle(
            spawnPos.x,
            spawnPos.y,
            spawnPos.z
        );
        
        scene.add(particle);
        trailParticles.push(particle);
        lastSpawnTime = currentTime;
    }

    // Update existing particles
    trailParticles.forEach((particle, index) => {
        // Move particles with terrain
        particle.position.x -= deltaX * TRAIL_CONFIG.MOVE_SPEED;
        particle.position.z += deltaZ * TRAIL_CONFIG.MOVE_SPEED;
        particle.position.y += deltaY * TRAIL_CONFIG.MOVE_SPEED;

        const age = currentTime - particle.userData.createdAt;
        const lifetimeRatio = age / TRAIL_CONFIG.LIFETIME;

        // Fade out
        if (lifetimeRatio > TRAIL_CONFIG.FADE_START) {
            particle.material.opacity = 0.8 * (1 - lifetimeRatio) / (1 - TRAIL_CONFIG.FADE_START);
        }

        // Remove old particles
        if (age > TRAIL_CONFIG.LIFETIME) {
            scene.remove(particle);
            trailParticles.splice(index, 1);
        }
    });
}

export function clearTrail(scene) {
    trailParticles.forEach(particle => scene.remove(particle));
    trailParticles = [];
} 