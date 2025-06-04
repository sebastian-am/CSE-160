// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Imports
//===============================================
import * as THREE from 'three';
import { camera, controls } from './camera.js';
import { createSkybox } from './skybox.js';
import { loadAirplane } from './model.js';
import { updateTerrain } from './terrain.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createNoise2D } from 'https://cdn.skypack.dev/simplex-noise';

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
/** @type {number} */ let waterLevel = 5;
/** @type {THREE.Color} */ let waterColor = new THREE.Color(0x0077be);
/** @type {THREE.Color} */ let landColor = new THREE.Color(0x228B22);

//===============================================
// Main
//===============================================
function main() {
    // Scene setup
    scene = new THREE.Scene();

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

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create a simple plane
    planeGeometry = new THREE.PlaneGeometry(100, 100, 50, 50); // Large plane, same triangle size
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x228B22,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.0,
        flatShading: true,
        vertexColors: true  // Enable vertex colors for water/land
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
        const height = noise1 + noise2 + noise3 + noise4;
        
        // Set vertex height
        vertices[i + 2] = height;
        
        // Set vertex color based on height
        const color = height < waterLevel ? waterColor : landColor;
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

    // Add more light to make the plane more visible
    const additionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    additionalLight.position.set(5, 10, 5);
    scene.add(additionalLight);

    // Debug logging
    console.log('Camera position:', camera.position);
    console.log('Plane position:', plane.position);
    console.log('Plane geometry:', plane.geometry);
    console.log('Plane material:', plane.material);

    // Load the airplane model
    loadAirplane(scene, camera, controls, noiseOffset, plane).then(root => {
        console.log('Airplane loaded successfully');
    });

    // Add clouds to the scene
    scene.add(createCloud(10, 10, 0));
    scene.add(createCloud(-15, 12, 8));
    scene.add(createCloud(5, 15, -10));
    scene.add(createCloud(-8, 11, -12));

    // Setup pixel effect toggle
    document.getElementById("pixelToggle").onclick = function() {
        g_pixelEnabled = !g_pixelEnabled;
        pixelPass.enabled = g_pixelEnabled;
    };

    // Start animation
    animate(0);
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
    const sphereGeometry = new THREE.SphereGeometry(2, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        roughness: 0.8,
        metalness: 0.0,
        depthWrite: false // Helps with transparency
    });
    // Create several overlapping spheres for a cloud
    for (let i = 0; i < 5; i++) {
        const sphere = new THREE.Mesh(sphereGeometry, material);
        sphere.position.set(
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 2
        );
        sphere.scale.set(
            1 + Math.random() * 0.7,
            0.7 + Math.random() * 0.5,
            1 + Math.random() * 0.7
        );
        cloud.add(sphere);
    }
    cloud.position.set(x, y, z);
    return cloud;
}

// Start the application
main();