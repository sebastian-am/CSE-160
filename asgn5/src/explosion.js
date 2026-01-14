import * as THREE from 'three';

//===============================================
// Global Variables
//===============================================
/** @type {Array<THREE.Mesh>} */ let explosionParticles = [];
/** @type {boolean} */ let hasExploded = false;
/** @type {Object} */ let explosionState = {
    startTime: 0,
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    spawnedLayers: 0,
    maxLayers: 5
};

// Explosion Configuration
const EXPLOSION_CONFIG = {
    SMOKE_PARTICLES: 25,        // Increased for more dark smoke on outside
    RED_PARTICLES: 10,          // Increased for more center glow
    ARC_PARTICLES: 12,          // Number of arcing particles
    LIFETIME: 8000,             // Much longer lifetime before fading (ms)
    SMOKE: {
        SIZE: 1.0,  // Smaller voxels for better scale relative to plane
        COLOR: 0x1a1a1a,        // Darker smoke
        SPEED: { min: 0.01, max: 0.04 }, // Slower outward movement
        RISE_SPEED: 0.03,       // Very slow continuous rise
        VELOCITY_DECAY: 0.98,   // Slower decay so particles keep rising
        VOXEL_SPACING: 1.0,     // Spacing = size (touching, not overlapping)
        LAYER_SPAWN_INTERVAL: 200  // Slower expansion - spawn new layer every 200ms
    },
    RED: {
        SIZE: 0.8,  // Smaller red voxels
        COLOR: 0xFF3300,        // More orange-red
        SPEED: { min: 0.01, max: 0.04 }, // Slower speed
        EMISSIVE: 0xFF4400,     // Glow color
        EMISSIVE_INTENSITY: 5.0, // Even stronger glow to be more visible
        VOXEL_SPACING: 0.8      // Spacing = size (touching, not overlapping)
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
    // Use fixed size for voxel grid (no randomization for clean voxel look)
    const size = config.SIZE;
    
    // Use cubes (voxels) - positioned in grid so they touch but don't overlap
    const geometry = new THREE.BoxGeometry(size, size, size);
    
    // Create material with type-specific properties
    const materialProps = {
        color: config.COLOR,
        transparent: true,
        opacity: type === 'smoke' ? 0.8 : 0.9,  // Higher opacity for voxel connections
        roughness: 0.8,
        metalness: 0.1,
        depthWrite: false
    };
    
    // Add glow/emissive for red particles
    if (type === 'red' && config.EMISSIVE) {
        materialProps.emissive = new THREE.Color(config.EMISSIVE);
        materialProps.emissiveIntensity = config.EMISSIVE_INTENSITY || 1.0;
        // Make red particles fully opaque and brighter
        materialProps.opacity = 1.0;
        materialProps.roughness = 0.3; // Less rough for more glow
    }
    
    const material = new THREE.MeshStandardMaterial(materialProps);

    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(x, y, z);
    
    // Random velocity based on type
    let velocity;
    if (type === 'smoke') {
        // Smoke puffs out very slowly and rises - minimal initial velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (config.SPEED.max - config.SPEED.min) + config.SPEED.min;
        // Very minimal horizontal movement - expansion comes from new voxels, not velocity
        velocity = new THREE.Vector3(
            Math.cos(angle) * speed * 0.05,  // Even slower horizontal
            config.RISE_SPEED + Math.random() * 0.02,  // Very slow rise
            Math.sin(angle) * speed * 0.05
        );
    } else if (type === 'red') {
        // Red voxels flow with the explosion (same movement as smoke)
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (config.SPEED.max - config.SPEED.min) + config.SPEED.min;
        // Same slow movement as smoke so they flow together
        velocity = new THREE.Vector3(
            Math.cos(angle) * speed * 0.05,  // Even slower horizontal
            EXPLOSION_CONFIG.SMOKE.RISE_SPEED + Math.random() * 0.02,  // Same very slow rise as smoke
            Math.sin(angle) * speed * 0.05
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
        initialY: y,
        initialSize: size
    };
    
    return particle;
}

// Helper function to spawn voxels in an organic layer (mushroom-cloud shape)
function spawnVoxelLayer(scene, centerX, centerY, centerZ, layer, type, config, includeRed = false) {
    const spacing = config.VOXEL_SPACING;
    // Smaller base radius for better scale
    const baseRadius = layer * spacing * 0.8;
    
    // Create organic mushroom-cloud shape - wider at bottom, narrower at top
    // Start lower for more grounded explosion
    const layerHeight = (layer - 1) * spacing * 0.5; // Start from below center, slower vertical growth
    // Taper more aggressively for mushroom shape
    const heightFactor = 1.0 - (layerHeight * 0.15);
    const radiusMultiplier = Math.max(0.4, heightFactor); // Bottom wider, top narrower
    
    // Spawn voxels in a spherical shell with organic variation
    const voxelsPerLayer = 8 + layer * 3; // Fewer voxels for smaller scale
    for (let i = 0; i < voxelsPerLayer; i++) {
        // Spherical coordinates with variation for organic shape
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;  // Azimuth angle
        const phi = Math.acos(2.0 * v - 1.0);  // Polar angle
        
        // More organic variation - irregular lobes and tendrils
        const radiusVariation = 0.5 + Math.random() * 0.8; // 0.5 to 1.3 for more irregularity
        const radius = baseRadius * radiusMultiplier * radiusVariation;
        
        // Calculate position with more organic vertical distribution
        const verticalVariation = (Math.random() - 0.5) * spacing * 0.8;
        const offsetX = radius * Math.sin(phi) * Math.cos(theta);
        const offsetY = layerHeight + verticalVariation;
        const offsetZ = radius * Math.sin(phi) * Math.sin(theta);
        
        // Snap to voxel grid (so cubes align properly)
        const voxelX = Math.round(offsetX / spacing) * spacing;
        const voxelY = Math.round(offsetY / spacing) * spacing;
        const voxelZ = Math.round(offsetZ / spacing) * spacing;
        
        const particle = createExplosionParticle(
            centerX + voxelX,
            centerY + voxelY,
            centerZ + voxelZ,
            type,
            config
        );
        scene.add(particle);
        explosionParticles.push(particle);
        
        // Spawn red particles in inner layers (core of explosion)
        if (includeRed && layer <= 2 && Math.random() < 0.3) {
            // Spawn red voxels near the core of smoke layers
            const redOffsetX = voxelX * 0.3; // Closer to center
            const redOffsetY = voxelY * 0.3;
            const redOffsetZ = voxelZ * 0.3;
            
            const redParticle = createExplosionParticle(
                centerX + redOffsetX,
                centerY + redOffsetY,
                centerZ + redOffsetZ,
                'red',
                EXPLOSION_CONFIG.RED
            );
            scene.add(redParticle);
            explosionParticles.push(redParticle);
        }
    }
}

// Create explosion at position
export function createExplosion(scene, x, y, z) {
    if (hasExploded) return; // Prevent multiple explosions
    
    hasExploded = true;
    const currentTime = Date.now();
    
    // Initialize explosion state
    explosionState.startTime = currentTime;
    explosionState.centerX = x;
    explosionState.centerY = y;
    explosionState.centerZ = z;
    explosionState.spawnedLayers = 0;
    
    // Spawn initial core: red voxels at center in a compact cluster
    const redSpacing = EXPLOSION_CONFIG.RED.VOXEL_SPACING;
    // Create a dense cluster of red voxels at the very center
    // Spawn in a small 2x2x2 grid at exact center for guaranteed visibility
    const redGridSize = 2;
    for (let i = 0; i < redGridSize; i++) {
        for (let j = 0; j < redGridSize; j++) {
            for (let k = 0; k < redGridSize; k++) {
                const gridX = (i - redGridSize / 2 + 0.5) * redSpacing;
                const gridY = (j - redGridSize / 2 + 0.5) * redSpacing;
                const gridZ = (k - redGridSize / 2 + 0.5) * redSpacing;
                
                const particle = createExplosionParticle(
                    x + gridX,
                    y + gridY,
                    z + gridZ,
                    'red',
                    EXPLOSION_CONFIG.RED
                );
                scene.add(particle);
                explosionParticles.push(particle);
            }
        }
    }
    
    // Spawn first layer of smoke voxels immediately (base of explosion)
    // Include red particles in inner layers for visible core
    spawnVoxelLayer(scene, x, y, z, 1, 'smoke', EXPLOSION_CONFIG.SMOKE, true);
    explosionState.spawnedLayers = 1;
    
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
    
    // Spawn new voxel layers over time to create expanding effect
    if (hasExploded && explosionState.startTime) {
        const explosionAge = currentTime - explosionState.startTime;
        const layersToSpawn = Math.floor(explosionAge / EXPLOSION_CONFIG.SMOKE.LAYER_SPAWN_INTERVAL) + 1;
        
        // Spawn new layers as explosion expands
        while (explosionState.spawnedLayers < layersToSpawn && explosionState.spawnedLayers < explosionState.maxLayers) {
            explosionState.spawnedLayers++;
            // Include red particles in first 2 layers (core)
            const includeRed = explosionState.spawnedLayers <= 2;
            spawnVoxelLayer(
                scene, 
                explosionState.centerX, 
                explosionState.centerY, 
                explosionState.centerZ,
                explosionState.spawnedLayers,
                'smoke',
                EXPLOSION_CONFIG.SMOKE,
                includeRed
            );
        }
    }
    
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
        
        // Fade out over 2 seconds, starting earlier (at 4 seconds, so fade from 4-6 seconds)
        const fadeDuration = 2000; // 2 seconds fade duration (same as before)
        const fadeStartTime = 4000; // Start fading at 4 seconds (sooner than before)
        if (age > fadeStartTime) {
            const fadeRatio = Math.min((age - fadeStartTime) / fadeDuration, 1.0); // Fade over 2 seconds
            particle.material.opacity = 0.9 * (1 - fadeRatio);
        } else {
            particle.material.opacity = 0.9; // Full opacity until fade starts
        }
        
        // Smoke and red voxels don't scale - expansion comes from new voxels
        // Slow down velocity but ensure they keep slowly rising
        if (particle.userData.type === 'smoke' || particle.userData.type === 'red') {
            particle.userData.velocity.multiplyScalar(EXPLOSION_CONFIG.SMOKE.VELOCITY_DECAY);
            
            // Ensure minimum rise speed AFTER decay so particles never stop rising
            const config = EXPLOSION_CONFIG.SMOKE;
            if (particle.userData.velocity.y < config.RISE_SPEED * 0.2) {
                particle.userData.velocity.y = config.RISE_SPEED * 0.2; // Minimum slow continuous rise
            }
        }
        
        // Red particles fade but maintain glow longer
        if (particle.userData.type === 'red') {
            // Maintain strong emissive intensity until fade starts
            if (particle.material.emissive) {
                const fadeDuration = 2000; // Same 2 second fade duration
                const fadeStartTime = 4000; // Same fade timing as opacity (start at 4 seconds)
                if (age > fadeStartTime) {
                    const fadeRatio = Math.min((age - fadeStartTime) / fadeDuration, 1.0); // Fade over 2 seconds
                    particle.material.emissiveIntensity = EXPLOSION_CONFIG.RED.EMISSIVE_INTENSITY * (1 - fadeRatio);
                } else {
                    particle.material.emissiveIntensity = EXPLOSION_CONFIG.RED.EMISSIVE_INTENSITY; // Full glow
                }
            }
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
    explosionState = {
        startTime: 0,
        centerX: 0,
        centerY: 0,
        centerZ: 0,
        spawnedLayers: 0,
        maxLayers: 4  // Fewer layers for shorter, more compact explosion
    };
}

// Check if explosion has happened
export function getHasExploded() {
    return hasExploded;
}

// Reset explosion state
export function resetExplosion() {
    hasExploded = false;
}

