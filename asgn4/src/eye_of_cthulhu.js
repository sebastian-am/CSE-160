// Sebastian Morgese
// smorgese@ucsc.edu

// Eye of Cthulhu 
// Handles position, animation, chasing, and rendering

class EyeOfCthulhu {
    constructor() {
        this.type = 'eye';
        this.pos = { x: 10, y: 5, z: 10 };  // Start further away and higher up
        this.bobPhase = 0;
        this.tiltPhase = 0;
        this.speed = 0.05;

        // Store all voxels for the eye (body, tendrils, etc.)
        this.voxelCubes = [];
        this.tendrilSegments = [];
        this.g_segmentCount = 8;
        this.g_tendrilBasePositions = [
            [0.125, -0.375, 0.375],
            [-0.125, -0.25, 0.5],
            [0.25,  0.0, 0.375],
            [-0.375, -0.125, 0.375],
            [-0.25,  0.25, 0.375],
            [0.125, 0.25, 0.375],
            [-0.125, 0.0, 0.5],
        ];
        this.createVoxelSphere();
        this.createRedVoxels();
        this.createTendrils();

        // For smooth turning
        this.currentYaw = 0;
        this.currentPitch = 0;
        this.prevYaw = 0;
        this.prevPitch = 0;

        // Particle system
        this.particles = [];
        this.maxParticles = 1000;  
        this.particleLifetime = 8000.0;  // 8 seconds in milliseconds
        this.particleSpeed = 0.002;
        this.particleSize = 0.065;
        this.particleColor = [0.5, 0.0, 0.0, 0.9];

        // Debug log
        // console.log('[EyeOfCthulhu] Constructor:', {
        //     maxParticles: this.maxParticles,
        //     particleLifetime: this.particleLifetime,
        //     particleSpeed: this.particleSpeed,
        //     particleSize: this.particleSize,
        //     particleColor: this.particleColor
        // });
    }

    // Animate and chase the player
    update(playerPos, deltaTime, particlesEnabled = true) {
        // Bobbing and tilting (match original phase)
        this.bob = 0.06 * Math.sin(1.5 * deltaTime - 1.5);
        this.tilt = 7 * Math.sin(1.5 * deltaTime);
        // Chase the player
        let dx = playerPos[0] - this.pos.x;
        let dy = playerPos[1] - this.pos.y;
        let dz = playerPos[2] - this.pos.z;
        let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        let stopDistance = 2.0; // How close the Eye can get
        if (dist > stopDistance) {  
            let moveDist = dist - stopDistance;
            let moveStep = Math.min(this.speed, moveDist);
            this.pos.x += (dx / dist) * moveStep;
            this.pos.y += (dy / dist) * moveStep;
            this.pos.z += (dz / dist) * moveStep;
        }
        // Store direction to player for pupil
        this.playerDir = [dx, dy, dz];
        // For tendril ripple: match original phase
        this.waveAngles = [];
        for (let i = 0; i < this.g_segmentCount; i++) {
            let angle = 7 * Math.sin(1.5 * deltaTime - i);
            this.waveAngles.push(angle);
        }

        // Update particles
        if (particlesEnabled) {
            this.updateParticles(deltaTime);
            // Emit new particles more frequently
            if (Math.random() < 0.5) { // 50% chance each frame 
                this.emitParticle();
            }
        } else {
            this.particles = []; // clear when disabled
        }
    }

    // Render the Eye at its current position, with animation
    render(playerPos) {
        // Calculate the eye's position in world space
        let eyeCenter = [this.pos.x, this.pos.y + this.bob, this.pos.z]; // tilt not needed
        let dir = [ 
            playerPos[0] - eyeCenter[0],
            playerPos[1] - eyeCenter[1],
            playerPos[2] - eyeCenter[2]
        ];
        // Normalize the direction vector
        let mag = Math.sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]);
        let yaw = 0, pitch = 0;
        if (mag > 0.001) { 
            yaw = Math.atan2(dir[0], dir[2]) * 180 / Math.PI + 180;
            pitch = Math.asin(dir[1]/mag) * 180 / Math.PI;
        }

        // Smoothen turning radius
        const turnSpeed = 0.08; // Lower = slower turns
        this.currentYaw = lerp(this.currentYaw, yaw, turnSpeed);
        this.currentPitch += (pitch - this.currentPitch) * turnSpeed;
        // Tendril sway: based on how fast the Eye is turning
        let yawDelta = this.currentYaw - (this.prevYaw || this.currentYaw);
        while (yawDelta < -180) yawDelta += 360;
        while (yawDelta > 180) yawDelta -= 360;
        let pitchDelta = this.currentPitch - (this.prevPitch || this.currentPitch);
        while (pitchDelta < -180) pitchDelta += 360;
        while (pitchDelta > 180) pitchDelta -= 360;
        let yawSwayStrength = 5;   // Lower for more subtle effect
        let pitchSwayStrength = 7; // Lower for more subtle effect
        let tendrilYawSway = -yawDelta * yawSwayStrength;
        let tendrilPitchSway = -pitchDelta * pitchSwayStrength;
        this.prevYaw = this.currentYaw;
        this.prevPitch = this.currentPitch;

        // Base matrix for the whole eye
        let baseMatrix = new Matrix4();
        baseMatrix.translate(this.pos.x, this.pos.y + this.bob, this.pos.z);
        baseMatrix.rotate(this.currentYaw, 0, 1, 0);
        baseMatrix.rotate(this.currentPitch, 1, 0, 0);
        baseMatrix.rotate(this.tilt, 1, 0, 0);

        // Draw body (voxel sphere)
        for (let i = 0; i < this.voxelCubes.length; i++) {
            let cube = this.voxelCubes[i];
            cube.textureNum = g_normalOn ? -3 : -2;
            cube.matrix = new Matrix4(baseMatrix);
            cube.matrix.multiply(cube.baseMatrix);
            let normalMatrix = new Matrix4(cube.matrix);
            normalMatrix.setInverseOf(normalMatrix).transpose();
            gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
            cube.renderFast();
        }
        // Draw red voxels
        for (let i = 0; i < this.redVoxels.length; i++) {
            let cube = this.redVoxels[i];
            cube.textureNum = g_normalOn ? -3 : -2;
            cube.matrix = new Matrix4(baseMatrix);
            cube.matrix.multiply(cube.baseMatrix);
            let normalMatrix = new Matrix4(cube.matrix);
            normalMatrix.setInverseOf(normalMatrix).transpose();
            gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
            cube.renderFast();
        }
        // Draw tendrils (with ripple and sway)
        for (let t = 0; t < this.tendrilSegments.length; t++) {
            let base = this.g_tendrilBasePositions[t];
            let tendril = this.tendrilSegments[t];
            let tendrilBaseMatrix = new Matrix4(baseMatrix);
            tendrilBaseMatrix.translate(base[0], base[1], base[2]);
            let segmentLength = 0.3;
            for (let i = 0; i < tendril.length; i++) {
                let segment = tendril[i];
                segment.textureNum = g_normalOn ? -3 : -2;
                // Sway strongest at base, less at tip
                let factor = (1 - i / (tendril.length - 1));
                let segmentYawSway = tendrilYawSway * factor;
                let segmentPitchSway = tendrilPitchSway * factor;
                let waveAngle = this.waveAngles && this.waveAngles[i] ? this.waveAngles[i] : 0;
                tendrilBaseMatrix.rotate(waveAngle, 1, 0, 0); // ripple (X axis)
                tendrilBaseMatrix.rotate(segmentYawSway, 0, 1, 0); // left/right trailing (Y axis)
                tendrilBaseMatrix.rotate(segmentPitchSway, 1, 0, 0); // up/down trailing (X axis)
                let scaleFactor = 0.125 * (1.0 - 0.1 * i); // Slightly less shrink per segment
                let segmentMatrix = new Matrix4(tendrilBaseMatrix);
                segmentMatrix.scale(scaleFactor, scaleFactor, segmentLength);
                segmentMatrix.translate(0, 0, 0.5);
                segment.matrix = segmentMatrix;
                let normalMatrix = new Matrix4(segmentMatrix);
                normalMatrix.setInverseOf(normalMatrix).transpose();
                gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
                segment.renderFast();
                tendrilBaseMatrix.translate(0, 0, segmentLength);
            }
        }

        // Draw pupil 
        let pupil = new Cylinder();
        pupil.color = [0.0, 0.0, 0.0, 1.0];
        pupil.segments = 8;
        pupil.textureNum = g_normalOn ? -3 : -2;
        pupil.shininess = 200.0;
        let pupilMatrix = new Matrix4(baseMatrix);
        pupilMatrix.translate(0.0, 0.0, -0.52);
        pupilMatrix.scale(0.3, 0.3, 0.2);
        pupil.matrix = pupilMatrix;
        let pupilNormalMatrix = new Matrix4(pupilMatrix);
        pupilNormalMatrix.setInverseOf(pupilNormalMatrix).transpose();
        gl.uniformMatrix4fv(u_NormalMatrix, false, pupilNormalMatrix.elements);
        pupil.render();

        // Draw reflections
        let ref1 = new Cylinder();
        ref1.color = [1.0, 1.0, 1.0, 0.3];
        ref1.segments = 16;
        let ref1Matrix = new Matrix4(baseMatrix);
        ref1Matrix.translate(0.1, 0.06, -0.521);
        ref1Matrix.scale(0.1, 0.08, 0.2);
        ref1.matrix = ref1Matrix;
        ref1.render();
        let ref2 = new Cylinder();
        ref2.color = [1.0, 1.0, 1.0, 0.2];
        ref2.segments = 16;
        let ref2Matrix = new Matrix4(baseMatrix);
        ref2Matrix.translate(0.01, -0.02, -0.521);
        ref2Matrix.scale(0.075, 0.06, 0.2);
        ref2.matrix = ref2Matrix;
        ref2.render();

        // Draw particles
        if (this.particles.length > 0) {
            this.drawParticles();
        }
    }

    // --- Eye construction helpers ---
    createVoxelSphere() {
        this.voxelCubes = [];
        const size = 8;
        const outerRadius = size / 2;
        const innerRadius = outerRadius * 0.8; 
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const dx = x - (size - 1) / 2; 
                    const dy = y - (size - 1) / 2; 
                    const dz = z - (size - 1) / 2; 
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (distance < outerRadius && distance > innerRadius) {
                        const cube = new Cube(); // Didn't notice performance increase if I used a single cube, no need to optimize
                        cube.textureNum = -2;
                        if (g_normalOn) {cube.textureNum = -3;}
                        cube.color = (z == 0) ? [0.2, 0.2, 0.8, 1.0] : [0.95, 0.9, 0.8, 1.0];
                        cube.baseMatrix = new Matrix4();
                        cube.baseMatrix.translate(x/size-0.5, y/size-0.5, z/size-0.5);
                        cube.baseMatrix.scale(0.125, 0.125, 0.125);
                        this.voxelCubes.push(cube);
                    }
                }
            }
        }
    }

    createRedVoxels() {
        this.redVoxels = [];
        const spacing = 0.125;
        let redVoxelPositions = [
            // x = 0.5
            [0.5, 0.0, 0.0],
            [0.5, 0.0, -0.125],
        
            // x = 0.375
            [0.375, 0.0, 0.25],
            [0.375, 0.125, 0.125],
            [0.375, -0.125, 0.25],
            [0.375, -0.25, 0.125],
        
            // x = 0.25
            [0.25, 0.0, 0.375],
            [0.25, 0.125, 0.375],
            [0.25, 0.25, 0.25],
            [0.25, 0.375, 0.125],
            [0.25, -0.125, 0.375],
            [0.25, -0.25, 0.375],
            [0.25, -0.375, 0.25],
            [0.25, -0.5, 0.125],
            
            // x = 0.125
            [0.125, 0.0, 0.5],
            [0.125, 0.125, 0.375],
            [0.125, 0.25, 0.375],
            [0.125, 0.375, 0.25],
            [0.125, -0.125, 0.5],
            [0.125, -0.25, 0.375],
            [0.125, -0.375, 0.375],
            [0.125, -0.5, 0.25],
        
            // x = 0.0
            [0.0, 0.0, 0.5],
            [0.0, 0.125, 0.5],
            [0.0, 0.25, 0.375],
            [0.0, 0.375, 0.25],
            [0.0, 0.5, 0.125],
            [0.0, 0.5, 0],
            [0.0, -0.125, 0.5],
            [0.0, -0.25, 0.5],
            [0.0, -0.375, 0.375],
            [0.0, -0.5, 0.25],
            [0.0, -0.625, 0.125],
            
            // x = -0.125
            [-0.125, 0.0, 0.5],
            [-0.125, 0.125, 0.5],
            [-0.125, 0.25, 0.375],
            [-0.125, 0.375, 0.25],
            [-0.125, -0.125, 0.5],
            [-0.125, -0.25, 0.5],
            [-0.125, -0.375, 0.375],
            [-0.125, -0.5, 0.25],
            [-0.125, -0.625, 0.125],
            [-0.125, -0.625, 0.0],
        
            // x = -0.25
            [-0.25, 0.0, 0.5],
            [-0.25, 0.125, 0.375],
            [-0.25, 0.25, 0.375],
            [-0.25, 0.375, 0.25],
            [-0.25, 0.375, 0.125],
            [-0.25, -0.125, 0.5],
            [-0.25, -0.25, 0.375],
            [-0.25, -0.375, 0.375],
            [-0.25, -0.5, 0.25],
        
            // x = -0.375
            [-0.375, 0.0, 0.375],
            [-0.375, 0.125, 0.375],
            [-0.375, 0.25, 0.25],
            [-0.375, 0.375, 0.125],
            [-0.375, 0.375, 0.0],
            [-0.375, -0.125, 0.375],
            [-0.375, -0.25, 0.375],
            [-0.375, -0.375, 0.25],
            [-0.375, -0.5, 0.125],
        
            //x = -0.5 
            [-0.5, 0.0, 0.25],
            [-0.5, 0.125, 0.125],
            [-0.5, -0.125, 0.25],
            [-0.5, -0.25, 0.25],
            [-0.5, 0.25, -0.125],
            [-0.5, -0.375, 0.125],
        
            // x = -0.625
            [-0.625, -0.25, 0.0],
          ];
          
        for (let i = 0; i < redVoxelPositions.length; i++) {
            let pos = redVoxelPositions[i];
            const red = new Cube();
            red.color = [1.0, 0.0, 0.0, 1.0];
            red.textureNum = -2;
            if (g_normalOn) { red.textureNum = -3; }
            red.baseMatrix = new Matrix4();
            red.baseMatrix.translate(pos[0], pos[1], pos[2]);
            red.baseMatrix.scale(spacing, spacing, spacing);
            this.redVoxels.push(red);
        }
    }

    createTendrils() {
        this.tendrilSegments = [];
        for (let t = 0; t < this.g_tendrilBasePositions.length; t++) {
            const tendril = [];
            for (let i = 0; i < this.g_segmentCount; i++) {
                const segment = new Cube();
                segment.color = [0.95, 0.2, 0.2, 1.0];
                segment.textureNum = -2;
                if (g_normalOn) { segment.textureNum = -3; }
                tendril.push(segment);
            }
            this.tendrilSegments.push(tendril);
        }
    }

    // --- Particle system ---
    emitParticle() {
        if (this.particles.length >= this.maxParticles) return;

        // Create particle at eye surface
        const radius = 0.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        // Calculate position on sphere surface
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        // Create particle with constant velocity
        const particle = {
            position: [
                this.pos.x + x,
                this.pos.y + y,
                this.pos.z + z
            ],
            velocity: [
                x * this.particleSpeed,
                y * this.particleSpeed,
                z * this.particleSpeed
            ],
            lifetime: this.particleLifetime,
            size: this.particleSize
        };
        this.particles.push(particle);
    }

    updateParticles(deltaTime) {
        // Update existing particles
        const fixedTimeStep = 16.67; // fixed 60fps time step in milliseconds
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.lifetime -= fixedTimeStep;  // use fixed time step instead of deltaTime—itdoesn't shorten lifetime agressively 
            
            if (p.lifetime <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Update position with constant velocity using Vector3
            const pos = new Vector3(p.position);
            const vel = new Vector3(p.velocity);
            pos.add(vel);
            p.position = [pos.elements[0], pos.elements[1], pos.elements[2]];

            // Simple linear fade
            const alpha = p.lifetime / this.particleLifetime;
            p.color = [this.particleColor[0], this.particleColor[1], this.particleColor[2], alpha * this.particleColor[3]];
        }
    }

    drawParticles() {
        if (this.particles.length === 0) return;
        let identityNormalMatrix = new Matrix4(); // Set normal matrix to identity for particles
        gl.uniformMatrix4fv(u_NormalMatrix, false, identityNormalMatrix.elements);
        const particleVertices = new Float32Array([
            -0.5, -0.5, 0.0,  // bottom-left
             0.5, -0.5, 0.0,  // bottom-right
             0.5,  0.5, 0.0,  // top-right
            -0.5,  0.5, 0.0   // top-left
        ]);

        const particleIndices = new Uint16Array([
            0, 1, 2, 
            0, 2, 3  
        ]);

        const particleBuffer = gl.createBuffer();
        const particleIndexBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, particleVertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, particleIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, particleIndices, gl.STATIC_DRAW);

        // For the quad geometry
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // For billboarding calculation
        const cameraPos = g_camera.eye.elements;
        const cameraUp = g_camera.up.elements;

        for (const p of this.particles) {
            gl.uniform1f(u_shininess, 0.0);
            var quadNormals = new Float32Array([
                0, 0, -1,
                0, 0, -1,
                0, 0, -1,
                0, 0, -1
            ]);
            if (!window.particleNormalBuffer) {
                window.particleNormalBuffer = gl.createBuffer();
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, window.particleNormalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, quadNormals, gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(a_Normal);

            const particleMatrix = new Matrix4();
            particleMatrix.translate(p.position[0], p.position[1], p.position[2]); // Translate to particle position

            // Calculate direction (from particle to camera) for billboarding
            const dx = cameraPos[0] - p.position[0];
            const dy = cameraPos[1] - p.position[1];
            const dz = cameraPos[2] - p.position[2];
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist > 0.001) {
                // Forward vector points towards camera
                const forward = [dx/dist, dy/dist, dz/dist];
                
                // Right vector (perpendicular to forward and camera up)
                const right = [
                    forward[1] * cameraUp[2] - forward[2] * cameraUp[1],
                    forward[2] * cameraUp[0] - forward[0] * cameraUp[2],
                    forward[0] * cameraUp[1] - forward[1] * cameraUp[0]
                ];
                
                // Normalize right vector fo proper scaling (couldn't use Vecor3, don't try to fix)
                const rightLength = Math.sqrt(right[0]*right[0] + right[1]*right[1] + right[2]*right[2]);
                if (rightLength > 0.001) {
                    right[0] /= rightLength;
                    right[1] /= rightLength;
                    right[2] /= rightLength;
                }

                // Up vector completes the orthonormal basis
                const up = [
                    right[1] * forward[2] - right[2] * forward[1],
                    right[2] * forward[0] - right[0] * forward[2],
                    right[0] * forward[1] - right[1] * forward[0]
                ];

                // Construct rotation matrix from orthonormal basis
                // Makes the quad face the camera while maintaining proper orientation
                const rotationMatrix = new Matrix4();
                rotationMatrix.elements[0] = right[0];   // right vector
                rotationMatrix.elements[1] = right[1];
                rotationMatrix.elements[2] = right[2];
                rotationMatrix.elements[4] = up[0];      // up vector
                rotationMatrix.elements[5] = up[1];
                rotationMatrix.elements[6] = up[2];
                rotationMatrix.elements[8] = -forward[0]; // negative forward vector
                rotationMatrix.elements[9] = -forward[1];
                rotationMatrix.elements[10] = -forward[2];

                particleMatrix.multiply(rotationMatrix);
            }

            particleMatrix.scale(p.size, p.size, p.size);
            gl.uniformMatrix4fv(u_ModelMatrix, false, particleMatrix.elements);

            // Set normal matrix to rotation part of particleMatrix
            let normalMatrix = new Matrix4(particleMatrix);
            // Remove translation
            normalMatrix.elements[12] = 0;
            normalMatrix.elements[13] = 0;
            normalMatrix.elements[14] = 0;
            gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

            gl.uniform4fv(u_FragColor, p.color || this.particleColor);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        }
        gl.disable(gl.BLEND);
    }
} 

function lerp(a, b, t) { // linear interpolation for angles
    let diff = b - a;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    return a + diff * t;
}