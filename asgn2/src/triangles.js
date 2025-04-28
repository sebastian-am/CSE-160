// Sebastian Morgese
// smorgese@ucsc.edu

// Globla vars
let triangleBuffer = null; 
let triangle3DBuffer = null;

class Triangle {
  // constructor
  constructor() {
    this.type = 'triangle';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0]; 
    this.size = 20.0;
  }

  // render this shape
  render(){
      var xy = this.position;
      var rgba = this.color;
      var size = this.size;
      var d = this.size/200.0; // Used to scale the triangle
      
      // Pass the color of a point to u_FragColor variable
      gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);

      
      // Draw
      drawTriangle([xy[0], xy[1], xy[0] + d, xy[1], xy[0], xy[1] + d]); 
  }
}

function drawTriangle(vertices) { 
  var n = 3; // The number of vertices

  if (triangleBuffer == null) {
    triangleBuffer = gl.createBuffer();
  }
  
  if (!triangleBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }

  // Bind the buffer object to target
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer);
  // Write date into the buffer object
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

  // Assign the buffer object to a_Position variable
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);

  // Enable the assignment to a_Position variable when drawning triangles
  gl.enableVertexAttribArray(a_Position);

  gl.drawArrays(gl.TRIANGLES, 0, n);

  gl.disableVertexAttribArray(a_Position); // Disable the assignment to a_Position variable when drawing points
}

function drawTriangle3D(vertices) { 
  var n = vertices.length / 3; 
  // Create a buffer object
  if (triangle3DBuffer == null) {
    triangle3DBuffer = gl.createBuffer();
  }
  if (!triangle3DBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }

  // Bind the buffer object to target
  gl.bindBuffer(gl.ARRAY_BUFFER, triangle3DBuffer);
  // Write date into the buffer object
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

  // Assign the buffer object to a_Position variable
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);

  // Enable the assignment to a_Position variable when drawning triangles
  gl.enableVertexAttribArray(a_Position);

  gl.drawArrays(gl.TRIANGLES, 0, n);

  gl.disableVertexAttribArray(a_Position); // Disable the assignment to a_Position variable when drawing points
}