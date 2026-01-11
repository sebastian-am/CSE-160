import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Main camera setup
const fov = 45;
const aspect = window.innerWidth / window.innerHeight;
const near = 0.1;
const far = 1000;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.set(0, 5, -10);  // Position sligthly behind and above the plane
camera.lookAt(0, 0, 0);

// Controls for camera - will be attached to canvas in main()
let controls = null;

// Function to initialize controls with canvas
export function initControls(canvas) {
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    return controls;
}

// Add camera lock state
let isCameraLocked = false;

// Function to toggle camera lock
export function toggleCameraLock() {
    isCameraLocked = !isCameraLocked;
    return isCameraLocked;
}

// Update camera position based on lock state
export function updateCameraPosition(airplane) {
    if (!airplane || !controls) return;

    const airplanePos = new THREE.Vector3();
    airplane.getWorldPosition(airplanePos);

    if (isCameraLocked) {
        // Camera locked: follow airplane closely
        const cameraOffset = new THREE.Vector3(0, 2, -8);
        cameraOffset.applyQuaternion(airplane.quaternion);
        
        camera.position.copy(airplanePos).add(cameraOffset);
        camera.lookAt(airplanePos);
        
        controls.enabled = false;
    } else {
        // Camera unlocked: don't update target automatically (prevents zooming out)
        // User can manually control the camera
        controls.enabled = true;
    }
}

// Function to update controls
function updateControls() {
    if (controls) {
        controls.update();
    }
}

// Export controls getter (will be set after init)
export function getControls() {
    return controls;
}

export { 
    camera, 
    updateControls
}; 