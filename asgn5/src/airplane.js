import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import { updateTerrain } from './terrain.js';

function loadAirplane(scene, camera, renderer, noiseOffset, terrainPlane) {
    return new Promise((resolve) => {
        // Add axes helper to visualize coordinate system
        const axesHelper = new THREE.AxesHelper(5);
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
                        
                        // Attach spotlight to airplane
                        const lights = scene.userData.lights;
                        if (lights) {
                            // Position spotlight at the front of the airplane
                            lights.spotlight.position.set(0, 0.25, 1.25);
                            // Make spotlight target follow the airplane's direction
                            lights.spotTarget.position.set(0, 0.25, 15);
                            
                            // Set yellow color and high intensity
                            lights.spotlight.color.setHex(0xEFC576);
                            lights.spotlight.intensity = 3000.0;
                            
                            // Add spotlight and target to the airplane
                            root.add(lights.spotlight);
                            root.add(lights.spotTarget);

                            // Update spotlight helper
                            lights.spotHelper.update();
                        }

                        // Set up FlyControls
                        const flyControls = new FlyControls(camera, renderer.domElement);
                        
                        // Configure controls
                        flyControls.movementSpeed = 1.0;    // How fast it moves
                        flyControls.rollSpeed = 0.005;      // How fast it rolls
                        flyControls.autoForward = false;    // Don't automatically move forward
                        flyControls.dragToLook = false;     // Don't require dragging to look around

                        // Animation function for the plane
                        function animatePlane() {
                            function updatePlane() {
                                // Update fly controls
                                flyControls.update(0.016); // Assuming 60fps

                                // Update spotlight helper
                                if (scene.userData.lights) {
                                    scene.userData.lights.spotHelper.update();
                                }

                                // Update terrain based on camera orientation
                                updateTerrain(camera, noiseOffset, terrainPlane);

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