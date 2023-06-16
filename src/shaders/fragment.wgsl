 @group(0) @binding(0)  
var<storage, read_write> pixels : array<vec4f>;

@group(1) @binding(0) 
var<uniform> rez : f32;


@fragment
fn frag(@location(0) fragUV : vec2f) -> @location(0) vec4f {
    var color = vec4(0, 0, 0, 1.0);
    color += pixels[i32((fragUV.x * rez) + floor(fragUV.y * rez) * rez)];
    return color;
}