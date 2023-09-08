@group(0) @binding(0) var sampl : sampler;
@group(0) @binding(1) var texture : texture_2d<f32>;
      
struct VertexOutput {
@builtin(position) position : vec4f,
@location(0) UV : vec2f,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {

    const pos = array(
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
    output.position = vec4f(pos[ vertexIndex], 0.0, 1.0);
    output.UV = uv[ vertexIndex];
    return output;
}

@fragment
fn fs(@location(0) UV : vec2f) -> @location(0) vec4f {
    var color = textureSample(texture, sampl, UV);
    return color;
}