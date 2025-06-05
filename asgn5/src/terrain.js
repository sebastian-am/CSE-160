import * as THREE from 'three';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';

// Create noise generator with fixed seed for consistency
const noise2D = createNoise2D();

// Flight physics configuration
const FLIGHT_CONFIG = {
    MIN_SPEED: 0.1,        // Minimum flight speed
    MAX_SPEED: 0.5,        // Maximum flight speed
    TURN_SPEED: 0.02,      // Turn rate
    PITCH_SPEED: 0.02,     // Climb/dive rate
    ACCELERATION: 0.01,    // Speed change rate
    CURRENT_SPEED: 0.2,    // Initial speed
    TARGET_SPEED: 0.2      // Target speed for smooth acceleration
};

// Terrain configuration
const HEIGHT_SCALE = 50;  // Height amplitude
const NOISE_SCALE = 0.01;  // Base frequency
const DISTANCE_SCALE = 0.005;  // Controls distance between major features

// Terrain color configuration
export const TERRAIN_CONFIG = {
    WATER_LEVEL: -35,      // Water level
    GRASS_HEIGHT: -20,     // Height where grass ends (moved up to create rock zone)
    SNOW_START: 35,        // Height where snow begins
    COLORS: {
        WATER: new THREE.Color(0x0077be),    // Deep blue
        GRASS: new THREE.Color(0x228B22),    // Forest green
        SNOW: new THREE.Color(0xFFFFFF).multiplyScalar(5),  // Much brighter white
        ROCK: new THREE.Color(0x808080)      // Grey
    }
};

// Create the terrain plane
export function createTerrainPlane(scene, noiseOffset) {
    // Create plane geometry
    const planeGeometry = new THREE.PlaneGeometry(500, 500, 75, 75);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080,  // Default grey color
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.0,
        flatShading: true,
        vertexColors: true
    });

    // Create color array for vertices
    const colors = new Float32Array(planeGeometry.attributes.position.count * 3);

    // Add simplex noise to the plane vertices
    const vertices = planeGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        // Use multiple layers of noise for more jagged terrain
        const noise1 = noise2D((x + noiseOffset.x) * DISTANCE_SCALE, (y + noiseOffset.z) * DISTANCE_SCALE) * HEIGHT_SCALE;
        const noise2 = noise2D((x + noiseOffset.x) * NOISE_SCALE, (y + noiseOffset.z) * NOISE_SCALE) * (HEIGHT_SCALE * 0.4);
        const noise3 = noise2D((x + noiseOffset.x) * NOISE_SCALE * 2, (y + noiseOffset.z) * NOISE_SCALE * 2) * (HEIGHT_SCALE * 0.2);
        const noise4 = noise2D((x + noiseOffset.x) * NOISE_SCALE * 4, (y + noiseOffset.z) * NOISE_SCALE * 4) * (HEIGHT_SCALE * 0.1);
        let height = noise1 + noise2 + noise3 + noise4;
        
        // Clamp height to water level if below it
        const isWater = height < TERRAIN_CONFIG.WATER_LEVEL;
        if (isWater) {
            height = TERRAIN_CONFIG.WATER_LEVEL;
        }
        
        // Set vertex height
        vertices[i + 2] = height;
        
        // Set vertex color based on height
        let color;
        if (isWater) {
            // Water - use water color regardless of height when it's water
            color = TERRAIN_CONFIG.COLORS.WATER;
        } else if (height < TERRAIN_CONFIG.GRASS_HEIGHT) {
            // Grass
            color = TERRAIN_CONFIG.COLORS.GRASS;
        } else if (height > TERRAIN_CONFIG.SNOW_START) {
            // Snow
            color = TERRAIN_CONFIG.COLORS.SNOW;
        } else {
            // Rock
            color = TERRAIN_CONFIG.COLORS.ROCK;
        }
        
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
    }
    
    // Add colors to geometry
    planeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planeGeometry.attributes.position.needsUpdate = true;
    planeGeometry.computeVertexNormals();

    // Create and position the plane
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -5;
    scene.add(plane);

    return plane;
}

function updateTerrain(plane, noiseOffset, terrainPlane) {
    if (!terrainPlane || !terrainPlane.geometry) {
        console.log('Terrain plane or geometry is missing:', terrainPlane);
        return;
    }

    // Calculate speed based on forward movement
    const baseSpeed = 0.25;
    const currentSpeed = baseSpeed * (1/4); // Normalize to 60fps

    
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(plane.quaternion); //quaternions used to store rotations without gimbal lock, based on plane's rot in model.js
    forwardVector.normalize();

    // Update noise offset based on plane's direction
    noiseOffset.x += forwardVector.x * currentSpeed;
    noiseOffset.z -= forwardVector.z * currentSpeed;  // Negative to make terrain move towards plane
    noiseOffset.y = (noiseOffset.y || 0) - forwardVector.y * currentSpeed;
    
    // Update terrain vertices with noise
    const vertices = terrainPlane.geometry.attributes.position.array;
    const colors = terrainPlane.geometry.attributes.color.array;
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        
        // Calculate world position
        const worldX = x + noiseOffset.x;
        const worldZ = y + noiseOffset.z;
        const worldY = (noiseOffset.y || 0); // Add vertical offset
        
        // Generate terrain height using multiple octaves of noise
        const noise1 = noise2D(worldX * DISTANCE_SCALE, worldZ * DISTANCE_SCALE) * HEIGHT_SCALE;
        const noise2 = noise2D(worldX * NOISE_SCALE, worldZ * NOISE_SCALE) * (HEIGHT_SCALE * 0.4);
        const noise3 = noise2D(worldX * NOISE_SCALE * 2, worldZ * NOISE_SCALE * 2) * (HEIGHT_SCALE * 0.2);
        const noise4 = noise2D(worldX * NOISE_SCALE * 4, worldZ * NOISE_SCALE * 4) * (HEIGHT_SCALE * 0.1);
        
        // Calculate base height (without vertical offset) for coloring
        let baseHeight = noise1 + noise2 + noise3 + noise4;
        
        // Clamp base height to water level if below it
        const isWater = baseHeight < TERRAIN_CONFIG.WATER_LEVEL;
        if (isWater) {
            baseHeight = TERRAIN_CONFIG.WATER_LEVEL;
        }
        
        // Add vertical offset for position
        let height = baseHeight + worldY;
        
        // Set vertex height
        vertices[i + 2] = height;
        
        // Set vertex color based on base height (without vertical offset)
        let color;
        if (isWater) {
            // Water
            color = TERRAIN_CONFIG.COLORS.WATER;
        } else if (baseHeight < TERRAIN_CONFIG.GRASS_HEIGHT) {
            // Grass
            color = TERRAIN_CONFIG.COLORS.GRASS;
        } else if (baseHeight > TERRAIN_CONFIG.SNOW_START) {
            // Snow
            color = TERRAIN_CONFIG.COLORS.SNOW;
        } else {
            // Rock
            color = TERRAIN_CONFIG.COLORS.ROCK;
        }
        
        // Force color update
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
    }
    
    terrainPlane.geometry.attributes.position.needsUpdate = true;
    terrainPlane.geometry.attributes.color.needsUpdate = true;
    terrainPlane.geometry.computeVertexNormals();
}

// Add these functions to control the plane's movement
export function increaseSpeed() {
    FLIGHT_CONFIG.TARGET_SPEED = Math.min(
        FLIGHT_CONFIG.TARGET_SPEED + 0.1,
        FLIGHT_CONFIG.MAX_SPEED
    );
}

export function decreaseSpeed() {
    FLIGHT_CONFIG.TARGET_SPEED = Math.max(
        FLIGHT_CONFIG.TARGET_SPEED - 0.1,
        FLIGHT_CONFIG.MIN_SPEED
    );
}

export function turnPlane(plane, direction) {
    plane.rotation.y += direction * FLIGHT_CONFIG.TURN_SPEED;
}

export function pitchPlane(plane, direction) {
    plane.rotation.x += direction * FLIGHT_CONFIG.PITCH_SPEED;
    // Clamp pitch to prevent flipping
    plane.rotation.x = THREE.MathUtils.clamp(
        plane.rotation.x,
        -Math.PI / 2,
        Math.PI / 2
    );
}

export { updateTerrain }; 