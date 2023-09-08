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
    const field = glsl({}, { size: [160, 160], story: 2, tag: 'field' });
    glsl.loop(({ time }) => {
        // glsl.adjustCanvas()
        glsl({ seed: Math.random() * 12417, time, FP: 'max(step(hash(ivec3(I,seed)).r,0.0001), Src(I-ivec2(int((sin(time)*2.0)),int(cos(time)*2.0))).r-0.01)' }, field);
        glsl({ tex: field[0], FP: 'tex(UV)' });
    });
}
void main();
