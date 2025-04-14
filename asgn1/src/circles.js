// Sebastian Morgese
// smorgese@ucsc.edu

class Circle {
    // constructor
    constructor() {
      this.type = 'circle';
      this.position = [0.0, 0.0, 0.0];
      this.color = [1.0, 1.0, 1.0, 1.0]; 
      this.size = 20.0;
      this.segments = 10;
    }
  
    // render this shape
    render(){
        var xy = this.position;
        var rgba = this.color;
        var size = this.size;
        var segments = this.segments;
        
        // Pass the color of a point to u_FragColor variable
        gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
        
        drawCircle(xy, size, segments);
    }
}

function drawCircle(xy, size, segments) {
    var d = size/200.0; 
    var angleStep = 360 / segments;
    for (var angle = 0; angle < 360; angle+=angleStep) {
        var centerPt = [xy[0], xy[1]];
        var angle1 = angle;
        var angle2 = angle + angleStep;
        var vec1 = [Math.cos(angle1*Math.PI/180)*d, Math.sin(angle1*Math.PI/180)*d];
        var vec2 = [Math.cos(angle2*Math.PI/180)*d, Math.sin(angle2*Math.PI/180)*d];
        var pt1 = [centerPt[0]+vec1[0], centerPt[1]+vec1[1]]
        var pt2 = [centerPt[0]+vec2[0], centerPt[1]+vec2[1]]

        drawTriangle([xy[0], xy[1], pt1[0], pt1[1], pt2[0], pt2[1]]);
    }
}