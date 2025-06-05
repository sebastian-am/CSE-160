import * as THREE from 'three';

// Cloud management
export const CLOUD_CONFIG = {
    SPAWN_DISTANCE: 200,   // Distance from center to spawn new clouds
    DESPAWN_DISTANCE: 250, // Distance from center to despawn clouds
    MAX_CLOUDS: 40,       // Maximum number of clouds in the scene
    SPAWN_HEIGHT: { min: 15, max: 25 }, // Height range for cloud spawning
    SPAWN_RADIUS: 150,    // Radius around the center where clouds can spawn
    MOVE_SPEED: 1.0 * (1/2),  // Match terrain speed normalization
    FADE_DISTANCE: 50     // Distance over which clouds fade in/out
};

let clouds = [];  // Array to track active clouds
let lastNoiseOffset = { x: 0, z: 0, y: 0 };  // Track last offset for smooth movement

export function createCloud(x, y, z) {
    const cloud = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,  // Start fully transparent
        roughness: 0.9,
        metalness: 0.0,
        depthWrite: false
    });

    // Create base cloud shape with 3-5 spheres
    const numSpheres = Math.floor(Math.random() * 3) + 3;
    const baseRadius = 2.5;
    
    // Create several overlapping spheres for a cloud
    for (let i = 0; i < numSpheres; i++) {
        const sphereGeometry = new THREE.SphereGeometry(baseRadius, 16, 16);
        const sphere = new THREE.Mesh(sphereGeometry, material.clone());  // Clone material for individual control
        
        // Position spheres in a more natural cluster
        const angle = (i / numSpheres) * Math.PI * 2;
        const radius = baseRadius * 0.5;
        sphere.position.set(
            Math.cos(angle) * radius + (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.0,
            Math.sin(angle) * radius + (Math.random() - 0.5) * 1.5
        );
        
        cloud.add(sphere);
    }

    // Add some smaller detail spheres
    const numDetails = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < numDetails; i++) {
        const detailGeometry = new THREE.SphereGeometry(baseRadius * 0.6, 16, 16);
        const detail = new THREE.Mesh(detailGeometry, material.clone());  // Clone material for individual control
        
        detail.position.set(
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 3
        );
        
        cloud.add(detail);
    }
    
    cloud.position.set(x, y, z);
    cloud.userData = { fadeProgress: 0 };  // Track fade progress
    return cloud;
}

export function updateClouds(scene, noiseOffset) {
    // Get airplane's direction
    const airplane = scene.getObjectByName('airplane');
    if (!airplane) return;

    // Calculate the change in offset
    const deltaX = noiseOffset.x - lastNoiseOffset.x;
    const deltaZ = noiseOffset.z - lastNoiseOffset.z;
    const deltaY = (noiseOffset.y || 0) - (lastNoiseOffset.y || 0);  // Track y offset changes
    
    // Update last offset
    lastNoiseOffset.x = noiseOffset.x;
    lastNoiseOffset.z = noiseOffset.z;
    lastNoiseOffset.y = noiseOffset.y || 0;

    // Update cloud positions and handle fading
    clouds.forEach(cloud => {
        // Move clouds smoothly with terrain offset
        cloud.position.x -= deltaX * CLOUD_CONFIG.MOVE_SPEED;
        cloud.position.z += deltaZ * CLOUD_CONFIG.MOVE_SPEED;
        cloud.position.y += deltaY * CLOUD_CONFIG.MOVE_SPEED;  // Move with terrain's y offset

        // Calculate distance from center
        const distance = Math.sqrt(
            Math.pow(cloud.position.x, 2) +
            Math.pow(cloud.position.z, 2)
        );

        // Handle fading
        const fadeStart = CLOUD_CONFIG.SPAWN_DISTANCE - CLOUD_CONFIG.FADE_DISTANCE;
        const fadeEnd = CLOUD_CONFIG.SPAWN_DISTANCE;
        const fadeProgress = Math.min(1, Math.max(0, (distance - fadeStart) / CLOUD_CONFIG.FADE_DISTANCE));
        
        // Update fade progress
        cloud.userData.fadeProgress = fadeProgress;
        
        // Apply fade to all cloud parts
        cloud.children.forEach(part => {
            if (part.material) {
                part.material.opacity = 0.6 * (1 - fadeProgress);
            }
        });

        // Remove clouds that are too far away
        if (distance > CLOUD_CONFIG.DESPAWN_DISTANCE) {
            scene.remove(cloud);
            return;
        }
    });

    // Filter out removed clouds
    clouds = clouds.filter(cloud => cloud.parent === scene);

    // Spawn new clouds if needed
    while (clouds.length < CLOUD_CONFIG.MAX_CLOUDS) {
        // Get airplane's yaw angle
        const yaw = airplane.rotation.y;
        
        // Calculate spawn position ahead of the airplane
        const spawnAngle = yaw + (Math.random() - 0.5) * Math.PI * 0.5; // Reduced angle range
        const radius = CLOUD_CONFIG.SPAWN_DISTANCE;
        const x = Math.sin(spawnAngle) * radius + (Math.random() - 0.5) * 30;
        const z = Math.cos(spawnAngle) * radius + (Math.random() - 0.5) * 30;
        const y = CLOUD_CONFIG.SPAWN_HEIGHT.min + 
                 Math.random() * (CLOUD_CONFIG.SPAWN_HEIGHT.max - CLOUD_CONFIG.SPAWN_HEIGHT.min);

        const cloud = createCloud(x, y, z);
        scene.add(cloud);
        clouds.push(cloud);
    }
}

export function initializeClouds(scene) {
    // Initialize clouds
    for (let i = 0; i < CLOUD_CONFIG.MAX_CLOUDS; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * CLOUD_CONFIG.SPAWN_RADIUS;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = CLOUD_CONFIG.SPAWN_HEIGHT.min + 
                 Math.random() * (CLOUD_CONFIG.SPAWN_HEIGHT.max - CLOUD_CONFIG.SPAWN_HEIGHT.min);
        
        const cloud = createCloud(x, y, z);
        scene.add(cloud);
        clouds.push(cloud);
    }
} 