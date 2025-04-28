// Sebastian Morgese
// smorgese@ucsc.edu

// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotationMatrix;
  void main() {
    gl_Position = u_GlobalRotationMatrix * u_ModelMatrix * a_Position;
  }`

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`

// Global Var for WebGL context
let canvas, gl;
let a_Position, u_FragColor, u_Size, u_ModelMatrix; // Attribute and uniform locations


function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  gl = canvas.getContext('webgl', {preserveDrawingBuffer: true}); 
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  gl.enable(gl.DEPTH_TEST);

  // Enableing alpha
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Get the storage location of u_ModelMatrix
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }

  u_GlobalRotationMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotationMatrix');
  if (!u_GlobalRotationMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotationMatrix');
    return;
  }

  // Set the matrix to identity
  var identityMatrix = new Matrix4(); 
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityMatrix.elements);

  // // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

}


// Contants 
const POINT = 0, TRIANGLE = 1, CIRCLE = 2;

//Global Var for selected shape
let g_selectedColor = [1.0, 1.0, 1.0, 1.0]; // Default color is white
let g_selectedSize = 20.0; // Default size is 20
let g_selectedShape = POINT; // Default shape is point
let g_globalAngle = 0.0; // Global angle for rotation
let g_yellowAngle = 0.0; // Angle for the yellow arm
let g_magentaAngle = 0.0; // Angle for the magenta box
let g_AnimationOn = false;


function addActionForHtmlUI() {
  // Part Slider Events
  document.getElementById("yellowSlide").addEventListener("input", function() {
    g_yellowAngle = this.value; renderScene();
  });
  document.getElementById("magentaSlide").addEventListener("input", function() {
    g_magentaAngle = this.value; renderScene();
  });

  // Global Angle Slider Events
  document.getElementById("angleSlide").addEventListener("input", function() {
    g_globalAngle = this.value; renderScene();
  });

  // Animation Button Event
  document.getElementById("animationOnButton").onclick = function() { 
    g_AnimationOn = true;
  };
  document.getElementById("animationOffButton").onclick = function() { 
    g_AnimationOn = false;
  };
}

function main() {
  setupWebGL();
  connectVariablesToGLSL();
  addActionForHtmlUI();
  setupMouseControl(); 
  createVoxelSphere(); // Create the voxel sphere (out of renderScene to preserve performance)

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  requestAnimationFrame(tick); // Start the animation
}

// Global variables for mouse
let g_mouseDown = false;
let g_lastX = 0;
let g_lastY = 0;
let g_mouseXRotation = 0;
let g_mouseYRotation = 0;

function setupMouseControl() {
  // When the mouse is pressed down, start tracking movement
  canvas.onmousedown = function(ev) { 
    g_mouseDown = true; 
    g_lastX = ev.clientX; 
    g_lastY = ev.clientY;
  };

  // When the mouse is released, stop tracking movement
  window.onmouseup = function(ev) {  // window used to capture mouse up events outside the canvas
    g_mouseDown = false; 
  };

  // When the mouse is moved, update the rotation if dragging
  window.onmousemove = function(ev) { 
    if (g_mouseDown) {
      let dx = ev.clientX - g_lastX;
      let dy = ev.clientY - g_lastY;
      g_mouseXRotation += dy;
      g_mouseYRotation += dx;
      g_lastX = ev.clientX;
      g_lastY = ev.clientY;

      renderScene();
    }
  };
}


// Performance test variables
let g_startTime = performance.now()/1000.0; // Start time for the animation
let g_seconds = performance.now()/1000.0-g_startTime; // Current time in seconds

function tick() {
  g_seconds = performance.now()/1000.0-g_startTime; // Update the current time
  // g_globalAngle = (g_globalAngle+1) % 360; // Update the global angle
  updateAnimationAngles(); // Update the angles for animation
  renderScene(); // Render the scene
  requestAnimationFrame(tick); // Request the next frame
}

function updateAnimationAngles() {
  if (g_AnimationOn) {
    g_yellowAngle = 45*Math.sin(g_seconds); // Update the yellow arm angle
  }
}

function renderScene() {
  var startTime = performance.now();

  // Rotateion logic
  var globalRotMat = new Matrix4();
  globalRotMat.rotate(g_mouseYRotation, 0, -1, 0); // Mouse left-right -> rotate Y
  globalRotMat.rotate(g_mouseXRotation, -1, 0, 0); // Mouse up-down -> rotate X
  globalRotMat.rotate(g_globalAngle, 0, 1, 0);    // Plus the slider rotation
  gl.uniformMatrix4fv(u_GlobalRotationMatrix, false, globalRotMat.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // Clear <canvas>


  // Draw iris
  // var iris = new Cylinder();
  // iris.color = [0.2, 0.2, 0.8, 1.0];
  // iris.segments = 16;
  // iris.matrix.translate(0.0, 0.0, -0.501);  
  // iris.matrix.scale(0.5, 0.5, 0.2); 
  // iris.render();

  // Draw pupil
  var pup = new Cylinder();
  pup.color = [0.0, 0.0, 0.0, 1.0];
  pup.segments = 8;
  pup.matrix.translate(0.0, 0.0, -0.52);
  pup.matrix.scale(0.3, 0.3, 0.2);
  pup.render();

  //Draw shine
  var shine = new Cylinder();
  shine.color = [1.0, 1.0, 1.0, 0.3];
  shine.segments = 16;
  shine.matrix.translate(-0.1, 0.06, -0.521);
  shine.matrix.scale(0.1, 0.08, 0.2);
  shine.render();

  // Draw shine 2
  var shine2 = new Cylinder();
  shine2.color = [1.0, 1.0, 1.0, 0.2];
  shine2.segments = 16;
  shine2.matrix.translate(0.01, -0.02, -0.521);
  shine2.matrix.scale(0.075, 0.06, 0.2);
  shine2.render();

  // Parent Base
  let baseMatrix = new Matrix4();
  baseMatrix.setTranslate(0, 0, 0); 
  baseMatrix.rotate(g_globalAngle, 0, 1, 0);  // <- animation based on your slider (or auto spin)
  
  // Save parent's matrix
  g_voxelBaseMatrix = baseMatrix;

  // Draw voxels
  for (let i = 0; i < g_voxelCubes.length; i++) {
    let cube = g_voxelCubes[i];
    cube.matrix = new Matrix4(g_voxelBaseMatrix); // Start from parent
    cube.matrix.multiply(cube.baseMatrix);        // Apply own position
    cube.render();
  }
 





  // // Draw the body cube
  // var body = new Cube();
  // body.color = [1.0,0.0,0.0,1.0];
  // body.matrix.translate(-0.25, -0.75, 0.0);
  // body.matrix.scale(0.5, 0.3, 0.5);
  // body.render();
  
  // // Draw a left arm
  // var leftArm = new Cube();
  // leftArm.color = [1,1,0,1];
  // leftArm.matrix.setTranslate(0, -0.5, 0.001);
  // leftArm.matrix.rotate(-g_yellowAngle, 0,0,1);
  // var yellowCoordsMat = new Matrix4(leftArm.matrix);
  // leftArm.matrix.scale(0.25, 0.7, 0.5);
  // leftArm.matrix.translate(-0.5,0,0);
  // leftArm.render ();
  
  // // Test box
  // var box = new Cube();
  // box.color = [1,0,1,1];
  // box.matrix = yellowCoordsMat;
  // box.matrix. translate(0, 0.65, 0,0);
  // box.matrix.rotate(g_magentaAngle,0,0,1);
  // box.matrix.scale(0.3, 0.3, 0.3);
  // box.matrix.translate(-0.5,0,-0.001);
  // box.render ();

  //performance test
  var duration = performance.now() - startTime;
  sendTextToHTML("ms: " + Math.floor(duration) + " fps: " + Math.floor(1000/duration), "numdot");
}

let g_voxelCubes = [];
let g_voxelBaseMatrix = new Matrix4();

function createVoxelSphere() {
  let size = 8;
  let radius = size / 2;

  // Create a sphere of cubes 
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        let dx = x - (size - 1) / 2; 
        let dy = y - (size - 1) / 2; 
        let dz = z - (size - 1) / 2; 
        let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < radius) {
          let cube = new Cube();
          if (z == 0) {
            cube.color = [0.2, 0.2, 0.8, 1.0];
          }
          else {
            cube.color = [0.95, 0.9, 0.8, 1.0];
          }
          // Save relative placement
          cube.baseMatrix = new Matrix4();
          cube.baseMatrix.translate(x/size-0.5, y/size-0.5, z/size-0.5); // Translate to the center of the cube
          cube.baseMatrix.scale(0.125, 0.125, 0.125);
          g_voxelCubes.push(cube);
        }
      }
    }
  }
}


function sendTextToHTML(text, htmlID) {
  var element = document.getElementById(htmlID);
  if (!element) {
    console.log("Failed to get the HTML element with id: " + htmlID);
    return;
  }
  element.innerHTML = text;
}
