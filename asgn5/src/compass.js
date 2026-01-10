// Sebastian Morgese
// smorgese@ucsc.edu

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { camera } from './camera.js';

let compassBase;
let compassNeedle;
let compassGroup;
let scene;

// Configuration for compass positioning
const COMPASS_CONFIG = {
    distance: 0.18,
    scale: 0.015,
    rotationSpeed: 0.05,
    // Position offsets (in screen space)
    offsetX: -0.11,     // left/right
    offsetY: -0.05,     // up/down
    offsetZ: 0.0,      // forward/backward
    // Compass swing parameters
    swingDamping: 0.05,    // Resistance of the spring
    swingStrength: 2.0,    // Strength of the spring
    swingSpeed: 0.2        // Speed of the spring
};

// Variables for compass swing
let currentHeading = 0;
let targetHeading = 0;
let headingVelocity = 0;

// Load the compass model
export function loadCompass(sceneRef) {
    scene = sceneRef;
    console.log("Starting to load compass...");
    return new Promise((resolve) => {
        const gltfLoader = new GLTFLoader();
        gltfLoader.setPath('../assets/compass/');

        console.log("Loading compass body...");
        compassGroup = new THREE.Group();
        compassGroup.name = 'compass';

        gltfLoader.load(
            'body.glb',
            (gltf) => {
                console.log("Body GLB loaded successfully");
                compassBase = gltf.scene;
                compassBase.scale.set(COMPASS_CONFIG.scale, COMPASS_CONFIG.scale, COMPASS_CONFIG.scale);
                compassBase.rotation.y = Math.PI;
                compassGroup.add(compassBase);

                console.log("Loading compass needle...");
                gltfLoader.load(
                    'needle.glb',
                    (gltf) => {
                        console.log("Needle GLB loaded successfully");
                        compassNeedle = gltf.scene;
                        compassNeedle.scale.set(COMPASS_CONFIG.scale, COMPASS_CONFIG.scale, COMPASS_CONFIG.scale);
                        compassNeedle.rotation.y = Math.PI;
                        compassGroup.add(compassNeedle);

                        scene.add(compassGroup);
                        console.log("Compass added to scene");
                        resolve(compassGroup);
                    },
                    undefined,
                    (error) => {
                        console.error("Error loading needle GLB:", error);
                    }
                );
            },
            undefined,
            (error) => {
                console.error("Error loading body GLB:", error);
            }
        );
    });
}

// Update compass position and rotation
export function updateCompass() {
    if (!compassGroup || !scene) {
        console.log("Compass group or scene not initialized");
        return;
    }

    const airplane = scene.getObjectByName('airplane');
    if (!airplane) {
        console.log("Airplane not found in scene");
        return;
    }

    // Get camera's position and forward direction
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    
    // Calculate position in front of camera
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    
    // Create a vector for the right direction
    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(camera.quaternion);
    
    // Create a vector for the up direction
    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(camera.quaternion);
    
    // Calculate the final position
    const compassPosition = cameraPosition.clone()
        .add(forward.multiplyScalar(COMPASS_CONFIG.distance))
        .add(right.multiplyScalar(COMPASS_CONFIG.offsetX))
        .add(up.multiplyScalar(COMPASS_CONFIG.offsetY));
    
    compassGroup.position.copy(compassPosition);
    
    // Make compass face the same direction as the camera
    compassGroup.quaternion.copy(camera.quaternion);
    // compassGroup.lookAt(cameraPosition);

    // Update needle rotation with swing effect
    if (compassNeedle) {
        // Get plane's forward vector
        const planeForward = new THREE.Vector3(0, 0, 1);
        planeForward.applyQuaternion(airplane.quaternion);
        targetHeading = -Math.atan2(planeForward.x, planeForward.z);

        // Get the shortest angle diff
        let angleDiff = targetHeading - currentHeading;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Apply spring physics for swinging effect
        const springForce = angleDiff * COMPASS_CONFIG.swingSpeed;
        headingVelocity += springForce * COMPASS_CONFIG.swingStrength;
        headingVelocity *= (1 - COMPASS_CONFIG.swingDamping);
        currentHeading += headingVelocity;

        // Normalize current heading to be between pi and -pi
        if (currentHeading > Math.PI) currentHeading -= Math.PI * 2;
        if (currentHeading < -Math.PI) currentHeading += Math.PI * 2;

        compassNeedle.rotation.z = currentHeading;
    }
} 