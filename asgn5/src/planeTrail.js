import * as THREE from 'three';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';

//===============================================
// Global Variables
//===============================================
/** @type {Array<THREE.Mesh>} */ let trailParticles = [];  // Array to track active trail particles
/** @type {number} */ let lastSpawnTime = 0;    // Track last spawn time
/** @type {Object} */ let lastNoiseOffset = { x: 0, z: 0 };  // Track last offset for smooth movement
/** @type {boolean} */ let isFadingOut = false;  // Track if trail is fading out
/** @type {number} */ let fadeOutStartTime = 0;  // When fade-out started
const FADE_OUT_DURATION = 1000;  // How long to fade out (ms)

// Constants and Configuration
const TRAIL_CONFIG = {
    MAX_PARTICLES: 100,            // Maximum number of trail particles (doubled from 50)
    SPAWN_INTERVAL: 50,            // Milliseconds between spawns (halved from 100 for twice as many)
    LIFETIME: 2000,               // How long each particle lives (ms)
    SIZE: { min: 0.3, max: 0.5 }, // Size range for trail particles
    COLOR: 0xE0E0E0,              // Light grey color
    FADE_START: 0.7,              // When to start fading (percentage of lifetime)
    SPAWN_DISTANCE: -1.2,         // Distance behind airplane to spawn particles (closer to tail)
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
    
    // Debug: log if we're updating trail while fading out
    if (isFadingOut && trailParticles.length > 0) {
        const fadeOutAge = currentTime - fadeOutStartTime;
        if (Math.floor(fadeOutAge / 500) !== Math.floor((fadeOutAge - 16) / 500)) {
            const firstParticle = trailParticles[trailParticles.length - 1];
            const opacity = firstParticle ? firstParticle.material.opacity : 'N/A';
            console.log(`[Trail Update] Fading out: age=${fadeOutAge.toFixed(0)}ms, particles=${trailParticles.length}, firstOpacity=${opacity}`);
        }
    }

    // Calculate the change in offset
    const deltaX = noiseOffset.x - lastNoiseOffset.x;
    const deltaZ = noiseOffset.z - lastNoiseOffset.z;
    const deltaY = (noiseOffset.y || 0) - (lastNoiseOffset.y || 0);
    lastNoiseOffset.x = noiseOffset.x;
    lastNoiseOffset.z = noiseOffset.z;
    lastNoiseOffset.y = noiseOffset.y || 0;

    // Don't spawn new particles if fading out
    if (!isFadingOut) {
        // Spawn new particle if enough time has passed
        if (currentTime - lastSpawnTime > TRAIL_CONFIG.SPAWN_INTERVAL && 
            trailParticles.length < TRAIL_CONFIG.MAX_PARTICLES) {
        
        // Get airplane's position and rotation
        const airplanePos = new THREE.Vector3();
        airplane.getWorldPosition(airplanePos);
        
        // Calculate spawn position behind the airplane with random variation
        // Use local space: behind is negative Z, then transform to world space
        const spawnOffset = new THREE.Vector3(
            (Math.random() - 0.5) * TRAIL_CONFIG.POSITION_VARIANCE,
            TRAIL_CONFIG.SPAWN_OFFSET.y,
            TRAIL_CONFIG.SPAWN_DISTANCE  // Negative Z = behind the airplane
        );
        // Transform to world space using airplane's rotation
        spawnOffset.applyQuaternion(airplane.quaternion);
        
        // Calculate spawn position (airplane is at origin, so just use the offset)
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
    }

    // Update existing particles (iterate backwards to safely remove items)
    for (let index = trailParticles.length - 1; index >= 0; index--) {
        const particle = trailParticles[index];
        
        // Calculate age and lifetime ratio (works for both normal and fade-out)
        const age = currentTime - particle.userData.createdAt;
        const lifetimeRatio = age / TRAIL_CONFIG.LIFETIME;
        
        // Use the same fade logic that works when flying
        // When isFadingOut is true, particles have been set to start at FADE_START
        // so they immediately begin fading using the normal lifetime fade
        if (lifetimeRatio > TRAIL_CONFIG.FADE_START) {
            const newOpacity = 0.8 * (1 - lifetimeRatio) / (1 - TRAIL_CONFIG.FADE_START);
            particle.material.opacity = newOpacity;
            particle.material.transparent = true;
            
            // Debug: log first particle's fade progress
            if (isFadingOut && index === trailParticles.length - 1 && Math.floor(age / 200) !== Math.floor((age - 16) / 200)) {
                console.log(`Trail fading: age=${age.toFixed(0)}, ratio=${lifetimeRatio.toFixed(3)}, opacity=${newOpacity.toFixed(3)}`);
            }
        }
        
        // Remove old particles based on normal lifetime
        if (age > TRAIL_CONFIG.LIFETIME) {
            scene.remove(particle);
            trailParticles.splice(index, 1);
            continue; // Skip movement updates for removed particles
        }
        
        // Move particles in sync with terrain chunk group (same as clouds)
        // This happens regardless of fade-out state, but movement may be zero when crashed
        // Chunk group moves at -noiseOffset, so particles should move at -deltaX, -deltaZ, -deltaY
        particle.position.x -= deltaX;  // Same as clouds
        particle.position.z -= deltaZ;  // Same as clouds
        particle.position.y -= deltaY;   // Same as clouds
    }
}

// Start fading out the trail (called when plane crashes)
// Uses the same lifetime-based fade mechanism that works when flying
export function fadeOutTrail() {
    if (trailParticles.length === 0) {
        console.log('No trail particles to fade out');
        return;
    }
    isFadingOut = true;
    const currentTime = Date.now();
    
    // Set all particles to be at FADE_START (70% of lifetime) so they immediately start fading
    // This uses the same fade mechanism that works when flying
    trailParticles.forEach(particle => {
        // Set the particle's "createdAt" time so it's already at FADE_START
        // This makes it immediately start fading using the normal fade logic
        const targetAge = TRAIL_CONFIG.LIFETIME * TRAIL_CONFIG.FADE_START;
        particle.userData.createdAt = currentTime - targetAge;
        
        // Debug: verify the setup
        const age = currentTime - particle.userData.createdAt;
        const lifetimeRatio = age / TRAIL_CONFIG.LIFETIME;
        console.log(`Particle fade setup: age=${age.toFixed(0)}, ratio=${lifetimeRatio.toFixed(3)}, should fade=${lifetimeRatio > TRAIL_CONFIG.FADE_START}`);
    });
    
    console.log(`Fading out ${trailParticles.length} trail particles using lifetime fade`);
}

export function clearTrail(scene) {
    trailParticles.forEach(particle => scene.remove(particle));
    trailParticles = [];
    isFadingOut = false;
    fadeOutStartTime = 0;
} 