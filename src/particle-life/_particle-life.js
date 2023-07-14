import { WGPU } from "../wgpu.js";
import GUI from '../lil-gui.esm.js';
/////////////////////////////////////////////////////////
// GPU and CPU Settings
// Sizes in bytes
const sizes = {
    f32: 4,
    u32: 4,
    i32: 4,
    vec2: 8,
    vec4: 16,
    workGroupSize: 32,
};
const uniforms = {
    rez: 512,
    time: 0,
    radius: 50,
    count: 15000,
    number_of_colors: 3,
};
const scale = 0.95;
const min = Math.min(window.innerHeight, window.innerWidth);
const width = min * scale;
const height = min * scale;
const agent_types = 3;
const PixelBuffer = (wgpu) => {
    const pixelBuffer = wgpu.device.createBuffer({
        size: uniforms.rez ** 2 * sizes.vec4,
        usage: GPUBufferUsage.STORAGE,
    });
    return pixelBuffer;
};
const AgenstsBuffer = (wgpu) => {
    const stride = 6;
    const agents = new Float32Array(uniforms.count * stride);
    for (let i = 0; i < uniforms.count; i++) {
        let offset = 0;
        // Random position
        agents[i * stride + offset++] = Math.random() * uniforms.rez;
        agents[i * stride + offset++] = Math.random() * uniforms.rez;
        // Velocity
        agents[i * stride + offset++] = 0.0;
        agents[i * stride + offset++] = 0.0;
        // agent type
        agents[i * stride + offset++] = Math.round(Math.random() * agent_types);
    }
    const agentsBuffer = wgpu.device.createBuffer({
        size: agents.byteLength,
        usage: GPUBufferUsage.STORAGE,
        mappedAtCreation: true,
    });
    wgpu.setBufferData(agentsBuffer, agents);
    return agentsBuffer;
};
const UniformsBuffer = (wgpu) => {
    const _uniform = new Float32Array([uniforms.rez, uniforms.time, uniforms.radius, uniforms.count, uniforms.number_of_colors]);
    const uniformsBuffer = wgpu.device.createBuffer({
        size: _uniform.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    wgpu.setBufferData(uniformsBuffer, _uniform);
    return uniformsBuffer;
};
const AgentsInteractionsBuffer = (wgpu) => {
    const agentInteractions = new Float32Array(uniforms.count ** 2);
    for (let i = 0; i < uniforms.count; i++) {
        for (let j = 0; j < uniforms.count; j++) {
            agentInteractions[i * uniforms.count + j] = Math.random() * 2 - 1;
        }
    }
    const agentInteractionsBuffer = wgpu.device.createBuffer({
        size: agentInteractions.byteLength,
        usage: GPUBufferUsage.STORAGE,
        mappedAtCreation: true,
    });
    wgpu.setBufferData(agentInteractionsBuffer, agentInteractions);
    return agentInteractionsBuffer;
};
/////////////////////////////////////////////////////////
// Main
async function main() {
    // Create a WGPU instance
    const wgpu = await new WGPU(width, height);
    // Create and initialize buffers
    const agentsBuffer = AgenstsBuffer(wgpu);
    const uniformsBuffer = UniformsBuffer(wgpu);
    const agentInteractionsBuffer = AgentsInteractionsBuffer(wgpu);
    const pixelBuffer = PixelBuffer(wgpu);
    const outTexture = wgpu.createTexture();
    // Create compute pipelines
    const shaderModule = await wgpu.compileShader("particle-life.wgsl");
    const resetPipeline = await wgpu.createComputePipeline(shaderModule, "reset");
    const simulatePipeline = await wgpu.createComputePipeline(shaderModule, "simulate");
    const fadePipeline = await wgpu.createComputePipeline(shaderModule, "fade");
    // Create bindgroups
    const resetBindGroup = await wgpu.createBindGroup({
        pipeline: resetPipeline,
        bindings: [
            pixelBuffer,
            agentsBuffer,
            uniformsBuffer,
        ],
        group: 0,
    });
    const simulateBindGroup = await wgpu.createBindGroup({
        pipeline: resetPipeline,
        bindings: [
            pixelBuffer,
            agentsBuffer,
            uniformsBuffer,
        ],
        group: 0,
    });
    const fadeBindGroup = await wgpu.createBindGroup({
        pipeline: resetPipeline,
        bindings: [
            pixelBuffer,
            agentsBuffer,
            uniformsBuffer,
        ],
        group: 0,
    });
    const encoder = wgpu.device.createCommandEncoder();
    encoder.copyTextureToTexture();
    /////////////////////////
    // RUN the reset shader function
    const reset = () => {
    };
    reset();
    /////////////////////////
    // RUN the sim compute function and render pixels
    const draw = () => {
        requestAnimationFrame(draw);
    };
    draw();
    let container = document.getElementById("guiContainer");
    if (!container) {
        console.log("No GUI container found");
        return;
    }
    let buttonObj = {
        reset: () => {
            reset();
        }
    };
    let gui = new GUI({ container: container });
    // gui.add(uniforms, "radius").min(0.0).max(64);
    // gui.add(uniforms, "count").min(1).max(uniforms.count).step(1);
    // gui.add(buttonObj, "reset");
    // gui.onChange(writeUniforms);
}
main();
