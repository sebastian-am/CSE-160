import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { updateTerrain } from './terrain.js';

// Track keyboard state
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
                        
                        // Animation function for the plane
                        function animatePlane() {
                            // Control parameters
                            const maxRoll = Math.PI / 4;    // Maximum roll angle (45 degrees)
                            const maxPitch = Math.PI / 4;   // Maximum pitch angle (45 degrees)
                            const moveSpeed = 0.015;        // How fast it moves
                            const returnSpeed = 0.97;       // How fast it returns to neutral
                            const yawFactor = 0.1;          // How much yaw occurs during roll
                            const easeStart = 0.7;          // Start easing at 70% of max angle

                            // Store initial rotation
                            const initialRotation = {
                                x: root.rotation.x,
                                y: root.rotation.y,
                                z: root.rotation.z
                            };

                            function updatePlane() {
                                // Handle roll (A and D)
                                if (keys.a) {
                                    if (root.rotation.z > -maxRoll) {
                                        // Calculate easing factor
                                        let easeFactor = 1.0;
                                        if (Math.abs(root.rotation.z) > maxRoll * easeStart) {
                                            easeFactor = 1 - (Math.abs(root.rotation.z) - maxRoll * easeStart) / (maxRoll * (1 - easeStart));
                                        }

                                        // Roll around local Z axis
                                        const localZ = new THREE.Vector3(0, 0, 1);
                                        root.rotateOnWorldAxis(localZ, -moveSpeed * easeFactor);
                                        
                                        // Yaw around local Y axis (opposite to roll)
                                        const localY = new THREE.Vector3(0, 1, 0);
                                        root.rotateOnWorldAxis(localY, moveSpeed * yawFactor * easeFactor);
                                    }
                                } else if (keys.d) {
                                    if (root.rotation.z < maxRoll) {
                                        // Calculate easing factor
                                        let easeFactor = 1.0;
                                        if (Math.abs(root.rotation.z) > maxRoll * easeStart) {
                                            easeFactor = 1 - (Math.abs(root.rotation.z) - maxRoll * easeStart) / (maxRoll * (1 - easeStart));
                                        }

                                        // Roll around local Z axis
                                        const localZ = new THREE.Vector3(0, 0, 1);
                                        root.rotateOnWorldAxis(localZ, moveSpeed * easeFactor);
                                        
                                        // Yaw around local Y axis (opposite to roll)
                                        const localY = new THREE.Vector3(0, 1, 0);
                                        root.rotateOnWorldAxis(localY, -moveSpeed * yawFactor * easeFactor);
                                    }
                                } else {
                                    // Return roll and yaw to neutral
                                    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, initialRotation.z, 1 - returnSpeed);
                                    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, initialRotation.y, 1 - returnSpeed);
                                }

                                // Handle pitch (W and S)
                                if (keys.w) {
                                    // Calculate total pitch from initial position
                                    const totalPitch = root.rotation.x - initialRotation.x;
                                    if (totalPitch > -maxPitch) {
                                        // Calculate easing factor
                                        let easeFactor = 1.0;
                                        if (Math.abs(totalPitch) > maxPitch * easeStart) {
                                            easeFactor = 1 - (Math.abs(totalPitch) - maxPitch * easeStart) / (maxPitch * (1 - easeStart));
                                        }
                                        root.rotation.x -= moveSpeed * easeFactor;
                                    }
                                } else if (keys.s) {
                                    // Calculate total pitch from initial position
                                    const totalPitch = root.rotation.x - initialRotation.x;
                                    if (totalPitch < maxPitch) {
                                        // Calculate easing factor
                                        let easeFactor = 1.0;
                                        if (Math.abs(totalPitch) > maxPitch * easeStart) {
                                            easeFactor = 1 - (Math.abs(totalPitch) - maxPitch * easeStart) / (maxPitch * (1 - easeStart));
                                        }
                                        root.rotation.x += moveSpeed * easeFactor;
                                    }
                                } else {
                                    // Return pitch to neutral
                                    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, initialRotation.x, 1 - returnSpeed);
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