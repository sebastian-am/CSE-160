// Sebastian Morgese
// smorgese@ucsc.edu

class Cube {
    static defaultUVs = new Float32Array([
      // Front
      0,0, 1,0, 1,1,
      0,0, 1,1, 0,1,
      // Top
      0,0, 1,0, 1,1,
      0,0, 1,1, 0,1,
      // Bottom
      0,0, 1,0, 1,1,
      0,0, 1,1, 0,1,
      // Left
      0,0, 1,0, 1,1,
      0,0, 1,1, 0,1,
      // Right
      0,0, 1,0, 1,1,
      0,0, 1,1, 0,1,
      // Back
      0,0, 1,0, 1,1,
      0,0, 1,1, 0,1,
    ]);
    // constructor
    constructor() {
        this.type = 'cube';
        this.color = [1.0, 1.0, 1.0, 1.0]; 
        this.matrix = new Matrix4();
        this.normalMatrix = new Matrix4();
        this.textureNum = 0; // Default to texture 0
        this.shininess = 0.0;
        this.cubeVerts = new Float32Array([ 
            // Front face (corresponds to z=0 in local coords)
            0,0,0,  1,0,0,  1,1,0,
            0,0,0,  1,1,0,  0,1,0,
          
            // Top face (corresponds to y=1)
            0,1,0,  0,1,1,  1,1,1,
            0,1,0,  1,1,1,  1,1,0,
          
            // Bottom face (corresponds to y=0)
            0,0,0,  1,0,0,  1,0,1,
            0,0,0,  1,0,1,  0,0,1,
          
            // Left face (corresponds to x=0)
            0,0,0,  0,0,1,  0,1,1,
            0,0,0,  0,1,1,  0,1,0,
          
            // Right face (corresponds to x=1)
            1,0,0,  1,0,1,  1,1,1,
            1,0,0,  1,1,1,  1,1,0,
          
            // Back face (corresponds to z=1)
            0,0,1,  1,0,1,  1,1,1,
            0,0,1,  1,1,1,  0,1,1,
        ]);
        this.cubeUVs = new Float32Array(Cube.defaultUVs);
        this.cubeNormals = new Float32Array([
            // Front face (normal 0,0,-1)
            0,0,-1, 0,0,-1, 0,0,-1,
            0,0,-1, 0,0,-1, 0,0,-1,
            // Top face (normal 0,1,0)
            0,1,0,  0,1,0,  0,1,0,
            0,1,0,  0,1,0,  0,1,0,
            // Bottom face (normal 0,-1,0)
            0,-1,0, 0,-1,0, 0,-1,0,
            0,-1,0, 0,-1,0, 0,-1,0,
            // Left face (normal -1,0,0)
            -1,0,0, -1,0,0, -1,0,0,
            -1,0,0, -1,0,0, -1,0,0,
            // Right face (normal 1,0,0)
            1,0,0,  1,0,0,  1,0,0,
            1,0,0,  1,0,0,  1,0,0,
            // Back face (normal 0,0,1)
            0,0,1,  0,0,1,  0,0,1,
            0,0,1,  0,0,1,  0,0,1,
        ]);
    }

    resetDefaultUVs() {
      this.cubeUVs = new Float32Array(Cube.defaultUVs);
    }


    renderFast(){
        gl.uniform1i(u_whichTexture, this.textureNum);
        gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
        gl.uniform1f(u_shininess, this.shininess);
        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

        // Setup for Position
        initTriangle();
        gl.bufferData(gl.ARRAY_BUFFER, this.cubeVerts, gl.DYNAMIC_DRAW);
        
        // Setup for UV
        initTriangleUV();
        gl.bufferData(gl.ARRAY_BUFFER, this.cubeUVs, gl.DYNAMIC_DRAW);

        // Setup for Normals
        initTriangleNorm();
        gl.bufferData(gl.ARRAY_BUFFER, this.cubeNormals, gl.DYNAMIC_DRAW);
        
        gl.drawArrays(gl.TRIANGLES, 0, 36);

        gl.disableVertexAttribArray(a_Position);
        gl.disableVertexAttribArray(a_UV);
        gl.disableVertexAttribArray(a_Normal); 
    }

    setGrassBlockUVs() {
        const u0 = 0.0 + 0.02; 
        const u1 = 86 / 256 - 0.02;      // ≈ 0.334
        const u2 = 172 / 256;   // ≈ 0.672
        const u3 = 1.0;
        const v0 = 0.0;
        const v1 = 86 / 256 + 0.01;      // ≈ 0.335
        const v2 = 172 / 256 - 0.015;   // ≈ 0.657
        // const v3 = 1.0; // Not used
        this.cubeUVs = new Float32Array([
            // Front (side)
            u0,v0,  u1,v0,   u1,v1,
            u0,v0,   u1,v1,   u0,v1,
            // Top (all grass)
            u0,v1,  u0,v2,   u1,v2,
            u0,v1,   u1,v2,   u1,v1,
            // Bottom (all dirt)
            u2,v1,  u3,v1,   u3,v2,
            u2,v1,  u3,v2,   u2,v2,
            // Left (side)
            u0,v0,  u1,v0,   u1,v1,
            u0,v0,   u1,v1,   u0,v1,
            // Right (side)
            u0,v0,  u1,v0,   u1,v1,
            u0,v0,   u1,v1,   u0,v1,
            // Back (side)
            u0,v0,  u1,v0,   u1,v1,
            u0,v0,   u1,v1,   u0,v1,
        ]);
    }
}
