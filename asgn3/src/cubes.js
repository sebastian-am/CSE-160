// Sebastian Morgese
// smorgese@ucsc.edu

class Cube {
    // constructor
    constructor() {
        this.type = 'cube';
        this.color = [1.0, 1.0, 1.0, 1.0]; 
        this.matrix = new Matrix4();
        this.textureNum = 0; // Default to texture 0
        this.cubeVerts = new Float32Array([
            // Front face
            0,0,0,  1,0,0,  1,1,0,
            0,0,0,  1,1,0,  0,1,0,
          
            // Top face
            0,1,0,  0,1,1,  1,1,1,
            0,1,0,  1,1,1,  1,1,0,
          
            // Bottom face
            0,0,0,  1,0,0,  1,0,1,
            0,0,0,  1,0,1,  0,0,1,
          
            // Left face
            0,0,0,  0,1,0,  0,1,1,
            0,0,0,  0,1,1,  0,0,1,
          
            // Right face
            1,0,0,  1,1,0,  1,1,1,
            1,0,0,  1,1,1,  1,0,1,
          
            // Back face
            0,0,1,  1,0,1,  1,1,1,
            0,0,1,  1,1,1,  0,1,1,
          ]);
          
          this.cubeUVs = new Float32Array([
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
    }

    // render this shape
    render(){
        // Pass the texture number to u_whichTexture
        gl.uniform1i(u_whichTexture, this.textureNum);
        
        // Pass the color to u_FragColor
        gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
        
        // Pass the matrix to u_ModelMatrix attribute
        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
        var matrix = this.matrix;
        drawCube(matrix, this.color);
    }
    renderFast(){
        // Pass the texture number to u_whichTexture
        gl.uniform1i(u_whichTexture, this.textureNum);
        
        // Pass the color to u_FragColor
        gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
        
        // Pass the matrix to u_ModelMatrix attribute
        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

        initTriangle();
        gl.bufferData(gl.ARRAY_BUFFER, this.cubeVerts, gl.DYNAMIC_DRAW);
        
        initTriangleUV();
        gl.bufferData(gl.ARRAY_BUFFER, this.cubeUVs, gl.DYNAMIC_DRAW);

        gl.drawArrays(gl.TRIANGLES, 0, 36);
        gl.disableVertexAttribArray(a_Position);
        gl.disableVertexAttribArray(a_UV);
    }
}
 
function drawCubeFast(matrix, color) {

}
function drawCube(matrix, color) {
    // Front face
    drawFace([0,0,0, 1,0,0, 1,1,0, 0,1,0], [0,0, 1,0, 1,1, 0,1]);
    
    // Top face
    drawFace([0,1,0, 1,1,0, 1,1,1, 0,1,1], [0,0, 1,0, 1,1, 0,1]);
    
    // Bottom face
    drawFace([0,0,0, 1,0,0, 1,0,1, 0,0,1], [0,0, 1,0, 1,1, 0,1]);
    
    // Left face
    drawFace([0,0,0, 0,1,0, 0,1,1, 0,0,1], [0,0, 1,0, 1,1, 0,1]);
    
    // Right face
    drawFace([1,0,0, 1,1,0, 1,1,1, 1,0,1], [0,0, 1,0, 1,1, 0,1]);
    
    // Back face
    drawFace([0,0,1, 1,0,1, 1,1,1, 0,1,1], [0,0, 1,0, 1,1, 0,1]);
}

function drawFace(vertices, uv) {
    var n = 6; // The number of vertices (2 triangles × 3 vertices)

    // Create a buffer object
    if (triangle3DUVBuffer == null) {
        triangle3DUVBuffer = gl.createBuffer();
    }
    if (!triangle3DUVBuffer) {
        console.log('Failed to create the buffer object');
        return -1;
    }

    // Convert quad vertices to triangles
    var triangleVertices = [
        vertices[0], vertices[1], vertices[2],  // First triangle
        vertices[3], vertices[4], vertices[5],
        vertices[6], vertices[7], vertices[8],
        vertices[0], vertices[1], vertices[2],  // Second triangle
        vertices[6], vertices[7], vertices[8],
        vertices[9], vertices[10], vertices[11]
    ];

    // Convert quad UVs to triangles
    var triangleUVs = [
        uv[0], uv[1],  // First triangle
        uv[2], uv[3],
        uv[4], uv[5],
        uv[0], uv[1],  // Second triangle
        uv[4], uv[5],
        uv[6], uv[7]
    ];

    // Bind the buffer object to target
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle3DUVBuffer);
    // Write date into the buffer object
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.DYNAMIC_DRAW);

    // Assign the buffer object to a_Position variable
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);

    // Enable the assignment to a_Position variable when drawing triangles
    gl.enableVertexAttribArray(a_Position);

    if (uvBuffer == null) {
        uvBuffer = gl.createBuffer();
    }
    if (!uvBuffer) {
        console.log('Failed to create the buffer object');
        return -1;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleUVs), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);

    gl.drawArrays(gl.TRIANGLES, 0, n);

    gl.disableVertexAttribArray(a_Position);
    gl.disableVertexAttribArray(a_UV);
}
