import { load_file } from "./lib.js";
export class WGPU {
    ////////////////////////////////////////
    // Initial setup of WebGPU
    constructor(width, height) {
        // Create the canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        document.body.appendChild(canvas);
        this.context = this.canvas.getContext('webgpu');
        this.swapChainFormat = 'bgra8unorm';
        // Initialize webGPU
        this.init().then(() => {
            console.log("WebGPU initialized.");
        }).catch((error) => {
            console.error("Error initializing WebGPU: ", error);
        });
    }
    async init() {
        // Check if WebGPU is supported
        if (!navigator.gpu) {
            console.log('WebGPU is not supported');
            throw 'WebGPU is not supported';
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.log('Failed to get an adapter');
            throw 'Failed to get an adapter';
        }
        this.device = await adapter.requestDevice();
        if (!this.device) {
            console.log('Failed to get a device');
            throw 'Failed to get a device';
        }
        this.context.configure({
            device: this.device,
            format: this.swapChainFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            alphaMode: "premultiplied",
        });
    }
    ////////////////////////////////////////
    // Compile a shader
    async compileShader(file) {
        let code = await load_file(file);
        const shaderModule = this.device.createShaderModule({
            code: code,
        });
        const compilationInfo = await shaderModule.getCompilationInfo();
        if (compilationInfo.messages.length > 0) {
            compilationInfo.messages.forEach(msg => {
                console.error(`${msg.message} at ${file}:${msg.lineNum}:${msg.linePos}`);
            });
            throw new Error(`Shader compilation failed for ${file}`);
        }
        return shaderModule;
    }
    ////////////////////////////////////////
    // Create a texture
    createTexture(usage = GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT) {
        const texture = this.device.createTexture({
            size: {
                width: this.canvas.width,
                height: this.canvas.height,
            },
            format: this.swapChainFormat,
            usage: usage,
        });
        return texture;
    }
}
