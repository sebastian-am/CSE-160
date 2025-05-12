class Camera {
    constructor() {
        this.type = 'camera';
        this.fov = 60;
        this.eye = new Vector3([0, 0, 0]);
        this.at = new Vector3([0, 0, -1]);
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

    moveForward(speed = 0.1) {
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        f.normalize();
        f = f.mul(speed);
        this.eye = this.eye.add(f);
        this.at = this.at.add(f);
    }

    moveBackward(speed = 0.1) {
        let b = new Vector3();
        b.set(this.eye);
        b.sub(this.at);
        b.normalize();
        b = b.mul(speed);
        this.eye = this.eye.add(b);
        this.at = this.at.add(b);
    }

    moveLeft(speed = 0.1) {
        let l = new Vector3();
        l.set(this.at);
        l.sub(this.eye);
        l.normalize();
        let s = Vector3.cross(this.up, l);
        s.normalize();
        s = s.mul(speed);
        this.eye = this.eye.add(s);
        this.at = this.at.add(s);
    }

    moveRight(speed = 0.1) {
        let r = new Vector3();
        r.set(this.at);
        r.sub(this.eye);
        r.normalize();
        let s = Vector3.cross(r, this.up);
        r.normalize();
        r = s.mul(speed);
        this.eye = this.eye.add(s);
        this.at = this.at.add(s);
    }

    panLeft(alpha) {
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        if (f.magnitude() < 1e-6) { // just in case it's zero
            f = new Vector3([0, 0, -1]);
        }
        let rotationMatrix = new Matrix4();
        rotationMatrix.setRotate(alpha, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
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
        rotationMatrix.setRotate(alpha, s.elements[0], s.elements[1], s.elements[2]);
        let f_prime = rotationMatrix.multiplyVector3(f);
        // Clamp to avoid flipping (optional, can be improved)
        if (Math.abs(f_prime.elements[1]) > 0.99 * f_prime.magnitude()) {
            return; // Prevent flipping over
        }
        this.at = new Vector3(this.eye.elements);
        this.at.add(f_prime);
    }
}