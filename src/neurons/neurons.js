import { SwissGL } from '../swissgl.js';
const uniforms = {
    rez: 1024,
    time: 0,
    radius: 50,
    count: 15000,
    number_of_colors: 3
};
async function main() {
    const canvas = document.createElement('canvas');
    const scale = (0.95 * Math.min(window.innerHeight, window.innerWidth)) / uniforms.rez;
    canvas.width = canvas.height = uniforms.rez * scale;
    document.body.appendChild(canvas);
    const glsl = SwissGL(canvas);
    glsl.loop(({ time }) => {
        // glsl.adjustCanvas()
        const tex = glsl({ time, FP: 'sin(time*0.001*(float(I.y^I.x))), cos(time*0.001*(float(I.y^I.x))), sin(time*0.5), .5' }, { scale: 1 / 1, tag: 'tmp' });
        glsl({ tex, FP: 'tex(abs(XY))' });
    });
}
void main();
