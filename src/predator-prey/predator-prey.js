import { createShaderModule, render } from "../lib.js";
/////////////////////////////////////////////////////////
// GPU and CPU Settings
// Sizes in bytes
const sizes = {
    f32: 4,
    vec2: 8,
    vec4: 16,
};
const uniforms = {
    rez: 2048,
    maxPredatorCount: 100,
    currentPredatorCount: 500,
    preyCount: 16000,
    time: 0,
};
// CPU-only settings
const settings = {
    scale: (0.85 * Math.min(window.innerHeight, window.innerWidth)) / uniforms.rez,
    pixelCount: uniforms.rez ** 2 * sizes.vec4,
    agentWorkGroups: 256,
};
/////////////////////////////////////////////////////////
// Main
async function main() {
    ///////////////////////
    // Initial setup
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        alert("No GPU found");
        return;
    }
    const gpu = await adapter.requestDevice();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = uniforms.rez * settings.scale;
    document.body.appendChild(canvas);
    const context = canvas.getContext("webgpu");
    if (!context) {
        alert("No WebGPU");
        return;
    }
    const format = "bgra8unorm";
    context.configure({
        device: gpu,
        format: format,
        alphaMode: "premultiplied",
    });
    /////////////////////////
    // Set up memory resources
    const visibility = GPUShaderStage.COMPUTE;
    // Pixel buffer
    const pixelBuffer = gpu.createBuffer({
        size: uniforms.rez ** 2 * sizes.vec4,
        usage: GPUBufferUsage.STORAGE,
    });
    const pixelBufferLayout = gpu.createBindGroupLayout({
        entries: [{ visibility, binding: 0, buffer: { type: "storage" } }],
    });
    const pixelBufferBindGroup = gpu.createBindGroup({
        layout: pixelBufferLayout,
        entries: [{ binding: 0, resource: { buffer: pixelBuffer } }],
    });
    // Uniform buffers
    const rezBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    gpu.queue.writeBuffer(rezBuffer, 0, new Float32Array([uniforms.rez]));
    const frameCountBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    gpu.queue.writeBuffer(frameCountBuffer, 0, new Float32Array([uniforms.time]));
    const currentPredatorCountBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    gpu.queue.writeBuffer(currentPredatorCountBuffer, 0, new Float32Array([uniforms.currentPredatorCount]));
    const preyCountBuffer = gpu.createBuffer({
        size: sizes.f32,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    gpu.queue.writeBuffer(preyCountBuffer, 0, new Float32Array([uniforms.preyCount]));
    const mouseBuffer = gpu.createBuffer({
        size: sizes.vec2,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    gpu.queue.writeBuffer(mouseBuffer, 0, new Float32Array([0, 0]));
    const uniformsLayout = gpu.createBindGroupLayout({
        entries: [
            { visibility, binding: 0, buffer: { type: "uniform" } },
            { visibility, binding: 1, buffer: { type: "uniform" } },
            { visibility, binding: 2, buffer: { type: "uniform" } },
            { visibility, binding: 3, buffer: { type: "uniform" } },
            { visibility, binding: 4, buffer: { type: "uniform" } },
        ],
    });
    const uniformsBuffersBindGroup = gpu.createBindGroup({
        layout: uniformsLayout,
        entries: [
            { binding: 0, resource: { buffer: rezBuffer } },
            { binding: 1, resource: { buffer: frameCountBuffer } },
            { binding: 2, resource: { buffer: currentPredatorCountBuffer } },
            { binding: 3, resource: { buffer: preyCountBuffer } },
            { binding: 4, resource: { buffer: mouseBuffer } },
        ],
    });
    // Other buffers
    const predatorBuffer = gpu.createBuffer({
        size: sizes.vec4 * uniforms.maxPredatorCount,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const predatorSizeBuffer = gpu.createBuffer({
        size: sizes.f32 * uniforms.maxPredatorCount,
        usage: GPUBufferUsage.STORAGE,
    });
    const preyBuffer = gpu.createBuffer({
        size: sizes.vec4 * uniforms.preyCount,
        usage: GPUBufferUsage.STORAGE,
    });
    const preyStatesBuffer = gpu.createBuffer({
        size: sizes.f32 * uniforms.preyCount,
        usage: GPUBufferUsage.STORAGE,
    });
    const agentsLayout = gpu.createBindGroupLayout({
        entries: [
            { visibility, binding: 0, buffer: { type: "storage" } },
            { visibility, binding: 1, buffer: { type: "storage" } },
            { visibility, binding: 2, buffer: { type: "storage" } },
            { visibility, binding: 3, buffer: { type: "storage" } },
        ],
    });
    const agentsBuffersBindGroup = gpu.createBindGroup({
        layout: agentsLayout,
        entries: [
            { binding: 0, resource: { buffer: predatorBuffer } },
            { binding: 1, resource: { buffer: predatorSizeBuffer } },
            { binding: 2, resource: { buffer: preyBuffer } },
            { binding: 3, resource: { buffer: preyStatesBuffer } },
        ],
    });
    /////
    // Overall memory layout
    const layout = gpu.createPipelineLayout({
        bindGroupLayouts: [pixelBufferLayout, uniformsLayout, agentsLayout],
    });
    /////////////////////////
    // Set up code instructions
    const module = await createShaderModule(gpu, "../../src/predator-prey/agents.wgsl");
    const resetPipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: "reset" },
    });
    const predatorPipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: "predatorSim" },
    });
    const preyPipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: "preySim" },
    });
    const fadePipeline = gpu.createComputePipeline({
        layout,
        compute: { module, entryPoint: "fade" },
    });
    /////////////////////////
    // RUN the reset shader function
    const reset = () => {
        const encoder = gpu.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(resetPipeline);
        pass.setBindGroup(0, pixelBufferBindGroup);
        pass.setBindGroup(1, uniformsBuffersBindGroup);
        pass.setBindGroup(2, agentsBuffersBindGroup);
        pass.dispatchWorkgroups(Math.max(uniforms.preyCount, uniforms.maxPredatorCount) /
            settings.agentWorkGroups);
        pass.end();
        gpu.queue.submit([encoder.finish()]);
    };
    reset();
    const mouse = { x: 0, y: 0 };
    const canvasRect = canvas.getBoundingClientRect();
    document.addEventListener("mousemove", (e) => {
        mouse.x = (e.clientX - canvasRect.left) / settings.scale;
        mouse.y = (e.clientY - canvasRect.top) / settings.scale;
    });
    // mouse click
    document.addEventListener("click", (e) => {
        mouse.x = (e.clientX - canvasRect.left) / settings.scale;
        mouse.y = (e.clientY - canvasRect.top) / settings.scale;
        uniforms.currentPredatorCount += 1;
        gpu.queue.writeBuffer(currentPredatorCountBuffer, 0, new Float32Array([uniforms.currentPredatorCount]));
        gpu.queue.writeBuffer(predatorBuffer, sizes.vec4 * (uniforms.currentPredatorCount - 1), new Float32Array([mouse.x, mouse.y, 1.0, 1.0]));
        console.log("click", mouse.x, mouse.y, uniforms.currentPredatorCount);
    });
    /////////////////////////
    // RUN the sim compute function and render pixels
    const draw = () => {
        gpu.queue.writeBuffer(mouseBuffer, 0, new Float32Array([mouse.x, mouse.y]));
        // Compute sim function
        const encoder = gpu.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, pixelBufferBindGroup);
        pass.setBindGroup(1, uniformsBuffersBindGroup);
        pass.setBindGroup(2, agentsBuffersBindGroup);
        pass.setPipeline(predatorPipeline);
        pass.dispatchWorkgroups(Math.ceil(uniforms.maxPredatorCount / settings.agentWorkGroups));
        pass.setPipeline(preyPipeline);
        pass.dispatchWorkgroups(Math.ceil(uniforms.preyCount / settings.agentWorkGroups));
        pass.setPipeline(fadePipeline);
        pass.dispatchWorkgroups(Math.ceil(uniforms.rez / 16), Math.ceil(uniforms.rez / 16));
        pass.end();
        // Render the pixels buffer to the canvas
        render(gpu, uniforms.rez, pixelBuffer, format, context, encoder);
        gpu.queue.submit([encoder.finish()]);
        gpu.queue.writeBuffer(frameCountBuffer, 0, new Float32Array([uniforms.time++]));
        requestAnimationFrame(draw);
    };
    draw();
}
main();
