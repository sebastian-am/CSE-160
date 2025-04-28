// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Shaders
//===============================================
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotationMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_GlobalRotationMatrix * u_ModelMatrix * a_Position;
  }`

var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`

//===============================================
// Global Variables and Constants
//===============================================

/** WebGL Contexts and Locations **/
/** @type {HTMLCanvasElement} */ let canvas = null;
/** @type {WebGLRenderingContext} */ let gl = null;
/** @type {GLint} */ let a_Position = null;
/** @type {WebGLUniformLocation} */ let u_FragColor = null;
/** @type {WebGLUniformLocation} */ let u_ModelMatrix = null;
/** @type {WebGLUniformLocation} */ let u_GlobalRotationMatrix = null;
/** @type {WebGLUniformLocation} */ let u_ProjectionMatrix = null;

/** Animation Controls **/
/** @type {number} */ let g_globalAngle = 0;
/** @type {boolean} */ let g_animationOn = false;
/** @type {boolean} */ let g_pokeAnimation = false;
/** @type {boolean} */ let g_spinMode = false;
/** @type {number} */ let g_totalSpin = 720;
/** @type {number} */ let g_baseTentacleAngle = 0;
/** @type {number} */ let g_secondTentacleAngle = 0;
/** @type {number} */ let g_thirdTentacleAngle = 0;
/** @type {number} */let g_tipTentacleAngle = 0;
/** @type {number} */ let g_spiralSpin = 0;


/** Mouse Control **/
/** @type {boolean} */ let g_mouseDown = false;
/** @type {number} */ let g_lastX = 0;
/** @type {number} */ let g_lastY = 0;
/** @type {number} */ let g_mouseXRotation = 0;
/** @type {number} */ let g_mouseYRotation = 0;

/** Timing Variables **/
/** @type {number} */ let g_startTime = performance.now() / 1000;
/** @type {number} */ let g_seconds = performance.now()/1000.0-g_startTime; 
/** @type {number} */ let g_spiralStartTime = 0;
/** @type {number} */ let g_normalBobHeight = 0;
/** @type {number} */ let g_bobHeight = 0;
/** @type {number} */ let g_normalTiltAngle = 0;
/** @type {number} */ let g_tiltAngle = 0;
/** @type {number[]} */ let g_waveAngles = [];
/** @type {number} */ let g_segmentCount = 4;

/** Scene Objects **/
/** @type {Cube[]} */ let g_voxelCubes = [];
/** @type {Matrix4} */ let g_voxelBaseMatrix = new Matrix4();
/** @type {Cube[][]} */ let g_tentacleSegments = [];
/** @type {number[][]} */ let g_tentacleBasePositions = [
  [0.125, -0.375, 0.375],
  [-0.125, -0.25, 0.5],
  [0.25,  0.0, 0.375],
  [-0.375, -0.125, 0.375],
  [-0.25,  0.25, 0.375],
  [0.125, 0.25, 0.375],
  [-0.125, 0.0, 0.5],
];

function main() {
  setupWebGL();
  connectVariablesToGLSL();
  addActionForHtmlUI();
  setupMouseControl(); 
  buildShapes(); // Called here to preserve performance 

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  requestAnimationFrame(tick); // Start the animation
}

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

  // Enabling alpha
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }
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
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  if (!u_ProjectionMatrix) {
    console.log('Failed to get the storage location of u_ProjectionMatrix');
    return;
  }
  
  const projMatrix = new Matrix4();
  // Set the projection matrix (orthographic): left, right, bottom, top, near, far
  projMatrix.setOrtho(-1.5, 1.5, -1.5, 1.5, 0.01, 100);  
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMatrix.elements);

  // Set the matrix to identity
  var identityMatrix = new Matrix4(); 
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityMatrix.elements);
}

//===============================================
// User Input Functions
//===============================================

function addActionForHtmlUI() {
  // Part Slider Events
  document.getElementById("baseTentacleSlide").addEventListener("input", function() {
    g_baseTentacleAngle = this.value;
    renderScene();
  });
  document.getElementById("secondTentacleSlide").addEventListener("input", function() {
    g_secondTentacleAngle = this.value;
    renderScene();
  });
  document.getElementById("thirdTentacleSlide").addEventListener("input", function() {
    g_thirdTentacleAngle = this.value;
    renderScene();
  });
  document.getElementById("tipTentacleSlide").addEventListener("input", function() {
    g_tipTentacleAngle = this.value;
    renderScene();
  });

  // Global Angle Slider Events
  document.getElementById("angleSlide").addEventListener("input", function() {
    g_globalAngle = this.value; renderScene();
  });

  // Animation Button Event
  document.getElementById("animationOnButton").onclick = function() { 
    g_animationOn = true;
  };
  document.getElementById("animationOffButton").onclick = function() { 
    g_animationOn = false;
  };
  document.getElementById("spinOnButton").onclick = function() {
    g_spinMode = true;
  };
  document.getElementById("spinOffButton").onclick = function() {
    g_spinMode = false;
  };
  
}

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

  canvas.addEventListener('click', function(ev) {
    if (ev.shiftKey) {
      g_pokeAnimation = true;
      g_spiralStartTime = g_seconds; // save the time when the poke started
      g_spiralSpin = 0;  
      g_totalSpin = 720; 
    }
  });
}

//===============================================
// Animation and Timing
//===============================================

function tick() {
  g_seconds = performance.now()/1000.0-g_startTime; // Update the current time
 
  if(g_spinMode) {
   g_globalAngle = (g_globalAngle+1) % 360;
  }

  updateAnimationAngles(); // Update the angles for animation
  renderScene(); 
  requestAnimationFrame(tick); // Request the next frame
}

function updateAnimationAngles() {
  g_normalBobHeight = 0.06 * Math.sin(1.5 * g_seconds - 1.5);
  g_normalTiltAngle = 7 * Math.sin(1.5 * g_seconds);
  if (g_pokeAnimation) {
    g_bobHeight = 0;
    g_tiltAngle = 0;

    let elapsed = g_seconds - g_spiralStartTime;
    let duration = 2.0; // seconds
    let t = Math.min(elapsed / duration, 1.0); // normalized time [0,1]

    // Ease-out cubic
    let easeOut = 1 - Math.pow(1 - t, 3);

    g_spiralSpin = easeOut * g_totalSpin;

    if (t >= 1.0) {
      g_pokeAnimation = false; 
      g_spiralSpin = 0; 
    }

  } else if (g_animationOn) {
    g_bobHeight = g_normalBobHeight; 
    g_tiltAngle = g_normalTiltAngle; 

    g_waveAngles = [];
    for (let i = 0; i < g_segmentCount; i++) { 
      let angle = 7 * Math.sin(1.5 * g_seconds - i); // 7 degree wave angle
      g_waveAngles.push(angle);
    }

  } else {
    g_bobHeight = 0;
    g_tiltAngle = 0;
    g_waveAngles = [];  
  }
}

//===============================================
// Rendering
//===============================================

function setCameraMatrix() {
  var globalRotMat = new Matrix4();
  globalRotMat.translate(0, 0, -5);  // Move camera back
  globalRotMat.rotate(g_mouseYRotation, 0, 1, 0);
  globalRotMat.rotate(g_mouseXRotation, 1, 0, 0);
  globalRotMat.rotate(g_globalAngle, 0, 1, 0);

  if (g_spiralSpin != 0) {
    globalRotMat.rotate(g_spiralSpin, 0, 0, 1); // spiral around Z axis
  }

  gl.uniformMatrix4fv(u_GlobalRotationMatrix, false, globalRotMat.elements);
}

function setModelBaseMatrix() {
  let baseMatrix = new Matrix4();
  baseMatrix.setRotate(180, 0, 1, 0);  // Rotate model to face forward
  baseMatrix.rotate(g_tiltAngle, 1, 0, 0); // Add tilt
  baseMatrix.translate(0, g_bobHeight, 0); // Add bobbing
  g_voxelBaseMatrix = baseMatrix;
}

function renderScene() {
  var startTime = performance.now();
  
  setCameraMatrix(); // Set the camera matrix
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  setModelBaseMatrix(); // Set the model base matrix

  // Draw voxels
  for (let i = 0; i < g_voxelCubes.length; i++) {
    let cube = g_voxelCubes[i];
    cube.matrix = new Matrix4(g_voxelBaseMatrix); // Start from parent
    cube.matrix.multiply(cube.baseMatrix);        // Apply own position
    cube.render();
  }

  drawPupilsandReflections();
  drawTentacles(); 
  
  // Performance test
  var duration = performance.now() - startTime;
  sendTextToHTML("ms: " + Math.floor(duration) + " fps: " + Math.floor(1000/duration), "numdot");
}

function drawPupilsandReflections() {
  // Draw pupils
  var pup = new Cylinder();
  pup.color = [0.0, 0.0, 0.0, 1.0];
  pup.segments = 8;
  pup.matrix = new Matrix4(g_voxelBaseMatrix); 
  pup.matrix.translate(0.0, 0.0, -0.52);
  pup.matrix.scale(0.3, 0.3, 0.2);
  pup.render();

  //Draw eye reflections  
  var ref1 = new Cylinder();
  ref1.color = [1.0, 1.0, 1.0, 0.3];
  ref1.segments = 16;
  ref1.matrix = new Matrix4(g_voxelBaseMatrix); 
  ref1.matrix.translate(0.1, 0.06, -0.521);
  ref1.matrix.scale(0.1, 0.08, 0.2);
  ref1.render();  

  var ref2 = new Cylinder();
  ref2.color = [1.0, 1.0, 1.0, 0.2];
  ref2.segments = 16;
  ref2.matrix = new Matrix4(g_voxelBaseMatrix);
  ref2.matrix.translate(0.01, -0.02, -0.521);
  ref2.matrix.scale(0.075, 0.06, 0.2);
  ref2.render();
}

function drawTentacles() {
  for (let t = 0; t < g_tentacleSegments.length; t++) {
    let base = g_tentacleBasePositions[t];
    let tentacle = g_tentacleSegments[t];
  
    let tentacleBaseMatrix = new Matrix4(g_voxelBaseMatrix);
    tentacleBaseMatrix.translate(base[0], base[1], base[2]); // base location
  
    let segmentLength = 0.25; // Longer segment length
  
    for (let i = 0; i < tentacle.length; i++) {
      if (i == 0) {
        tentacleBaseMatrix.rotate(g_baseTentacleAngle, 1, 0, 0);
      } else if (i == 1) {
        tentacleBaseMatrix.rotate(g_secondTentacleAngle, 1, 0, 0);
      } else if (i == 2) {
        tentacleBaseMatrix.rotate(g_thirdTentacleAngle, 1, 0, 0);
      } else if (i == 3) {
        tentacleBaseMatrix.rotate(g_tipTentacleAngle, 1, 0, 0);
      }

      let segment = tentacle[i];
      let segmentMatrix = new Matrix4(tentacleBaseMatrix);
      
      if (g_waveAngles.length > i) {
        tentacleBaseMatrix.rotate(g_waveAngles[i], 1, 0, 0);
      }

      let scaleFactor = 0.125 * (1.0 - 0.2 * i); // Shrinks toward tip

      segmentMatrix.scale(scaleFactor, scaleFactor, segmentLength);
      segmentMatrix.translate(0, 0, 0.5); // Move half its height forward
      segment.matrix = segmentMatrix;
      segment.render();
  
      tentacleBaseMatrix.translate(0, 0, segmentLength); // Move up for next segment
    }
  }
}

//===============================================
// Scene Construction
//===============================================

function buildShapes() { // Build the shapes here to preserve performance
  g_voxelCubes = []; 
  createVoxelSphere();
  createRedVoxels();
  createTentacles();
}

function createVoxelSphere() {
  const size = 8;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.8; 
  // Create a sphere of cubes 
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const dx = x - (size - 1) / 2; 
        const dy = y - (size - 1) / 2; 
        const dz = z - (size - 1) / 2; 
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < outerRadius && distance > innerRadius) { // Makes the sphere hollow
          const cube = new Cube();
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

function createRedVoxels() {
  const spacing = 0.125; // cube size
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

  // Loop through positions for easier placement
  for (let i = 0; i < redVoxelPositions.length; i++) {
    let pos = redVoxelPositions[i];
    const red = new Cube();
    red.color = [1.0, 0.0, 0.0, 1.0];
    red.baseMatrix = new Matrix4();
    red.baseMatrix.translate(pos[0], pos[1], pos[2]);
    red.baseMatrix.scale(spacing, spacing, spacing);
    g_voxelCubes.push(red);
  }
}

function createTentacles() {
  g_tentacleSegments = []; // clear first

  for (let t = 0; t < g_tentacleBasePositions.length; t++) {
    const tentacle = []; // an array for this tentacle
    for (let i = 0; i < g_segmentCount; i++) {
      const segment = new Cube();
      segment.color = [0.95, 0.2, 0.2, 1.0]; // Reddish 
      tentacle.push(segment);
    }

    g_tentacleSegments.push(tentacle); // store whole tentacle
  }
}

//===============================================
// Utility
//===============================================

function sendTextToHTML(text, htmlID) {
  const element = document.getElementById(htmlID);
  if (!element) {
    console.log("Failed to get the HTML element with id: " + htmlID);
    return;
  }
  element.innerHTML = text;
}
