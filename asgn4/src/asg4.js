// Sebastian Morgese
// smorgese@ucsc.edu

//===============================================
// Shaders
//===============================================
var VSHADER_SOURCE = `
  precision mediump float;
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_vertPos;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_NormalMatrix;
  uniform mat4 u_GlobalRotationMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotationMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
    v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 1.0)));
    v_vertPos = u_ModelMatrix * a_Position;
  }`

var FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;
  uniform sampler2D u_Sampler4;
  uniform int u_whichTexture;
  uniform vec3 u_lightPos;
  uniform vec3 u_cameraPos;
  uniform bool u_lightOn;
  uniform float u_shininess;
  uniform vec3 u_spotLightPos;
  uniform vec3 u_spotLightDir;
  uniform float u_spotLightCutoff;
  uniform bool u_spotLightOn;
  uniform vec3 u_lightColor;
  varying vec4 v_vertPos;
  void main() {
    if (u_whichTexture == -3) {
      gl_FragColor = vec4((v_Normal+1.0)/2.0, 1.0); // Use normal debugger
    } else if (u_whichTexture == -2) {
      gl_FragColor = u_FragColor; // Use color
    } else if (u_whichTexture == -1) {
      gl_FragColor = vec4(v_UV, 1.0, 1.0); // Use UV debugger
    } else if (u_whichTexture == 0) {
      gl_FragColor = texture2D(u_Sampler0, v_UV); // Use texture 0 (grass)
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

    // Point Light 
    vec3 lightVector = u_lightPos - v_vertPos.xyz;
    float r = length(lightVector);
    // N dot L
    vec3 L = normalize(lightVector);
    vec3 N = normalize(v_Normal);
    float nDotL = max(dot(N,L), 0.0);

    //Refelction
    vec3 R = reflect(-L, N);
    vec3 E = normalize(u_cameraPos - v_vertPos.xyz); // Camera position

    float specular = 0.0;
    if (u_shininess > 0.0) {
        specular = pow(max(dot(E, R), 0.0), u_shininess);
    }
    vec3 diffuse = vec3(gl_FragColor) * nDotL * 0.85 * u_lightColor; 
    vec3 ambient = vec3(gl_FragColor) * 0.4 * u_lightColor; 

    if (u_lightOn) {
      gl_FragColor = vec4(diffuse + ambient + specular, 1.0);
      gl_FragColor.a = u_FragColor.a;
    }

    // Spotlight 
    if (u_spotLightOn) {
      vec3 spotVector = u_spotLightPos - v_vertPos.xyz;
      float spotDist = length(spotVector);
      vec3 spotL = normalize(spotVector);
      float spotCos = dot(normalize(-u_spotLightDir), spotL);
      if (spotCos > cos(radians(u_spotLightCutoff))) {
        float spotNDotL = max(dot(N, spotL), 0.0);
        vec3 spotDiffuse = vec3(gl_FragColor) * spotNDotL * 0.85 * u_lightColor;
        vec3 spotR = reflect(-spotL, N);
        float spotSpecular = 0.0;
        if (u_shininess > 0.0) {
          spotSpecular = pow(max(dot(E, spotR), 0.0), u_shininess);
        }
        gl_FragColor.rgb += spotDiffuse + spotSpecular;
      }
    }

    // Red/green distance visualization
    // float r = length(lightVector);
    // // if (r < 1.0) {
    // //   gl_FragColor = vec4(1,0,0,1);
    // // } else if (r < 2.0) {
    // //   gl_FragColor = vec4(0,1,0,1);
    // // }

    // Cool light fall off effect
    // vec3 lightVector = v_vertPos.xyz - u_lightPos;
    // gl_FragColor = vec4(vec3(gl_FragColor)/(r * r), 1); 
  }`

//===============================================
// Global Variables and Constants
//===============================================

/** WebGL Contexts and Locations **/
/** @type {HTMLCanvasElement} */ let canvas = null;
/** @type {WebGLRenderingContext} */ let gl = null;
/** @type {GLint} */ let a_Position = null;
/** @type {GLint} */ let a_UV = null;
/** @type {GLint} */ let a_Normal = null;
/** @type {WebGLUniformLocation} */ let u_FragColor = null;
/** @type {WebGLUniformLocation} */ let u_ModelMatrix = null;
/** @type {WebGLUniformLocation} */ let u_NormalMatrix = null;
/** @type {WebGLUniformLocation} */ let u_GlobalRotationMatrix = null;
/** @type {WebGLUniformLocation} */ let u_ViewMatrix = null;
/** @type {WebGLUniformLocation} */ let u_ProjectionMatrix = null;
/** @type {WebGLUniformLocation} */ let u_Sampler0 = null;
/** @type {WebGLUniformLocation} */ let u_Sampler1 = null;
/** @type {WebGLUniformLocation} */ let u_lightPos = null;
/** @type {WebGLUniformLocation} */ let u_cameraPos = null;
/** @type {WebGLUniformLocation} */ let u_whichTexture = null;
/** @type {WebGLUniformLocation} */ let u_shininess = null;
/** @type {WebGLUniformLocation} */ let u_spotLightPos = null;
/** @type {WebGLUniformLocation} */ let u_spotLightDir = null;
/** @type {WebGLUniformLocation} */ let u_spotLightCutoff = null;
/** @type {WebGLUniformLocation} */ let u_spotLightOn = null;
/** @type {WebGLUniformLocation} */ let u_lightColor = null;

/** Map Constants **/
const MAP_SIZE = 64;  // Size of the map in blocks
const MAP_HALF = MAP_SIZE / 2;  // Half size for centering
const BLOCK_SCALE = 0.5;  // Scale factor for block rendering
const WORLD_TO_MAP = 1;  // Conversion factor from world to map coordinates
const MAP_OFFSET_X = MAP_HALF;  // X offset to center the map
const MAP_OFFSET_Z = MAP_HALF;  // Z offset to center the map

/** Noise Generation Constants **/
const g_noiseStep = 1;  // Per-block step for noise generation
/** @type {number} */ let g_noiseStartX = 0;  // X offset for noise generation
/** @type {number} */ let g_noiseStartZ = 0;  // Z offset for noise generation
/** @type {number} */ let g_noiseScale = 22;  // Scale factor for noise generation

/** Animation Controls **/
/** @type {number} */ let g_globalAngle = 0;
/** @type {boolean} */ let g_eyeEnabled = true;
/** @type {boolean} */ let g_particlesEnabled = true;

/** Environment Variables **/
/** @type {boolean} */ let g_normalOn = false; // Normal debugger toggle
/** @type {number[][]} */ let g_lightPos = [0, 8, -2];
/** @type {boolean} */ let g_lightOn = true; // Light toggle
/** @type {boolean} */ let g_lightXAnimated = true;
/** @type {number} */ let g_lightXOffset = 0;

/** Mouse Control **/
/** @type {boolean} */ let g_mouseDown = false;
/** @type {number} */ let g_lastX = 0;
/** @type {number} */ let g_lastY = 0;
/** @type {number} */ let g_mouseXRotation = 0;
/** @type {number} */ let g_mouseYRotation = 0;

/** Timing Variables **/
/** @type {number} */ let g_startTime = performance.now() / 1000;
/** @type {number} */ let g_seconds = performance.now()/1000.0-g_startTime; 

/** Scene Objects **/
/** @type {Camera} */ let g_camera = null;
/** @type {number[][]} */ let g_map = [];
/** @type {EyeOfCthulhu} */ let g_eyeOfCthulhu = null;
/** @type {number[][][]} */ let g_placedBlocks = Array(MAP_SIZE).fill().map(() => Array(MAP_SIZE).fill().map(() => []));

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

let g_shapeToShow = 'sphere';
let g_lightType = 'point';
let g_lightColor = [1, 1, 1];

function main() {
  noise.seed(Math.random()); 
  setupWebGL();
  connectVariablesToGLSL();
  addActionForHtmlUI();
  setupMouseControl(); 
  setupKeyControls();
  createMap();

  // Intialize external objects
  g_camera = new Camera();
  g_eyeOfCthulhu = new EyeOfCthulhu();

  document.onkeydown = keydown; // Register the keydown event handler
  
  initTexture(); // Initialize texture

  // Add shape selection event
  const shapeSelect = document.getElementById('shapeSelect');
  const particlesToggleRow = document.getElementById('particlesToggleRow');
  if (shapeSelect) {
    shapeSelect.onchange = function() {
      g_shapeToShow = shapeSelect.value;
      g_eyeEnabled = (g_shapeToShow === 'eye');
      // Show/hide particles toggle
      if (particlesToggleRow) {
        particlesToggleRow.style.display = (g_shapeToShow === 'eye') ? '' : 'none';
      }
      renderScene();
    };
    // Initial state
    if (particlesToggleRow) {
      particlesToggleRow.style.display = (g_shapeToShow === 'eye') ? '' : 'none';
    }
    g_eyeEnabled = (g_shapeToShow === 'eye');
    renderScene();
  }

  // Add light type selection event
  const lightTypeSelect = document.getElementById('lightTypeSelect');
  if (lightTypeSelect) {
    lightTypeSelect.onchange = function() {
      g_lightType = lightTypeSelect.value;
      renderScene();
    };
  }

  // Light color sliders
  const lightColorR = document.getElementById('lightColorR');
  const lightColorG = document.getElementById('lightColorG');
  const lightColorB = document.getElementById('lightColorB');
  function updateLightColor() {
    g_lightColor[0] = parseFloat(lightColorR.value);
    g_lightColor[1] = parseFloat(lightColorG.value);
    g_lightColor[2] = parseFloat(lightColorB.value);
    renderScene();
  }
  if (lightColorR && lightColorG && lightColorB) {
    lightColorR.oninput = updateLightColor;
    lightColorG.oninput = updateLightColor;
    lightColorB.oninput = updateLightColor;
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  requestAnimationFrame(tick); // Start the animation
}

function setupWebGL() {
  canvas = document.getElementById('webgl');

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
  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  if (a_Normal < 0) {
    console.log('Failed to get the storage location of a_Normal');
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
  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  if (!u_NormalMatrix) {
    console.log('Failed to get the storage location of u_NormalMatrix');
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
  u_lightPos = gl.getUniformLocation(gl.program, 'u_lightPos');
  if (!u_lightPos) {
    console.log('Failed to get the storage location of u_lightPos');
    return;
  }
  u_cameraPos = gl.getUniformLocation(gl.program, 'u_cameraPos');
  if (!u_cameraPos) {
    console.log('Failed to get the storage location of u_cameraPos');
    return;
  }
  u_lightOn = gl.getUniformLocation(gl.program, 'u_lightOn');
  if (!u_lightOn) {
    console.log('Failed to get the storage location of u_lightOn');
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
  u_shininess = gl.getUniformLocation(gl.program, 'u_shininess');
  if (!u_shininess) {
    console.log('Failed to get the storage location of u_shininess');
    return;
  }
  u_spotLightPos = gl.getUniformLocation(gl.program, 'u_spotLightPos');
  if (!u_spotLightPos) {
    console.log('Failed to get the storage location of u_spotLightPos');
    return;
  }
  u_spotLightDir = gl.getUniformLocation(gl.program, 'u_spotLightDir');
  if (!u_spotLightDir) {
    console.log('Failed to get the storage location of u_spotLightDir');
    return;
  }
  u_spotLightCutoff = gl.getUniformLocation(gl.program, 'u_spotLightCutoff');
  if (!u_spotLightCutoff) {
    console.log('Failed to get the storage location of u_spotLightCutoff');
    return;
  }
  u_spotLightOn = gl.getUniformLocation(gl.program, 'u_spotLightOn');
  if (!u_spotLightOn) {
    console.log('Failed to get the storage location of u_spotLightOn');
    return;
  }
  u_lightColor = gl.getUniformLocation(gl.program, 'u_lightColor');
  if (!u_lightColor) {
    console.log('Failed to get the storage location of u_lightColor');
    return;
  }

  // Set the matrix to identity
  var identityMatrix = new Matrix4(); 
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityMatrix.elements);
}

function initTexture() {
  var image0 = new Image();
  image0.onload = function(){ sendTextureToGLSL(image0, 0, u_Sampler0); };
  image0.src = 'textures/grass.png';

  var image1 = new Image();
  image1.onload = function(){ sendTextureToGLSL(image1, 1, u_Sampler1); };
  image1.src = 'textures/sand.png';

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

  // Normal Debugger Button
  document.getElementById("normalOn").onclick = function() {g_normalOn = true;};
  document.getElementById("normalOff").onclick = function() {g_normalOn = false;};

  // Light On/Off Button
  document.getElementById("lightOn").onclick = function() {g_lightOn = true;};
  document.getElementById("lightOff").onclick = function() {g_lightOn = false;};
  
  // Light Sliders
  document.getElementById("lightSlideX").addEventListener("input", function() {
    g_lightPos[0] = this.value/10;
    g_lightXOffset = g_lightPos[0] - Math.sin(g_seconds);
    g_lightXAnimated = true;
    renderScene();
  });
  document.getElementById("lightSlideY").addEventListener("input", function() {g_lightPos[1] = this.value/10; renderScene(); });
  document.getElementById("lightSlideZ").addEventListener("input", function() {g_lightPos[2] = this.value/10; renderScene(); });

  // Noise Offset and Scale Sliders
  const sliders = {
    "noiseOffsetXSlide": (value) => { g_noiseStartX = parseFloat(value); },
    "noiseOffsetZSlide": (value) => { g_noiseStartZ = parseFloat(value); },
    "noiseScaleSlide": (value) => { g_noiseScale = parseFloat(value); }
  };

  // Add event listeners for all sliders
  Object.entries(sliders).forEach(([id, callback]) => {
    const slider = document.getElementById(id);
    if (slider) {
      slider.addEventListener("input", function() {
        callback(this.value);
        createMap();
        renderScene();
      });
    }
  });

  // Toggle Eye of Cthulhu
  const eyeBtn = document.getElementById("toggleEyeBtn");
  if (eyeBtn) {
    eyeBtn.onclick = function() {
      g_eyeEnabled = !g_eyeEnabled;
      this.textContent = g_eyeEnabled ? 'Hide Eye' : 'Summon the Eye';
    };
  }

  // Toggle Particles
  const particleBtn = document.getElementById("toggleParticlesBtn");
  if (particleBtn) {
    particleBtn.onclick = function() {
      g_particlesEnabled = !g_particlesEnabled;
      this.textContent = g_particlesEnabled ? 'Disable Particles' : 'Enable Particles';
    };
    particleBtn.textContent = g_particlesEnabled ? 'Disable Particles' : 'Enable Particles';
  }
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
    if (!g_camera) return; 
    const sensitivity = 0.4; // degrees per pixel
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

  if (g_eyeOfCthulhu && g_eyeEnabled) {
    g_eyeOfCthulhu.pos.x = 0;
    g_eyeOfCthulhu.pos.y = 5;
    g_eyeOfCthulhu.pos.z = 0;
    g_eyeOfCthulhu.update(g_camera.eye.elements, g_seconds, g_particlesEnabled);
  }

  updateAnimation(); 

  renderScene(); 
  requestAnimationFrame(tick); // Request the next frame
}

function updateAnimation() {
  // Light position update
  if (g_lightXAnimated) {
    g_lightPos[0] = g_lightXOffset + Math.sin(g_seconds);
  }
}

function keydown(ev) {
  // Only handle F and G keys here, moved movement to tick()
  if (ev.keyCode == 70) { // F key
    addBlockAtCamera(g_camera);
  } else if (ev.keyCode == 71) { // G key
    deleteBlockAtCamera(g_camera);
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

  gl.uniformMatrix4fv(u_GlobalRotationMatrix, false, globalRotMat.elements);
}

function setModelBaseMatrix() {
  let baseMatrix = new Matrix4();
  g_voxelBaseMatrix = baseMatrix;
}

function renderScene() {
  var startTime = performance.now();
  
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);
  gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);

  setCameraMatrix();
  setModelBaseMatrix();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // Light and camera positions
  gl.uniform3f(u_lightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]); 
  gl.uniform3f(u_cameraPos, g_camera.eye.elements[0], g_camera.eye.elements[1], g_camera.eye.elements[2]);
  gl.uniform1i(u_lightOn, g_lightOn && g_lightType === 'point');
  // Spotlight uniforms
  gl.uniform3f(u_spotLightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  // Spotlight direction: from light to shape center
  let target = [0, 5, 0];
  if (g_shapeToShow === 'eye' && g_eyeOfCthulhu) {
    target = [g_eyeOfCthulhu.pos.x, g_eyeOfCthulhu.pos.y, g_eyeOfCthulhu.pos.z];
  }
  let dir = [
    target[0] - g_lightPos[0],
    target[1] - g_lightPos[1],
    target[2] - g_lightPos[2]
  ];
  let len = Math.sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]);
  if (len > 0.001) {
    dir = [dir[0]/len, dir[1]/len, dir[2]/len];
  } else {
    dir = [0, -1, 0];
  }
  gl.uniform3f(u_spotLightDir, dir[0], dir[1], dir[2]);
  gl.uniform1f(u_spotLightCutoff, 20.0); // 20 degree cutoff
  gl.uniform1i(u_spotLightOn, g_lightType === 'spot' && g_lightOn);

  // Set normal matrix to identity for static objects
  let identityNormalMatrix = new Matrix4();
  gl.uniformMatrix4fv(u_NormalMatrix, false, identityNormalMatrix.elements);

  // 1. Draw light source
  if (g_lightOn) {
    var light = new Cube();
    light.color = [2.0, 2.0, 0.0, 1.0]; 
    light.textureNum = -2; // Color
    light.matrix.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
    light.matrix.scale(-0.5, -0.5, -0.5); // Scale down the light cube
    light.matrix.translate(-0.5, -0.5, -0.5); // Center the cube
    light.renderFast();
  }

  // 2. Draw skybox (opaque)
  var skybox = new Cube();
  skybox.color = [0.53, 0.8, 0.92, 1.0];
  skybox.textureNum = -2;
  if (g_normalOn) { skybox.textureNum = -3; } // Normal debugger
  skybox.matrix.scale(-50.0, -50.0, -50.0);
  skybox.matrix.translate(-0.5, -0.5, -0.5);
  skybox.renderFast();

  // 3.  Draw all opaque objects (blocks, Eye, etc.)
  drawMap();
  // Always have an object on screen
  if (!g_shapeToShow || (g_shapeToShow !== 'eye' && g_shapeToShow !== 'sphere' && g_shapeToShow !== 'cube')) {
    g_shapeToShow = 'eye';
  }
  if (g_eyeEnabled && g_eyeOfCthulhu) {
    g_eyeOfCthulhu.render(g_camera.eye.elements);
    // Reset normal matrix for static objects after Eye
    let identityNormalMatrix = new Matrix4();
    gl.uniformMatrix4fv(u_NormalMatrix, false, identityNormalMatrix.elements);
  } else if (g_shapeToShow === 'sphere') {
    let identityNormalMatrix = new Matrix4();
    gl.uniformMatrix4fv(u_NormalMatrix, false, identityNormalMatrix.elements);
    var sphere = new Sphere();
    sphere.color = [1.0, 1.0, 1.0, 1.0];
    sphere.textureNum = -2;
    sphere.shininess = 10.0;
    if (g_normalOn) { sphere.textureNum = -3; }
    sphere.matrix.setIdentity();
    sphere.matrix.translate(0.0, 5.0, 0.0);
    sphere.matrix.scale(0.5, 0.5, 0.5);
    sphere.render();
  } else if (g_shapeToShow === 'cube') {
    let identityNormalMatrix = new Matrix4();
    gl.uniformMatrix4fv(u_NormalMatrix, false, identityNormalMatrix.elements);
    var cube = new Cube();
    cube.color = [1.0, 0.5, 0.2, 1.0];
    cube.textureNum = -2;
    if (g_normalOn) { cube.textureNum = -3; }
    cube.matrix.setIdentity();
    cube.matrix.translate(0.0, 5.0, 0.0);
    cube.matrix.scale(1.0, 1.0, 1.0);
    cube.renderFast();
  }

  // 4. Draw transparent floor last
  var floor = new Cube();
  floor.color = [0.02, 0.0, 1.0, 0.8];
  floor.textureNum = -2; // Color
  if (g_normalOn) { floor.textureNum = -3; } // Normal debugger
  floor.matrix.setIdentity();
  floor.matrix.translate(0.0, 0.63, 0.0); 
  floor.matrix.scale(32.0, 0.001, 32.0); 
  floor.matrix.translate(-0.5, 0.0, -0.5); 
  floor.renderFast();

  // Performance test
  var duration = performance.now() - startTime;
  sendTextToHTML("ms: " + Math.floor(duration) + " fps: " + Math.floor(1000/duration), "numdot");

  gl.uniform3f(u_lightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);
}

//===============================================
// Scene Construction
//===============================================

function drawMap() {
  let wall = new Cube(); // Call once for performance :D
  // Draw terrain
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      // Draw the ground
      let height = g_map[x][z];
      if (height > 0) {
        let y = height - 1;
        wall.matrix.setIdentity();
        wall.color = [1.0, 1.0, 1.0, 1.0];
        wall.textureNum = (y <= 2) ? 1 : 0; // 1 is sand, 0 is grass
        if (g_normalOn) { wall.textureNum = -3; } // Normal debugger
        wall.matrix.scale(0.5, 0.5, 0.5);
        let worldX = (x - MAP_OFFSET_X) / WORLD_TO_MAP;
        let worldZ = (z - MAP_OFFSET_Z) / WORLD_TO_MAP;
        wall.matrix.translate(worldX, y - 1.5, worldZ);
        if (wall.textureNum === 0) {
          wall.setGrassBlockUVs();
        }
        wall.renderFast();
        if (wall.textureNum === 0) { // Reset all to default for next block
          wall.resetDefaultUVs();
        }
      }
      // Draw placed blocks
      for (let y of g_placedBlocks[x][z]) {
        wall.matrix.setIdentity();
        wall.color = [1.0, 1.0, 1.0, 1.0];
        wall.textureNum = (y <= 2) ? 1 : 0;
        if (g_normalOn) { wall.textureNum = -3; } // Normal debugger
        wall.matrix.scale(0.5, 0.5, 0.5);
        let worldX = (x - MAP_OFFSET_X) / WORLD_TO_MAP;
        let worldZ = (z - MAP_OFFSET_Z) / WORLD_TO_MAP;
        wall.matrix.translate(worldX, y - 1.5, worldZ);
        if (wall.textureNum === 0) {
          wall.setGrassBlockUVs();
        }
        wall.renderFast();
        if (wall.textureNum === 0) { // Reset all to default for next block
          wall.resetDefaultUVs();
        }
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
      // Convert map coordinates back to world coordinates for noise
      let worldX = (x - MAP_OFFSET_X) / WORLD_TO_MAP;
      let worldZ = (z - MAP_OFFSET_Z) / WORLD_TO_MAP;
      let value = noise.simplex2((worldX + g_noiseStartX) / g_noiseScale, (worldZ + g_noiseStartZ) / g_noiseScale); // Generate Simplex noise (-1 to 1), scale controls frequency, offset allows scrolling
      let height = Math.max(minHeight, Math.floor((value + 1) / 2 * heightScale)); // Convert noise to height: normalize to 0-1, scale to desired range, enable min height
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

function addBlockAtCamera(camera) {
  let pos = camera.eye.elements;

  let dir = new Vector3(camera.at.elements);
  dir.sub(camera.eye);
  dir.normalize();
  let offsetX = 0;
  let offsetZ = 0;
  let offsetY = 0;
  
  // Use different thresholds for horizontal and vertical placement
  const horizontalThreshold = 0.3; // Increased threshold for more precise horizontal placement
  const verticalThreshold = 0.05; // Keep vertical threshold the same
  
  // Find the dominant direction
  let maxComponent = Math.max(
    Math.abs(dir.elements[0]),
    Math.abs(dir.elements[1]),
    Math.abs(dir.elements[2])
  );
  
  // Only place in the dominant direction
  if (Math.abs(dir.elements[0]) === maxComponent && Math.abs(dir.elements[0]) > horizontalThreshold) {
    offsetX = dir.elements[0] > 0 ? BLOCK_SCALE : -BLOCK_SCALE;
  }
  if (Math.abs(dir.elements[1]) === maxComponent && Math.abs(dir.elements[1]) > verticalThreshold) {
    offsetY = dir.elements[1] > 0 ? BLOCK_SCALE : -BLOCK_SCALE;
  }
  if (Math.abs(dir.elements[2]) === maxComponent && Math.abs(dir.elements[2]) > horizontalThreshold) {
    offsetZ = dir.elements[2] > 0 ? BLOCK_SCALE : -BLOCK_SCALE;
  }
  
  // Convert world coordinates to map coordinates, accounting for block scale and direction
  let mapX = Math.floor(((pos[0] + offsetX) / BLOCK_SCALE) + MAP_HALF);
  let mapZ = Math.floor(((pos[2] + offsetZ) / BLOCK_SCALE) + MAP_HALF);
  
  // Check bounds
  if (mapX < 0 || mapX >= MAP_SIZE || mapZ < 0 || mapZ >= MAP_SIZE) return;
  
  // Get the height at the camera position, accounting for block scale and Y offset
  let targetY = Math.floor(pos[1] / BLOCK_SCALE) + 1 + Math.floor(offsetY / BLOCK_SCALE);
  
  // Add this height to the placed blocks array if it's not already there
  if (!g_placedBlocks[mapX][mapZ].includes(targetY)) {
    g_placedBlocks[mapX][mapZ].push(targetY);
  }
}

function deleteBlockAtCamera(camera) {
  let pos = camera.eye.elements;
  let dir = new Vector3(camera.at.elements);
  dir.sub(camera.eye);
  dir.normalize();
  
  // Calculate offsets based on direction components
  // Account for BLOCK_SCALE in the direction
  let offsetX = 0;
  let offsetZ = 0;
  let offsetY = 0;
  
  // Use different thresholds for horizontal and vertical placement
  const horizontalThreshold = 0.3; // Same as addBlockAtCamera
  const verticalThreshold = 0.05; // Same as addBlockAtCamera
  
  // Find the dominant direction
  let maxComponent = Math.max(
    Math.abs(dir.elements[0]),
    Math.abs(dir.elements[1]),
    Math.abs(dir.elements[2])
  );
  
  // Only delete in the dominant direction
  if (Math.abs(dir.elements[0]) === maxComponent && Math.abs(dir.elements[0]) > horizontalThreshold) {
    offsetX = dir.elements[0] > 0 ? BLOCK_SCALE : -BLOCK_SCALE;
  }
  if (Math.abs(dir.elements[1]) === maxComponent && Math.abs(dir.elements[1]) > verticalThreshold) {
    offsetY = dir.elements[1] > 0 ? BLOCK_SCALE : -BLOCK_SCALE;
  }
  if (Math.abs(dir.elements[2]) === maxComponent && Math.abs(dir.elements[2]) > horizontalThreshold) {
    offsetZ = dir.elements[2] > 0 ? BLOCK_SCALE : -BLOCK_SCALE;
  }
  
  // Convert world coordinates to map coordinates, accounting for block scale and direction
  let mapX = Math.floor(((pos[0] + offsetX) / BLOCK_SCALE) + MAP_HALF);
  let mapZ = Math.floor(((pos[2] + offsetZ) / BLOCK_SCALE) + MAP_HALF);
  
  // Check bounds
  if (mapX < 0 || mapX >= MAP_SIZE || mapZ < 0 || mapZ >= MAP_SIZE) return;
  
  // Get the height at the camera position, accounting for block scale and Y offset
  let targetY = Math.floor(pos[1] / BLOCK_SCALE) + 1 + Math.floor(offsetY / BLOCK_SCALE);
  
  // Check a small area around the target position for blocks to delete
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      let checkX = mapX + dx;
      let checkZ = mapZ + dz;
      
      // Skip if out of bounds
      if (checkX < 0 || checkX >= MAP_SIZE || checkZ < 0 || checkZ >= MAP_SIZE) continue;
      
      // Try to delete from placed blocks first
      let index = g_placedBlocks[checkX][checkZ].indexOf(targetY);
      if (index !== -1) {
        g_placedBlocks[checkX][checkZ].splice(index, 1);
        return; // Stop after deleting one block
      }
      
      // Try to delete from terrain - if the target height matches the terrain height, delete it
      if (g_map[checkX][checkZ] === targetY + 1) { // +1 because terrain height is stored as height+1
        g_map[checkX][checkZ] = 0; // Set to 0 to completely remove the block
        return; // Stop after deleting one block
      }
    }
  }
}
