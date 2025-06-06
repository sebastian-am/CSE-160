// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Global Variables
//===============================================
/** @type {Array} */ let clouds = [];
/** @type {Object} */ let lastNoiseOffset = { x: 0, z: 0, y: 0 };

// Control parameters
/** @type {number} */ export const maxRoll = Math.PI / 4;
/** @type {number} */ export const maxPitch = Math.PI / 4;
/** @type {number} */ export const moveSpeed = 0.015;
/** @type {number} */ export const returnSpeed = 0.97;

// State variables that need to be modified
let _currentRoll = 0;
let _currentPitch = 0;

// Getters and setters for the state variables
export function getCurrentRoll() { return _currentRoll; }
export function setCurrentRoll(value) { _currentRoll = value; }
export function getCurrentPitch() { return _currentPitch; }
export function setCurrentPitch(value) { _currentPitch = value; }

//===============================================
// Imports
//===============================================
import * as THREE from 'three';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

function loadAirplane(scene, camera, controls, noiseOffset, terrainPlane) {
    return new Promise((resolve) => {
        const axesHelper = new THREE.AxesHelper(5);
        axesHelper.visible = false;
        scene.add(axesHelper);

        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        mtlLoader.setPath('../assets/airplane/');
        objLoader.setPath('../assets/airplane/');

        mtlLoader.load(
            'plane.mtl',
            (mtl) => {
                mtl.preload();
                objLoader.setMaterials(mtl);
                objLoader.load(
                    'plane.obj',
                    (root) => {
                        scene.add(root);
                        root.name = 'airplane';

                        root.position.set(0, 0, 0);
                        
                        const localAxesHelper = new THREE.AxesHelper(2);
                        localAxesHelper.name = 'localAxes';
                        localAxesHelper.visible = false;
                        root.add(localAxesHelper);
                        
                        const lights = scene.userData.lights; // Attach spotlight to airplane
                        if (lights && lights.spotlight && lights.spotTarget) {
                            lights.spotlight.position.set(0, 0.25, 1.25);
                            lights.spotTarget.position.set(0, 0.25, 15);
                            
                            // Add spotlight and target to the airplane
                            root.add(lights.spotlight);
                            root.add(lights.spotTarget);
                            
                            const coneGeometry = new THREE.ConeGeometry(8, 20, 32); // Cool light cone effect
                            const coneMaterial = new THREE.MeshBasicMaterial({
                                color: 0xEFC576,
                                transparent: true,
                                opacity: 0.08,
                                side: THREE.BackSide,
                                depthWrite: false
                            });
                            const lightCone = new THREE.Mesh(coneGeometry, coneMaterial);
                            lightCone.name = 'lightCone';
                            lightCone.rotation.x = -Math.PI / 2;
                            lightCone.position.set(0, 0.25, 11);
                            root.add(lightCone);
                        }

                        resolve(root);
                    }
                );
            }
        );
    });
}

// Movement control functions
function handleRollAndYaw(root, keys, moveSpeed, maxRoll, currentRoll) {
    // for roll left and right, get current roll, calculate target roll, lerp between them to get new roll, apply rotation
    // yaw left and right is done by rotating on the world axis (0,1,0)
    if (keys.a) {
        // Roll left
        const rollAxis = new THREE.Vector3(0, 0, 1);
        const targetRoll = -maxRoll;
        const newRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, moveSpeed * 2.0);
        const rollDelta = newRoll - currentRoll;
        currentRoll = newRoll;
        root.rotateOnAxis(rollAxis, rollDelta);
        
        // Yaw left
        root.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), moveSpeed);
    } else if (keys.d) {
        // Roll right
        const rollAxis = new THREE.Vector3(0, 0, 1);
        const targetRoll = maxRoll;
        const newRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, moveSpeed * 2.0);
        const rollDelta = newRoll - currentRoll;
        currentRoll = newRoll;
        root.rotateOnAxis(rollAxis, rollDelta);
        
        // Yaw right
        root.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -moveSpeed);
    } else { // return to level flight
        const rollAxis = new THREE.Vector3(0, 0, 1);
        const newRoll = THREE.MathUtils.lerp(currentRoll, 0, moveSpeed * 3.0);
        const rollDelta = newRoll - currentRoll;
        currentRoll = newRoll;
        root.rotateOnAxis(rollAxis, rollDelta);
    }
    return currentRoll;
}

function handlePitch(root, keys, moveSpeed, maxPitch, currentPitch) { // note to self: never use euler angles again T-T
    // for pitch up and down, get current pitch, calculate target pitch, lerp between them to get new pitch, apply rotation
    if (keys.w) {
        const pitchAxis = new THREE.Vector3(1, 0, 0);
        const targetPitch = -maxPitch;  // Negative for up
        const newPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, moveSpeed * 2.0);
        const pitchDelta = newPitch - currentPitch;
        currentPitch = newPitch;
        root.rotateOnAxis(pitchAxis, pitchDelta);
    } else if (keys.s) {
        const pitchAxis = new THREE.Vector3(1, 0, 0);
        const targetPitch = maxPitch;   // Positive for down
        const newPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, moveSpeed * 2.0);
        const pitchDelta = newPitch - currentPitch;
        currentPitch = newPitch;
        root.rotateOnAxis(pitchAxis, pitchDelta);
    } else { // return to level flight
        const pitchAxis = new THREE.Vector3(1, 0, 0);
        const newPitch = THREE.MathUtils.lerp(currentPitch, 0, moveSpeed * 3.0);
        const pitchDelta = newPitch - currentPitch;
        currentPitch = newPitch;
        root.rotateOnAxis(pitchAxis, pitchDelta);
    }
    return currentPitch;
}

function handleFlashlight(root, keys, lights) {
    if (keys.f) {
        if (!keys.fPressed) {
            keys.fPressed = true;
            if (lights && lights.spotlight) {
                lights.spotlight.visible = !lights.spotlight.visible;
            }
            // Find the light cone in the scene
            const lightCone = root.getObjectByName('lightCone', true);  // true means search recursively
            if (lightCone) {
                lightCone.visible = !lightCone.visible;
            }
        }
    } else {
        keys.fPressed = false;
    }
}

export { loadAirplane, handleRollAndYaw, handlePitch, handleFlashlight }; 