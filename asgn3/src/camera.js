const PLAYER_RADIUS = 0.25; // Half a block wide

// Speed configuration
const SPEEDS = {
    MOVE: 0.1,    // Forward/backward/strafe speed
    ROTATE: 1.0,  // Rotation speed for Q/E
    VERTICAL: 0.1 // Up/down speed
};

class Camera {
    constructor() {
        this.type = 'camera';
        this.fov = 60;
        // Dynamically set spawn height based on terrain at (0,0)
        let mapX = Math.floor(0 + 16);
        let mapZ = Math.floor(0 + 16);
        let blockHeight = g_map[mapX][mapZ] * 0.5;
        let spawnY = blockHeight + 0.1; // 0.1 buffer above ground
        this.eye = new Vector3([0, spawnY, 0]);
        this.at = new Vector3([0, spawnY, -1]);
        this.up = new Vector3([0, 1, 0]);
        this.viewMatrix = new Matrix4();
        this.viewMatrix.setLookAt(
            this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
            this.at.elements[0], this.at.elements[1], this.at.elements[2],
            this.up.elements[0], this.up.elements[1], this.up.elements[2]
        );
        this.projectionMatrix = new Matrix4();
        this.projectionMatrix.setPerspective(this.fov, canvas.width/canvas.height, 0.1, 1000);
    }

    // // Crisp, simple block collision with player radius
    // isBlocked(x, y, z) {
    //     // Check 4 points around the player (N, S, E, W) at the player's feet/center
    //     const checks = [
    //         [x + PLAYER_RADIUS, z],
    //         [x - PLAYER_RADIUS, z],
    //         [x, z + PLAYER_RADIUS],
    //         [x, z - PLAYER_RADIUS]
    //     ];
    //     for (let [cx, cz] of checks) {
    //         let mapX = Math.floor(cx + 16);
    //         let mapZ = Math.floor(cz + 16);
    //         if (mapX < 0 || mapX >= 32 || mapZ < 0 || mapZ >= 32) return true;
    //         let blockHeight = g_map[mapX][mapZ] * 0.5;
    //         if (y < blockHeight + 0.01) return true; // 0.01 buffer
    //     }
    //     return false;
    // }

    moveForward() {
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        f.normalize();
        f = f.mul(SPEEDS.MOVE);
        this.eye.add(f);
        this.at.add(f);
    }

    moveBackward() {
        let b = new Vector3();
        b.set(this.eye);
        b.sub(this.at);
        b.normalize();
        b = b.mul(SPEEDS.MOVE);
        this.eye.add(b);
        this.at.add(b);
    }

    moveLeft() {
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        f.normalize();
        let s = Vector3.cross(this.up, f);
        s.normalize();
        s = s.mul(SPEEDS.MOVE);
        this.eye.add(s);
        this.at.add(s);
    }

    moveRight() {
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        f.normalize();
        let s = Vector3.cross(f, this.up);
        s.normalize();
        s = s.mul(SPEEDS.MOVE);
        this.eye.add(s);
        this.at.add(s);
    }

    moveUp() {
        this.eye.elements[1] += SPEEDS.VERTICAL;
        this.at.elements[1] += SPEEDS.VERTICAL;
    }

    moveDown() {
        this.eye.elements[1] -= SPEEDS.VERTICAL;
        this.at.elements[1] -= SPEEDS.VERTICAL;
    }

    panLeft(alpha) {
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        if (f.magnitude() < 1e-6) { // just in case it's zero
            f = new Vector3([0, 0, -1]);
        }
        let rotationMatrix = new Matrix4();
        rotationMatrix.setRotate(alpha * SPEEDS.ROTATE, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
        let f_prime = rotationMatrix.multiplyVector3(f);
        this.at = new Vector3(this.eye.elements); // clone eye
        this.at.add(f_prime); // at = eye + rotated direction
    }

    panRight(alpha) {
        this.panLeft(-alpha);
    }

    tiltUp(alpha) { 
        // Compute forward vector
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        // Compute right vector (side)
        let s = Vector3.cross(f, this.up);
        s.normalize();
        // Rotate forward vector around right vector
        let rotationMatrix = new Matrix4();
        rotationMatrix.setRotate(alpha * SPEEDS.ROTATE, s.elements[0], s.elements[1], s.elements[2]);
        let f_prime = rotationMatrix.multiplyVector3(f);
        if (Math.abs(f_prime.elements[1]) > 0.99 * f_prime.magnitude()) { // simple clamping to prevent flipping over
            return; 
        }
        this.at = new Vector3(this.eye.elements);
        this.at.add(f_prime);
    }
}