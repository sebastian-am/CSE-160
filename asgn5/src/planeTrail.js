import * as THREE from 'three';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';

// Create noise generator with fixed seed for consistency
const noise2D = createNoise2D();

// Terrain configuration (matching terrain.js)
const HEIGHT_SCALE = 50;  // Height amplitude
const NOISE_SCALE = 0.01;  // Base frequency
const DISTANCE_SCALE = 0.005;  // Controls distance between major features

// Trail management
export const TRAIL_CONFIG = {
    MAX_PARTICLES: 50,     // Maximum number of trail particles
    SPAWN_INTERVAL: 100,   // Milliseconds between spawns
    LIFETIME: 2000,        // How long each particle lives (ms)
    SIZE: { min: 0.3, max: 0.5 },  // Size range for trail particles
    COLOR: 0xE0E0E0,       // Light grey color
    FADE_START: 0.7,       // When to start fading (percentage of lifetime)
    SPAWN_DISTANCE: -1,    // Distance behind airplane to spawn particles
    SPAWN_OFFSET: { y: -0.5 },  // Vertical offset relative to spawn position
    POSITION_VARIANCE: 0.3,  // How much to vary x,y position
    MOVE_SPEED: 1.0 * (1/2)  // Match terrain speed normalization
};

let trailParticles = [];  // Array to track active trail particles
let lastSpawnTime = 0;    // Track last spawn time
let lastNoiseOffset = { x: 0, z: 0 };  // Track last offset for smooth movement

function calculateTerrainHeight(x, z, noiseOffset) {
    // Calculate world position
    const worldX = x + noiseOffset.x;
    const worldZ = z + noiseOffset.z;
    
    // Generate terrain height using multiple octaves of noise (matching terrain.js)
    const noise1 = noise2D(worldX * DISTANCE_SCALE, worldZ * DISTANCE_SCALE) * HEIGHT_SCALE;
    const noise2 = noise2D(worldX * NOISE_SCALE, worldZ * NOISE_SCALE) * (HEIGHT_SCALE * 0.4);
    const noise3 = noise2D(worldX * NOISE_SCALE * 2, worldZ * NOISE_SCALE * 2) * (HEIGHT_SCALE * 0.2);
    const noise4 = noise2D(worldX * NOISE_SCALE * 4, worldZ * NOISE_SCALE * 4) * (HEIGHT_SCALE * 0.1);
    
    return noise1 + noise2 + noise3 + noise4;
}

function createTrailParticle(x, y, z) {
    const size = Math.random() * (TRAIL_CONFIG.SIZE.max - TRAIL_CONFIG.SIZE.min) + TRAIL_CONFIG.SIZE.min;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
        color: TRAIL_CONFIG.COLOR,
        transparent: true,
        opacity: 0.8,
        roughness: 0.7,
        metalness: 0.2,
        depthWrite: false
    });

    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(x, y, z);
    particle.userData = { createdAt: Date.now() };
    return particle;
}

export function updateTrail(scene, airplane, noiseOffset) {
    if (!airplane) return;

    const currentTime = Date.now();

    // Calculate the change in offset
    const deltaX = noiseOffset.x - lastNoiseOffset.x;
    const deltaZ = noiseOffset.z - lastNoiseOffset.z;
    const deltaY = (noiseOffset.y || 0) - (lastNoiseOffset.y || 0);  // Track y offset changes
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
        particle.position.y += deltaY * TRAIL_CONFIG.MOVE_SPEED;  // Changed sign to match terrain movement

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