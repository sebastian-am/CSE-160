import * as THREE from 'three';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';
import { speedMultiplier } from './asg5.js';

// Chunk system configuration
const CHUNK_SIZE = 200;  // Size of each terrain chunk
const CHUNK_RESOLUTION = 50;  // Resolution of each chunk (50x50 segments)
// Note: PlaneGeometry creates vertices from -size/2 to +size/2, so chunks align at edges
const CHUNKS_LOADED = 5;  // Number of chunks in each direction (5x5 grid = 25 chunks)
const CHUNK_UPDATE_DISTANCE = CHUNK_SIZE * 0.5;  // Update chunks when airplane moves this far

// Chunk storage
const terrainChunks = new Map();  // Map of "x,z" -> chunk mesh
let chunkGroup = null;  // Group to hold all chunks
let currentChunkX = 0;
let currentChunkZ = 0;


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
// x and z should be absolute world coordinates for seamless chunk alignment
function calculateTerrainHeight(x, z, worldOffset) {
    // Use absolute world coordinates directly (worldOffset should be {x:0, z:0} when called with world coords)
    const worldX = x + (worldOffset.x || 0);
    const worldZ = z + (worldOffset.z || 0);
    
    // Sample noise at exact world position for seamless chunk edges
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

// Create a single terrain chunk at a specific world position
const noise2D = createNoise2D();
function createTerrainChunk(chunkX, chunkZ) {
    const planeGeometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_RESOLUTION, CHUNK_RESOLUTION);
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

    // Calculate world position for this chunk
    // Chunk centers are at exact multiples of CHUNK_SIZE
    const chunkCenterX = chunkX * CHUNK_SIZE;
    const chunkCenterZ = chunkZ * CHUNK_SIZE;
    
    // Calculate vertex spacing in the grid
    const vertexSpacing = CHUNK_SIZE / CHUNK_RESOLUTION;
    const numVerticesPerRow = CHUNK_RESOLUTION + 1; // 51 vertices for 50 segments

    // Calculate world coordinates from grid indices, not from local coordinates
    // This ensures boundary vertices use identical world coordinates regardless of chunk
    let vertexIndex = 0;
    for (let row = 0; row < numVerticesPerRow; row++) {
        for (let col = 0; col < numVerticesPerRow; col++) {
            const i = vertexIndex * 3;
            
            // Calculate world position from grid indices
            // Grid starts at chunk corner: chunkCenter - CHUNK_SIZE/2
            const chunkMinX = chunkCenterX - CHUNK_SIZE / 2;
            const chunkMinZ = chunkCenterZ - CHUNK_SIZE / 2;
            
            // World position = chunk corner + grid offset
            // This ensures boundary vertices (at col=0 or col=CHUNK_RESOLUTION) use exact coordinates
            const worldX = chunkMinX + col * vertexSpacing;
            const worldZ = chunkMinZ + row * vertexSpacing;

            // Use absolute world position for noise (ensures seamless chunks)
            // This ensures that the same world position always gets the same height
            const height = calculateTerrainHeight(worldX, worldZ, { x: 0, z: 0 });
            vertices[i + 2] = height;

            const color = getTerrainColor(height);
            setColorInArray(colors, i, color);
            
            vertexIndex++;
        }
    }
    
    planeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planeGeometry.attributes.position.needsUpdate = true;
    planeGeometry.computeVertexNormals();

    const chunk = new THREE.Mesh(planeGeometry, planeMaterial);
    chunk.rotation.x = -Math.PI / 2;
    // Position chunk at its center (geometry is centered, so position is at center)
    chunk.position.set(chunkCenterX, 0, chunkCenterZ);
    chunk.userData.chunkX = chunkX;
    chunk.userData.chunkZ = chunkZ;
    
    return chunk;
}

// Create initial terrain chunk system
export function createTerrainPlane(scene, noiseOffset) {
    chunkGroup = new THREE.Group();
    chunkGroup.name = 'terrainChunks';
    scene.add(chunkGroup);

    // Create initial grid of chunks around origin
    const halfChunks = Math.floor(CHUNKS_LOADED / 2);
    for (let x = -halfChunks; x <= halfChunks; x++) {
        for (let z = -halfChunks; z <= halfChunks; z++) {
            const chunkKey = `${x},${z}`;
            const chunk = createTerrainChunk(x, z);
            terrainChunks.set(chunkKey, chunk);
            chunkGroup.add(chunk);
        }
    }

    // Return a dummy object for compatibility
    return { geometry: null };
}

// Update terrain chunks based on airplane position
export function updateTerrain(airplane, noiseOffset, plane) {
    if (!chunkGroup || !airplane) {
        return;
    }

    const baseSpeed = 0.5;  // Doubled from 0.25
    const currentSpeed = baseSpeed * (1/4) * speedMultiplier;
    
    // Get airplane's forward direction
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(airplane.quaternion);
    forwardVector.normalize();

    // Move noise offset based on airplane's forward direction
    // This simulates the airplane moving through the world
    noiseOffset.x += forwardVector.x * currentSpeed;
    noiseOffset.z += forwardVector.z * currentSpeed;
    noiseOffset.y = (noiseOffset.y || 0) + forwardVector.y * currentSpeed;  // Fixed: changed minus to plus

    // Keep airplane at origin
    airplane.position.set(0, 0, 0);

    // Move chunk group opposite to noise offset to keep airplane centered
    // This makes chunks appear to move past the airplane
    chunkGroup.position.set(-noiseOffset.x, -noiseOffset.y, -noiseOffset.z);

    // Calculate which chunk the airplane is "in" based on noise offset
    // Chunks are centered at multiples of CHUNK_SIZE, so we round to nearest chunk
    // Use Math.round to find the nearest chunk center
    const newChunkX = Math.round(noiseOffset.x / CHUNK_SIZE);
    const newChunkZ = Math.round(noiseOffset.z / CHUNK_SIZE);

    // Only update chunks if airplane has moved to a different chunk
    if (newChunkX !== currentChunkX || newChunkZ !== currentChunkZ) {
        currentChunkX = newChunkX;
        currentChunkZ = newChunkZ;

        // Determine which chunks should exist (grid around current chunk)
        const halfChunks = Math.floor(CHUNKS_LOADED / 2);
        const requiredChunks = new Set();
        
        for (let x = currentChunkX - halfChunks; x <= currentChunkX + halfChunks; x++) {
            for (let z = currentChunkZ - halfChunks; z <= currentChunkZ + halfChunks; z++) {
                const chunkKey = `${x},${z}`;
                requiredChunks.add(chunkKey);
                
                // Create chunk if it doesn't exist
                if (!terrainChunks.has(chunkKey)) {
                    const chunk = createTerrainChunk(x, z);
                    terrainChunks.set(chunkKey, chunk);
                    chunkGroup.add(chunk);
                }
            }
        }

        // Remove chunks that are too far away
        for (const [chunkKey, chunk] of terrainChunks.entries()) {
            if (!requiredChunks.has(chunkKey)) {
                chunkGroup.remove(chunk);
                chunk.geometry.dispose();
                chunk.material.dispose();
                terrainChunks.delete(chunkKey);
            }
        }
    }
}
