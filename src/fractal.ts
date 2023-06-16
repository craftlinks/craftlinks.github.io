// Constants
const SCALE = 0.0015;
const MAX_ITERS = 250;
const  juliaX = -0.62580000000000;
const  juliaY = 0.40250000000000;



// get the canvas element and its context
let canvas: HTMLCanvasElement | null = document.getElementById("myCanvas") as HTMLCanvasElement;

// if no canvas, exit
if (!canvas) {
    alert("Error: cannot find the canvas element!");
    throw new Error("Error: cannot find the canvas element!");
}

// get the canvas context
let ctx: CanvasRenderingContext2D | null = canvas.getContext("2d", {willReadFrequently: true});
if (!ctx) {
    alert("Error: failed to get canvas context!");
    throw new Error("Error: failed to get canvas context!");
}

canvas.width = window.innerWidth - 40;
canvas.height = window.innerHeight - 200;

// The HTMLElement.focus() method sets focus on the specified element, if it can be focused.
// The focused element is the element that will receive keyboard and similar events by default.
canvas.focus();

function getNumIters(re: number, im: number, c_re: number, c_im: number, maxIters: number) {
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
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx!.fillStyle = "#FF0000";

    let imageData: ImageData = ctx!.getImageData(0, 0, canvas!.width, canvas!.height, );
    let y = 0 - canvas!.height / 2 * SCALE;

    let p = 0;
    for (let i = canvas!.height -1; i >=0 ; i--) {
        let x = 0 - canvas!.width / 2.0 * SCALE;
        for (let j = 0; j < canvas!.width; j++) {
            const iters = getNumIters(x, y, juliaX, juliaY, MAX_ITERS);
            // const index = (i * canvas!.width + j) * 4;
            if (iters < MAX_ITERS) {
                imageData.data[p++] = 0;
                imageData.data[p++] = 0;
                imageData.data[p++] = 0;
                //imageData.data[p++] = 255;
            }
            else {
                imageData.data[p++] = 255;
                imageData.data[p++] = 192;
                imageData.data[p++] = 0;
                // imageData.data[p++] = 255;
            }
            imageData.data[p++] = 255;
            x += SCALE;
        }
        y += SCALE;
    }

    ctx!.putImageData(imageData, 0, 0);



}

function update() {


    // draw the fractal
    drawFractal();

    // request another animation frame
    requestAnimationFrame(update);
}

// start the animation
update();


