import { WGPU } from '../wgpu.js';
async function main() {
    const wgpu = await WGPU.init();
    // Handle device lost
    void wgpu.device.lost.then((info) => {
        console.error('WebGPU device lost: ', info.message);
        if (info.reason !== 'destroyed') {
            // Try again
            void main();
        }
    });
}
void main();
