import {WGPU} from '../wgpu.js';

let wgpu = new WGPU(512, 512);
wgpu.compileShader("../../src/dla/dla.wgsl").then((shader) => {
    console.log("Shader compiled.");
});

let outTexture = wgpu.createTexture();
