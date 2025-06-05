// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Imports
//===============================================
import * as THREE from 'three';
import { camera, controls } from './camera.js';
import { createSkybox } from './skybox.js';
import { loadAirplane } from './model.js';
import { updateTerrain, TERRAIN_CONFIG } from './terrain.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

//===============================================
// Global Variables
//===============================================
/** @type {THREE.Scene} */ let scene;
/** @type {THREE.WebGLRenderer} */ let renderer;
/** @type {THREE.EffectComposer} */ let composer;
/** @type {THREE.RenderPixelatedPass} */ let pixelPass;
/** @type {boolean} */ let g_pixelEnabled = true;
/** @type {number} */ let g_pixelSize = 7;
/** @type {Object} */ let noiseOffset = { x: 0, z: 0 };
/** @type {THREE.PlaneGeometry} */ let planeGeometry;
/** @type {THREE.Mesh} */ let plane;
/** @type {Function} */ let noise2D;

// Cloud management
const CLOUD_CONFIG = {
    SPAWN_DISTANCE: 200,   // Distance from center to spawn new clouds
    DESPAWN_DISTANCE: 250, // Distance from center to despawn clouds
    MAX_CLOUDS: 40,       // Maximum number of clouds in the scene
    SPAWN_HEIGHT: { min: 15, max: 25 }, // Height range for cloud spawning
    SPAWN_RADIUS: 150,    // Radius around the center where clouds can spawn
    MOVE_SPEED: 1.0 * (1/2),  // Match terrain speed normalization
    FADE_DISTANCE: 50     // Distance over which clouds fade in/out
};

let clouds = [];  // Array to track active clouds
let lastNoiseOffset = { x: 0, z: 0 };  // Track last offset for smooth movement

// Lighting configuration
const LIGHT_CONFIG = {
    AMBIENT: {
        color: 0x404040,
        intensity: 0.5
    },
    DIRECTIONAL: {
        color: 0xffffff,
        intensity: 0.8,
        position: { x: 5, y: 5, z: 5 }
    },
    HEMISPHERE: {
        skyColor: 0xffffff,
        groundColor: 0x444444,
        intensity: 0.6
    },
    SPOTLIGHT: {
        color: 0xffffff,
        intensity: 5,        // Increased intensity
        distance: 50,          // Reduced distance for more focused light
        angle: Math.PI / 8,    // Reduced angle to 22.5 degrees for tighter beam
        penumbra: 0.3,         // Reduced penumbra for sharper edges
        decay: 2               // Increased decay for more realistic falloff
    }
};

// Add FogGUIHelper class before main()
class FogGUIHelper {
    constructor(fog, backgroundColor) {
        this.fog = fog;
        this.backgroundColor = backgroundColor;
    }
    get near() {
        return this.fog.near;
    }
    set near(v) {
        this.fog.near = v;
        this.fog.far = Math.max(this.fog.far, v);
    }
    get far() {
        return this.fog.far;
    }
    set far(v) {
        this.fog.far = v;
        this.fog.near = Math.min(this.fog.near, v);
    }
    get color() {
        return `#${this.fog.color.getHexString()}`;
    }
    set color(hexString) {
        this.fog.color.set(hexString);
        this.backgroundColor.set(hexString);
    }
}

//===============================================
// Main
//===============================================
function main() {
    // Scene setup
    scene = new THREE.Scene();

    // Add fog
    {
        // Light fog for light interaction
        const lightFogColor = new THREE.Color('white');
        const lightFogDensity = 0.003;  // Much lighter fog for subtle light interaction
        scene.fog = new THREE.FogExp2(lightFogColor, lightFogDensity);

        // Background color for distance blending
        const backgroundColor = new THREE.Color('lightblue');
        scene.background = backgroundColor;
    }

    // Create skybox
    createSkybox(scene);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Post-processing setup
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add pixel shader pass
    pixelPass = new RenderPixelatedPass(g_pixelSize, scene, camera);
    pixelPass.normalEdgeStrength = 0.3;
    pixelPass.depthEdgeStrength = 0.4;
    composer.addPass(pixelPass);

    // Add output pass
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Setup lighting
    setupLighting();

    // Create a simple plane
    planeGeometry = new THREE.PlaneGeometry(500, 500, 75, 75);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080,  // Default grey color
        side: THREE.DoubleSide,
        roughness: 0.9,   // Back to original roughness
        metalness: 0.0,   // Back to no metalness
        flatShading: true,
        vertexColors: true
    });

    // Create a noise2D function using the imported createNoise2D
    noise2D = createNoise2D();

    // Create color array for vertices
    const colors = new Float32Array(planeGeometry.attributes.position.count * 3);

    // Add simplex noise to the plane vertices
    const vertices = planeGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        // Use multiple layers of noise for more jagged terrain
        const noise1 = noise2D((x + noiseOffset.x) * 0.008, (y + noiseOffset.z) * 0.008) * 60;  // Large features
        const noise2 = noise2D((x + noiseOffset.x) * 0.02, (y + noiseOffset.z) * 0.02) * 20;   // Medium features
        const noise3 = noise2D((x + noiseOffset.x) * 0.04, (y + noiseOffset.z) * 0.04) * 5;    // Small features
        const noise4 = noise2D((x + noiseOffset.x) * 0.08, (y + noiseOffset.z) * 0.08) * 2;    // Very small features
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

    plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -5;
    scene.add(plane);
    console.log('Plane created and added to scene:', plane);

    // Load the airplane model
    loadAirplane(scene, camera, controls, noiseOffset, plane).then(root => {
        console.log('Airplane loaded successfully');
    });

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

    // Setup pixel effect toggle
    document.getElementById("pixelToggle").onclick = function() {
        g_pixelEnabled = !g_pixelEnabled;
        pixelPass.enabled = g_pixelEnabled;
    };

    // Start animation
    animate(0);
}

function setupLighting() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(
        LIGHT_CONFIG.AMBIENT.color,
        LIGHT_CONFIG.AMBIENT.intensity
    );
    scene.add(ambientLight);

    // Directional Light (sun)
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

    // Hemisphere Light
    const hemisphereLight = new THREE.HemisphereLight(
        LIGHT_CONFIG.HEMISPHERE.skyColor,
        LIGHT_CONFIG.HEMISPHERE.groundColor,
        LIGHT_CONFIG.HEMISPHERE.intensity
    );
    scene.add(hemisphereLight);

    // Create spotlight target
    const spotTarget = new THREE.Object3D();
    scene.add(spotTarget);

    // Spotlight
    const spotlight = new THREE.SpotLight(
        LIGHT_CONFIG.SPOTLIGHT.color,
        LIGHT_CONFIG.SPOTLIGHT.intensity,
        LIGHT_CONFIG.SPOTLIGHT.distance,
        LIGHT_CONFIG.SPOTLIGHT.angle,
        LIGHT_CONFIG.SPOTLIGHT.penumbra,
        LIGHT_CONFIG.SPOTLIGHT.decay
    );
    spotlight.target = spotTarget;
    scene.add(spotlight);
    scene.add(spotlight.target);

    // Add spotlight helper for debugging
    const spotHelper = new THREE.SpotLightHelper(spotlight);
    scene.add(spotHelper);

    // Store lights in scene for later access
    scene.userData.lights = {
        spotlight,
        spotTarget,
        spotHelper
    };
}

//===============================================
// Animation and Rendering
//===============================================
function animate(currentTime) {
    requestAnimationFrame(animate);
    controls.update();

    // Update terrain if airplane is loaded
    if (scene.getObjectByName('airplane')) {
        console.log('Airplane loaded, updating terrain');
        updateTerrain(scene.getObjectByName('airplane'), noiseOffset, plane);
        updateClouds(noiseOffset);  // Update clouds with terrain movement
    } else {
        console.log('Airplane not loaded yet');
    }

    composer.render();
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

//===============================================
// Cloud Creation
//===============================================
function createCloud(x, y, z) {
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
        
        // Subtle scaling variations
        const scale = 0.9 + Math.random() * 0.3;
        sphere.scale.set(scale, scale * 0.8, scale);
        
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
        
        const scale = 0.7 + Math.random() * 0.3;
        detail.scale.set(scale, scale * 0.7, scale);
        
        cloud.add(detail);
    }
    
    cloud.position.set(x, y, z);
    cloud.userData = { fadeProgress: 0 };  // Track fade progress
    return cloud;
}

function updateClouds(noiseOffset) {
    // Get airplane's direction
    const airplane = scene.getObjectByName('airplane');
    if (!airplane) return;

    // Calculate the change in offset
    const deltaX = noiseOffset.x - lastNoiseOffset.x;
    const deltaZ = noiseOffset.z - lastNoiseOffset.z;
    
    // Update last offset
    lastNoiseOffset.x = noiseOffset.x;
    lastNoiseOffset.z = noiseOffset.z;

    // Update cloud positions and handle fading
    clouds.forEach(cloud => {
        // Move clouds smoothly with terrain offset
        cloud.position.x -= deltaX * CLOUD_CONFIG.MOVE_SPEED;
        cloud.position.z += deltaZ * CLOUD_CONFIG.MOVE_SPEED;

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

// Start the application
main();