// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Imports
//===============================================
import * as THREE from 'three';
import { camera, controls } from './camera.js';
import { createSkybox } from './skybox.js';
import { 
    loadAirplane, 
    handleRollAndYaw, 
    handlePitch, 
    handleFlashlight, 
    maxRoll, 
    maxPitch, 
    moveSpeed,
    getCurrentRoll,
    setCurrentRoll,
    getCurrentPitch,
    setCurrentPitch
} from './airplane.js';
import { updateTerrain, createTerrainPlane } from './terrain.js';
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

// Add speed multiplier to global variables
/** @type {number} */ let speedMultiplier = 2.0;  // Default to 2x speed

// Key state tracking
/** @type {Object} */ let keyStates = {
    w: false,
    a: false,
    s: false,
    d: false,
    f: false
};

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

    // Clear any existing trail particles
    clearTrail(scene);

    // Create skybox
    createSkybox(scene);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

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

    // Setup lighting
    setupLighting();

    // Setup menu
    setupMenu();

    // Create terrain plane
    plane = createTerrainPlane(scene, noiseOffset);

    // Load the airplane model
    loadAirplane(scene, camera, controls, noiseOffset, plane);

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
    scene.add(spotlight);
    scene.add(spotlight.target);

    // Storing lights in scene for later access
    scene.userData.lights = {
        spotlight,
        spotTarget
    };
}

//===============================================
// Menu Setup
//===============================================
function setupMenu() {
    const menu = document.getElementById('escapeMenu');
    const hamburger = document.getElementById('hamburger');
    const externalSourcesBtn = document.getElementById('externalSourcesBtn');
    const externalSourcesContent = document.getElementById('externalSourcesContent');
    const notesBtn = document.getElementById('notesBtn');
    const notesContent = document.getElementById('notesContent');
    const controlsBtn = document.getElementById('controlsBtn');
    const controlsContent = document.getElementById('controlsContent');
    let isMenuVisible = false;
    let isFlashlightOn = true;
    let isAxisVisible = false;

    function toggleMenu() {
        isMenuVisible = !isMenuVisible;
        menu.classList.toggle('visible');
        hamburger.classList.toggle('active');
        controls.enabled = !isMenuVisible;
        
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
        } else if (event.key.toLowerCase() === 'f') {
            // Toggle flashlight
            isFlashlightOn = !isFlashlightOn;
            const airplane = scene.getObjectByName('airplane');
            if (airplane) {
                const lightCone = airplane.getObjectByName('lightCone');
                if (lightCone) {
                    lightCone.visible = isFlashlightOn;
                }
                const spotlight = scene.userData.lights.spotlight;
                if (spotlight) {
                    spotlight.visible = isFlashlightOn;
                }
                // Clear trail when toggling flashlight
                clearTrail(scene);
            }
        }
    });

    // Add key state tracking
    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (key in keyStates) {
            keyStates[key] = true;
        }
    });

    window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (key in keyStates) {
            keyStates[key] = false;
        }
    });

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

    // Menu item handlers
    document.getElementById('toggleFog').addEventListener('click', () => {
        scene.fog = scene.fog ? null : new THREE.FogExp2(0xffffff, 0.003);
    });

    document.getElementById('toggleAxis').addEventListener('click', () => {
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

    window.addEventListener('click', (event) => { // Close menu when clicking outside
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
    controls.update();

    // Update terrain if airplane is loaded
    const airplane = scene.getObjectByName('airplane');
    if (airplane) {
        // Handle all movement controls
        const newRoll = handleRollAndYaw(airplane, keyStates, moveSpeed, maxRoll, getCurrentRoll());
        setCurrentRoll(newRoll);
        const newPitch = handlePitch(airplane, keyStates, moveSpeed, maxPitch, getCurrentPitch());
        setCurrentPitch(newPitch);
        handleFlashlight(airplane, keyStates, scene.userData.lights);

        // Update terrain, clouds, and smoke trail based on plane orientation
        updateTerrain(airplane, noiseOffset, plane);
        updateClouds(scene, noiseOffset);
        updateTrail(scene, airplane, noiseOffset);

        // Only update camera position if we're not in free orbit mode
        if (!controls.enabled) {
            const cameraOffset = new THREE.Vector3(0, 2, -8);
            cameraOffset.applyQuaternion(airplane.quaternion);
            camera.position.copy(airplane.position).add(cameraOffset);
            camera.lookAt(airplane.position);
        }
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

main();