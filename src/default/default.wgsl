// Fork from https://compute.toys/view/21

// PRELUDE

alias int = i32;
alias uint = u32;
alias float = f32;
alias int2 = vec2<i32>;
alias int3 = vec3<i32>;
alias int4 = vec4<i32>;
alias uint2 = vec2<u32>;
alias uint3 = vec3<u32>;
alias uint4 = vec4<u32>;
alias float2 = vec2<f32>;
alias float3 = vec3<f32>;
alias float4 = vec4<f32>;
alias bool2 = vec2<bool>;
alias bool3 = vec3<bool>;
alias bool4 = vec4<bool>;
alias float2x2 = mat2x2<f32>;
alias float2x3 = mat2x3<f32>;
alias float2x4 = mat2x4<f32>;
alias float3x2 = mat3x2<f32>;
alias float3x3 = mat3x3<f32>;
alias float3x4 = mat3x4<f32>;
alias float4x2 = mat4x2<f32>;
alias float4x3 = mat4x3<f32>;
alias float4x4 = mat4x4<f32>;

struct Time { frame: uint, elapsed: float, delta: float }
struct Mouse { pos: uint2, click: int }
struct DispatchInfo { id: uint }
struct Custom {
    Radius: float,
    Sine1: float,
    Sine2: float,
    Speed: float,
    Blur: float,
    Samples: float,
    Mode: float,
};
struct Data {
    _dummy: array<u32,1>,
};

// @group(0) @binding(2) var<uniform> time: Time;
// @group(0) @binding(3) var<uniform> mouse: Mouse;
// @group(0) @binding(4) var<uniform> _keyboard: array<vec4<u32>,2>;
// @group(0) @binding(5) var<uniform> custom: Custom;
// @group(0) @binding(6) var<storage,read> data: Data;
// @group(0) @binding(7) var<storage,read_write> _assert_counts: array<atomic<u32>>;
// @group(0) @binding(8) var<uniform> dispatch: DispatchInfo;
// @group(0) @binding(9) var screen: texture_storage_2d<rgba16float,write>;
// @group(0) @binding(10) var pass_in: texture_2d_array<f32>;
// @group(0) @binding(11) var pass_out: texture_storage_2d_array<rgba16float,write>;
// @group(0) @binding(12) var channel0: texture_2d<f32>;
// @group(0) @binding(13) var channel1: texture_2d<f32>;
// @group(0) @binding(14) var nearest: sampler;
// @group(0) @binding(15) var bilinear: sampler;
// @group(0) @binding(16) var trilinear: sampler;
// @group(0) @binding(17) var nearest_repeat: sampler;
// @group(0) @binding(18) var bilinear_repeat: sampler;
// @group(0) @binding(19) var trilinear_repeat: sampler;

@group(0) @binding(0) var screen: texture_storage_2d<rgba16float,write>;

fn keyDown(keycode: uint) -> bool {
    return ((_keyboard[keycode / 128u][(keycode % 128u) / 32u] >> (keycode % 32u)) & 1u) == 1u;
}

fn assert(index: int, success: bool) {
    if (!success) {
        atomicAdd(&_assert_counts[index], 1u);
    }
}

fn passStore(pass_index: int, coord: int2, value: float4) {
    textureStore(pass_out, coord, pass_index, value);
}

fn passLoad(pass_index: int, coord: int2, lod: int) -> float4 {
    return textureLoad(pass_in, coord, pass_index, lod);
}

fn passSampleLevelBilinearRepeat(pass_index: int, uv: float2, lod: float) -> float4 {
    return textureSampleLevel(pass_in, bilinear, fract(uv), pass_index, lod);
}

// START SCRIPT 
@compute @workgroup_size(16, 16)
fn main_image(@builtin(global_invocation_id) id: uint3) {
    // Viewport resolution (in pixels)
    let screen_size = uint2(textureDimensions(screen));

    // Prevent overdraw for workgroups on the edge of the viewport
    if (id.x >= screen_size.x || id.y >= screen_size.y) { return; }

    // Pixel coordinates (centre of pixel, origin at bottom left)
    let fragCoord = float2(float(id.x) + .5, float(screen_size.y - id.y) - .5);

    // Normalised pixel coordinates (from 0 to 1)
    let uv = fragCoord / float2(screen_size);

    // Time varying pixel colour
    var col = .5 + .5 * cos(time.elapsed + uv.xyx + float3(0.,2.,4.));

    // Convert from gamma-encoded to linear colour space
    col = pow(col, float3(2.2));

    // Output to screen (linear colour space)
    textureStore(screen, int2(id.xy), float4(col, 1.));
}