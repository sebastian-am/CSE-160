// Sebastian Morgese
// smorgese@ucsc.edu

class Cube {
    // constructor
    constructor() {
        this.type = 'cube';
        this.color = [1.0, 1.0, 1.0, 1.0]; 
        this.matrix = new Matrix4();
    }

    // render this shape
    render(){
        var rgba = this.color;
        var matrix = this.matrix;
        drawCube(matrix, rgba);
    }
}

function drawCube(matrix, rgba) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
    gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);

    // Front
    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
    drawFace([
        0,0,0, 1,0,0, 1,1,0,
        0,0,0, 1,1,0, 0,1,0
    ]);

    // Top
    gl.uniform4f(u_FragColor, rgba[0]*0.9, rgba[1]*0.9, rgba[2]*0.9, rgba[3]);
    drawFace([
        0,1,0, 1,1,1, 0,1,1,
        0,1,0, 1,1,0, 1,1,1
    ]);

    // Bottom
    gl.uniform4f(u_FragColor, rgba[0]*0.5, rgba[1]*0.5, rgba[2]*0.4, rgba[3]);
    drawFace([
        0,0,1, 1,0,0, 0,0,0,
        0,0,1, 1,0,1, 1,0,0
    ]);

    // Left
    gl.uniform4f(u_FragColor, rgba[0]*0.6, rgba[1]*0.6, rgba[2]*0.6, rgba[3]);
    drawFace([
        0,0,1, 0,1,0, 0,1,1,
        0,0,1, 0,0,0, 0,1,0
    ]);

    // Right
    gl.uniform4f(u_FragColor, rgba[0]*0.8, rgba[1]*0.8, rgba[2]*0.8, rgba[3]);
    drawFace([
        1,0,0, 1,1,1, 1,1,0,
        1,0,0, 1,0,1, 1,1,1
    ]);

    // Back
    gl.uniform4f(u_FragColor, rgba[0]*0.4, rgba[1]*0.4, rgba[2]*0.4, rgba[3]);
    drawFace([
        1,0,1, 0,0,1, 0,1,1,
        1,0,1, 0,1,1, 1,1,1
    ]);
}

// Helper for better performance
function drawFace(vertices) {
    var n = 6; 
    
    if (!drawFace.buffer) {
        drawFace.buffer = gl.createBuffer();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, drawFace.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.drawArrays(gl.TRIANGLES, 0, n);

    gl.disableVertexAttribArray(a_Position);
}
