// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Imports
//===============================================
import * as THREE from 'three';
import { camera, initControls, toggleCameraLock, updateCameraPosition } from './camera.js';
import { createSkybox } from './skybox.js';
import { 
    loadAirplane, 
    handleRollAndYaw, 
    handlePitch, 
    handleFlashlight, 
    applyRotations,
    maxRoll, 
    maxPitch, 
    moveSpeed,
    getCurrentRoll,
    setCurrentRoll,
    getCurrentPitch,
    setCurrentPitch,
    getCurrentYaw,
    setCurrentYaw
} from './airplane.js';
import { updateTerrain, createTerrainPlane, getAverageTerrainHeight, getMaxTerrainHeight, calculateTerrainHeight, findSafeSpawnLocation, toggleChunkEdges, updateChunkEdgesPosition, resetTerrainChunks } from './terrain.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initializeClouds, updateClouds, resetClouds } from './clouds.js';
import { updateTrail, clearTrail } from './planeTrail.js';
import { loadCompass, updateCompass } from './compass.js';
import { createExplosion, updateExplosion, clearExplosion, getHasExploded, resetExplosion } from './explosion.js';

//===============================================
// Global Variables
//===============================================
/** @type {THREE.Scene} */ let scene;
/** @type {THREE.WebGLRenderer} */ let renderer;
/** @type {THREE.EffectComposer} */ let composer;
/** @type {THREE.RenderPixelatedPass} */ let pixelPass;
/** @type {number} */ let g_pixelSize = 4;
/** @type {Object} */ let noiseOffset = { x: 0, z: 0 };
/** @type {THREE.Mesh} */ let plane;
/** @type {Object} */ let controls;

// Add speed multiplier to global variables
/** @type {number} */ let speedMultiplier = 2.0;  // Default to 2x speed

// Delta time tracking for smooth animations
let lastTime = performance.now();
let frameCount = 0;

// Game state
/** @type {boolean} */ let isExploded = false;
/** @type {boolean} */ let isHitboxVisible = false; // Global hitbox visibility state

// Collision visualization
let collisionMarkersGroup = null;
let showCollisionMarkers = false;
let terrainCollisionMesh = null;
let showTerrainCollisionSurface = false;

// Key state tracking
/** @type {Object} */ let keyStates = {
    w: false,
    a: false,
    s: false,
    d: false,
    f: false,
    space: false,
    arrowUp: false,
    arrowDown: false,
    arrowLeft: false,
    arrowRight: false
};

// Track if any key was just pressed (for respawn detection)
let anyKeyPressed = false;

// Track if F key was just pressed (for flashlight toggle)
let fKeyPressed = false;

export { speedMultiplier }; // for terrain, clouds, and smoke trial

// Lighting configuration
export const LIGHT_CONFIG = {
    AMBIENT: {
        color: 0x404040, // gray     
        intensity: 0.8
    },
    DIRECTIONAL: {
        color: 0xffffff, // white
        intensity: 1.0,
        position: { x: 5, y: 5, z: 5 }
    },
    HEMISPHERE: {
        skyColor: 0xffffff, // white
        groundColor: 0x444444, // dark gray
        intensity: 0.6
    },
    SPOTLIGHT: {
        color: 0xEFC576, // warm yellow
        intensity: 3000.0,
        distance: 50,         
        angle: Math.PI / 8,   
        penumbra: 0.3,        
        decay: 2,
        position: { x: 0, y: 0.25, z: 1.25 },
        targetPosition: { x: 0, y: 0.25, z: 15 },
        coneGeometry: {
            radius: 8,
            height: 20,
            segments: 32
        },
        coneMaterial: {
            opacity: 0.08,
            side: 'BackSide',
            depthWrite: false
        },
        conePosition: { x: 0, y: 0.25, z: 11 }
    }
};


//===============================================
// Main
//===============================================
function main() {
    // Scene setup
    scene = new THREE.Scene();
    
    {
        const lightFogColor = new THREE.Color('white');
        const lightFogDensity = 0.003;
        scene.fog = new THREE.FogExp2(lightFogColor, lightFogDensity);

        // Background color for distance blending
        const backgroundColor = new THREE.Color('lightblue');
        scene.background = backgroundColor;
    }

    // Clear any existing trail particles and explosions
    clearTrail(scene);
    clearExplosion(scene);
    isExploded = false;
    resetExplosion();

    // Create skybox
    createSkybox(scene);

    // Load the compass
    loadCompass(scene);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Initialize controls with canvas (not document.body) so menu clicks work
    controls = initControls(renderer.domElement);

    // Post-processing setup
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Add pixel shader pass
    pixelPass = new RenderPixelatedPass(g_pixelSize, scene, camera);
    pixelPass.normalEdgeStrength = 0.3;
    pixelPass.depthEdgeStrength = 0.4;
    composer.addPass(pixelPass);

    // Add output pass
    composer.addPass(new OutputPass());
    
    // Set composer size to match renderer
    composer.setSize(window.innerWidth, window.innerHeight);

    // Setup lighting
    setupLighting();

    // Setup menu (after controls are initialized)
    setupMenu(controls);

    // Create terrain plane
    plane = createTerrainPlane(scene, noiseOffset);

    // Load the airplane model
    loadAirplane(scene, camera, controls, noiseOffset, plane).then((airplane) => {
        // CRITICAL: The airplane is always at world position (0, 0, 0) after updateTerrain
        // Vertical position is tracked by noiseOffset.y
        // Terrain chunks are positioned at -noiseOffset, so terrain at absolute height H appears at world (H - noiseOffset.y)
        // To spawn safely above terrain, we need to set noiseOffset.y to a safe height
        
        // Calculate terrain height at spawn location (absolute world 0, 0)
        const terrainAtSpawn = calculateTerrainHeight(0, 0, { x: 0, z: 0 });
        const SAFE_SPAWN_HEIGHT = 31.25; // Desired clearance above terrain (250 / 8)
        const SAFE_NOISE_OFFSET_Y = terrainAtSpawn + SAFE_SPAWN_HEIGHT;
        
        // Set noiseOffset.y to spawn height (this is the airplane's "virtual" Y position)
        noiseOffset.y = SAFE_NOISE_OFFSET_Y;
        
        // Airplane position will be set to (0, 0, 0) by updateTerrain, but that's fine
        // The actual vertical position is noiseOffset.y
        
        console.log('Spawned: terrain height =', terrainAtSpawn.toFixed(2), 'noiseOffset.y =', SAFE_NOISE_OFFSET_Y.toFixed(2), 'clearance =', SAFE_SPAWN_HEIGHT);
        
        // Store spawn height for reference
        airplane.userData.spawnHeight = SAFE_SPAWN_HEIGHT;
    });

    // Initialize clouds
    initializeClouds(scene);
    
    animate();
}

//===============================================
// Lighting Setup
//===============================================
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(
        LIGHT_CONFIG.AMBIENT.color,
        LIGHT_CONFIG.AMBIENT.intensity
    );
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
        LIGHT_CONFIG.DIRECTIONAL.color,
        LIGHT_CONFIG.DIRECTIONAL.intensity
    );
    directionalLight.position.set(
        LIGHT_CONFIG.DIRECTIONAL.position.x,
        LIGHT_CONFIG.DIRECTIONAL.position.y,
        LIGHT_CONFIG.DIRECTIONAL.position.z
    );
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(
        LIGHT_CONFIG.HEMISPHERE.skyColor,
        LIGHT_CONFIG.HEMISPHERE.groundColor,
        LIGHT_CONFIG.HEMISPHERE.intensity
    );
    scene.add(hemisphereLight);

    const spotTarget = new THREE.Object3D();
    scene.add(spotTarget);

    const spotlight = new THREE.SpotLight(
        LIGHT_CONFIG.SPOTLIGHT.color,
        LIGHT_CONFIG.SPOTLIGHT.intensity,
        LIGHT_CONFIG.SPOTLIGHT.distance,
        LIGHT_CONFIG.SPOTLIGHT.angle,
        LIGHT_CONFIG.SPOTLIGHT.penumbra,
        LIGHT_CONFIG.SPOTLIGHT.decay
    );
    spotlight.target = spotTarget;
    spotlight.visible = true; // Visible by default
    scene.add(spotlight);
    scene.add(spotlight.target);

    // Storing lights in scene for later access
    scene.userData.lights = {
        spotlight,
        spotTarget
    };
}

//===============================================
// Collision Visualization
//===============================================
function visualizeCollisionPoints(hitboxPoints, terrainX, terrainZ) {
    if (!collisionMarkersGroup) {
        collisionMarkersGroup = new THREE.Group();
        collisionMarkersGroup.name = 'collisionMarkers';
        scene.add(collisionMarkersGroup);
    }
    
    // Clear old markers
    while (collisionMarkersGroup.children.length > 0) {
        const child = collisionMarkersGroup.children[0];
        child.geometry.dispose();
        child.material.dispose();
        collisionMarkersGroup.remove(child);
    }
    
    // Create markers for each collision point
    const airplane = scene.getObjectByName('airplane');
    if (!airplane) return;
    
    hitboxPoints.forEach((point) => {
        // Get the hitbox that collided
        const hitbox = point.name === 'body' 
            ? airplane.getObjectByName('bodyHitbox')
            : airplane.getObjectByName('wingHitbox');
        
        if (!hitbox) return;
        
        // Get hitbox center in world space
        const hitboxWorldPos = new THREE.Vector3();
        hitbox.getWorldPosition(hitboxWorldPos);
        
        // Calculate terrain position at collision point
        const terrainHeight = parseFloat(point.terrainHeight);
        
        // Create a sphere marker at the terrain collision point
        const markerGeometry = new THREE.SphereGeometry(1, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000, // Red
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(hitboxWorldPos.x, terrainHeight, hitboxWorldPos.z);
        collisionMarkersGroup.add(marker);
        
        // Create a line from hitbox bottom to terrain
        const hitboxBottomY = parseFloat(point.hitboxBottom);
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(hitboxWorldPos.x, hitboxBottomY, hitboxWorldPos.z),
            new THREE.Vector3(hitboxWorldPos.x, terrainHeight, hitboxWorldPos.z)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.6
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        collisionMarkersGroup.add(line);
    });
}

function toggleCollisionMarkers() {
    showCollisionMarkers = !showCollisionMarkers;
    
    if (!collisionMarkersGroup) {
        collisionMarkersGroup = new THREE.Group();
        collisionMarkersGroup.name = 'collisionMarkers';
        scene.add(collisionMarkersGroup);
    }
    
    collisionMarkersGroup.visible = showCollisionMarkers;
    
    // Clear markers when toggling off
    if (!showCollisionMarkers) {
        while (collisionMarkersGroup.children.length > 0) {
            const child = collisionMarkersGroup.children[0];
            child.geometry.dispose();
            child.material.dispose();
            collisionMarkersGroup.remove(child);
        }
    }
}

// Create a visualization mesh that shows exactly what collision detection sees
// This uses the same calculateTerrainHeight() function to ensure 1:1 match
function updateTerrainCollisionSurface(noiseOffset) {
    if (!showTerrainCollisionSurface) {
        if (terrainCollisionMesh) {
            terrainCollisionMesh.visible = false;
        }
        return;
    }
    
    if (!terrainCollisionMesh) {
        // Create a high-resolution wireframe mesh showing the collision terrain
        // Use same resolution as visual terrain chunks for consistency
        const CHUNK_SIZE = 200;
        const CHUNK_RESOLUTION = 50;
        const VISIBLE_RADIUS = 2; // Show 2 chunks in each direction (5x5 grid)
        
        const geometry = new THREE.PlaneGeometry(
            CHUNK_SIZE * (VISIBLE_RADIUS * 2 + 1),
            CHUNK_SIZE * (VISIBLE_RADIUS * 2 + 1),
            CHUNK_RESOLUTION * (VISIBLE_RADIUS * 2 + 1),
            CHUNK_RESOLUTION * (VISIBLE_RADIUS * 2 + 1)
        );
        
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Green wireframe
            wireframe: true,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        terrainCollisionMesh = new THREE.Mesh(geometry, material);
        terrainCollisionMesh.rotation.x = -Math.PI / 2;
        terrainCollisionMesh.name = 'terrainCollisionSurface';
        scene.add(terrainCollisionMesh);
    }
    
    terrainCollisionMesh.visible = true;
    
    // Update vertex positions to match collision detection terrain
    // CRITICAL UNDERSTANDING:
    // 1. Terrain chunks: Created at absolute world positions, then chunkGroup positioned at -noiseOffset
    //    So a chunk vertex at absolute world (100, height, 200) appears at screen (100 - noiseOffset.x, height - noiseOffset.y, 200 - noiseOffset.z)
    // 2. Collision detection: Hitbox at world position (x, y, z) where airplane is at (0, 0, airplaneY)
    //    Samples terrain at absolute world coordinates (x, z) - same as terrain chunks use
    // 3. Visualization: Should match terrain chunks exactly
    //    Create vertices at absolute world positions, position mesh at -noiseOffset to match chunkGroup
    
    const CHUNK_SIZE = 200;
    const CHUNK_RESOLUTION = 50;
    const VISIBLE_RADIUS = 2;
    const vertices = terrainCollisionMesh.geometry.attributes.position.array;
    const numVerticesPerRow = CHUNK_RESOLUTION * (VISIBLE_RADIUS * 2 + 1) + 1; // 251 vertices
    const vertexSpacing = (CHUNK_SIZE * (VISIBLE_RADIUS * 2 + 1)) / (numVerticesPerRow - 1);
    
    // Create vertices at absolute world positions (same coordinate system as terrain chunks)
    // Center around the airplane's current position in world space (which is at noiseOffset)
    const centerWorldX = noiseOffset.x;
    const centerWorldZ = noiseOffset.z;
    const startWorldX = centerWorldX - CHUNK_SIZE * VISIBLE_RADIUS;
    const startWorldZ = centerWorldZ - CHUNK_SIZE * VISIBLE_RADIUS;
    
    let vertexIndex = 0;
    for (let row = 0; row < numVerticesPerRow; row++) {
        for (let col = 0; col < numVerticesPerRow; col++) {
            const i = vertexIndex * 3;
            
            // Absolute world position (same coordinate system as terrain chunks)
            const absoluteWorldX = startWorldX + col * vertexSpacing;
            const absoluteWorldZ = startWorldZ + row * vertexSpacing;
            
            // Sample terrain at absolute world coordinates (same as terrain chunks and collision detection)
            const height = calculateTerrainHeight(absoluteWorldX, absoluteWorldZ, { x: 0, z: 0 });
            
            // Store as local position (mesh will be positioned at -noiseOffset to match chunkGroup)
            // So local position = absolute world position + noiseOffset (to cancel out the -noiseOffset positioning)
            vertices[i] = absoluteWorldX + noiseOffset.x;     // X in local space
            vertices[i + 1] = absoluteWorldZ + noiseOffset.z; // Z in local space (will be rotated)
            vertices[i + 2] = height;                          // Y coordinate in plane geometry
            vertexIndex++;
        }
    }
    
    terrainCollisionMesh.geometry.attributes.position.needsUpdate = true;
    terrainCollisionMesh.geometry.computeVertexNormals();
    
    // Position mesh to match chunk group position (so it moves with terrain)
    // chunkGroup is positioned at -noiseOffset, so we match that
    const chunkGroup = scene.getObjectByName('terrainChunks');
    if (chunkGroup) {
        terrainCollisionMesh.position.copy(chunkGroup.position);
    } else {
        // Fallback: position at -noiseOffset directly
        terrainCollisionMesh.position.set(-noiseOffset.x, -noiseOffset.y, -noiseOffset.z);
    }
}

function toggleTerrainCollisionSurface() {
    showTerrainCollisionSurface = !showTerrainCollisionSurface;
    
    if (terrainCollisionMesh) {
        terrainCollisionMesh.visible = showTerrainCollisionSurface;
    }
}

//===============================================
// Menu Setup
//===============================================
function setupMenu(controls) {
    const menu = document.getElementById('escapeMenu');
    const hamburger = document.getElementById('hamburger');
    const externalSourcesBtn = document.getElementById('externalSourcesBtn');
    const externalSourcesContent = document.getElementById('externalSourcesContent');
    const notesBtn = document.getElementById('notesBtn');
    const notesContent = document.getElementById('notesContent');
    const controlsBtn = document.getElementById('controlsBtn');
    const controlsContent = document.getElementById('controlsContent');
    let isMenuVisible = false;
    let isAxisVisible = false;
    // isHitboxVisible is now global, defined above

    function toggleMenu() {
        isMenuVisible = !isMenuVisible;
        menu.classList.toggle('visible');
        hamburger.classList.toggle('active');
        if (controls) {
            controls.enabled = !isMenuVisible;
        }
        
        // Close dropdowns when closing menu
        if (!isMenuVisible) {
            externalSourcesContent.classList.remove('visible');
            notesContent.classList.remove('visible');
            controlsContent.classList.remove('visible');
            externalSourcesBtn.classList.remove('active');
            notesBtn.classList.remove('active');
            controlsBtn.classList.remove('active');
        }
    }

    // Add speed slider handler
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    
    speedSlider.addEventListener('input', (event) => {
        speedMultiplier = parseFloat(event.target.value);
        speedValue.textContent = speedMultiplier + 'x';
    });

    // Handle escape key and menu click
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            toggleMenu();
        }
    });

    // Add key state tracking
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    hamburger.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleMenu();
    });

    // Handle dropdown clicks
    externalSourcesBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        externalSourcesContent.classList.toggle('visible');
        externalSourcesBtn.classList.toggle('active');
        notesContent.classList.remove('visible');
        notesBtn.classList.remove('active');
        controlsContent.classList.remove('visible');
        controlsBtn.classList.remove('active');
    });

    notesBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        notesContent.classList.toggle('visible');
        notesBtn.classList.toggle('active');
        externalSourcesContent.classList.remove('visible');
        externalSourcesBtn.classList.remove('active');
        controlsContent.classList.remove('visible');
        controlsBtn.classList.remove('active');
    });

    controlsBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        controlsContent.classList.toggle('visible');
        controlsBtn.classList.toggle('active');
        externalSourcesContent.classList.remove('visible');
        externalSourcesBtn.classList.remove('active');
        notesContent.classList.remove('visible');
        notesBtn.classList.remove('active');
    });

    // Menu item handlers - use mousedown to ensure it fires before controls
    const toggleFogBtn = document.getElementById('toggleFog');
    const toggleAxisBtn = document.getElementById('toggleAxis');
    
    toggleFogBtn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        scene.fog = scene.fog ? null : new THREE.FogExp2(0xffffff, 0.003);
    });
    
    toggleFogBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    toggleAxisBtn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        isAxisVisible = !isAxisVisible;
        const globalAxes = scene.getObjectByName('axesHelper');
        const localAxes = scene.getObjectByName('localAxes');
        
        if (globalAxes) {
            globalAxes.visible = isAxisVisible;
        }
        if (localAxes) {
            localAxes.visible = isAxisVisible;
        }
    });
    
    toggleAxisBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    // Hitbox toggle
    const toggleHitboxBtn = document.getElementById('toggleHitbox');
    
    toggleHitboxBtn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        isHitboxVisible = !isHitboxVisible;
        const airplane = scene.getObjectByName('airplane');
        
        if (airplane) {
            const bodyHitbox = airplane.getObjectByName('bodyHitbox');
            const wingHitbox = airplane.getObjectByName('wingHitbox');
            
            if (bodyHitbox) bodyHitbox.visible = isHitboxVisible;
            if (wingHitbox) wingHitbox.visible = isHitboxVisible;
        }
    });
    
    toggleHitboxBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    // Chunk edges toggle
    const toggleChunkEdgesBtn = document.getElementById('toggleChunkEdges');
    
    toggleChunkEdgesBtn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleChunkEdges(scene);
    });
    
    toggleChunkEdgesBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    // Collision markers toggle
    const toggleCollisionMarkersBtn = document.getElementById('toggleCollisionMarkers');
    
    toggleCollisionMarkersBtn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleCollisionMarkers();
    });
    
    toggleCollisionMarkersBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    // Terrain collision surface toggle
    const toggleTerrainCollisionSurfaceBtn = document.getElementById('toggleTerrainCollisionSurface');
    
    toggleTerrainCollisionSurfaceBtn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleTerrainCollisionSurface();
    });
    
    toggleTerrainCollisionSurfaceBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    // Prevent clicks on menu from propagating to controls
    menu.addEventListener('mousedown', (event) => {
        event.stopPropagation();
    });
    
    menu.addEventListener('click', (event) => {
        event.stopPropagation();
        // Close menu when clicking on menu background (not on children)
        if (isMenuVisible && event.target === menu) {
            toggleMenu();
        }
    });
}

//===============================================
// Animation and Rendering
//===============================================
function animate() {
    requestAnimationFrame(animate);
    
    // Increment frame counter for debug logging
    frameCount++;
    
    // Calculate delta time for smooth animations
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 100ms to prevent large jumps
    lastTime = currentTime;
    
    if (controls) {
        controls.update();
    }

    // Handle restart on ANY key press when dead (only when isExploded is true)
    if (anyKeyPressed && isExploded) {
        // Restart game - reset everything to initial state
        isExploded = false;
        resetExplosion();
        clearExplosion(scene);
        clearTrail(scene);
        
        // Reset noise offset FIRST (before terrain reset)
        noiseOffset.x = 0;
        noiseOffset.z = 0;
        // Don't reset noiseOffset.y yet - we'll set it to safe spawn height below
        
        // Reset terrain chunks to origin
        resetTerrainChunks();
        
        // Update chunk edges position after terrain reset
        updateChunkEdgesPosition();
        
        // Reset clouds to origin
        resetClouds(scene);
        
        // Reset airplane position and state
        const airplane = scene.getObjectByName('airplane');
        if (airplane) {
            // CRITICAL: The airplane is always at world position (0, 0, 0) after updateTerrain
            // Vertical position is tracked by noiseOffset.y
            // Terrain chunks are positioned at -noiseOffset, so terrain at absolute height H appears at world (H - noiseOffset.y)
            // To spawn safely above terrain, we need to set noiseOffset.y to a safe height
            
            // Calculate terrain height at spawn location (absolute world 0, 0)
            const terrainAtSpawn = calculateTerrainHeight(0, 0, { x: 0, z: 0 });
            const SAFE_SPAWN_HEIGHT = 250; // Desired clearance above terrain
            const SAFE_NOISE_OFFSET_Y = terrainAtSpawn + SAFE_SPAWN_HEIGHT;
            
            // Set noiseOffset.y to spawn height (this is the airplane's "virtual" Y position)
            noiseOffset.y = SAFE_NOISE_OFFSET_Y;
            
            // Reset airplane position to origin (updateTerrain will also do this, but set it explicitly)
            airplane.position.set(0, 0, 0);
            
            console.log('Restarted: terrain height =', terrainAtSpawn.toFixed(2), 'noiseOffset.y =', SAFE_NOISE_OFFSET_Y.toFixed(2), 'clearance =', SAFE_SPAWN_HEIGHT);
            
            // Reset rotations
            setCurrentRoll(0);
            setCurrentPitch(0);
            setCurrentYaw(0);
            applyRotations(airplane, 0, 0, 0);
            
            // Make plane visible again (but preserve hitbox and light cone transparency)
            const bodyHitbox = airplane.getObjectByName('bodyHitbox');
            const wingHitbox = airplane.getObjectByName('wingHitbox');
            const lightCone = airplane.getObjectByName('lightCone');
            
            // Restore hitbox visibility and transparency
            if (bodyHitbox) {
                bodyHitbox.visible = isHitboxVisible;
                if (bodyHitbox.material) {
                    bodyHitbox.material.transparent = true;
                    bodyHitbox.material.opacity = 0.3;
                }
            }
            if (wingHitbox) {
                wingHitbox.visible = isHitboxVisible;
                if (wingHitbox.material) {
                    wingHitbox.material.transparent = true;
                    wingHitbox.material.opacity = 0.3;
                }
            }
            
            // Restore light cone visibility and transparency (visible by default)
            if (lightCone) {
                lightCone.visible = true; // Visible by default along with spotlight
                if (lightCone.material) {
                    lightCone.material.transparent = true;
                    lightCone.material.opacity = 0.08;
                }
            }
            
            // Restore spotlight visibility (visible by default)
            const lights = scene.userData.lights;
            if (lights && lights.spotlight) {
                lights.spotlight.visible = true;
            }
            
            // Make regular airplane meshes visible and opaque
            airplane.traverse((child) => {
                if (child.isMesh) {
                    // Skip hitboxes and light cone - already handled above
                    if (child === bodyHitbox || child === wingHitbox || child === lightCone) {
                        return;
                    }
                    
                    child.visible = true;
                    if (child.material) {
                        child.material.opacity = 1.0;
                        child.material.transparent = false;
                    }
                }
            });
            
            // Double-check terrain height after reset
            const checkTerrainHeight = calculateTerrainHeight(0, 0, { x: 0, z: 0 });
            console.log('After reset - Terrain at (0,0):', checkTerrainHeight, 'Plane Y:', airplane.position.y);
        }
        
        // Reset all key states to prevent other functions from triggering
        keyStates.w = false;
        keyStates.a = false;
        keyStates.s = false;
        keyStates.d = false;
        keyStates.f = false;
        keyStates.space = false;
        keyStates.arrowUp = false;
        keyStates.arrowDown = false;
        keyStates.arrowLeft = false;
        keyStates.arrowRight = false;
    }
    
    // Reset anyKeyPressed flag after checking (consumes the key press)
    anyKeyPressed = false;

    // Update terrain if airplane is loaded
    const airplane = scene.getObjectByName('airplane');
    if (airplane && !isExploded) {
        // Combine WASD and arrow keys for unified control
        const combinedKeyStates = {
            w: keyStates.w || keyStates.arrowUp,
            a: keyStates.a || keyStates.arrowLeft,
            s: keyStates.s || keyStates.arrowDown,
            d: keyStates.d || keyStates.arrowRight,
            f: keyStates.f,
            space: keyStates.space,
            fPressed: fKeyPressed  // Pass the persistent fPressed state
        };
        
        // Handle roll and yaw (returns { roll, yaw } object)
        const rollYawResult = handleRollAndYaw(airplane, combinedKeyStates, moveSpeed, maxRoll, getCurrentRoll(), getCurrentYaw(), speedMultiplier, deltaTime);
        setCurrentRoll(rollYawResult.roll);
        setCurrentYaw(rollYawResult.yaw);
        // Note: yaw rate is updated inside handleRollAndYaw
        
        // Handle pitch
        const newPitch = handlePitch(airplane, combinedKeyStates, moveSpeed, maxPitch, getCurrentPitch(), speedMultiplier, deltaTime);
        setCurrentPitch(newPitch);
        
        // Apply all rotations to the airplane
        applyRotations(airplane, getCurrentRoll(), getCurrentPitch(), getCurrentYaw());
        
        handleFlashlight(airplane, combinedKeyStates, scene.userData.lights);
        
        // Update fKeyPressed state after handling flashlight
        fKeyPressed = combinedKeyStates.fPressed;

        // Update terrain first so noiseOffset is current for collision detection
        updateTerrain(airplane, noiseOffset, plane);
        
        // Update chunk edges position if visible
        updateChunkEdgesPosition();
        
        // Update terrain collision surface visualization
        updateTerrainCollisionSurface(noiseOffset);
        
        // Collision detection using hitboxes - check multiple points on the plane
        // Airplane is always at world position (0, 0, airplane.position.y)
        // Hitbox AABB gives world positions (since airplane is at origin, these are absolute world coords)
        // Terrain chunks use absolute world coordinates, then chunkGroup is positioned at -noiseOffset
        // So we sample terrain at the hitbox's absolute world coordinates directly
        
        // Check if hitboxes intersect with terrain
        const bodyHitbox = airplane.getObjectByName('bodyHitbox');
        const wingHitbox = airplane.getObjectByName('wingHitbox');
        
        let collisionDetected = false;
        const hitboxPoints = [];
        
        // Improved collision detection using grid sampling
        // Based on Three.js Box3 and terrain height sampling
        function checkHitboxCollision(hitbox, name) {
            if (!hitbox || !airplane) return false;
            
            // Ensure world matrices are updated
            hitbox.updateMatrixWorld(true);
            airplane.updateMatrixWorld(true);
            
            // Get AABB of hitbox in world space
            const hitboxAABB = new THREE.Box3().setFromObject(hitbox);
            
            // CRITICAL: The airplane is always at world position (0, 0, 0) after updateTerrain
            // But the airplane's "virtual" vertical position is tracked by noiseOffset.y
            // The terrain chunks are positioned at -noiseOffset.y, which moves them vertically
            // So the hitbox's world Y position needs to be compared to terrain height + noiseOffset.y
            // to account for the terrain's vertical offset
            
            // Get the bottom of the hitbox (lowest Y coordinate in world space)
            // Since airplane is at (0,0,0), hitbox Y is relative to that
            const hitboxBottomY = hitboxAABB.min.y;
            
            // The airplane's "virtual" Y position in absolute world space
            // This accounts for vertical movement through noiseOffset.y
            const airplaneVirtualY = noiseOffset.y || 0;
            
            // Sample a grid of points across the hitbox's XZ footprint
            // This ensures we catch collisions even if only part of the hitbox intersects terrain
            const gridSize = 5; // 5x5 grid = 25 sample points
            const xStep = (hitboxAABB.max.x - hitboxAABB.min.x) / (gridSize - 1);
            const zStep = (hitboxAABB.max.z - hitboxAABB.min.z) / (gridSize - 1);
            
            let maxTerrainHeight = -Infinity;
            let minDistanceAbove = Infinity;
            
            // Sample terrain at grid points
            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    // Calculate world position of this grid point
                    const worldX = hitboxAABB.min.x + (i * xStep);
                    const worldZ = hitboxAABB.min.z + (j * zStep);
                    
                    // Convert to absolute terrain coordinates
                    // The airplane is at world (0, 0, 0), so hitbox world positions are small
                    // Terrain chunks are positioned at -noiseOffset, so terrain at absolute world W
                    // appears at screen position (W - noiseOffset)
                    // Therefore: screen position S = absolute world A - noiseOffset
                    // So: absolute world A = screen position S + noiseOffset
                    const absoluteWorldX = worldX + noiseOffset.x;
                    const absoluteWorldZ = worldZ + noiseOffset.z;
                    
                    // Sample terrain height at this absolute world position
                    // Terrain is a 2D heightmap, so height is only a function of X/Z
                    const terrainHeightAtPoint = calculateTerrainHeight(absoluteWorldX, absoluteWorldZ, { x: 0, z: 0 });
                    
                    // CRITICAL COORDINATE SYSTEM EXPLANATION:
                    // - Airplane is always at world position (0, 0, 0) after updateTerrain
                    // - Terrain chunks are positioned at -noiseOffset to move them visually
                    // - Terrain at absolute world (X, Z) has height H (from calculateTerrainHeight)
                    // - This terrain point appears in world space at: (X - noiseOffset.x, H - noiseOffset.y, Z - noiseOffset.z)
                    // - Since airplane is at (0, 0, 0), we compare hitbox world Y to (H - noiseOffset.y)
                    // - Therefore: terrainSurfaceY = terrainHeight - noiseOffset.y
                    const terrainSurfaceY = terrainHeightAtPoint - airplaneVirtualY;
                    
                    maxTerrainHeight = Math.max(maxTerrainHeight, terrainSurfaceY);
                    
                    // Track minimum distance above terrain for debugging
                    const distanceAbove = hitboxBottomY - terrainSurfaceY;
                    minDistanceAbove = Math.min(minDistanceAbove, distanceAbove);
                }
            }
            
            // Calculate distance from hitbox bottom to terrain surface
            const distanceAbove = hitboxBottomY - maxTerrainHeight;
            
            // Safety checks to prevent false positives
            // If clearly above terrain, no collision
            if (distanceAbove > 1.0) {
                return false;
            }
            
            // Additional safety for high altitude (prevent false positives in sky)
            if (hitboxBottomY > 100 && distanceAbove > 0.3) {
                return false;
            }
            
            // Check if hitbox intersects terrain
            // Use a small tolerance for floating point precision
            const tolerance = 0.1;
            const collision = hitboxBottomY <= (maxTerrainHeight + tolerance);
            
            // Debug logging
            if (collision) {
                hitboxPoints.push({ 
                    name: name, 
                    hitboxBottom: hitboxBottomY.toFixed(2), 
                    terrainHeight: maxTerrainHeight.toFixed(2),
                    clearance: distanceAbove.toFixed(2),
                    minDistance: minDistanceAbove.toFixed(2),
                    worldPos: `(${hitboxAABB.min.x.toFixed(1)}, ${hitboxAABB.min.z.toFixed(1)})`,
                    absWorldPos: `(${(hitboxAABB.min.x + noiseOffset.x).toFixed(1)}, ${(hitboxAABB.min.z + noiseOffset.z).toFixed(1)})`
                });
            }
            
            return collision;
        }
        
        // Check collision for both hitboxes
        if (bodyHitbox && wingHitbox) {
            const bodyCollision = checkHitboxCollision(bodyHitbox, 'body');
            const wingCollision = checkHitboxCollision(wingHitbox, 'wing');
            
            if (bodyCollision || wingCollision) {
                collisionDetected = true;
            }
        } else {
            // Fallback to simple collision check if hitboxes aren't loaded
            const terrainHeight = calculateTerrainHeight(noiseOffset.x, noiseOffset.z, { x: 0, z: 0 });
            if (airplane.position.y <= terrainHeight) {
                collisionDetected = true;
            }
        }
        
        // Debug logging for collision
        if (collisionDetected && !isExploded) {
            console.log('COLLISION DETECTED!', hitboxPoints.map(p => 
                `${p.name}: HitboxBottom=${p.hitboxBottom}, Terrain=${p.terrainHeight}, Clearance=${p.clearance}, World=${p.worldPos}, AbsWorld=${p.absWorldPos}`
            ).join(', '));
        }
        
        // Periodic debug logging to verify coordinate system (every 60 frames)
        if (frameCount % 60 === 0 && bodyHitbox && wingHitbox && !isExploded) {
            bodyHitbox.updateMatrixWorld(true);
            const bodyAABB = new THREE.Box3().setFromObject(bodyHitbox);
            const centerX = (bodyAABB.min.x + bodyAABB.max.x) / 2;
            const centerZ = (bodyAABB.min.z + bodyAABB.max.z) / 2;
            const absX = centerX + noiseOffset.x;
            const absZ = centerZ + noiseOffset.z;
            const terrainAtCenter = calculateTerrainHeight(absX, absZ, { x: 0, z: 0 });
            const distance = bodyAABB.min.y - terrainAtCenter;
            console.log(`[Debug] Body hitbox: world(${centerX.toFixed(1)}, ${centerZ.toFixed(1)}) abs(${absX.toFixed(1)}, ${absZ.toFixed(1)}) terrain=${terrainAtCenter.toFixed(1)} hitboxBottom=${bodyAABB.min.y.toFixed(1)} distance=${distance.toFixed(2)}`);
        }
        
        // Visualize collision points if enabled (show continuously, not just on collision)
        if (showCollisionMarkers && hitboxPoints.length > 0) {
            visualizeCollisionPoints(hitboxPoints, terrainX, terrainZ);
        } else if (showCollisionMarkers && hitboxPoints.length === 0 && collisionMarkersGroup) {
            // Clear markers when no collisions
            while (collisionMarkersGroup.children.length > 0) {
                const child = collisionMarkersGroup.children[0];
                child.geometry.dispose();
                child.material.dispose();
                collisionMarkersGroup.remove(child);
            }
        }
        
        if (collisionDetected && !isExploded) {
            // Trigger explosion
            isExploded = true;
            createExplosion(scene, 0, airplane.position.y, 0);
            
            // Make plane disappear (fade out)
            airplane.traverse((child) => {
                if (child.isMesh) {
                    child.material.transparent = true;
                    child.material.opacity = 0;
                    child.visible = false;
                }
            });
        }
        
        if (!isExploded) {
            updateClouds(scene, noiseOffset);
            updateTrail(scene, airplane, noiseOffset);
        }

        // Update camera position based on lock state
        updateCameraPosition(airplane);
    }
    
    // Update explosion particles
    updateExplosion(scene, noiseOffset);

    // Update compass position and rotation
    updateCompass();

    // Render the scene
    try {
        if (composer) {
            composer.render();
        } else if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    } catch (renderError) {
        console.error('Render error:', renderError);
        // Fallback to basic renderer
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }
}

//===============================================
// Event Handlers
//===============================================
function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
    }
    return needResize;
}

window.addEventListener('resize', () => {
    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }
});

// Update key handlers
function onKeyDown(event) {
    // If dead, mark that any key was pressed (for respawn) and prevent other functions
    if (isExploded) {
        // Ignore Escape key (still allow menu)
        if (event.key !== 'Escape') {
            anyKeyPressed = true;
            event.preventDefault(); // Prevent default behavior
        }
        return; // Don't process other key functions when dead
    }
    
    const key = event.key.toLowerCase();
    switch(key) {
        case 'w': keyStates.w = true; break;
        case 'a': keyStates.a = true; break;
        case 's': keyStates.s = true; break;
        case 'd': keyStates.d = true; break;
        case 'f': keyStates.f = true; break;
        case ' ': 
            if (!keyStates.space) {  // toggle once per press only
                keyStates.space = true;
                toggleCameraLock();
            }
            break;
    }
    
    // Handle arrow keys (they don't lowercase properly)
    switch(event.key) {
        case 'ArrowUp': 
            event.preventDefault(); // Prevent page scrolling
            keyStates.arrowUp = true; 
            break;
        case 'ArrowDown': 
            event.preventDefault(); // Prevent page scrolling
            keyStates.arrowDown = true; 
            break;
        case 'ArrowLeft': 
            event.preventDefault(); // Prevent page scrolling
            keyStates.arrowLeft = true; 
            break;
        case 'ArrowRight': 
            event.preventDefault(); // Prevent page scrolling
            keyStates.arrowRight = true; 
            break;
    }
}

function onKeyUp(event) {
    // If dead, don't process key releases (except Escape for menu)
    if (isExploded && event.key !== 'Escape') {
        return;
    }
    
    const key = event.key.toLowerCase();
    switch(key) {
        case 'w': keyStates.w = false; break;
        case 'a': keyStates.a = false; break;
        case 's': keyStates.s = false; break;
        case 'd': keyStates.d = false; break;
        case 'f': 
            keyStates.f = false;
            fKeyPressed = false;  // Reset fPressed when key is released
            break;
        case ' ': keyStates.space = false; break;
    }
    
    // Handle arrow keys (they don't lowercase properly)
    switch(event.key) {
        case 'ArrowUp': keyStates.arrowUp = false; break;
        case 'ArrowDown': keyStates.arrowDown = false; break;
        case 'ArrowLeft': keyStates.arrowLeft = false; break;
        case 'ArrowRight': keyStates.arrowRight = false; break;
    }
}

// Start the application with error handling
try {
    main();
} catch (error) {
    console.error('Error initializing application:', error);
    // Fallback: try to render a basic scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}