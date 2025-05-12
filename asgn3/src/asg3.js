// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Shaders
//===============================================
var VSHADER_SOURCE = `
  precision mediump float;
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  varying vec2 v_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotationMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotationMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
  }`

var FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform int u_whichTexture;
  void main() {
    if (u_whichTexture == -2) {
      gl_FragColor = u_FragColor; // Use color
    } else if (u_whichTexture == -1) {
      gl_FragColor = vec4(v_UV, 1.0, 1.0); // Use UV debugger
    } else if (u_whichTexture == 0) {
      gl_FragColor = texture2D(u_Sampler0, v_UV); // Use texture 0 (dirt)
    } else if (u_whichTexture == 1) {
      gl_FragColor = texture2D(u_Sampler1, v_UV); // Use texture 1 (floor)
    } else if (u_whichTexture == 2) { 
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Error case, use red color
    }
  }`

//===============================================
// Global Variables and Constants
//===============================================

/** WebGL Contexts and Locations **/
/** @type {HTMLCanvasElement} */ let canvas = null;
/** @type {WebGLRenderingContext} */ let gl = null;
/** @type {GLint} */ let a_Position = null;
/** @type {GLint} */ let a_UV = null;
/** @type {WebGLUniformLocation} */ let u_FragColor = null;
/** @type {WebGLUniformLocation} */ let u_ModelMatrix = null;
/** @type {WebGLUniformLocation} */ let u_GlobalRotationMatrix = null;
/** @type {WebGLUniformLocation} */ let u_ViewMatrix = null;
/** @type {WebGLUniformLocation} */ let u_ProjectionMatrix = null;
/** @type {WebGLUniformLocation} */ let u_Sampler0 = null;
/** @type {WebGLUniformLocation} */ let u_Sampler1 = null;
/** @type {WebGLUniformLocation} */ let u_whichTexture = null;

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
/** @type {Camera} */ let g_camera = null;
/** @type {number[][]} */ let g_tentacleBasePositions = [
  [0.125, -0.375, 0.375],
  [-0.125, -0.25, 0.5],
  [0.25,  0.0, 0.375],
  [-0.375, -0.125, 0.375],
  [-0.25,  0.25, 0.375],
  [0.125, 0.25, 0.375],
  [-0.125, 0.0, 0.5],
];
/** @type {number[][]} */ let g_map = [];
  


function main() {
  setupWebGL();
  connectVariablesToGLSL();
  addActionForHtmlUI();
  setupMouseControl(); 
  buildShapes(); // Called here to preserve performance 

  // Initialize camera
  g_camera = new Camera();
  // console.log("Camera initialized:", g_camera);
  // console.log("Eye:", g_camera.eye.elements);
  // console.log("At:", g_camera.at.elements);
  // console.log("Up:", g_camera.up.elements);

  document.onkeydown = keydown; // Register the keydown event handler
  
  initTexture(); // Initialize texture

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
  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  if (a_UV < 0) {
    console.log('Failed to get the storage location of a_UV');
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
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  if (!u_ViewMatrix) {
    console.log('Failed to get the storage location of u_ViewMatrix');
    return;
  }
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  if (!u_ProjectionMatrix) {
    console.log('Failed to get the storage location of u_ProjectionMatrix');
    return;
  }
  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  if (!u_whichTexture) {
    console.log('Failed to get the storage location of u_whichTexture');
    return;
  }
  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  if (!u_Sampler0) {
    console.log('Failed to get the storage location of u_Sampler0');
    return false;
  }
  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  if (!u_Sampler1) {
    console.log('Failed to get the storage location of u_Sampler1');
    return false;
  }

  // Set the matrix to identity
  var identityMatrix = new Matrix4(); 
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityMatrix.elements);
}


function initTexture() {
  var image0 = new Image();
  image0.onload = function(){ sendTextureToGLSL(image0, 0, u_Sampler0); };
  image0.src = 'textures/dirt.jpg';

  var image1 = new Image();
  image1.onload = function(){ sendTextureToGLSL(image1, 1, u_Sampler1); };
  image1.src = 'textures/floor.jpg';

  return true;
}

function sendTextureToGLSL(image, textureUnitIndex, samplerUniform) {
  var texture = gl.createTexture();
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.activeTexture(gl.TEXTURE0 + textureUnitIndex); // gl.TEXTURE0 or gl.TEXTURE1
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image); // had to upload the image before gnerating mipmaps
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); // Trilinear filtering
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
  gl.uniform1i(samplerUniform, textureUnitIndex); // 0 for TEXTURE0, 1 for TEXTURE1

  return true;
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
  // Request pointer lock on canvas click
  canvas.onclick = function() {
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    if (canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
  };

  // Listen for pointer lock changes
  document.addEventListener('pointerlockchange', lockChangeAlert, false);
  document.addEventListener('mozpointerlockchange', lockChangeAlert, false);

  function lockChangeAlert() {
    if (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas) {
      document.addEventListener('mousemove', updateCameraLook, false);
    } else {
      document.removeEventListener('mousemove', updateCameraLook, false);
    }
  }

  function updateCameraLook(ev) {
    const sensitivity = 0.4; // degrees per pixel (twice as fast)
    if (ev.movementX !== 0) {
        g_camera.panLeft(-ev.movementX * sensitivity);
    }
    if (ev.movementY !== 0 && g_camera.tiltUp) {
        g_camera.tiltUp(-ev.movementY * sensitivity);
    }
    renderScene();
  }
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
    let duration = 2.0; // in seconds
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
      let angle = 7 * Math.sin(1.5 * g_seconds - i); // 7 degree wave angle, 1.5s to match phase of other animations
      g_waveAngles.push(angle);
    }

  } else {
    g_bobHeight = 0;
    g_tiltAngle = 0;
    g_waveAngles = [];  
  }
}

function keydown(ev) {
  if (ev.keyCode == 87) { // Forward/W key
    g_camera.moveForward();
  } else if (ev.keyCode == 83) { // Back/S key
    g_camera.moveBackward();
  } else if (ev.keyCode == 68) { // Right/D key
    g_camera.moveRight();
  } else if (ev.keyCode == 65) { // Left/A key
    g_camera.moveLeft();
  } else if (ev.keyCode == 81) { // Rot Left/Q key
    g_camera.panLeft(1);
  }
  else if (ev.keyCode == 69) { // Rot Right/E key
    g_camera.panRight(1);
  } else if (ev.keyCode == 32) { // Space key
    g_camera.eye.elements[1] += 0.1; // Move up
    g_camera.at.elements[1] += 0.1; // Move up
  } else if (ev.keyCode == 16) { // Shift key /// FIX NOTE SMOOTH
    g_camera.eye.elements[1] -= 0.1; 
    g_camera.at.elements[1] -= 0.1; 
    ev.preventDefault(); // Allows for smooth downward movement
  } else {
    return; // Prevent the default action for other keys
  }

  renderScene();
}

//===============================================
// Rendering
//===============================================

function setCameraMatrix() {
  var globalRotMat = new Matrix4();
  globalRotMat.rotate(g_mouseYRotation, 0, 1, 0);  // Rotate around Y first
  globalRotMat.rotate(g_mouseXRotation, 1, 0, 0);  // Then rotate around X
  globalRotMat.rotate(g_globalAngle, 0, 1, 0);     // Then apply global rotation

  if (g_spiralSpin != 0) {
    globalRotMat.rotate(g_spiralSpin, 0, 0, 1); // spiral around Z axis
  }

  gl.uniformMatrix4fv(u_GlobalRotationMatrix, false, globalRotMat.elements);
}

function setModelBaseMatrix() {
  let baseMatrix = new Matrix4();
  // No need for any transformations here since we're using the global rotation matrix
  baseMatrix.rotate(g_tiltAngle, 1, 0, 0); // Add tilt
  baseMatrix.translate(0, g_bobHeight, 0); // Add bobbing
  g_voxelBaseMatrix = baseMatrix;
}

function renderScene() {
  var startTime = performance.now();
  
  var projMat = new Matrix4();
  projMat.setPerspective(g_camera.fov, canvas.width/canvas.height, 0.1, 1000);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMat.elements);

  var viewMat = new Matrix4();
  viewMat.setLookAt(
    g_camera.eye.elements[0], g_camera.eye.elements[1], g_camera.eye.elements[2],
    g_camera.at.elements[0],  g_camera.at.elements[1],  g_camera.at.elements[2],
    g_camera.up.elements[0],  g_camera.up.elements[1],  g_camera.up.elements[2]
  );
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMat.elements);

  setCameraMatrix();
  setModelBaseMatrix();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw Floor
  var floor = new Cube();
  floor.color = [1.0, 0.0, 0.0, 1.0];
  floor.textureNum = 1; // Use texture 1
  floor.matrix.translate(0.0, -0.76, 0.0); // Move to the floor
  floor.matrix.scale(15.0, 0.01, 15.0); // Scale to make it a floor
  floor.matrix.translate(-0.5, 0.0, -0.5); // Center the floor
  floor.renderFast();

  // Draw the skybox
  var skybox = new Cube();
  skybox.color = [0.53, 0.8, 0.92, 1.0];
  skybox.textureNum = -2; // Use color
  skybox.matrix.scale(50.0, 50.0, 50.0); // Scale to make it a skybox
  skybox.matrix.translate(-0.5, -0.5, -0.5); // Move to the center of the scene
  skybox.renderFast();

  drawMap();


  // Draw voxels
  for (let i = 0; i < g_voxelCubes.length; i++) {
    let cube = g_voxelCubes[i];
    cube.matrix = new Matrix4(g_voxelBaseMatrix); // Start from parent
    cube.matrix.multiply(cube.baseMatrix);        // Apply own position
    cube.renderFast();
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
  
    let segmentLength = 0.25; 
  
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
      segment.renderFast();
  
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
  createTerrain();
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
          cube.textureNum = -2; // Use color
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
  const spacing = 0.125; // the cube size
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
    red.textureNum = -2; // Use color
    red.baseMatrix = new Matrix4();
    red.baseMatrix.translate(pos[0], pos[1], pos[2]);
    red.baseMatrix.scale(spacing, spacing, spacing);
    g_voxelCubes.push(red);
  }
}

function createTentacles() {
  g_tentacleSegments = []; 
  for (let t = 0; t < g_tentacleBasePositions.length; t++) {
    const tentacle = [];
    for (let i = 0; i < g_segmentCount; i++) {
      const segment = new Cube();
      segment.color = [0.95, 0.2, 0.2, 1.0]; 
      segment.textureNum = -2; // Use color
      tentacle.push(segment);
    }

    g_tentacleSegments.push(tentacle); // store whole tentacle
  }
}

function drawMap() {
  // Debug logging
  // console.log("g_map:", g_map);
  // console.log("g_map length:", g_map ? g_map.length : "undefined");
  let wall = new Cube();
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      let height = g_map[x][z];
      if (height > 0) {
        // For controlling the height
        for (let y = 0; y < height; y++) {
          wall.matrix.setIdentity(); // Reset transforms
          wall.color = [1.0, 1.0, 1.0, 1.0];
          wall.textureNum = 0; // Use texture 0
          wall.matrix.scale(0.5, 0.5, 0.5);
          wall.matrix.translate(x - 16, y - 1.5, z - 16);  // Center the map around (0,0) by subtracting 16 (half of 32)
          
          wall.renderFast();
        }
      }
    }
  }
}

function createTerrain() {
  noise.seed(Math.random());

  const width = 32;
  const depth = 32;
  const scale = 8; // Higher = flatter terrain
  const heightScale = 4; // Maximum height of walls

  // Initialize g_map with zeros
  g_map = Array(width).fill().map(() => Array(depth).fill(0));

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      // Generate noise value between -1 and 1
      let value = noise.perlin2(x / scale, z / scale);
      
      // Convert to height between 0 and heightScale
      let height = Math.floor((value + 1) / 2 * heightScale);
      
      // Ensure outer walls are always height 4
      if (x === 0 || x === width - 1 || z === 0 || z === depth - 1) {
        height = 4;
      }
      
      g_map[x][z] = height;
    }
  }

  console.log("Terrain generated:", g_map.length, "x", g_map[0].length, "map");
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
