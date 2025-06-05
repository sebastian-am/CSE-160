// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Imports
//===============================================
import * as THREE from 'three';
import { camera, controls } from './camera.js';
import { createSkybox } from './skybox.js';
import { loadAirplane } from './model.js';
import { updateTerrain, TERRAIN_CONFIG, createTerrainPlane } from './terrain.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initializeClouds, updateClouds } from './clouds.js';
import { updateTrail, clearTrail } from './planeTrail.js';

//===============================================
// Global Variables
//===============================================
/** @type {THREE.Scene} */ let scene;
/** @type {THREE.WebGLRenderer} */ let renderer;
/** @type {THREE.EffectComposer} */ let composer;
/** @type {THREE.RenderPixelatedPass} */ let pixelPass;
/** @type {number} */ let g_pixelSize = 7;
/** @type {Object} */ let noiseOffset = { x: 0, z: 0 };
/** @type {THREE.Mesh} */ let plane;

// Lighting configuration
const LIGHT_CONFIG = {
    AMBIENT: {
        color: 0x404040,
        intensity: 0.8
    },
    DIRECTIONAL: {
        color: 0xffffff,
        intensity: 1.0,
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

    // Create terrain plane
    plane = createTerrainPlane(scene, noiseOffset);
    console.log('Terrain plane created and added to scene:', plane);

    // Load the airplane model
    loadAirplane(scene, camera, controls, noiseOffset, plane).then(root => {
        console.log('Airplane loaded successfully');
    });

    // Initialize clouds
    initializeClouds(scene);

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
    const airplane = scene.getObjectByName('airplane');
    if (airplane) {
        console.log('Airplane loaded, updating terrain');
        updateTerrain(airplane, noiseOffset, plane);
        updateClouds(scene, noiseOffset);  // Update clouds with terrain movement
        updateTrail(scene, airplane, noiseOffset);  // Update airplane trail with terrain movement
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

// Helper function to calculate terrain height at a point
function calculateTerrainHeight(x, z, noiseOffset) {
    const worldX = x + noiseOffset.x;
    const worldZ = z + noiseOffset.z;
    
    // Generate terrain height using multiple octaves of noise
    const noise1 = noise2D(worldX * 0.008, worldZ * 0.008) * 60;  // Large features
    const noise2 = noise2D(worldX * 0.02, worldZ * 0.02) * 20;   // Medium features
    const noise3 = noise2D(worldX * 0.04, worldZ * 0.04) * 5;    // Small features
    const noise4 = noise2D(worldX * 0.08, worldZ * 0.08) * 2;    // Very small features
    
    let height = noise1 + noise2 + noise3 + noise4;
    
    // Clamp height to water level if below it
    if (height < TERRAIN_CONFIG.WATER_LEVEL) {
        height = TERRAIN_CONFIG.WATER_LEVEL;
    }
    
    return height;
}

// Start the application
main();