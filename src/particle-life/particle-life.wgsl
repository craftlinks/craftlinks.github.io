// Pixels
@group(0) @binding(0)  
  var<storage, read_write> pixels : array<vec4f>;

// Uniforms
@group(1) @binding(0)  
  var<uniform> rez : f32;

@group(1) @binding(1) 
  var<uniform> time : f32;

@group(1) @binding(2)  
  var<uniform> count : u32;

@group(1) @binding(3)  
  var<uniform> radius : f32;

@group(1) @binding(4)  
  var<uniform> number_of_colors : u32;
// Matrix Buffer
struct wrapped_f32 {
  @size(16) elem: f32
}
struct Matrix {
  a: array<wrapped_f32,36> // stride 16
}

@group(1) @binding(5)  
  var<uniform> matrix : Matrix;

// Other buffers
@group(2) @binding(0)  
  var<storage, read_write> positions : array<vec2f>;

@group(2) @binding(1)  
  var<storage, read_write> velocities : array<vec2f>;

@group(2) @binding(2)  
  var<storage, read_write> colors : array<u32>;


const dt = 0.003;
const friction_half_life = 0.08;
const r_max = 6;
const friction_factor = pow(0.5, dt / friction_half_life);
const force_factor = 100;

fn hsv2rgb(h : f32, s: f32, v: f32) -> vec3f
// Converts a color from the HSV (Hue, Saturation, Value) color space to the RGB (Red, Green, Blue) color space.
// See https://en.wikipedia.org/wiki/HSL_and_HSV for more information, including pseudocode for this algorithm.
{
  var c = vec3(h, s, v);
  var K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  var p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, vec3(0.0), vec3(1.0)), c.y);
}

fn r(n: f32) -> f32 {
  let x = sin(n) * 43758.5453;
  return fract(x);
}

fn index(p: vec2f) -> i32 {
  return i32(p.x) + i32(p.y) * i32(rez);
}

@compute @workgroup_size(32)
fn reset(@builtin(global_invocation_id) id : vec3u) {
  let seed = f32(id.x)/f32(count);
  var p = vec2(r(seed), r(seed + 0.1));
  let color = u32(floor(r(seed) * f32(number_of_colors)));
  p *= rez;
  positions[id.x] = p;
  velocities[id.x] = vec2f(0.0, 0.0);
  colors[id.x] = color;

}

fn force(r: f32, a:f32) -> f32 {
  const beta = .3;
  if (r < beta) { return r / beta -1;}
  else if ( beta < r && r < 1) {
    return a * (r - abs(2.0 * r - 1.0 - beta)) / (1.0 - beta);
  }
  else {return 0.0;}
}

@compute @workgroup_size(32)
fn simulate(@builtin(global_invocation_id) id : vec3u) {
    var p = positions[id.x];
    var v = velocities[id.x];

    var totalForce = vec2f(0.0, 0.0);

  // For each other agent
  for (var i = 0u; i < count; i++) {
    if (i == id.x) { continue; } // ignore self
    var op = positions[i];  // other position
    let r = distance(p, op);

    if ( r < radius) {
      let f = force(r/radius, matrix.a[colors[id.x] * number_of_colors + colors[i]].elem);
      totalForce += f * normalize(p - op);
    }
  }

  totalForce *= radius * force_factor;

  velocities[id.x] *= friction_factor;
  velocities[id.x] += totalForce * dt;
  p += velocities[id.x] * dt;
  p = (p + rez) % rez;
  positions[id.x] = p ;

  const sizei = i32(3);
  for(var x = -sizei; x<= sizei; x++) {
    for(var y=-sizei; y<= sizei; y++) {
      let l = (length(vec2(f32(x), f32(y))));
      if(l < f32(sizei)) {
        pixels[index(p+vec2(f32(x), f32(y)))] += .90 * ( vec4(hsv2rgb((f32(colors[id.x] / (number_of_colors))), 1.0, 0.5), 1.0) * (1.0-l/f32(sizei)));
      }
    }
  }

  // Draw
  // pixels[index(p)] = vec4(hsv2rgb( (f32(colors[id.x] / (number_of_colors))), 1.0, 0.5), 1.0);
}

@compute @workgroup_size(32)
fn fade(@builtin(global_invocation_id) id : vec3u) {
  pixels[id.x] *= 0.35;
}