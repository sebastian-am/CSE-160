// Sebastian Morgese
// smorgese@ucsc.edu

// Global Variables
let mouse = { x: 0, y: 0, size: 15.0, color: [1, 1, 1, 1] };
let cat = { x: 0.5, y: 0.5, radius: 0.05, color: [1, 0, 0, 1] };
let gameActive = false, waitingToStart = false, catSpeed = 0;

function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function updateCat() {
  let dx = mouse.x - cat.x;
  let dy = mouse.y - cat.y;
  let dist = getDistance(cat.x, cat.y, mouse.x, mouse.y);

  // Smooth ramp-up toward 0.75
  catSpeed = Math.min(catSpeed + (0.01 * (1 - catSpeed)), 0.75);

  // Move proportionally toward mouse
  let speed = Math.min(dist * 0.1, 0.05) * catSpeed;

  if (dist > 0.001) {
    cat.x += (dx / dist) * speed;
    cat.y += (dy / dist) * speed;
  }

  // If cat caught mouse
  if (dist < cat.radius + 0.04) {
    alert("The cat caught the mouse!!! Game Over!\nClick 'Start Game' to play again or click the canvas to draw.");
    endGame();
  }
}

function renderCatMouse() {
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Draw the mouse
  gl.disableVertexAttribArray(a_Position); // Needed to manually set vertex
  gl.vertexAttrib3f(a_Position, mouse.x, mouse.y, 0);
  gl.uniform4f(u_FragColor, mouse.color[0], mouse.color[1], mouse.color[2], mouse.color[3]);
  gl.uniform1f(u_Size, mouse.size);
  gl.drawArrays(gl.POINTS, 0, 1);

  // Draw the cat
  gl.enableVertexAttribArray(a_Position); // Needed to use buffers
  gl.uniform4f(u_FragColor, cat.color[0], cat.color[1], cat.color[2], cat.color[3]);
  drawCircle([cat.x, cat.y], cat.radius * 200, 20);
}

function gameLoop() {
  if (!gameActive) return;
  updateCat();
  renderCatMouse();
  requestAnimationFrame(gameLoop);
}

function setupCatMouseListeners() {
  canvas.addEventListener("mousemove", function(ev) {
    if (!gameActive && !waitingToStart) return;
    var r = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) - canvas.width / 2) / (canvas.width / 2);
    mouse.y = (canvas.height / 2 - (ev.clientY - r.top)) / (canvas.height / 2);
  });

  canvas.addEventListener("mousedown", function() {
    if (waitingToStart) {
      waitingToStart = false;
      gameActive = true;
      requestAnimationFrame(gameLoop);
    }
  });
}

function endGame() {
  gameActive = false;
  waitingToStart = false;
  catSpeed = 0;
  g_shapeList = [];
  renderAllShapes();
  document.getElementById("gameButton").disabled = false;
}
