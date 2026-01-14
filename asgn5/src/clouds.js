import * as THREE from 'three';

// Cloud management
export const CLOUD_CONFIG = {
    SPAWN_DISTANCE: 200,                // Distance from center to spawn new clouds
    DESPAWN_DISTANCE: 250,              // Distance from center to despawn clouds
    MAX_CLOUDS: 40,                     // Maximum number of clouds in the scene
    SPAWN_HEIGHT: { min: 15, max: 25 }, // Height range for cloud spawning
    SPAWN_RADIUS: 150,                  // Radius around the center where clouds can spawn
    MOVE_SPEED: 1.0 * (1/2),            // Match terrain speed normalization
    FADE_DISTANCE: 50,                  // Distance over which clouds fade in/out
    VARIATION: {
        SIZE: { min: 0.8, max: 1.2 },   // Size variation for clouds
        SPEED: { min: 0.8, max: 1.2 },  // Speed variation for clouds
        OPACITY: { min: 0.4, max: 0.7 } // Opacity variation for clouds
    }
};

/** @type {Array} */ let clouds = [];  // Array to track active clouds
/** @type {Object} */ let lastNoiseOffset = { x: 0, z: 0, y: 0 };  // Track last offset

export function createCloud(x, y, z) {
    const cloud = new THREE.Group();
    const baseOpacity = CLOUD_CONFIG.VARIATION.OPACITY.min + 
                       Math.random() * (CLOUD_CONFIG.VARIATION.OPACITY.max - CLOUD_CONFIG.VARIATION.OPACITY.min);
    
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,  // Start fully transparent
        roughness: 0.9,
        metalness: 0.0,
        depthWrite: false
    });

    // Determine cloud size variation
    const sizeVariation = CLOUD_CONFIG.VARIATION.SIZE.min + 
                         Math.random() * (CLOUD_CONFIG.VARIATION.SIZE.max - CLOUD_CONFIG.VARIATION.SIZE.min);
    const baseRadius = 2.5 * sizeVariation;
    
    // Create main cloud body
    const numSpheres = Math.floor(Math.random() * 3) + 3; // 3-5 Spheres per cloud
    for (let i = 0; i < numSpheres; i++) {
        const sphereGeometry = new THREE.SphereGeometry(baseRadius, 16, 16);
        const sphere = new THREE.Mesh(sphereGeometry, material.clone());
        
        // Create more natural clustering
        const angle = (i / numSpheres) * Math.PI * 2;
        const radius = baseRadius * 0.5;
        const heightVariation = Math.random() * 0.5;
        
        sphere.position.set(
            Math.cos(angle) * radius + (Math.random() - 0.5) * 1.5,
            heightVariation,
            Math.sin(angle) * radius + (Math.random() - 0.5) * 1.5
        );
        
        // Slightly scale each sphere for more natural look
        const scale = 0.8 + Math.random() * 0.4;
        sphere.scale.set(scale, scale, scale);
        
        cloud.add(sphere);
    }

    // Add detail spheres
    const numDetails = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < numDetails; i++) {
        const detailGeometry = new THREE.SphereGeometry(baseRadius * 0.6, 16, 16);
        const detail = new THREE.Mesh(detailGeometry, material.clone());
        
        // Position details more naturally
        const detailAngle = Math.random() * Math.PI * 2;
        const detailRadius = baseRadius * 0.8;
        detail.position.set(
            Math.cos(detailAngle) * detailRadius + (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.0,
            Math.sin(detailAngle) * detailRadius + (Math.random() - 0.5) * 1.5
        );
        
        // Scale details for variety
        const detailScale = 0.6 + Math.random() * 0.4;
        detail.scale.set(detailScale, detailScale, detailScale);
        
        cloud.add(detail);
    }
    
    cloud.position.set(x, y, z);
    cloud.userData = { 
        fadeProgress: 0,
        speedFactor: CLOUD_CONFIG.VARIATION.SPEED.min + 
                    Math.random() * (CLOUD_CONFIG.VARIATION.SPEED.max - CLOUD_CONFIG.VARIATION.SPEED.min),
        baseOpacity: baseOpacity
    };
    return cloud;
}

export function updateClouds(scene, noiseOffset) {
    const airplane = scene.getObjectByName('airplane');
    if (!airplane) return;

    const deltaX = noiseOffset.x - lastNoiseOffset.x;
    const deltaZ = noiseOffset.z - lastNoiseOffset.z;
    const deltaY = (noiseOffset.y || 0) - (lastNoiseOffset.y || 0);
    
    lastNoiseOffset.x = noiseOffset.x;
    lastNoiseOffset.z = noiseOffset.z;
    lastNoiseOffset.y = noiseOffset.y || 0;

    clouds.forEach(cloud => {
        // Move clouds in sync with terrain chunk group
        // Chunk group moves at -noiseOffset, so clouds should move at -deltaX, -deltaZ, -deltaY
        // This keeps clouds in sync with the terrain movement
        cloud.position.x -= deltaX;  // Move opposite to noiseOffset.x (same as chunk group)
        cloud.position.z -= deltaZ;  // Move opposite to noiseOffset.z (same as chunk group)
        cloud.position.y -= deltaY;  // Move opposite to noiseOffset.y (same as chunk group moves down when noiseOffset.y increases)

        const distance = Math.sqrt(
            Math.pow(cloud.position.x, 2) +
            Math.pow(cloud.position.z, 2)
        );

        const fadeStart = CLOUD_CONFIG.SPAWN_DISTANCE - CLOUD_CONFIG.FADE_DISTANCE;
        const fadeProgress = Math.min(1, Math.max(0, (distance - fadeStart) / CLOUD_CONFIG.FADE_DISTANCE));
        
        cloud.userData.fadeProgress = fadeProgress;
        
        cloud.children.forEach(part => {
            if (part.material) {
                part.material.opacity = cloud.userData.baseOpacity * (1 - fadeProgress);
            }
        });

        if (distance > CLOUD_CONFIG.DESPAWN_DISTANCE) {
            scene.remove(cloud);
            return;
        }
    });

    clouds = clouds.filter(cloud => cloud.parent === scene);
    
    // Spawn new clouds in clusters
    while (clouds.length < CLOUD_CONFIG.MAX_CLOUDS) {
        const yaw = airplane.rotation.y;
        const spawnAngle = yaw + (Math.random() - 0.5) * Math.PI * 0.5;
        const radius = CLOUD_CONFIG.SPAWN_DISTANCE;
        
        // Create cluster of clouds
        const clusterSize = Math.min(3, CLOUD_CONFIG.MAX_CLOUDS - clouds.length);
        for (let i = 0; i < clusterSize; i++) {
            const clusterOffset = (Math.random() - 0.5) * 30;
            const x = Math.sin(spawnAngle) * radius + clusterOffset;
            const z = Math.cos(spawnAngle) * radius + clusterOffset;
            const y = CLOUD_CONFIG.SPAWN_HEIGHT.min + 
                     Math.random() * (CLOUD_CONFIG.SPAWN_HEIGHT.max - CLOUD_CONFIG.SPAWN_HEIGHT.min);

            const cloud = createCloud(x, y, z);
            scene.add(cloud);
            clouds.push(cloud);
        }
    }
}

export function initializeClouds(scene) {
    // Create initial cloud clusters
    for (let i = 0; i < CLOUD_CONFIG.MAX_CLOUDS; i += 3) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * CLOUD_CONFIG.SPAWN_RADIUS;
        const clusterOffset = (Math.random() - 0.5) * 20;
        
        for (let j = 0; j < 3 && (i + j) < CLOUD_CONFIG.MAX_CLOUDS; j++) {
            const x = Math.cos(angle) * radius + clusterOffset;
            const z = Math.sin(angle) * radius + clusterOffset;
            const y = CLOUD_CONFIG.SPAWN_HEIGHT.min + 
                     Math.random() * (CLOUD_CONFIG.SPAWN_HEIGHT.max - CLOUD_CONFIG.SPAWN_HEIGHT.min);
            
            const cloud = createCloud(x, y, z);
            scene.add(cloud);
            clouds.push(cloud);
        }
    }
}

// Reset clouds to origin (for respawn)
export function resetClouds(scene) {
    // Remove all existing clouds
    clouds.forEach(cloud => {
        scene.remove(cloud);
        // Dispose of geometries and materials
        cloud.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    });
    clouds = [];
    
    // Reset noise offset tracking
    lastNoiseOffset = { x: 0, z: 0, y: 0 };
    
    // Reinitialize clouds
    initializeClouds(scene);
} 