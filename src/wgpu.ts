import { load_file } from "./lib.js";

export class WGPU {
    device!: GPUDevice;
    context!: GPUCanvasContext;
    swapChainFormat!: GPUTextureFormat;
    canvas: HTMLCanvasElement;
    renderContext!: RenderContext;
    


    ////////////////////////////////////////
    // Initial setup of WebGPU
    constructor(width: number, height: number) {
        // Create the canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        document.body.appendChild(canvas!);
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        this.swapChainFormat = 'bgra8unorm';


        // Initialize webGPU
        this.init().then(() => {
            console.log("WebGPU initialized.");
        }).catch((error) => {
            console.error("Error initializing WebGPU: ", error);
        });
    }

    private async init() {
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

        const outTexture = this.createTexture();

        const quadShader = await this.compileShader(
            "../src/quad.wgsl"
        );
        this.renderContext.renderPipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: quadShader,
                entryPoint: "vert",
            },
            fragment: {
                module: quadShader,
                entryPoint: "frag",
                targets: [
                    {
                        format: this.swapChainFormat,
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
            },
        });

        const sampler = this.device.createSampler({
            magFilter: "nearest",
            minFilter: "nearest",
        });
        this.renderContext.planeBindGroup = await this.createBindGroup({
            pipeline: this.renderContext.renderPipeline,
            group: 0,
            bindings: [sampler, outTexture.createView()],
        });
    }

    ////////////////////////////////////////
    // Compile a shader
    async compileShader(file: string): Promise<GPUShaderModule> {
        let code = await load_file(file);

        const shaderModule = this.device.createShaderModule({
            code: code!,
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
    createTexture(usage: GPUTextureUsageFlags =
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT
    ): GPUTexture {

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

    ////////////////////////////////////////
    // Create a buffer
    createBuffer(size: number, usage: GPUBufferUsageFlags): GPUBuffer {
        const buffer = this.device.createBuffer({
            size,
            usage: usage,
            mappedAtCreation: true,
        });
        return buffer;
    }

    ////////////////////////////////////////
    // Set buffer data
    setBufferData(buffer: GPUBuffer, data: ArrayBufferView) {
        const writeArray = new Uint8Array(buffer.getMappedRange());
        writeArray.set(data as any);
        buffer.unmap();
    }

    ////////////////////////////////////////
    // Create a compute pipeline given a WGSL file and entry function
    createComputePipeline = async (file: string, fn: string) => {
        const shaderModule = await this.compileShader(file);
        const computePipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: fn,
            },
        });
        return computePipeline;
    };

    ///////////////////////
    // Create a bind group given an array of bindings
    // handles errors


    createBindGroup = async (settings: BindGroupSettings): Promise<GPUBindGroup> => {
        this.device.pushErrorScope("validation");

        const entries: GPUBindGroupEntry[] = settings.bindings.map((entry, i) => {

            let resource: GPUBindingResource;

            if (entry instanceof GPUBuffer) {
                resource = {
                    buffer: entry,
                    size: entry.size,
                    offset: 0,
                };
            } else if (
                entry instanceof GPUTextureView ||
                entry instanceof GPUTexture ||
                entry instanceof GPUExternalTexture ||
                entry instanceof GPUSampler
            ) {
                resource = entry;
            } else {
                console.log("unhandled", entry);
                return;
            }

            return {
                binding: i,
                resource,
            };
        }).filter((e) => e !== undefined) as GPUBindGroupEntry[];

        const bg = this.device.createBindGroup({
            layout: settings.pipeline.getBindGroupLayout(settings.group),
            entries: entries,
        });

        let error = await this.device.popErrorScope();
        if (error) {
            console.warn(error.message);
            throw new Error(`Could not create bind group`);
        }

        return bg;
    };

    ////////////////////////////////////////
    // render the texture to the canvas
    dispatchRenderPass = async (commandEncoder: GPUCommandEncoder) => {
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });
        renderPass.setPipeline(this.renderContext.renderPipeline);
        renderPass.setBindGroup(0, this.renderContext.planeBindGroup);
        renderPass.draw(6, 1, 0, 0);
        renderPass.end();
    };


    ////////////////////////////////////////
    // dispatch a compute pass
    dispatchComputePass = () => {
        // TODO: dispatch compute pass
        throw new Error("Not implemented");
    }
}

interface BindGroupSettings {
    bindings: (GPUBuffer | GPUTextureView | GPUSampler | GPUExternalTexture)[];
    pipeline: GPUComputePipeline | GPURenderPipeline;
    group: number;  // replace with the appropriate type
}

interface RenderContext {
    renderPipeline: GPURenderPipeline;
    planeBindGroup: GPUBindGroup;
}
