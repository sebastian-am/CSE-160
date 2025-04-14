// Sebastian Morgese
// smorgese@ucsc.edu

function drawApple() {
    g_shapeList = [];
    renderAllShapes();
  
    // Red shades
    const red1 = [249 / 255, 73 / 255, 67 / 255, 1.0];     // rgb(249, 73, 67) (4)
    const red2 = [239 / 255, 59 / 255, 47 / 255, 1.0];     // rgb(239, 59, 47) (3, 5)
    const red3 = [184 / 255, 24 / 255, 31 / 255, 1.0];     // rgb(184, 24, 31) (1, 2)
    const red4 = [151 / 255, 11 / 255, 21 / 255, 1.0];     // rgb(151, 11, 21) (11, 6, 8)
    const red5 = [135 / 255, 17 / 255, 21 / 255, 1.0];     // rgb(135, 17, 21) (7, 13)
    const red6 = [143 / 255, 20 / 255, 24 / 255, 1.0];     // rgb(143, 20, 24) (9, 10)
    const red7 = [127 / 255, 21 / 255, 28 / 255, 1.0];     // rgb(127, 21, 28) (12, 14)
    const red8 = [149 / 255, 34 / 255, 39 / 255, 1.0];     // rgb(149, 34, 39) (15)

    // Brown shades
    const brown1 = [67 / 255, 39 / 255, 26 / 255, 1.0];     // rgb(67, 39, 26) (16)
    const brown2 = [113 / 255, 62 / 255, 19 / 255, 1.0];    // rgb(113, 62, 19) (17)

    // Green shades
    const green1 = [73 / 255, 121 / 255, 53 / 255, 1.0];   // rgb(73, 121, 53) (19)
    const green2 = [22 / 255, 103 / 255, 42 / 255, 1.0];   // rgb(22, 103, 42) (18)
    const green3 = [111 / 255, 173 / 255, 80 / 255, 1.0];  // rgb(111, 173, 80) (20)

    const appleTriangles = [
        { color: red1, verts: [ -0.40, 0.05, -0.16, 0, -0.35, 0.18] }, //4
        { color: red3, verts: [ -0.16, 0, 0.08, 0.15, -0.20, 0.25 ] }, //1
        { color: red3, verts: [ -0.35, -0.18, -0.21, -0.35, -0.16, 0 ] }, //2
        { color: red2, verts: [ -0.35, 0.18, -0.16, 0, -0.20, 0.25] }, //3
        { color: red2, verts: [ -0.40, 0.05, -0.35, -0.18, -0.16, 0] }, //5
        { color: red5, verts: [ 0, 0.178, 0.08, 0.15, 0.2, 0.25 ] }, //7
        { color: red7, verts: [ -0.21, -0.35, 0, -0.37, 0.2, -0.25 ] }, //12
        { color: red4, verts: [ -0.21, -0.35, 0.2, -0.25, -0.16, 0 ] }, //11
        { color: red4, verts: [ -0.16, 0, 0.35, 0, 0.08, 0.15,] }, //6
        { color: red4, verts: [ 0.08, 0.15, 0.32, 0.18, 0.2, 0.25 ] }, //8
        { color: red6, verts: [ 0.08, 0.15, 0.35, 0, 0.32, 0.18 ] }, //9
        { color: red6, verts: [ -0.16, 0, 0.2, -0.25, 0.35, 0] }, //10
        { color: red8, verts: [0.2, -0.25, 0.3, -0.23, 0.35, 0] }, //15
        { color: red7, verts: [ 0.19, -0.35, 0.3, -0.23, 0.2, -0.25 ] }, //14
        { color: red5, verts: [ 0, -0.37, 0.19, -0.35, 0.2, -0.25 ] }, //13
        
        { color: brown1, verts: [ -0.09, 0.3, 0, 0.178, -0.07, 0.33] }, //16
        { color: brown2, verts: [ -0.13, 0.32, -0.09, 0.3, -0.07, 0.33] }, //17

        { color: green3, verts: [ 0, 0.178, 0.08, 0.215, 0.03, 0.26 ] }, //18
        { color: green2, verts: [ 0.03, 0.26, 0.08, 0.215, 0.12, 0.24 ] }, //19
        { color: green1, verts: [ 0.03, 0.26, 0.12, 0.24, 0.14, 0.27 ] }, //20
    ];
  
    for (let tri of appleTriangles) {
      gl.uniform4f(u_FragColor, tri.color[0], tri.color[1], tri.color[2], tri.color[3]);
      drawTriangle(tri.verts);
    }
  }
  
// Reference to center drawing
// function drawCross() {
//     const white = [1.0, 1.0, 1.0, 1.0];
//     gl.uniform4f(u_FragColor, white[0], white[1], white[2], white[3]);

//     const size = 0.005;
//     const len = 0.5;

//     // Horizontal bar
//     drawTriangle([-len,  size,  len,  size,  len, -size]);
//     drawTriangle([-len,  size,  len, -size, -len, -size]);

//     // Vertical bar
//     drawTriangle([ size,  len, -size,  len, -size, -len]);
//     drawTriangle([ size,  len, -size, -len,  size, -len]);
// }
  