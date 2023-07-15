import { createShaderModule, render } from '../lib.js';
import GUI from '../lil-gui.esm.js';
/// //////////////////////////////////////////////////////
// GPU and CPU Settings
// Sizes in bytes
const sizes = {
    f32: 4,
    u32: 4,
    i32: 4,
    vec2: 8,
    vec4: 16,
    workGroupSize: 32
};
const uniforms = {
    rez: 512,
    time: 0,
    radius: 50,
    count: 15000,
    number_of_colors: 3
};
// CPU-only settings
const settings = {
    scale: (0.95 * Math.min(window.innerHeight, window.innerWidth)) / uniforms.rez,
    pixelWorkgroups: Math.ceil(uniforms.rez ** 2 / sizes.workGroupSize),
    agentWorkgroups: Math.ceil(uniforms.count / sizes.workGroupSize)
};
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
        alert('No WebGPU found');
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
    const timeBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([uniforms.time]));
    const countBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    const radiusBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    const numberOfColorsBuffer = gpu.createBuffer({
        size: sizes.u32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    gpu.queue.writeBuffer(numberOfColorsBuffer, 0, new Uint32Array([uniforms.number_of_colors]));
    // Color matrix
    const matrixBuffer = gpu.createBuffer({
        size: sizes.f32 * uniforms.number_of_colors * uniforms.number_of_colors * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    const makeRandomMatrix = () => {
        const matrix = [];
        for (let i = 0; i < uniforms.number_of_colors ** 2; i++) {
            matrix[i] = Math.random() * 2 - 1;
        }
        console.log(matrix);
        return matrix;
    };
    gpu.queue.writeBuffer(matrixBuffer, 0, new Float32Array(makeRandomMatrix()));
    const uniformsLayout = gpu.createBindGroupLayout({
        entries: [
            { visibility, binding: 0, buffer: { type: 'uniform' } },
            { visibility, binding: 1, buffer: { type: 'uniform' } },
            { visibility, binding: 2, buffer: { type: 'uniform' } },
            { visibility, binding: 3, buffer: { type: 'uniform' } },
            { visibility, binding: 4, buffer: { type: 'uniform' } },
            { visibility, binding: 5, buffer: { type: 'uniform' } }
        ]
    });
    const uniformsBuffersBindGroup = gpu.createBindGroup({
        layout: uniformsLayout,
        entries: [
            { binding: 0, resource: { buffer: rezBuffer } },
            { binding: 1, resource: { buffer: timeBuffer } },
            { binding: 2, resource: { buffer: countBuffer } },
            { binding: 3, resource: { buffer: radiusBuffer } },
            { binding: 4, resource: { buffer: numberOfColorsBuffer } },
            { binding: 5, resource: { buffer: matrixBuffer } }
        ]
    });
    const writeUniforms = () => {
        gpu.queue.writeBuffer(rezBuffer, 0, new Float32Array([uniforms.rez]));
        gpu.queue.writeBuffer(countBuffer, 0, new Uint32Array([uniforms.count]));
        gpu.queue.writeBuffer(radiusBuffer, 0, new Float32Array([uniforms.radius]));
        settings.agentWorkgroups = Math.ceil(uniforms.count / sizes.workGroupSize);
    };
    writeUniforms();
    // Other buffers
    const positionsBuffer = gpu.createBuffer({
        size: sizes.vec2 * uniforms.count,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    const velocitiesBuffer = gpu.createBuffer({
        size: sizes.vec2 * uniforms.count,
        usage: GPUBufferUsage.STORAGE
    });
    const colorsBuffer = gpu.createBuffer({
        size: sizes.u32 * uniforms.count,
        usage: GPUBufferUsage.STORAGE
    });
    const agentsLayout = gpu.createBindGroupLayout({
        entries: [
            { visibility, binding: 0, buffer: { type: 'storage' } },
            { visibility, binding: 1, buffer: { type: 'storage' } },
            { visibility, binding: 2, buffer: { type: 'storage' } }
        ]
    });
    const agentsBuffersBindGroup = gpu.createBindGroup({
        layout: agentsLayout,
        entries: [
            { binding: 0, resource: { buffer: positionsBuffer } },
            { binding: 1, resource: { buffer: velocitiesBuffer } },
            { binding: 2, resource: { buffer: colorsBuffer } }
        ]
    });
    /// //
    // Overall memory layout
    const layout = gpu.createPipelineLayout({
        bindGroupLayouts: [pixelBufferLayout, uniformsLayout, agentsLayout]
    });
    /// //////////////////////
    // Set up code instructions
    const module = await createShaderModule(gpu, '../../src/particle-life/particle-life.wgsl');
    const resetPipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: 'reset' }
    });
    const simulatePipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: 'simulate' }
    });
    const fadePipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: 'fade' }
    });
    /// //////////////////////
    // RUN the reset shader function
    const reset = () => {
        // generate random positions
        const positions = new Float32Array(uniforms.count * 2);
        for (let i = 0; i < uniforms.count; i++) {
            positions[i * 2] = (Math.random()) * uniforms.rez;
            positions[i * 2 + 1] = (Math.random()) * uniforms.rez;
        }
        gpu.queue.writeBuffer(positionsBuffer, 0, positions);
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
    /// //////////////////////
    // RUN the sim compute function and render pixels
    const draw = () => {
        // Compute sim function
        const encoder = gpu.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, pixelBufferBindGroup);
        pass.setBindGroup(1, uniformsBuffersBindGroup);
        pass.setBindGroup(2, agentsBuffersBindGroup);
        pass.setPipeline(fadePipeline);
        pass.dispatchWorkgroups(settings.pixelWorkgroups);
        pass.setPipeline(simulatePipeline);
        pass.dispatchWorkgroups(settings.agentWorkgroups);
        pass.end();
        // Render the pixels buffer to the canvas
        void render(gpu, uniforms.rez, pixelBuffer, format, context, encoder).then(() => {
            gpu.queue.submit([encoder.finish()]);
            gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array());
            requestAnimationFrame(draw);
        });
    };
    draw();
    const container = document.getElementById('guiContainer');
    if (container == null) {
        console.log('No GUI container found');
        return;
    }
    const buttonObj = {
        reset: () => {
            reset();
        }
    };
    const gui = new GUI({ container });
    gui.add(uniforms, 'radius').min(0.0).max(64);
    gui.add(uniforms, 'count').min(1).max(uniforms.count).step(1);
    gui.add(buttonObj, 'reset');
    gui.onChange(writeUniforms);
}
void main();
