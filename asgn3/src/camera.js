class Camera {
    constructor() {
        this.type = 'camera';
        this.fov = 90;
        this.eye = new Vector3([0, 0, 2]);    // Camera position
        this.at = new Vector3([0, 0, -100]);  // Look at point
        this.up = new Vector3([0, 1, 0]);     // Up vector
    }

    moveForward() {
        // D = at - eye (direction vector)
        var d = this.at.sub(this.eye);
        d.normalize();
        this.eye.add(d);
        this.at.add(d);
    }

    moveBackward() {
        // D = at - eye (direction vector)
        var d = this.at.sub(this.eye);
        d.normalize();
        this.eye.sub(d);
        this.at.sub(d);
    }

    moveLeft() {
        // D = eye - at (direction vector)
        var d = new Vector3(this.eye.elements);
        d.sub(this.at);
        d.normalize();
        // Calculate left vector: left = d * up (flipped order)
        var left = Vector3.cross(d, this.up);
        // Move eye and at left
        this.eye.add(left);
        this.at.add(left);
    }

    moveRight() {
        // D = eye - at (direction vector)
        var d = new Vector3(this.eye.elements);
        d.sub(this.at);
        d.normalize();

        // Calculate right vector: right = up * d (flipped order)
        var right = Vector3.cross(this.up, d);

        // Move eye and at right
        this.eye.add(right);
        this.at.add(right);
    }

    panLeft(alpha) {
        let f = this.at.sub(this.eye); // forward vector (at - eye)
        let rotationMatrix = new Matrix4();
        rotationMatrix.setRotate(alpha, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
        
        let f_prime = rotationMatrix.multiplyVector3(f); // rotated forward
        this.at = this.eye.add(f_prime); // update 'at' to rotated direction
    }
    panRight(alpha) {
        this.panLeft(-alpha);
    }

    rotate(degrees) {
        let rad = degrees * Math.PI / 180; // convert degrees to radians
        // create a new point atp, which is a new point in the eye coordinate system
        let atp = this.at.sub(this.eye); // atp = at - eye = direction vector
        // r = sqrt((dx)^2+(dy)^2)
        let r = Math.sqrt(atp.elements[0]**2 + atp.elements[1]**2);
        // theta = arctan(y,x) 
        let theta = Math.atan2(atp.elements[1], atp.elements[0]);
        // remember theta is in radians, so convert to degrees
        theta += rad

        // newX and newY are the new coordinates of the point in the eye coordinate system
        let newX = r * Math.cos(theta);
        let newY = r * Math.sin(theta);
        let d = new Vector3([newX, newY]);
    
        // new at point (fixed to use this.eye instead of eye)
        this.at = this.eye.add(d);
    }
}