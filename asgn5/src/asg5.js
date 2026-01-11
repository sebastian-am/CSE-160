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
import { updateTerrain, createTerrainPlane } from './terrain.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initializeClouds, updateClouds } from './clouds.js';
import { updateTrail, clearTrail } from './planeTrail.js';
import { loadCompass, updateCompass } from './compass.js';

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
    
    // Calculate delta time for smooth animations
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 100ms to prevent large jumps
    lastTime = currentTime;
    
    if (controls) {
        controls.update();
    }

    // Update terrain if airplane is loaded
    const airplane = scene.getObjectByName('airplane');
    if (airplane) {
        // Combine WASD and arrow keys for unified control
        const combinedKeyStates = {
            w: keyStates.w || keyStates.arrowUp,
            a: keyStates.a || keyStates.arrowLeft,
            s: keyStates.s || keyStates.arrowDown,
            d: keyStates.d || keyStates.arrowRight,
            f: keyStates.f,
            space: keyStates.space
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

        // Update terrain, clouds, and smoke trail based on plane orientation
        updateTerrain(airplane, noiseOffset, plane);
        updateClouds(scene, noiseOffset);
        updateTrail(scene, airplane, noiseOffset);

        // Update camera position based on lock state
        updateCameraPosition(airplane);
    }

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
    const key = event.key.toLowerCase();
    switch(key) {
        case 'w': keyStates.w = false; break;
        case 'a': keyStates.a = false; break;
        case 's': keyStates.s = false; break;
        case 'd': keyStates.d = false; break;
        case 'f': keyStates.f = false; break;
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