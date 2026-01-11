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
/** @type {number} */ export const moveSpeed = 0.03;  // Doubled from 0.015
/** @type {number} */ export const returnSpeed = 0.97;

// State variables that need to be modified
let _currentRoll = 0;
let _currentPitch = 0;
let _currentYaw = 0;
let _currentYawRate = 0; // Current yaw rotation rate (radians per second)

// Getters and setters for the state variables
export function getCurrentRoll() { return _currentRoll; }
export function setCurrentRoll(value) { _currentRoll = value; }
export function getCurrentPitch() { return _currentPitch; }
export function setCurrentPitch(value) { _currentPitch = value; }
export function getCurrentYaw() { return _currentYaw; }
export function setCurrentYaw(value) { _currentYaw = value; }
export function getCurrentYawRate() { return _currentYawRate; }
export function setCurrentYawRate(value) { _currentYawRate = value; }

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
function handleRollAndYaw(root, keys, moveSpeed, maxRoll, currentRoll, currentYaw, speedMultiplier, deltaTime) {
    // Calculate target roll based on input
    let targetRoll = 0;
    let targetYawRate = 0; // Target yaw rotation rate (radians per second)
    
    if (keys.a) {
        // Roll left and turn left
        targetRoll = -maxRoll;
        targetYawRate = moveSpeed * 60; // Convert to radians per second (assuming 60fps base)
    } else if (keys.d) {
        // Roll right and turn right
        targetRoll = maxRoll;
        targetYawRate = -moveSpeed * 60; // Convert to radians per second
    }
    // If neither key is pressed, targetRoll stays 0 (return to level)
    
    // Check if pitch is also active (combining movements)
    const isCombiningMovements = keys.w || keys.s;
    
    // Calculate smoothing factor - much slower for realistic turning
    // Even slower when combining with pitch for smoother transitions
    const baseSmoothingRate = isCombiningMovements ? 1.0 : 1.5; // Slower when combining movements
    // Scale up slightly with speed (slower speeds = slower turning)
    // At speedMultiplier 1.0: rate = 0.7 (combining) or 1.05 (single)
    // At speedMultiplier 2.0: rate = 0.8 (combining) or 1.2 (single)
    // At speedMultiplier 4.0+: rate = 0.9 (combining) or 1.35 (single)
    const speedAdjustedRate = baseSmoothingRate * (0.7 + speedMultiplier * 0.1);
    const smoothingFactor = 1.0 - Math.exp(-speedAdjustedRate * deltaTime);
    
    // Smoothly interpolate roll using exponential smoothing
    const newRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, smoothingFactor);
    currentRoll = newRoll;
    
    // Smoothly interpolate yaw rate to match rotation smoothness
    // This makes the turning movement match the visual rotation
    const newYawRate = THREE.MathUtils.lerp(_currentYawRate, targetYawRate, smoothingFactor);
    _currentYawRate = newYawRate;
    
    // Apply the smoothed yaw rate to update yaw
    currentYaw += newYawRate * deltaTime;
    
    return { roll: currentRoll, yaw: currentYaw };
}

function handlePitch(root, keys, moveSpeed, maxPitch, currentPitch, speedMultiplier, deltaTime) {
    // Calculate target pitch based on input
    let targetPitch = 0;
    
    if (keys.w) {
        // Pitch up
        targetPitch = -maxPitch;
    } else if (keys.s) {
        // Pitch down
        targetPitch = maxPitch;
    }
    // If neither key is pressed, targetPitch stays 0 (return to level)
    
    // Check if roll/yaw is also active (combining movements)
    const isCombiningMovements = keys.a || keys.d;
    
    // Calculate smoothing factor - even slower for pitch (up/down feels snappier)
    // Even slower when combining with roll/yaw for smoother transitions
    const baseSmoothingRate = isCombiningMovements ? 0.7 : 1.0; // Slower when combining movements
    // Scale up slightly with speed (slower speeds = slower turning)
    // At speedMultiplier 1.0: rate = 0.49 (combining) or 0.7 (single)
    // At speedMultiplier 2.0: rate = 0.56 (combining) or 0.8 (single)
    // At speedMultiplier 4.0+: rate = 0.63 (combining) or 0.9 (single)
    const speedAdjustedRate = baseSmoothingRate * (0.7 + speedMultiplier * 0.1);
    const smoothingFactor = 1.0 - Math.exp(-speedAdjustedRate * deltaTime);
    
    // Smoothly interpolate pitch using exponential smoothing
    const newPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, smoothingFactor);
    
    return newPitch;
}

// New function to apply rotations in correct order
function applyRotations(root, currentRoll, currentPitch, currentYaw) {
    // Set rotation order first (important for correct interpretation)
    root.rotation.order = 'YXZ';
    
    // Apply rotations in YXZ order (yaw-pitch-roll)
    // This ensures that:
    // 1. Yaw (Y-axis) is applied first (turning left/right)
    // 2. Pitch (X-axis) is applied second (pitching up/down)  
    // 3. Roll (Z-axis) is applied last (rolling left/right)
    // The set() method takes (x, y, z) which correspond to rotations around X, Y, Z axes
    root.rotation.set(currentPitch, currentYaw, currentRoll);
}

function handleFlashlight(root, keys, lights) {
    if (keys.f) {
        if (!keys.fPressed) {
            keys.fPressed = true;
            if (lights && lights.spotlight) {
                lights.spotlight.visible = !lights.spotlight.visible;
                // Find the light cone in the scene
                const lightCone = root.getObjectByName('lightCone', true);  // true means search recursively
                if (lightCone) {
                    lightCone.visible = !lightCone.visible;
                }
            }
        }
    } else {
        keys.fPressed = false;
    }
}

export { loadAirplane, handleRollAndYaw, handlePitch, handleFlashlight, applyRotations }; 