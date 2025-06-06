import * as THREE from 'three';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';
import { speedMultiplier } from './asg5.js';


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
    GRASS_HEIGHT: -25,     // Height where grass ends (moved up to create rock zone)
    SNOW_START: 35,        // Height where snow begins
    COLORS: {
        WATER: new THREE.Color(0x0077be),    // Deep blue
        GRASS: new THREE.Color(0x228B22),    // Forest green
        SNOW: new THREE.Color(0xFFFFFF).multiplyScalar(5),  // Very brighter white
        ROCK: new THREE.Color(0x808080)      // Grey
    }
};

// Helper function to determine terrain color based on height
function getTerrainColor(height) {
    if (height < TERRAIN_CONFIG.GRASS_HEIGHT - 9.99) {  // Water is 10 units below grass height
        return TERRAIN_CONFIG.COLORS.WATER;
    } else if (height < TERRAIN_CONFIG.GRASS_HEIGHT) {
        return TERRAIN_CONFIG.COLORS.GRASS;
    } else if (height > TERRAIN_CONFIG.SNOW_START) {
        return TERRAIN_CONFIG.COLORS.SNOW;
    } else {
        return TERRAIN_CONFIG.COLORS.ROCK;
    }
}

// Helper function to set color in the colors array
function setColorInArray(colors, index, color) {
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
}

// Helper function to calculate terrain height using noise
function calculateTerrainHeight(x, z, noiseOffset) {
    const worldX = x + noiseOffset.x;
    const worldZ = z + noiseOffset.z;
    
    const noise1 = noise2D(worldX * DISTANCE_SCALE, worldZ * DISTANCE_SCALE) * HEIGHT_SCALE;
    const noise2 = noise2D(worldX * NOISE_SCALE, worldZ * NOISE_SCALE) * (HEIGHT_SCALE * 0.4);
    const noise3 = noise2D(worldX * NOISE_SCALE * 2, worldZ * NOISE_SCALE * 2) * (HEIGHT_SCALE * 0.2);
    const noise4 = noise2D(worldX * NOISE_SCALE * 4, worldZ * NOISE_SCALE * 4) * (HEIGHT_SCALE * 0.1);

    let baseHeight = noise1 + noise2 + noise3 + noise4;
    
    // Handle water level
    if (baseHeight < TERRAIN_CONFIG.WATER_LEVEL) {
        baseHeight = TERRAIN_CONFIG.WATER_LEVEL;
    }
    
    return baseHeight;
}

// Create the terrain plane
const noise2D = createNoise2D();
export function createTerrainPlane(scene, noiseOffset) {
    const planeGeometry = new THREE.PlaneGeometry(500, 500, 75, 75);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.0,
        flatShading: true,
        vertexColors: true
    });

    const vertices = planeGeometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];

        const height = calculateTerrainHeight(x, y, noiseOffset);
        vertices[i + 2] = height;

        const color = getTerrainColor(height);
        setColorInArray(colors, i, color);
    }
    
    planeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planeGeometry.attributes.position.needsUpdate = true;
    planeGeometry.computeVertexNormals();

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
    return plane;
}

// Update terrain based on airplane position
export function updateTerrain(airplane, noiseOffset, plane) {
    if (!plane || !plane.geometry) {
        console.log('Terrain plane or geometry is missing:', plane);
        return;
    }

    const baseSpeed = 0.25;
    const currentSpeed = baseSpeed * (1/4) * speedMultiplier; // Use imported speed multiplier
    
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(airplane.quaternion);//quaternions used to store rotations without gimbal lock, based on plane's rot in airplane.js
    forwardVector.normalize();

    noiseOffset.x += forwardVector.x * currentSpeed;
    noiseOffset.z -= forwardVector.z * currentSpeed;
    noiseOffset.y = (noiseOffset.y || 0) - forwardVector.y * currentSpeed;
    
    const vertices = plane.geometry.attributes.position.array;
    const colors = plane.geometry.attributes.color.array;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];

        const baseHeight = calculateTerrainHeight(x, y, noiseOffset);
        const height = baseHeight + (noiseOffset.y || 0);
        vertices[i + 2] = height;

        const color = getTerrainColor(baseHeight);  // Use baseHeight for color determination
        setColorInArray(colors, i, color);
    }

    plane.geometry.attributes.position.needsUpdate = true;
    plane.geometry.attributes.color.needsUpdate = true;
    plane.geometry.computeVertexNormals();
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
    plane.rotation.x = THREE.MathUtils.clamp(
        plane.rotation.x,
        -Math.PI / 2,
        Math.PI / 2
    );
} 