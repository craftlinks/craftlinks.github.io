
const load = async (path: string) => {
    try {
        const response = await fetch(path);
        if (response.ok) {
            const content = await response.text();
            return content;
        } else {
            throw new Error(`Error loading: ${path}`);
        }
    } catch (error) {
        console.error(error);
    }
};

const createShaderModule = async (gpu: GPUDevice, file: string) => {
    const code = await load(file);
    if (!code) {
        throw new Error(`Could not load ${file}`);
    }
    const module = gpu.createShaderModule({ code });
    const info = await module.getCompilationInfo();
    if (info.messages.length > 0) {
        for (let message of info.messages) {
            console.warn(`${message.message} 
    at ${file} line ${message.lineNum}`);
        }
        throw new Error(`Could not compile ${file}`);
    }
    return module;
};

let rp: (commandEncoder: GPUCommandEncoder) => void;
const render = async (gpu: GPUDevice, resolution: number, buffer: GPUBuffer, format: GPUTextureFormat, context: GPUCanvasContext, commandEncoder: GPUCommandEncoder) => {
   
    if (rp) {
        rp(commandEncoder);
        return;
    }

    // shader will be generated once, then reused.
    let textureShader = gpu.createShaderModule({
        code: `
        @group(0) @binding(0)  
        var<storage, read_write> pixels : array<vec4f>;
  
        struct VertexOutput {
          @builtin(position) vertexPosition : vec4f,
            @location(0) UV : vec2f,
        }
        
        @vertex
        fn vert(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
        
          const vertices = array(
            vec2( 1.0,  1.0),
            vec2( 1.0, -1.0),
            vec2(-1.0, -1.0),
            vec2( 1.0,  1.0),
            vec2(-1.0, -1.0),
            vec2(-1.0,  1.0),
          );
        
          const uv = array(
            vec2(1.0, 0.0),
            vec2(1.0, 1.0),
            vec2(0.0, 1.0),
            vec2(1.0, 0.0),
            vec2(0.0, 1.0),
            vec2(0.0, 0.0),
          );
  
          var output : VertexOutput;
          output.vertexPosition = vec4(vertices[VertexIndex], 0.0, 1.0);
          output.UV = uv[VertexIndex];
          return output;
        }
        
        @fragment
        fn frag(@location(0) UV : vec2f) -> @location(0) vec4f {
          var color = vec4(1.0, 1.0, 1.0, 1.0);
          color = pixels[i32((UV.x * ${resolution}) + floor(UV.y * ${resolution}) * ${resolution})];
          return color;
        }
      `,
    });

    const renderPipeline = gpu.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: textureShader,
            entryPoint: "vert",
        },
        fragment: {
            module: textureShader,
            entryPoint: "frag",
            targets: [
                {
                    format: format,
                },
            ],
        },
        primitive: {
            topology: "triangle-list",
        },
    });

    const bindGroup = gpu.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: buffer,
                    offset: 0,
                    size: resolution * resolution * 16,
                },
            },
        ],
    });

    rp = (commandEncoder: GPUCommandEncoder) => {
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 255.0, g: 255.0, b: 255.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, bindGroup);

        renderPass.draw(6, 1, 0, 0);
        renderPass.end();
    };

    rp(commandEncoder);
};

export { createShaderModule, render };
