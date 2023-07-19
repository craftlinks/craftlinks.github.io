import { load_file } from './lib.js'

export class WGPU {
  device!: GPUDevice
  context!: GPUCanvasContext
  swapChainFormat!: GPUTextureFormat
  canvas!: HTMLCanvasElement
  renderContext!: RenderContext

  /// /////////////////////////////////////
  // Initial setup of WebGPU
  constructor (width: number, height: number) {
    // Initialize webGPU
    this.init(width, height).then(() => {
      console.log('WebGPU initialized.')
    }).catch((error) => {
      console.error('Error initializing WebGPU: ', error)
    })
  }

  private async init (width: number, height: number): Promise<void> {
    if (navigator.gpu === undefined || navigator.gpu === null) {
      throw new Error('WebGPU not supported')
    }
    const adapter = await navigator.gpu.requestAdapter()
    if (adapter === null) {
      throw new Error("Couldn't request WebGPU adapter.")
    }

    await this.showGPUInfo(adapter)

    this.device = await adapter.requestDevice()
    // Create the canvas
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    if (this.canvas == null) {
      throw new Error('Failed to create canvas')
    }
    document.body.appendChild(this.canvas)

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext
    this.swapChainFormat = navigator.gpu.getPreferredCanvasFormat() // 'bgra8unorm'

    this.context.configure({
      device: this.device,
      format: this.swapChainFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      alphaMode: 'premultiplied'
    })

    const outTexture = this.createTexture()

    const quadShader = await this.createShaderModule(
      '../src/quad.wgsl'
    )

    const renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: quadShader,
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: quadShader,
        entryPoint: 'fragmentMain',
        targets: [
          {
            format: this.swapChainFormat
          }
        ]
      },
      primitive: {
        topology: 'triangle-list'
      }
    })

    const sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest'
    })
    const planeBindGroup = await this.createBindGroup({
      pipeline: renderPipeline,
      group: 0,
      bindings: [sampler, outTexture.createView()]
    })

    const renderPass = (commandEncoder: GPUCommandEncoder): GPURenderPassEncoder => {
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store'
          }
        ]
      })
      renderPass.setPipeline(this.renderContext.renderPipeline)
      renderPass.setBindGroup(0, this.renderContext.planeBindGroup)
      renderPass.draw(6, 1, 0, 0)
      renderPass.end()
      return renderPass
    }

    this.renderContext = {
      renderPipeline,
      planeBindGroup,
      renderPass
    }
  }

  private async showGPUInfo (adapter: GPUAdapter): Promise<void> {
    const info: GPUAdapterInfo = await adapter.requestAdapterInfo()
    console.log('GPU Information:')
    console.log('Vendor: ', info.vendor)
    console.log('Architecture: ', info.architecture)
    console.log('Limits:')
    let i: keyof GPUSupportedLimits
    for (i in adapter.limits) {
      console.log(' ', i, adapter.limits[i])
    }

    console.log('Features: ')
    adapter.features.forEach((feature) => {
      console.log(' ', feature)
    })
  }

  /// /////////////////////////////////////
  // Compile a shader
  async createShaderModule (file: string): Promise<GPUShaderModule> {
    const code = await load_file(file)

    const shaderModule = this.device.createShaderModule({
      code
    })

    const compilationInfo = await shaderModule.getCompilationInfo()

    if (compilationInfo.messages.length > 0) {
      compilationInfo.messages.forEach(msg => {
        console.error(`${msg.message} at ${file}:${msg.lineNum}:${msg.linePos}`)
      })

      throw new Error(`Shader compilation failed for ${file}`)
    }
    return shaderModule
  }

  /// /////////////////////////////////////
  // Create a texture
  createTexture (usage?: GPUTextureUsageFlags
  ): GPUTexture {
    usage ||=
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT

    const texture = this.device.createTexture({
      size: {
        width: this.canvas.width,
        height: this.canvas.height
      },
      format: 'rgba8unorm',
      usage
    })
    return texture
  }

  /// /////////////////////////////////////
  // Create a buffer
  createBuffer (size: number, usage: GPUBufferUsageFlags): GPUBuffer {
    const buffer = this.device.createBuffer({
      size,
      usage,
      mappedAtCreation: true
    })
    return buffer
  }

  /// /////////////////////////////////////
  // Set buffer data
  setBufferData (buffer: GPUBuffer, data: ArrayBufferView): void {
    const writeArray = new Uint8Array(buffer.getMappedRange())
    writeArray.set(data as any)
    buffer.unmap()
  }

  /// /////////////////////////////////////
  // Create a compute pipeline given a WGSL file and entry function
  createComputePipeline = (module: GPUShaderModule, fn: string): GPUComputePipeline => {
    const computePipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module,
        entryPoint: fn
      }
    })
    return computePipeline
  }

  /// ////////////////////
  // Create a bind group given an array of bindings
  // handles errors

  createBindGroup = async (settings: BindGroupSettings): Promise<GPUBindGroup> => {
    this.device.pushErrorScope('validation')

    const entries: GPUBindGroupEntry[] = settings.bindings.filter((entry) => (
      entry instanceof GPUBuffer ||
      entry instanceof GPUTextureView ||
      entry instanceof GPUTexture ||
      entry instanceof GPUExternalTexture ||
      entry instanceof GPUSampler
    )).map((entry, i) => {
      let resource: GPUBindingResource

      if (entry instanceof GPUBuffer) {
        resource = {
          buffer: entry,
          size: entry.size,
          offset: 0
        }
      } else {
        resource = entry
      }
      return {
        binding: i,
        resource
      }
    })

    const bg = this.device.createBindGroup({
      layout: settings.pipeline.getBindGroupLayout(settings.group),
      entries
    })

    const error = await this.device.popErrorScope()
    if (error != null) {
      console.warn(error.message)
      throw new Error('Could not create bind group')
    }
    return bg
  }

  /// /////////////////////////////////////
  // render the texture to the canvas
  dispatchRenderPass = async (commandEncoder: GPUCommandEncoder): Promise<void> => {
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    })
    renderPass.setPipeline(this.renderContext.renderPipeline)
    renderPass.setBindGroup(0, this.renderContext.planeBindGroup)
    renderPass.draw(6, 1, 0, 0)
    renderPass.end()
  }

  /// /////////////////////////////////////
  // dispatch a compute pass
  dispatchComputePass = (settings: ComputePassSettings): void => {
    const computePass = settings.encoder.beginComputePass()
    computePass.setPipeline(settings.pipeline)
    computePass.setBindGroup(0, settings.bindGroup)
    computePass.dispatchWorkgroups(...settings.workGroups)
    computePass.end()
  }
}

interface BindGroupSettings {
  pipeline: GPUComputePipeline | GPURenderPipeline
  bindings: Array<GPUBuffer | GPUTextureView | GPUSampler | GPUExternalTexture>
  group: number
}

interface ComputePassSettings {
  pipeline: GPUComputePipeline
  bindGroup: GPUBindGroup
  workGroups: [number, number, number]
  encoder: GPUCommandEncoder
}

interface RenderContext {
  renderPipeline: GPURenderPipeline
  planeBindGroup: GPUBindGroup
  renderPass: (commandEncoder: GPUCommandEncoder) => GPURenderPassEncoder
}
