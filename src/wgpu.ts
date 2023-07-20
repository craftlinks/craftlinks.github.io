import { load_file } from './lib.js'

export class WGPU {
  device!: GPUDevice
  context!: GPUCanvasContext
  canvasFormat!: GPUTextureFormat
  canvas!: HTMLCanvasElement
  render!: () => void

  /// /////////////////////////////////////
  // Initial setup of WebGPU

  static async init (width: number, height: number): Promise<WGPU> {
    const wgpu = new WGPU()
    const adapter = await navigator.gpu?.requestAdapter()
    const device = await adapter?.requestDevice()

    if (adapter == null || device == null) {
      throw new Error('WebGPU not supported')
    }
    wgpu.device = device

    await wgpu.showGPUInfo(adapter)

    wgpu.canvas = document.createElement('canvas')
    if (wgpu.canvas == null) {
      throw new Error('Failed to create canvas')
    }
    wgpu.canvas.width = width
    wgpu.canvas.height = height
    document.body.appendChild(wgpu.canvas)
    wgpu.context = wgpu.canvas.getContext('webgpu') as GPUCanvasContext
    wgpu.canvasFormat = navigator.gpu.getPreferredCanvasFormat() // 'bgra8unorm'

    wgpu.context.configure({
      device: wgpu.device,
      format: wgpu.canvasFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      alphaMode: 'premultiplied'
    })

    const outTexture = wgpu.createTexture()

    const quadShader = await wgpu.createShaderModule(
      '../src/quad.wgsl', 'quad shader'
    )

    const renderPipeline = wgpu.device.createRenderPipeline({
      label: 'quad render pipeline',
      layout: 'auto',
      vertex: {
        module: quadShader,
        entryPoint: 'vs'
      },
      fragment: {
        module: quadShader,
        entryPoint: 'fs',
        targets: [
          {
            format: wgpu.canvasFormat // @location(0)
          }
        ]
      },
      primitive: {
        topology: 'triangle-list'
      }
    })

    const sampler = wgpu.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest'
    })

    const planeBindGroup = await wgpu.createBindGroup({
      pipeline: renderPipeline,
      group: 0,
      bindings: [sampler, outTexture.createView()]
    })

    wgpu.render = (): void => {
      const encoder = wgpu.device.createCommandEncoder({ label: 'quad encoder' })
      const renderPass = encoder.beginRenderPass({
        label: 'quad shader render pass',
        colorAttachments: [ // list of textures we are rendering to
          {
            view: wgpu.context.getCurrentTexture().createView(), // canvas texture
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store'
          }
        ]
      })
      renderPass.setPipeline(renderPipeline)
      renderPass.setBindGroup(0, planeBindGroup)
      renderPass.draw(6, 1, 0, 0)
      renderPass.end()

      const commandBuffer = encoder.finish()
      wgpu.device.queue.submit([commandBuffer])
    }

    return wgpu
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
  async createShaderModule (file: string, label?: string): Promise<GPUShaderModule> {
    const code = await load_file(file)

    const shaderModule = this.device.createShaderModule({
      label,
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
