// Sebastian Morgese
// smorgese@ucsc.edu

// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }`

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`

// Global var for WebGL context
let canvas, gl;
let a_Position, u_FragColor, u_Size;

function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  gl = canvas.getContext('webgl', {preserveDrawingBuffer: true}); 
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
}

function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

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

  // Get the storage location of u_Size
  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if (!u_Size) {
    console.log('Failed to get the storage location of u_Size');
    return;
  }
}

// Contants 
const POINT = 0, TRIANGLE = 1, CIRCLE = 2;

//Global Var for selected shape
let g_selectedColor = [1.0, 1.0, 1.0, 1.0]; // Default color is white
let g_selectedSize = 20.0; // Default size is 20
let g_selectedsegments = 10; // Default segments for circle is 10
let g_selectedShape = POINT; // Default shape is point


function addActionForHtmlUI() {
  // Clear Button Event
  document.getElementById("clearButton").onclick = function() {
    g_shapeList = []; // Clear the shape list
    renderAllShapes(); // Clear the canvas
  }

  // Shape Selection Event
  document.getElementById("pointButton").onclick = function() {
    g_selectedShape = POINT; // Set the selected shape to point
  }
  document.getElementById("triangleButton").onclick = function() {
    g_selectedShape = TRIANGLE; // Set the selected shape to triangle
  }
  document.getElementById("circleButton").onclick = function() {
    g_selectedShape = CIRCLE; // Set the selected shape to triangle
  }

  // console.log("Shape selected:", g_selectedShape);

  //Color Slider Events
  //TODO: fix intilization of slides so there's not visual mismatch
  document.getElementById("redSlide").addEventListener("input", function() {
    g_selectedColor[0] = this.value/255.0;
  });
  document.getElementById("greenSlide").addEventListener("input", function() {
    g_selectedColor[1] = this.value/255.0;
  });
  document.getElementById("blueSlide").addEventListener("input", function() {
    g_selectedColor[2] = this.value/255.0;
  });

  //Size Slider Events
  document.getElementById("sizeSlide").addEventListener("input", function() {
    g_selectedSize = this.value;
  });

  //Segments Slider Events
  document.getElementById("segmentSlide").addEventListener("input", function() {
    g_selectedsegments = this.value;
  });

  //Extra Events
  document.getElementById("drawButton").onclick = function() {
    drawApple();
    document.getElementById("referenceImage").style.display = "block";
  }; 

  document.getElementById("gameButton").onclick = function() {
    g_shapeList = [];
    renderAllShapes();
    
    document.getElementById("referenceImage").style.display = "none";
  
    waitingToStart = true;
    catSpeed = 0;
  
    cat.x = Math.max(Math.min(mouse.x + 0.5, 0.9), -0.9);
    cat.y = Math.max(Math.min(mouse.y + 0.5, 0.9), -0.9);
  
    setupCatMouseListeners(); 
  
    document.getElementById("gameButton").disabled = true;
    renderCatMouse();
  };
}

function main() {
  setupWebGL();
  connectVariablesToGLSL();
  addActionForHtmlUI();

  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) { // Mouse move event
    if (ev.buttons == 1) { // If the left mouse button is pressed
      click(ev); // Call click() to render
    }
  };

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);

  setupCatMouseListeners(); // Setup cat and mouse listeners
}

var g_shapeList = []; // The array for the shape objects

function click(ev) {
  document.getElementById("referenceImage").style.display = "none"; //hide image
  // Extract the event click and convert to WebGL coordinates
  let [x, y] = convertCoordinatesEventToGL(ev); 
  
  // Create a new point object
  let point;
  if (g_selectedShape == POINT) 
    point = new Point(); 
  else if (g_selectedShape == TRIANGLE) 
    point = new Triangle(); 
  else if (g_selectedShape == CIRCLE)
    point = new Circle(); 
  else {
    console.log("Invalid shape selected");
    return;
  }

  point.position = [x, y]; // Set the position of the point
  point.color = g_selectedColor.slice(); // Set the color of the point
  point.size = g_selectedSize; // Set the size of the point
  if (g_selectedShape == CIRCLE) {
    point.segments = g_selectedsegments; 
  }

  // Add the point to the shape list
  g_shapeList.push(point); 
  
  renderAllShapes();
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect(); 

  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

  return ([x,y]);
}

function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  var len = g_shapeList.length;
  for(var i = 0; i < len; i++) {
    g_shapeList[i].render();
  }
}
