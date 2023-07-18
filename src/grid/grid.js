import { WGPU } from '../wgpu.js';
async function main() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const wgpu = new WGPU(2048, 2048);
    const shaderModule = await wgpu.createShaderModule('../src/grid/grid.wgsl');
    const pipeline = wgpu.createComputePipeline(shaderModule, 'main');
}
void main();
