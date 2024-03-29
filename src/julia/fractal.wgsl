// Pixels
@group(0) @binding(0)  
  var<storage, read_write> pixels : array<vec4f>;

// Uniforms
@group(1) @binding(0) 
  var<uniform> rez : f32;

@group(1) @binding(1) 
  var<uniform> time : f32;

@group(1) @binding(2) 
  var<uniform> xmin_ymin: vec2f;

@group(1) @binding(3) 
  var<uniform> dxdy: vec2f;

@group(1) @binding(4) 
  var<uniform> mouse: vec2f;

// Agent positions
@group(2) @binding(0)  
  var<storage, read_write> positions : array<vec2f>;

// Agent velocities
@group(2) @binding(1)  
  var<storage, read_write> velocities : array<vec2f>;

const juliaXMin = -0.82580000000000;
const juliaXMax = -0.0580000000000;
const juliaXDiff = juliaXMax - juliaXMin;
const juliaYMin = 0.40250000000000;
const juliaYMax = 0.70250000000000;
const juliaYDiff = juliaYMax - juliaYMin;
const juliaStepSize = 0.0005;

fn r(n: f32) -> f32 {
  let x = sin(n) * 43758.5453;
  return fract(x);
}

fn index(p: vec2f) -> i32 {
  return i32(p.x) + i32(p.y) * i32(rez);
}

fn  mandelbrot(c: vec2f, j: vec2f) -> vec4f {
  var z = vec2f(c.x, c.y);
  var i = 0;
  while (i < 200) {
    z = vec2f(z.x * z.x - z.y * z.y, 2 * z.x * z.y) + vec2f(j.x, j.y);
    if (length(z) > 4) {
      break;
    }
    i += 1;
  }
  return vec4f((f32(i)/ 200.0), (f32(i)/ 200.0), (f32(i)/ 200.0), 1);
}

@compute @workgroup_size(256)
fn reset(@builtin(global_invocation_id) id : vec3u) {
  var x = r(f32(id.x));
  var y = r(f32(id.x) * 2);
  var p = vec2(x, y);
  p *= rez;
  positions[id.x] = p;

  velocities[id.x] = vec2(r(f32(id.x+1)), r(f32(id.x + 2))) - 0.5;
}

@compute @workgroup_size(256)
fn simulate(@builtin(global_invocation_id) id : vec3u) {
  var y = xmin_ymin.y  + f32(id.x)/rez * dxdy.y;
  var x = xmin_ymin.x  + f32(id.x)%rez * dxdy.x;
  var juliaX = juliaXMin + (mouse.x * juliaStepSize * juliaXDiff) ;
  var juliaY = juliaYMin + (mouse.y * juliaStepSize * juliaYDiff) ;

  pixels[id.x] = mandelbrot(vec2(x, y), vec2(juliaX, juliaY));
}