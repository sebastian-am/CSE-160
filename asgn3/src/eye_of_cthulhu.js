// Eye of Cthulhu 
// Handles position, animation, chasing, and rendering

class EyeOfCthulhu {
    constructor() {
        this.type = 'eye';
        this.pos = { x: 10, y: 5, z: 10 };  // Start further away and higher up
        this.bobPhase = 0;
        this.tiltPhase = 0;

        // Store all voxels for the eye (body, tentacles, etc.)
        this.voxelCubes = [];
        this.tentacleSegments = [];
        this.g_segmentCount = 8;
        this.g_tentacleBasePositions = [
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
        this.createTentacles();

        // For smooth turning
        this.currentYaw = 0;
        this.currentPitch = 0;
        this.prevYaw = 0;
        this.prevPitch = 0;

        // Particle system
        this.particles = [];
        this.maxParticles = 1000;
        this.particleLifetime = 20000.0;  // 
        this.particleSpeed = 0.002;
        this.particleSize = 0.05;
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
    update(playerPos, deltaTime) {
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
            let speed = 0.04;
            let moveDist = dist - stopDistance;
            let moveStep = Math.min(speed, moveDist);
            this.pos.x += (dx / dist) * moveStep;
            this.pos.y += (dy / dist) * moveStep;
            this.pos.z += (dz / dist) * moveStep;
        }
        // Store direction to player for pupil
        this.playerDir = [dx, dy, dz];
        // For tentacle ripple: match original phase
        this.waveAngles = [];
        for (let i = 0; i < this.g_segmentCount; i++) {
            let angle = 7 * Math.sin(1.5 * deltaTime - i);
            this.waveAngles.push(angle);
        }

        // Update particles
        this.updateParticles(deltaTime);

        // Emit new particles more frequently but with lower chance
        if (Math.random() < 0.2) { // 20% chance each frame
            this.emitParticle();
        }
    }

    // Render the Eye at its current position, with animation
    render(playerPos, g_seconds) {
        // Compute animated center of the eye
        let eyeCenter = [this.pos.x, this.pos.y + this.bob, this.pos.z];
        // Compute direction from eye center to player
        let dir = [
            playerPos[0] - eyeCenter[0],
            playerPos[1] - eyeCenter[1],
            playerPos[2] - eyeCenter[2]
        ];
        let mag = Math.sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]);
        let yaw = 0, pitch = 0;
        if (mag > 0.001) {
            yaw = Math.atan2(dir[0], dir[2]) * 180 / Math.PI + 180;
            pitch = Math.asin(dir[1]/mag) * 180 / Math.PI;
        }
        // Smoothly interpolate yaw and pitch
        const turnSpeed = 0.08; // Lower = slower turns
        this.currentYaw = lerp(this.currentYaw, yaw, turnSpeed);
        this.currentPitch += (pitch - this.currentPitch) * turnSpeed;
        // Tentacle sway: based on how fast the Eye is turning
        let yawDelta = this.currentYaw - (this.prevYaw || this.currentYaw);
        while (yawDelta < -180) yawDelta += 360;
        while (yawDelta > 180) yawDelta -= 360;
        let pitchDelta = this.currentPitch - (this.prevPitch || this.currentPitch);
        while (pitchDelta < -180) pitchDelta += 360;
        while (pitchDelta > 180) pitchDelta -= 360;
        let yawSwayStrength = 3;   // Lower for more subtle effect
        let pitchSwayStrength = 2; // Lower for more subtle effect
        let tentacleYawSway = -yawDelta * yawSwayStrength;
        let tentaclePitchSway = -pitchDelta * pitchSwayStrength;
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
            cube.matrix = new Matrix4(baseMatrix);
            cube.matrix.multiply(cube.baseMatrix);
            cube.renderFast();
        }
        // Draw red voxels
        for (let i = 0; i < this.redVoxels.length; i++) {
            let cube = this.redVoxels[i];
            cube.matrix = new Matrix4(baseMatrix);
            cube.matrix.multiply(cube.baseMatrix);
            cube.renderFast();
        }
        // Draw tentacles (with ripple and sway)
        for (let t = 0; t < this.tentacleSegments.length; t++) {
            let base = this.g_tentacleBasePositions[t];
            let tentacle = this.tentacleSegments[t];
            let tentacleBaseMatrix = new Matrix4(baseMatrix);
            tentacleBaseMatrix.translate(base[0], base[1], base[2]);
            let segmentLength = 0.3; // Longer segments
            for (let i = 0; i < tentacle.length; i++) {
                // Sway strongest at base, less at tip
                let factor = (1 - i / (tentacle.length - 1));
                let segmentYawSway = tentacleYawSway * factor;
                let segmentPitchSway = tentaclePitchSway * factor;
                let waveAngle = this.waveAngles && this.waveAngles[i] ? this.waveAngles[i] : 0;
                tentacleBaseMatrix.rotate(waveAngle, 1, 0, 0); // ripple (X axis)
                tentacleBaseMatrix.rotate(segmentYawSway, 0, 1, 0); // left/right trailing (Y axis)
                tentacleBaseMatrix.rotate(segmentPitchSway, 1, 0, 0); // up/down trailing (X axis)
                let segment = tentacle[i];
                let scaleFactor = 0.125 * (1.0 - 0.1 * i); // Slightly less shrink per segment
                let segmentMatrix = new Matrix4(tentacleBaseMatrix);
                segmentMatrix.scale(scaleFactor, scaleFactor, segmentLength);
                segmentMatrix.translate(0, 0, 0.5);
                segment.matrix = segmentMatrix;
                segment.renderFast();
                tentacleBaseMatrix.translate(0, 0, segmentLength);
            }
        }
        // Draw pupil 
        let pupil = new Cylinder();
        pupil.color = [0.0, 0.0, 0.0, 1.0];
        pupil.segments = 8;
        let pupilMatrix = new Matrix4(baseMatrix);
        pupilMatrix.translate(0.0, 0.0, -0.52);
        pupilMatrix.scale(0.3, 0.3, 0.2);
        pupil.matrix = pupilMatrix;
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
        this.drawParticles();
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
                        const cube = new Cube();
                        cube.textureNum = -2;
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
            red.baseMatrix = new Matrix4();
            red.baseMatrix.translate(pos[0], pos[1], pos[2]);
            red.baseMatrix.scale(spacing, spacing, spacing);
            this.redVoxels.push(red);
        }
    }
    createTentacles() {
        this.tentacleSegments = [];
        for (let t = 0; t < this.g_tentacleBasePositions.length; t++) {
            const tentacle = [];
            for (let i = 0; i < this.g_segmentCount; i++) {
                const segment = new Cube();
                segment.color = [0.95, 0.2, 0.2, 1.0];
                segment.textureNum = -2;
                tentacle.push(segment);
            }
            this.tentacleSegments.push(tentacle);
        }
    }

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
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.lifetime -= deltaTime;
            
            if (p.lifetime <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Update position with constant velocity
            p.position[0] += p.velocity[0];
            p.position[1] += p.velocity[1];
            p.position[2] += p.velocity[2];

            // Simple linear fade
            const alpha = p.lifetime / this.particleLifetime;
            p.color = [this.particleColor[0], this.particleColor[1], this.particleColor[2], alpha * this.particleColor[3]];
        }
    }

    drawParticles() {
        if (this.particles.length === 0) return;

        const particleVertices = new Float32Array([
            -0.5, -0.5, 0.0,
             0.5, -0.5, 0.0,
             0.5,  0.5, 0.0,
            -0.5,  0.5, 0.0
        ]);

        // Create particle indices
        const particleIndices = new Uint16Array([
            0, 1, 2,
            0, 2, 3
        ]);

        // Create buffers
        const particleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, particleVertices, gl.STATIC_DRAW);

        const particleIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, particleIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, particleIndices, gl.STATIC_DRAW);

        // Set up vertex attributes
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        // Enable blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Get camera position and up vector for billboarding
        const cameraPos = g_camera.eye.elements;
        const cameraUp = g_camera.up.elements;

        // Draw each particle
        for (const p of this.particles) {
            const particleMatrix = new Matrix4();
            particleMatrix.translate(p.position[0], p.position[1], p.position[2]);

            // Calculate billboard rotation to face camera
            const dx = cameraPos[0] - p.position[0];
            const dy = cameraPos[1] - p.position[1];
            const dz = cameraPos[2] - p.position[2];
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist > 0.001) {
                // Calculate forward vector (towards camera)
                const forward = [dx/dist, dy/dist, dz/dist];
                
                // Calculate right vector (perpendicular to forward and up)
                const right = [
                    forward[1] * cameraUp[2] - forward[2] * cameraUp[1],
                    forward[2] * cameraUp[0] - forward[0] * cameraUp[2],
                    forward[0] * cameraUp[1] - forward[1] * cameraUp[0]
                ];
                
                // Normalize right vector
                const rightLength = Math.sqrt(right[0]*right[0] + right[1]*right[1] + right[2]*right[2]);
                if (rightLength > 0.001) {
                    right[0] /= rightLength;
                    right[1] /= rightLength;
                    right[2] /= rightLength;
                }

                // Calculate up vector (perpendicular to forward and right)
                const up = [
                    right[1] * forward[2] - right[2] * forward[1],
                    right[2] * forward[0] - right[0] * forward[2],
                    right[0] * forward[1] - right[1] * forward[0]
                ];

                // Rotation matrix for billboarding effect
                const rotationMatrix = new Matrix4();
                rotationMatrix.elements[0] = right[0];
                rotationMatrix.elements[1] = right[1];
                rotationMatrix.elements[2] = right[2];
                rotationMatrix.elements[4] = up[0];
                rotationMatrix.elements[5] = up[1];
                rotationMatrix.elements[6] = up[2];
                rotationMatrix.elements[8] = -forward[0];
                rotationMatrix.elements[9] = -forward[1];
                rotationMatrix.elements[10] = -forward[2];

                particleMatrix.multiply(rotationMatrix);
            }

            particleMatrix.scale(p.size, p.size, p.size);

            gl.uniformMatrix4fv(u_ModelMatrix, false, particleMatrix.elements);
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