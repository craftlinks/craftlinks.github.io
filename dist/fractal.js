"use strict";
// Constants
const X_MIN = -1.5;
const X_MAX = 1.5;
const Y_MIN = -0.95;
const Y_MAX = 0.99;
const MAX_ITERS = 250;
const juliaX = -0.62580000000000;
const juliaY = 0.40250000000000;
// get the canvas element and its context
let canvas = document.getElementById("myCanvas");
// if no canvas, exit
if (!canvas) {
    alert("Error: cannot find the canvas element!");
    throw new Error("Error: cannot find the canvas element!");
}
// get the canvas context
let ctx = canvas.getContext("2d", { willReadFrequently: true });
if (!ctx) {
    alert("Error: failed to get canvas context!");
    throw new Error("Error: failed to get canvas context!");
}
canvas.width = window.innerWidth - 50;
canvas.height = window.innerHeight - 200;
const dx = (X_MAX - X_MIN) / canvas.width;
const dy = (Y_MAX - Y_MIN) / canvas.height;
console.log("dx: " + dx);
console.log("dy: " + dy);
// The HTMLElement.focus() method sets focus on the specified element, if it can be focused.
// The focused element is the element that will receive keyboard and similar events by default.
canvas.focus();
function getNumIters(re, im, c_re, c_im, maxIters) {
    // loop until max iterations reached or divergence detected
    let iters = 0;
    while (iters < maxIters && re * re + im * im <= 4.0) {
        iters++;
        // z = z^2 + c
        const x = re;
        re = re * re - im * im;
        im = 2.0 * x * im;
        re += c_re;
        im += c_im;
    }
    return iters;
}
let redraw = true;
function drawFractal() {
    if (redraw) {
        redraw = false;
    }
    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FF0000";
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let y = Y_MIN;
    let p = 0;
    for (let i = canvas.height - 1; i >= 0; i--) {
        let x = X_MIN;
        for (let j = 0; j < canvas.width; j++) {
            const iters = getNumIters(x, y, juliaX, juliaY, MAX_ITERS); // make faster
            if (iters < MAX_ITERS) {
                imageData.data[p++] = 256;
                imageData.data[p++] = 256;
                imageData.data[p++] = 256;
            }
            else {
                imageData.data[p++] = 0;
                imageData.data[p++] = 0;
                imageData.data[p++] = 0;
            }
            imageData.data[p++] = 255;
            x += dx;
        }
        y += dy;
    }
    ctx.putImageData(imageData, 0, 0);
}
function update() {
    // draw the fractal
    drawFractal();
    // request another animation frame
    requestAnimationFrame(update);
}
// start the animation
update();
