import * as THREE from 'three';

//===============================================
// Global Variables
//===============================================
/** @type {Array<THREE.Mesh>} */ let explosionParticles = [];
/** @type {boolean} */ let hasExploded = false;

// Explosion Configuration
const EXPLOSION_CONFIG = {
    SMOKE_PARTICLES: 15,        // Number of smoke puffs
    RED_PARTICLES: 8,           // Number of red base particles
    ARC_PARTICLES: 12,          // Number of arcing particles
    LIFETIME: 3000,             // How long explosion lasts (ms)
    SMOKE: {
        SIZE: { min: 0.8, max: 1.5 },
        COLOR: 0x333333,
        SPEED: { min: 0.3, max: 0.8 },
        RISE_SPEED: 0.5
    },
    RED: {
        SIZE: { min: 0.4, max: 0.7 },
        COLOR: 0xFF4444,
        SPEED: { min: 0.5, max: 1.2 },
        SPREAD: 2.0
    },
    ARC: {
        SIZE: { min: 0.2, max: 0.4 },
        COLOR: 0xFFAA00,
        SPEED: { min: 0.8, max: 1.5 },
        ARC_HEIGHT: 3.0,
        GRAVITY: 0.02
    }
};

// Helper function to create explosion particle
function createExplosionParticle(x, y, z, type, config) {
    const size = Math.random() * (config.SIZE.max - config.SIZE.min) + config.SIZE.min;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
        color: config.COLOR,
        transparent: true,
        opacity: 0.9,
        roughness: 0.8,
        metalness: 0.1,
        depthWrite: false
    });

    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(x, y, z);
    
    // Random velocity based on type
    let velocity;
    if (type === 'smoke') {
        // Smoke rises and spreads
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (config.SPEED.max - config.SPEED.min) + config.SPEED.min;
        velocity = new THREE.Vector3(
            Math.cos(angle) * speed * 0.5,
            config.RISE_SPEED + Math.random() * 0.3,
            Math.sin(angle) * speed * 0.5
        );
    } else if (type === 'red') {
        // Red particles spread outward from base
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (config.SPEED.max - config.SPEED.min) + config.SPEED.min;
        const spread = Math.random() * config.SPREAD;
        velocity = new THREE.Vector3(
            Math.cos(angle) * speed * spread,
            Math.random() * speed * 0.5,
            Math.sin(angle) * speed * spread
        );
    } else { // arc
        // Arcing particles with gravity
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (config.SPEED.max - config.SPEED.min) + config.SPEED.min;
        const upwardSpeed = speed * 0.8;
        velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            upwardSpeed,
            Math.sin(angle) * speed
        );
    }
    
    particle.userData = {
        type: type,
        velocity: velocity,
        createdAt: Date.now(),
        initialY: y
    };
    
    return particle;
}

// Create explosion at position
export function createExplosion(scene, x, y, z) {
    if (hasExploded) return; // Prevent multiple explosions
    
    hasExploded = true;
    const currentTime = Date.now();
    
    // Create smoke puffs
    for (let i = 0; i < EXPLOSION_CONFIG.SMOKE_PARTICLES; i++) {
        const offsetX = (Math.random() - 0.5) * 2;
        const offsetY = (Math.random() - 0.5) * 1;
        const offsetZ = (Math.random() - 0.5) * 2;
        const particle = createExplosionParticle(
            x + offsetX,
            y + offsetY,
            z + offsetZ,
            'smoke',
            EXPLOSION_CONFIG.SMOKE
        );
        scene.add(particle);
        explosionParticles.push(particle);
    }
    
    // Create red base particles
    for (let i = 0; i < EXPLOSION_CONFIG.RED_PARTICLES; i++) {
        const offsetX = (Math.random() - 0.5) * 1.5;
        const offsetY = (Math.random() - 0.5) * 0.5;
        const offsetZ = (Math.random() - 0.5) * 1.5;
        const particle = createExplosionParticle(
            x + offsetX,
            y + offsetY,
            z + offsetZ,
            'red',
            EXPLOSION_CONFIG.RED
        );
        scene.add(particle);
        explosionParticles.push(particle);
    }
    
    // Create arcing particles
    for (let i = 0; i < EXPLOSION_CONFIG.ARC_PARTICLES; i++) {
        const offsetX = (Math.random() - 0.5) * 1;
        const offsetY = (Math.random() - 0.5) * 0.3;
        const offsetZ = (Math.random() - 0.5) * 1;
        const particle = createExplosionParticle(
            x + offsetX,
            y + offsetY,
            z + offsetZ,
            'arc',
            EXPLOSION_CONFIG.ARC
        );
        scene.add(particle);
        explosionParticles.push(particle);
    }
}

// Update explosion particles
export function updateExplosion(scene, noiseOffset) {
    const currentTime = Date.now();
    const deltaX = noiseOffset.x - (updateExplosion.lastNoiseOffset?.x || 0);
    const deltaZ = noiseOffset.z - (updateExplosion.lastNoiseOffset?.z || 0);
    const deltaY = (noiseOffset.y || 0) - (updateExplosion.lastNoiseOffset?.y || 0);
    updateExplosion.lastNoiseOffset = { ...noiseOffset, y: noiseOffset.y || 0 };
    
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const particle = explosionParticles[i];
        const age = currentTime - particle.userData.createdAt;
        const lifetimeRatio = age / EXPLOSION_CONFIG.LIFETIME;
        
        // Update position based on velocity and type
        if (particle.userData.type === 'arc') {
            // Apply gravity to arcing particles
            particle.userData.velocity.y -= EXPLOSION_CONFIG.ARC.GRAVITY;
        }
        
        particle.position.add(particle.userData.velocity);
        
        // Move with terrain (opposite direction)
        particle.position.x -= deltaX;
        particle.position.z -= deltaZ;
        particle.position.y -= deltaY;
        
        // Fade out over time
        particle.material.opacity = 0.9 * (1 - lifetimeRatio);
        
        // Scale down smoke particles as they rise
        if (particle.userData.type === 'smoke') {
            const scale = 1 + lifetimeRatio * 0.5; // Grow slightly
            particle.scale.set(scale, scale, scale);
        }
        
        // Remove old particles
        if (age > EXPLOSION_CONFIG.LIFETIME) {
            scene.remove(particle);
            explosionParticles.splice(i, 1);
        }
    }
}

// Clear explosion particles
export function clearExplosion(scene) {
    explosionParticles.forEach(particle => scene.remove(particle));
    explosionParticles = [];
    hasExploded = false;
}

// Check if explosion has happened
export function getHasExploded() {
    return hasExploded;
}

// Reset explosion state
export function resetExplosion() {
    hasExploded = false;
}

