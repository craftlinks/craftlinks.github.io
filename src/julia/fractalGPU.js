import { createShaderModule, render } from '../lib.js';
/// //////////////////////////////////////////////////////
// GPU and CPU Settings
const xmin = -1.5;
const xmax = 1.5;
const ymin = -1.1;
const ymax = 2.0;
// Sizes in bytes
const sizes = {
    f32: 4,
    vec2: 8,
    vec4: 16
};
const uniforms = {
    rez: 2048,
    time: 0,
    count: 1
};
// CPU-only settings
const settings = {
    scale: (0.95 * Math.min(window.innerHeight, window.innerWidth)) / uniforms.rez,
    pixelWorkgroups: Math.ceil(uniforms.rez ** 2 / 256),
    count: 1,
    agentWorkgroups: Math.ceil(uniforms.count / 256),
    dxdy: new Float32Array([(xmax - xmin) / uniforms.rez, (ymax - ymin) / uniforms.rez]),
    xMinYmin: new Float32Array([xmin, ymin])
};
console.log(`dxdy: ${settings.dxdy.toString()}`);
console.log(`xMinYmin: ${settings.xMinYmin.toString()}`);
console.log(settings.dxdy[0] * uniforms.rez);
console.log(settings.dxdy[1] * uniforms.rez);
console.log(settings.xMinYmin[0] + settings.dxdy[0] * uniforms.rez);
console.log(settings.xMinYmin[1] + settings.dxdy[1] * uniforms.rez);
/// //////////////////////////////////////////////////////
// Main
async function main() {
    /// ////////////////////
    // Initial setup
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter == null) {
        alert('No GPU found');
        return;
    }
    const gpu = await adapter.requestDevice();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = uniforms.rez * settings.scale;
    document.body.appendChild(canvas);
    const context = canvas.getContext('webgpu');
    if (context == null) {
        alert('No WebGPU context found');
        return;
    }
    const format = 'bgra8unorm';
    context.configure({
        device: gpu,
        format,
        alphaMode: 'premultiplied'
    });
    /// //////////////////////
    // Set up memory resources
    const visibility = GPUShaderStage.COMPUTE;
    // Pixel buffer
    const pixelBuffer = gpu.createBuffer({
        size: uniforms.rez ** 2 * sizes.vec4,
        usage: GPUBufferUsage.STORAGE
    });
    const pixelBufferLayout = gpu.createBindGroupLayout({
        entries: [{ visibility, binding: 0, buffer: { type: 'storage' } }]
    });
    const pixelBufferBindGroup = gpu.createBindGroup({
        layout: pixelBufferLayout,
        entries: [{ binding: 0, resource: { buffer: pixelBuffer } }]
    });
    // Uniform buffers
    const rezBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    gpu.queue.writeBuffer(rezBuffer, 0, new Float32Array([uniforms.rez]));
    const timeBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([uniforms.time]));
    const mouseBuffer = gpu.createBuffer({
        size: sizes.vec2,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    gpu.queue.writeBuffer(mouseBuffer, 0, new Float32Array([0, 0]));
    const xMinYminBuffer = gpu.createBuffer({
        size: sizes.vec2,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    gpu.queue.writeBuffer(xMinYminBuffer, 0, settings.xMinYmin);
    const dxdyBuffer = gpu.createBuffer({
        size: sizes.vec2,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    gpu.queue.writeBuffer(dxdyBuffer, 0, settings.dxdy);
    const uniformsLayout = gpu.createBindGroupLayout({
        entries: [
            { visibility, binding: 0, buffer: { type: 'uniform' } },
            { visibility, binding: 1, buffer: { type: 'uniform' } },
            { visibility, binding: 2, buffer: { type: 'uniform' } },
            { visibility, binding: 3, buffer: { type: 'uniform' } },
            { visibility, binding: 4, buffer: { type: 'uniform' } }
        ]
    });
    const uniformsBuffersBindGroup = gpu.createBindGroup({
        layout: uniformsLayout,
        entries: [
            { binding: 0, resource: { buffer: rezBuffer } },
            { binding: 1, resource: { buffer: timeBuffer } },
            { binding: 2, resource: { buffer: xMinYminBuffer } },
            { binding: 3, resource: { buffer: dxdyBuffer } },
            { binding: 4, resource: { buffer: mouseBuffer } }
        ]
    });
    // Other buffers
    const positionBuffer = gpu.createBuffer({
        size: sizes.vec2 * settings.count,
        usage: GPUBufferUsage.STORAGE
    });
    const velocityBuffer = gpu.createBuffer({
        size: sizes.vec2 * settings.count,
        usage: GPUBufferUsage.STORAGE
    });
    const agentsLayout = gpu.createBindGroupLayout({
        entries: [
            { visibility, binding: 0, buffer: { type: 'storage' } },
            { visibility, binding: 1, buffer: { type: 'storage' } }
        ]
    });
    const agentsBuffersBindGroup = gpu.createBindGroup({
        layout: agentsLayout,
        entries: [
            { binding: 0, resource: { buffer: positionBuffer } },
            { binding: 1, resource: { buffer: velocityBuffer } }
        ]
    });
    /// //
    // Overall memory layout
    const layout = gpu.createPipelineLayout({
        bindGroupLayouts: [pixelBufferLayout, uniformsLayout, agentsLayout]
    });
    /// //////////////////////
    // Set up code instructions
    const module = await createShaderModule(gpu, '../../src/julia/fractal.wgsl');
    const resetPipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: 'reset' }
    });
    const simulatePipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: 'simulate' }
    });
    /// //////////////////////
    // RUN the reset shader function
    const reset = () => {
        const encoder = gpu.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(resetPipeline);
        pass.setBindGroup(0, pixelBufferBindGroup);
        pass.setBindGroup(1, uniformsBuffersBindGroup);
        pass.setBindGroup(2, agentsBuffersBindGroup);
        pass.dispatchWorkgroups(settings.agentWorkgroups);
        pass.end();
        gpu.queue.submit([encoder.finish()]);
    };
    reset();
    const mouse = { x: 0, y: 0 };
    const canvasRect = canvas.getBoundingClientRect();
    document.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX - canvasRect.left) / settings.scale;
        mouse.y = (e.clientY - canvasRect.top) / settings.scale;
    });
    /// //////////////////////
    // RUN the sim compute function and render pixels
    const draw = () => {
        const run = () => {
            gpu.queue.writeBuffer(mouseBuffer, 0, new Float32Array([mouse.x, mouse.y]));
            gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([uniforms.time++]));
            // Compute sim function
            const encoder = gpu.createCommandEncoder();
            const pass = encoder.beginComputePass();
            pass.setBindGroup(0, pixelBufferBindGroup);
            pass.setBindGroup(1, uniformsBuffersBindGroup);
            pass.setBindGroup(2, agentsBuffersBindGroup);
            pass.setPipeline(simulatePipeline);
            pass.dispatchWorkgroups(settings.pixelWorkgroups);
            pass.end();
            // Render the pixels buffer to the canvas
            void render(gpu, uniforms.rez, pixelBuffer, format, context, encoder);
            gpu.queue.submit([encoder.finish()]);
        };
        run();
        requestAnimationFrame(draw);
    };
    draw();
}
void main();
