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
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;
  uniform sampler2D u_Sampler4;
  uniform int u_whichTexture;
  void main() {
    if (u_whichTexture == -2) {
      gl_FragColor = u_FragColor; // Use color
    } else if (u_whichTexture == -1) {
      gl_FragColor = vec4(v_UV, 1.0, 1.0); // Use UV debugger
    } else if (u_whichTexture == 0) {
      gl_FragColor = texture2D(u_Sampler0, v_UV); // Use texture 0 (dirt)
    } else if (u_whichTexture == 1) {
      gl_FragColor = texture2D(u_Sampler1, v_UV); // Use texture 1 (grass top)
    } else if (u_whichTexture == 2) {
      gl_FragColor = texture2D(u_Sampler2, v_UV); // Use texture 2 (cobble)
    } else if (u_whichTexture == 3) {
      gl_FragColor = texture2D(u_Sampler3, v_UV); // Use texture 3 (stone)
    } else if (u_whichTexture == 4) {
      gl_FragColor = texture2D(u_Sampler4, v_UV); // Use texture 4 (andesite)
    } else {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // Default color
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
/** @type {WebGLUniformLocation} */ let u_Sampler2 = null;
/** @type {WebGLUniformLocation} */ let u_Sampler3 = null;
/** @type {WebGLUniformLocation} */ let u_Sampler4 = null;
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


/** Mouse Control **/
/** @type {boolean} */ let g_mouseDown = false;
/** @type {number} */ let g_lastX = 0;
/** @type {number} */ let g_lastY = 0;
/** @type {number} */ let g_mouseXRotation = 0;
/** @type {number} */ let g_mouseYRotation = 0;

/** Timing Variables **/
/** @type {number} */ let g_startTime = performance.now() / 1000;
/** @type {number} */ let g_seconds = performance.now()/1000.0-g_startTime; 
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
/** @type {number[][]} */ let g_textureMap = [];
  
/** Key State Tracking **/
/** @type {Object} */ let g_keyStates = {
    'w': false,
    'a': false,
    's': false,
    'd': false,
    'q': false,
    'e': false,
    ' ': false, 
    'shift': false,
    'control': false
};

// Add this near the other global variables
let g_eyeOfCthulhu = null;
let g_eyeEnabled = false;  // Start with the eye disabled
let g_wallCube = new Cube(); // Create cube once for reuse

const MAP_SIZE = 64;
const WALL_HEIGHT = 8; // Height of the perimeter wall

// Add these with the other global variables at the top
let g_noiseStartX = 0;
let g_noiseStartZ = 0;
let g_noiseScale = 20; // Add a global scale variable
const g_noiseStep = 1; // Per-block step

function main() {
  noise.seed(Math.random()); // Only seed once here!
  setupWebGL();
  connectVariablesToGLSL();
  addActionForHtmlUI();
  setupMouseControl(); 
  setupKeyControls();
  createMap();

  // Initialize camera
  g_camera = new Camera();

  // Initialize Eye of Cthulhu
  g_eyeOfCthulhu = new EyeOfCthulhu();

  document.onkeydown = keydown; // Register the keydown event handler
  document.onkeyup = keyup; // Add this line
  
  initTexture(); // Initialize texture

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  requestAnimationFrame(tick); // Start the animation

  document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('toggleEyeBtn');
    if (btn) {
      btn.onclick = function() {
        g_eyeEnabled = !g_eyeEnabled;
        btn.textContent = g_eyeEnabled ? 'Hide Eye' : 'Show Eye';
      };
      btn.textContent = g_eyeEnabled ? 'Hide Eye' : 'Show Eye';
    }
  });
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
  u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');
  if (!u_Sampler2) {
    console.log('Failed to get the storage location of u_Sampler2');
    return false;
  }
  u_Sampler3 = gl.getUniformLocation(gl.program, 'u_Sampler3');
  if (!u_Sampler3) {
    console.log('Failed to get the storage location of u_Sampler3');
    return false;
  }
  u_Sampler4 = gl.getUniformLocation(gl.program, 'u_Sampler4');
  if (!u_Sampler4) {
    console.log('Failed to get the storage location of u_Sampler4');
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
  image1.src = 'textures/grass_top.jpg';

  var image2 = new Image();
  image2.onload = function(){ sendTextureToGLSL(image2, 2, u_Sampler2); };
  image2.src = 'textures/cobble.png';

  var image3 = new Image();
  image3.onload = function(){ sendTextureToGLSL(image3, 3, u_Sampler3); };
  image3.src = 'textures/stone.png';

  var image4 = new Image();
  image4.onload = function(){ sendTextureToGLSL(image4, 4, u_Sampler4); };
  image4.src = 'textures/andesite.png';

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

  // Noise Offset Slider Events (Coding Train style)
  const noiseXSlider = document.getElementById("noiseOffsetXSlide");
  if (noiseXSlider) {
    noiseXSlider.addEventListener("input", function() {
      g_noiseStartX = parseFloat(this.value);
      createMap();
      renderScene();
    });
  }

  const noiseZSlider = document.getElementById("noiseOffsetZSlide");
  if (noiseZSlider) {
    noiseZSlider.addEventListener("input", function() {
      g_noiseStartZ = parseFloat(this.value);
      createMap();
      renderScene();
    });
  }

  // Scale slider
  const noiseScaleSlider = document.getElementById("noiseScaleSlide");
  if (noiseScaleSlider) {
    noiseScaleSlider.addEventListener("input", function() {
      g_noiseScale = parseFloat(this.value);
      createMap();
      renderScene();
    });
  }

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

  // Toggle Eye of Cthulhu
  document.getElementById("toggleEyeBtn").onclick = function() {
    g_eyeEnabled = !g_eyeEnabled;
    this.textContent = g_eyeEnabled ? 'Hide Eye' : 'Show Eye';
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
  }
}

function setupKeyControls() {
    // Add keydown and keyup event listeners
    document.addEventListener('keydown', function(ev) {
        const key = ev.key.toLowerCase();
        // console.log('Keydown:', key); // Debug log
        if (key in g_keyStates) {
            g_keyStates[key] = true;
            // console.log('g_keyStates after keydown:', g_keyStates); // Debug log
        }
    });

    document.addEventListener('keyup', function(ev) {
        const key = ev.key.toLowerCase();
        // console.log('Keyup:', key); // Debug log
        if (key in g_keyStates) {
            g_keyStates[key] = false;
            // console.log('g_keyStates after keyup:', g_keyStates); // Debug log
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

  // Sprint logic
  let moveSpeed = SPEEDS.MOVE;
  if (g_keyStates['shift']) moveSpeed = SPEEDS.MOVE * 2.5; // Sprint multiplier

  // Handle continuous movement like this for smoother result :D 
  if (g_keyStates['w']) g_camera.moveForward(moveSpeed);
  if (g_keyStates['s']) g_camera.moveBackward(moveSpeed);
  if (g_keyStates['a']) g_camera.moveLeft(moveSpeed);
  if (g_keyStates['d']) g_camera.moveRight(moveSpeed);
  if (g_keyStates['q']) g_camera.panLeft(1);
  if (g_keyStates['e']) g_camera.panRight(1);
  if (g_keyStates[' ']) g_camera.moveUp();
  if (g_keyStates['control']) g_camera.moveDown();

  if (g_eyeEnabled && g_eyeOfCthulhu) g_eyeOfCthulhu.update(g_camera.eye.elements, g_seconds);

  renderScene(); 
  requestAnimationFrame(tick); // Request the next frame
}

function keydown(ev) {
  // Only handle F and G keys here, movement is handled in tick()
  if (ev.keyCode == 70) { // F key
    addBlockInFront(g_camera);
  } else if (ev.keyCode == 71) { // G key
    deleteBlockInFront(g_camera);
  } else {
    return; // Prevent the default action for other keys
  }
  renderScene();
}

function keyup(ev) {
    // No need to do anything here, key states are handled in setupKeyControls
}

//===============================================
// Rendering
//===============================================

function setCameraMatrix() {
  var globalRotMat = new Matrix4();
  globalRotMat.rotate(g_mouseYRotation, 0, 1, 0);  // Rotate around Y first
  globalRotMat.rotate(g_mouseXRotation, 1, 0, 0);  // Then rotate around X
  globalRotMat.rotate(g_globalAngle, 0, 1, 0);     // Then apply global rotation

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
  
  // Use camera's matrices instead of recalculating
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);
  gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);

  setCameraMatrix();
  setModelBaseMatrix();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // 1. Draw skybox (opaque)
  var skybox = new Cube();
  skybox.color = [0.53, 0.8, 0.92, 1.0];
  skybox.textureNum = -2;
  skybox.matrix.scale(50.0, 50.0, 50.0);
  skybox.matrix.translate(-0.5, -0.5, -0.5);
  skybox.renderFast();

  // 2. Draw all opaque objects (blocks, Eye, etc.)
  drawMap();
  if (g_eyeEnabled && g_eyeOfCthulhu) g_eyeOfCthulhu.render(g_camera.eye.elements, g_seconds);

  // 3. Draw transparent floor last
  
  // Draw the floor
  var floor = new Cube();
  floor.color = [0.02, 0.0, 1.0, 0.8];
  floor.textureNum = -2; // Use texture -2 (color)
  floor.matrix.setIdentity();
  floor.matrix.translate(0.0, 0.63, 0.0); 
  floor.matrix.scale(32.0, 0.01, 32.0); 
  floor.matrix.translate(-0.5, 0.0, -0.5); 
  floor.renderFast();



  // Performance test
  var duration = performance.now() - startTime;
  sendTextToHTML("ms: " + Math.floor(duration) + " fps: " + Math.floor(1000/duration), "numdot");
}

//===============================================
// Scene Construction
//===============================================

function drawMap() {
  let wall = new Cube();
  // Draw terrain
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      let height = g_map[x][z];
      if (height > 0) {
        let y = height - 1;
        wall.matrix.setIdentity();
        wall.color = [1.0, 1.0, 1.0, 1.0];
        wall.textureNum = 0;
        wall.matrix.scale(0.5, 0.5, 0.5);
        wall.matrix.translate(x - MAP_SIZE / 2, y - 1.5, z - MAP_SIZE / 2);
        wall.renderFast();
      }
    }
  }
}

function createMap() {
  const width = MAP_SIZE;
  const depth = MAP_SIZE;
  const heightScale = 8;
  const minHeight = 1;
  g_map = Array(width).fill().map(() => Array(depth).fill(0));
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      let value = noise.simplex2((x + g_noiseStartX) / g_noiseScale, (z + g_noiseStartZ) / g_noiseScale);
      let height = Math.max(minHeight, Math.floor((value + 1) / 2 * heightScale));
      g_map[x][z] = height;
    }
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

// Helper to get map cell in front of the camera
function getTargetBlock(camera, maxDistance = 5.0, step = 0.05) {
    let dir = new Vector3(camera.at.elements);
    dir.sub(camera.eye);
    dir.normalize();
    for (let t = 0.5; t < maxDistance; t += step) {
        let pos = new Vector3(camera.eye.elements);
        let stepVec = new Vector3(dir.elements);
        stepVec = stepVec.mul(t);
        pos.add(stepVec);
        let mapX = Math.floor(pos.elements[0] + 16);
        let mapZ = Math.floor(pos.elements[2] + 16);
        let y = pos.elements[1];
        if (mapX < 0 || mapX >= 32 || mapZ < 0 || mapZ >= 32) break;
        let blockHeight = g_map[mapX][mapZ] * 0.5;
        // Check if y is just below the top of the stack
        if (y < blockHeight + 0.25 && y > blockHeight - 0.25 && g_map[mapX][mapZ] > 0) {
            // console.log('Targeting block at', mapX, mapZ, 'height:', blockHeight, 'y:', y);
            return { mapX, mapZ, blockHeight };
        }
    }
    return null;
}

function getTargetEmpty(camera, maxDistance = 5.0, step = 0.05) {
    let dir = new Vector3(camera.at.elements);
    dir.sub(camera.eye);
    dir.normalize();
    for (let t = 0.5; t < maxDistance; t += step) {
        let pos = new Vector3(camera.eye.elements);
        let stepVec = new Vector3(dir.elements);
        stepVec = stepVec.mul(t);
        pos.add(stepVec);
        let mapX = Math.floor(pos.elements[0] + 16);
        let mapZ = Math.floor(pos.elements[2] + 16);
        let y = pos.elements[1];
        if (mapX < 0 || mapX >= 32 || mapZ < 0 || mapZ >= 32) break;
        let blockHeight = g_map[mapX][mapZ] * 0.5;
        // Check if y is just above the top of the stack
        if (y > blockHeight + 0.25) {
            // console.log('Targeting empty at', mapX, mapZ, 'height:', blockHeight, 'y:', y);
            return { mapX, mapZ, blockHeight };
        }
    }
    return null;
}

function simpleRaycast(camera, maxDistance = 5, step = 0.1) {
  let dir = new Vector3(camera.at.elements);
  dir.sub(camera.eye);
  dir.normalize();
  let pos = new Vector3(camera.eye.elements);

  for (let t = 0; t < maxDistance; t += step) {
    let check = new Vector3(pos.elements);
    let stepVec = new Vector3(dir.elements).mul(t);
    check.add(stepVec);

    let mapX = Math.floor(check.elements[0] + MAP_SIZE / 2);
    let mapZ = Math.floor(check.elements[2] + MAP_SIZE / 2);

    if (mapX < 0 || mapX >= MAP_SIZE || mapZ < 0 || mapZ >= MAP_SIZE) break;

    if (g_map[mapX][mapZ] > 0) {
      return { mapX, mapZ };
    }
  }
  return null;
}

function simpleRaycastWithEmpty(camera, maxDistance = 10, step = 0.1) {
  let dir = new Vector3(camera.at.elements);
  dir.sub(camera.eye);
  dir.normalize();
  let pos = new Vector3(camera.eye.elements);

  // Debug: log camera position and direction
  console.log("Camera eye:", camera.eye.elements, "Camera at:", camera.at.elements, "Dir:", dir.elements);

  let lastEmpty = null;

  for (let t = 0; t < maxDistance; t += step) {
    let check = new Vector3(pos.elements);
    let stepVec = new Vector3(dir.elements).mul(t);
    check.add(stepVec);

    let mapX = Math.floor(check.elements[0] + MAP_SIZE / 2);
    let mapZ = Math.floor(check.elements[2] + MAP_SIZE / 2);

    if (mapX < 0 || mapX >= MAP_SIZE || mapZ < 0 || mapZ >= MAP_SIZE) break;

    if (g_map[mapX][mapZ] > 0) {
      // Debug
      console.log("Hit block at", mapX, mapZ, "lastEmpty", lastEmpty);
      return { mapX, mapZ, lastEmpty };
    } else {
      lastEmpty = { mapX, mapZ };
    }
  }
  // Debug
  console.log("No block hit, lastEmpty", lastEmpty);
  return null;
}

function addBlockInFront(camera) {
  let hit = simpleRaycastWithEmpty(camera);
  if (hit && hit.lastEmpty) {
    console.log("Adding block at", hit.lastEmpty.mapX, hit.lastEmpty.mapZ);
    g_map[hit.lastEmpty.mapX][hit.lastEmpty.mapZ] += 1;
  }
}

function deleteBlockInFront(camera) {
  let hit = simpleRaycastWithEmpty(camera);
  if (hit) {
    console.log("Deleting block at", hit.mapX, hit.mapZ);
    if (g_map[hit.mapX][hit.mapZ] > 1) {
      g_map[hit.mapX][hit.mapZ] -= 1;
    }
  }
}
