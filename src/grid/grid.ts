import { WGPU } from '../wgpu.js'

async function main (): Promise<void> {
  const wgpu = await WGPU.init(2048, 2048)

  wgpu.render()
  const shaderModule = await wgpu.createShaderModule('../src/grid/grid.wgsl')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pipeline = wgpu.createComputePipeline(shaderModule, 'main')
}

void main()
