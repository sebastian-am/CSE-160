import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { updateTerrain } from './terrain.js';

const keys = {
    a: false,
    d: false,
    w: false,
    s: false
};

// Add keyboard event listeners
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = false;
    }
});

function loadAirplane(scene, camera, controls, noiseOffset, terrainPlane) {
    return new Promise((resolve) => {
        // Add axes helper to visualize coordinate system
        const axesHelper = new THREE.AxesHelper(5); // 5 is the length of the axes
        scene.add(axesHelper);

        const mtlLoader = new MTLLoader();
        mtlLoader.load(
            './assets/airplane/temp.mtl',
            (mtl) => {
                mtl.preload();
                const objLoader = new OBJLoader();
                objLoader.setMaterials(mtl);
                objLoader.load(
                    './assets/airplane/temp.obj',
                    (root) => {
                        scene.add(root);
                        root.name = 'airplane';

                        // Position airplane at origin
                        root.position.set(0, 0, 0);
                        
                        // Add local axes helper to visualize airplane's coordinate system
                        const localAxesHelper = new THREE.AxesHelper(2); // 2 is the length of the axes
                        localAxesHelper.name = 'localAxes';
                        root.add(localAxesHelper);  // Add to airplane so it moves with it
                        
                        // Attach spotlight to airplane
                        const lights = scene.userData.lights;
                        if (lights) {
                            // Position spotlight at the front of the airplane
                            lights.spotlight.position.set(0, 0.25, 1.25);
                            // Make spotlight target follow the airplane's direction
                            lights.spotTarget.position.set(0, 0.25, 15);  // Increased target distance
                            
                            // Set yellow color and high intensity
                            lights.spotlight.color.setHex(0xEFC576);  // Warm yellow color
                            lights.spotlight.intensity = 3000.0;
                            
                            // Add spotlight and target to the airplane
                            root.add(lights.spotlight);
                            root.add(lights.spotTarget);

                            // Create light cone effect
                            const coneGeometry = new THREE.ConeGeometry(8, 20, 32);  // Smaller cone
                            const coneMaterial = new THREE.MeshBasicMaterial({
                                color: 0xEFC576,
                                transparent: true,
                                opacity: 0.08,
                                side: THREE.BackSide,
                                depthWrite: false
                            });
                            const lightCone = new THREE.Mesh(coneGeometry, coneMaterial);
                            lightCone.rotation.x = -Math.PI / 2;  // Rotate to point forward
                            lightCone.position.set(0, 0.25, 11);  // Position closer to the airplane
                            root.add(lightCone);

                            // Update spotlight helper
                            lights.spotHelper.update();
                        }

                        // Animation function for the plane
                        function animatePlane() {
                            // Control parameters
                            const maxRoll = Math.PI / 4;    // Maximum roll angle (45 degrees)
                            const maxPitch = Math.PI / 4;   // Maximum pitch angle (45 degrees)
                            const moveSpeed = 0.015;        // How fast it moves
                            const returnSpeed = 0.97;       // How fast it returns to neutral
                            const yawFactor = 0.1;          // How much yaw occurs during roll
                            const easeStart = 0.7;          // Start easing at 70% of max angle
                            let currentRoll = 0;            // Track current roll angle
                            let currentPitch = 0;           // Track current pitch angle

                            function updatePlane() {
                                // Handle combined movements first
                                
                                    // --- YAW (A/D) ---
                                    if (keys.a) {
                                        // Use world Y axis for yaw
                                        root.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), moveSpeed);
                                    } else if (keys.d) {
                                        // Use world Y axis for yaw
                                        root.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -moveSpeed);
                                    }

                                    // --- PITCH (W/S, true local axis) ---
                                    const pitchSpeed = moveSpeed * 2.0;
                                    if (keys.w) {
                                        const pitchAxis = new THREE.Vector3(1, 0, 0);
                                        // Lerp the pitch amount
                                        const targetPitch = -maxPitch;
                                        const newPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, moveSpeed * 2.0);
                                        const pitchDelta = newPitch - currentPitch;
                                        currentPitch = newPitch;
                                        root.rotateOnAxis(pitchAxis, pitchDelta);
                                    } else if (keys.s) {
                                        const pitchAxis = new THREE.Vector3(1, 0, 0);
                                        // Lerp the pitch amount
                                        const targetPitch = maxPitch;
                                        const newPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, moveSpeed * 2.0);
                                        const pitchDelta = newPitch - currentPitch;
                                        currentPitch = newPitch;
                                        root.rotateOnAxis(pitchAxis, pitchDelta);
                                    } else {
                                        // Return to neutral
                                        const pitchAxis = new THREE.Vector3(1, 0, 0);
                                        const newPitch = THREE.MathUtils.lerp(currentPitch, 0, moveSpeed * 3.0);
                                        const pitchDelta = newPitch - currentPitch;
                                        currentPitch = newPitch;
                                        root.rotateOnAxis(pitchAxis, pitchDelta);
                                    }

                                    // --- ROLL (A/D, visual only) ---
                                    if (keys.a) {
                                        const rollAxis = new THREE.Vector3(0, 0, 1);
                                        // Lerp the roll amount
                                        const targetRoll = -maxRoll;
                                        const newRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, moveSpeed * 2.0);
                                        const rollDelta = newRoll - currentRoll; // Only apply the change
                                        currentRoll = newRoll;
                                        root.rotateOnAxis(rollAxis, rollDelta);
                                    } else if (keys.d) {
                                        const rollAxis = new THREE.Vector3(0, 0, 1);
                                        // Lerp the roll amount
                                        const targetRoll = maxRoll;
                                        const newRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, moveSpeed * 2.0);
                                        const rollDelta = newRoll - currentRoll; // Only apply the change
                                        currentRoll = newRoll;
                                        root.rotateOnAxis(rollAxis, rollDelta);
                                    } else {
                                        // Return to neutral
                                        const rollAxis = new THREE.Vector3(0, 0, 1);
                                        const newRoll = THREE.MathUtils.lerp(currentRoll, 0, moveSpeed * 3.0);
                                        const rollDelta = newRoll - currentRoll; // Only apply the change
                                        currentRoll = newRoll;
                                        root.rotateOnAxis(rollAxis, rollDelta);
                                    }
                                

                                // Update spotlight helper to show current light direction
                                if (scene.userData.lights) {
                                    scene.userData.lights.spotHelper.update();
                                }

                                // Update terrain based on plane orientation
                                updateTerrain(root, noiseOffset, terrainPlane);

                                requestAnimationFrame(updatePlane);
                            }

                            updatePlane();
                        }

                        animatePlane();
                        resolve(root);
                    }
                );
            }
        );
    });
}

export { loadAirplane }; 