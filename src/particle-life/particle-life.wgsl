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

const tmp_nr_colors : u32 = 6;

// Other buffers
@group(2) @binding(0)  
  var<storage, read_write> positions : array<vec2f>;

@group(2) @binding(1)  
  var<storage, read_write> velocities : array<vec2f>;

@group(2) @binding(2)  
  var<storage, read_write> colors : array<u32>;

// TODO: color buffer ('matrix')

const dt = 0.2;
const friction_half_life = 0.04;
const r_max = 0.1;
const friction_factor = pow(0.5, dt / friction_half_life);
const matrix: array<array<f32, tmp_nr_colors>, tmp_nr_colors> = makeRandomMatrix(); // ERROR: "Cannot use function 'makeRandomMatrix' in global scope", so use buffer 
const force_factor = 10;

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

fn makeRandomMatrix() -> array<array<f32, tmp_nr_colors>, tmp_nr_colors> {
  var matrix: array<array<f32, tmp_nr_colors>, tmp_nr_colors>;
    for (var i = 0u; i < tmp_nr_colors; i++) {
        for (var j = 0u; j < tmp_nr_colors; j++) {
        matrix[i][j] = r(f32(i) + f32(j) * 0.1);
        }
    }
  return matrix;
}

fn index(p: vec2f) -> i32 {
  return i32(p.x) + i32(p.y) * i32(rez);
}

@compute @workgroup_size(32)
fn reset(@builtin(global_invocation_id) id : vec3u) {
  const seed = f32(id.x)/f32(count);
  var p = vec2(r(seed), r(seed + 0.1));
  const color = u32(floor(r(seed) * f32(tmp_nr_colors)));
  p *= rez;
  positions[id.x] = p;
  velocities[id.x] = vec2f(0.0, 0.0);
  colors[id.x] = color;

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
    const r = distance(p, op);

    if ( r < radius) {
      const f = force(r/radius, matrix[colors[id.x]][colors[i]]);
      totalForce += f * normalize(p - op);
    }
  }

  totalForce *= radius * force_factor;

  velocities[id.x] *= friction_factor;
  velocities[id.x] += totalForce * dt;
  
  positions[id.x] += velocities[id.x] * dt;

//   const sizei = i32(3);
//   for(var x = -sizei; x<= sizei; x++) {
//     for(var y=-sizei; y<= sizei; y++) {
//       const l = (length(vec2(f32(x), f32(y))));
//       if(l < f32(sizei)) {
//         pixels[index(p+vec2(f32(x), f32(y)))] += .10 * ( vec4(hsv2rgb(n/36, 0.9, 1.0), 1.0) * (1.0-l/f32(sizei)));
//       }
//     }
//   }

  // Draw
  pixels[index(p)] = vec4(hsv2rgb(360 * (colors[i] / m), 1.0, 0.5), 1.0);
}

@compute @workgroup_size(32)
fn fade(@builtin(global_invocation_id) id : vec3u) {
  pixels[id.x] *= 0.99;
}