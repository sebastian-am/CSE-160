// Sebastian Morgese
// smorgese@ucsc.edu

class Cylinder {
    constructor() {
      this.type = 'cylinder';
      this.color = [1.0, 1.0, 1.0, 1.0]; 
      this.segments = 10;
      this.height = 0.2;
      this.matrix = new Matrix4();
      this.shininess = 0.0;
    }
  
    render(){
        var rgba = this.color;
        var segments = this.segments;
        var height = this.height;
        var matrix = this.matrix;
        
        gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
        gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
        gl.uniform1f(u_shininess, this.shininess);
        
        drawCylinder(segments, height);
    }
}

function drawCylinder(segments, height) {
    var d = 0.5;
    var angleStep = 360 / segments;
    let vertices = [];
    let normals = [];
    let uvs = [];

    for (var angle = 0; angle < 360; angle += angleStep) {
        var angle1 = angle;
        var angle2 = angle + angleStep;
        var vec1 = [Math.cos(angle1 * Math.PI/180) * d, Math.sin(angle1 * Math.PI/180) * d];
        var vec2 = [Math.cos(angle2 * Math.PI/180) * d, Math.sin(angle2 * Math.PI/180) * d];
        var pt1Top = [vec1[0], vec1[1], height];
        var pt2Top = [vec2[0], vec2[1], height];
        var pt1Bot = [vec1[0], vec1[1], 0.0];
        var pt2Bot = [vec2[0], vec2[1], 0.0];

        // Top face (normal 0,0,1)
        vertices.push(0, 0, height, pt1Top[0], pt1Top[1], pt1Top[2], pt2Top[0], pt2Top[1], pt2Top[2]);
        normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
        uvs.push(0,0, 0,0, 0,0);

        // Bottom face (normal 0,0,-1)
        vertices.push(0, 0, 0, pt2Bot[0], pt2Bot[1], pt2Bot[2], pt1Bot[0], pt1Bot[1], pt1Bot[2]);
        normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1);
        uvs.push(0,0, 0,0, 0,0);

        // Side faces (2 triangles each)
        var n1 = [vec1[0], vec1[1], 0];
        var n2 = [vec2[0], vec2[1], 0];
        var n1len = Math.sqrt(n1[0]*n1[0] + n1[1]*n1[1]);
        var n2len = Math.sqrt(n2[0]*n2[0] + n2[1]*n2[1]);
        if (n1len > 0.0001) { n1[0] /= n1len; n1[1] /= n1len; }
        if (n2len > 0.0001) { n2[0] /= n2len; n2[1] /= n2len; }
        // First side triangle
        vertices.push(pt1Bot[0], pt1Bot[1], pt1Bot[2], pt2Bot[0], pt2Bot[1], pt2Bot[2], pt2Top[0], pt2Top[1], pt2Top[2]);
        normals.push(n1[0], n1[1], 0, n2[0], n2[1], 0, n2[0], n2[1], 0);
        uvs.push(0,0, 0,0, 0,0);
        // Second side triangle
        vertices.push(pt1Bot[0], pt1Bot[1], pt1Bot[2], pt2Top[0], pt2Top[1], pt2Top[2], pt1Top[0], pt1Top[1], pt1Top[2]);
        normals.push(n1[0], n1[1], 0, n2[0], n2[1], 0, n1[0], n1[1], 0);
        uvs.push(0,0, 0,0, 0,0);
    }
    drawTriangle3DUVNormal(vertices, uvs, normals);
}

function drawTriangle3DUVNormal(vertices, uvs, normals) {
    var n = vertices.length / 3;
    if (!window.cylinderVertexBuffer) {
        window.cylinderVertexBuffer = gl.createBuffer();
    }
    if (!window.cylinderNormalBuffer) {
        window.cylinderNormalBuffer = gl.createBuffer();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, window.cylinderVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.bindBuffer(gl.ARRAY_BUFFER, window.cylinderNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.disableVertexAttribArray(a_Position);
    gl.disableVertexAttribArray(a_Normal);
}

