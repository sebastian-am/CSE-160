// Sebastian Morgese
// smorgese@ucsc.edu

function main() {  
  // Retrieve <canvas> element
  var canvas = document.getElementById('example');  
  if (!canvas) { 
    console.log('Failed to retrieve the <canvas> element');
    return false; 
  } 

  // Get the rendering context for 2DCG
  var ctx = canvas.getContext('2d');

  // Draw a blue rectangle
  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)'; // Set color to black
  ctx.fillRect(0, 0, canvas.width, canvas.height);        // Fill a rectangle with the color
  
  handleDrawEvent();
  handleDrawOperationEvent();

}

function drawVector(v, color) {
  var ctx = document.getElementById('example').getContext('2d');
  ctx.beginPath();
  ctx.moveTo(200, 200);

  ctx.lineTo((v.elements[0]*20)+200, 200-(v.elements[1]*20)); // Moved to center and scaled by 20
  
  ctx.strokeStyle = color;
  ctx.stroke();
}

// Event Listeners
function handleDrawEvent() {
  clearCanvas();
  drawCanvas();

  //Read the values of the text boxes to create v1.
  let v1 = new Vector3([
    parseFloat(document.getElementById('v1x').value), 
    parseFloat(document.getElementById('v1y').value), 
    0]);  
  
  drawVector(v1, 'red');

  //Read the values of the text boxes to create v2.
  let v2 = new Vector3([
    parseFloat(document.getElementById('v2x').value), 
    parseFloat(document.getElementById('v2y').value), 
    0]);  

  drawVector(v2, 'blue');

}

function handleDrawOperationEvent() {
  clearCanvas();
  drawCanvas();

  //Read the values of the text boxes to create v1.
  let v1 = new Vector3([
    parseFloat(document.getElementById('v1x').value), 
    parseFloat(document.getElementById('v1y').value), 
    0]);  
  
  drawVector(v1, 'red');

  //Read the values of the text boxes to create v2.
  let v2 = new Vector3([
    parseFloat(document.getElementById('v2x').value), 
    parseFloat(document.getElementById('v2y').value), 
    0]);  

  drawVector(v2, 'blue');

  let op = document.getElementById('operation').value;
  let v3 = new Vector3(v1.elements);

  // Perform the operation based on the selected option
  if (op == 'add'){
    v3.add(v2);
    drawVector(v3, 'green');
  }
  else if (op == 'sub'){
    v3.sub(v2);
    drawVector(v3, 'green');
  }
  else if (op == 'div'){
    let v4 = new Vector3(v2.elements);
    let scalar = parseFloat(document.getElementById("scal").value);
    v3.div(scalar); 
    v4.div(scalar);
    drawVector(v3, 'green');
    drawVector(v4, 'green');
  }
  else if (op == 'mul'){
    let v4 = new Vector3(v2.elements);
    let scalar = parseFloat(document.getElementById("scal").value);
    v3.mul(scalar); 
    v4.mul(scalar);
    drawVector(v3, 'green');
    drawVector(v4, 'green');
  }
  else if (op == 'mag'){
    let v4 = new Vector3(v2.elements);
    v3.magnitude();
    v4.magnitude();
    console.log("Magnitude v1: " + v3.magnitude());
    console.log("Magnitude v2: " + v4.magnitude());
  }
  else if (op == "norm"){
    let v4 = new Vector3(v2.elements);
    v3.normalize();
    v4.normalize();
    drawVector(v3, 'green');
    drawVector(v4, 'green');
  }
  else if (op == "ang"){
    let angle = angleBetween(v1, v2);
    console.log("Angle: " + angle);
  }
  else if (op == "area"){
    let area = areaTriangle(v1, v2);
    console.log("Area of the triangle: " + area);
  }
}

// Helpeer Functions (given)
function angleBetween(v1, v2) {
  let dot = Vector3.dot(v1, v2);
  let magV1 = v1.magnitude();
  let magV2 = v2.magnitude();
  if (magV1 === 0 || magV2 === 0) { // Avoid division by zero
    return 0; 
  }

  let rad = Math.acos(dot / (magV1 * magV2)); //given formula (correct)
  let deg = rad * (180 / Math.PI);
  return deg;
}

function areaTriangle(v1, v2) {
  let cross = Vector3.cross(v1, v2);
  let area = cross.magnitude() / 2;
  return area;
}

// Helper functions (not given)
function clearCanvas() {
  const canvas = document.getElementById('example');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawCanvas() {
  const canvas = document.getElementById('example');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}