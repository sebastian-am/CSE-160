// Sebastian Morgese
// smorgese@ucsc.edu

class Cylinder {
    // constructor
    constructor() {
      this.type = 'cylinder';
      this.color = [1.0, 1.0, 1.0, 1.0]; 
      this.segments = 10;
      this.height = 0.2;
      this.matrix = new Matrix4();
    }
  
    // render this shape
    render(){
        var rgba = this.color;
        var segments = this.segments;
        var height = this.height;
        var matrix = this.matrix;
        
        gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
        gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
        
        drawCylinder(segments, height);
    }
}

function drawCylinder(segments, height) {
    var d = 0.5;
    var angleStep = 360 / segments;
    let vertices = [];

    for (var angle = 0; angle < 360; angle += angleStep) {
        var angle1 = angle;
        var angle2 = angle + angleStep;
        var vec1 = [Math.cos(angle1 * Math.PI/180) * d, Math.sin(angle1 * Math.PI/180) * d];
        var vec2 = [Math.cos(angle2 * Math.PI/180) * d, Math.sin(angle2 * Math.PI/180) * d];
        var pt1Top = [vec1[0], vec1[1], height];
        var pt2Top = [vec2[0], vec2[1], height];
        var pt1Bot = [vec1[0], vec1[1], 0.0];
        var pt2Bot = [vec2[0], vec2[1], 0.0];

        // Top face
        vertices.push(
            0, 0, height,
            pt1Top[0], pt1Top[1], pt1Top[2],
            pt2Top[0], pt2Top[1], pt2Top[2]
        );

        // Bottom face
        vertices.push(
            0, 0, 0,
            pt2Bot[0], pt2Bot[1], pt2Bot[2],
            pt1Bot[0], pt1Bot[1], pt1Bot[2]
        );

        // Side faces (2 triangles each)
        vertices.push(
            pt1Bot[0], pt1Bot[1], pt1Bot[2],
            pt2Bot[0], pt2Bot[1], pt2Bot[2],
            pt2Top[0], pt2Top[1], pt2Top[2]
        );
        vertices.push(
            pt1Bot[0], pt1Bot[1], pt1Bot[2],
            pt2Top[0], pt2Top[1], pt2Top[2],
            pt1Top[0], pt1Top[1], pt1Top[2]
        );
    }
    drawTriangle3D(vertices);
}

