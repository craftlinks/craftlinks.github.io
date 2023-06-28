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
  var<uniform> alpha : f32;

@group(1) @binding(4)  
  var<uniform> beta : f32;

@group(1) @binding(5)  
  var<uniform> radius : f32;


// Other buffers
@group(2) @binding(0)  
  var<storage, read_write> positions : array<vec2f>;

@group(2) @binding(1)  
  var<storage, read_write> angles : array<f32>;


fn r(n: f32) -> f32 {
  let x = sin(n) * 43758.5453;
  return fract(x);
}

fn index(p: vec2f) -> i32 {
  return i32(p.x) + i32(p.y) * i32(rez);
}

@compute @workgroup_size(256)
fn reset(@builtin(global_invocation_id) id : vec3u) {
  let seed = f32(id.x)/f32(count);
  var p = vec2(r(seed), r(seed + 0.1));
  p *= rez;
  positions[id.x] = p;

  angles[id.x] = r(f32(id.x) / 100) * 3.14 * 2;
}

fn hsv2rgb(h : f32, s: f32, v: f32) -> vec3f
{
  var c = vec3(h, s, v);
  var K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  var p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, vec3(0.0), vec3(1.0)), c.y);
}

fn isOnRightSide(p : vec2f, v : vec2f, op : vec2f) -> bool {
  var b = p + v;
  return ((b.x - p.x) * (op.y - p.y) - (b.y - p.y) * (op.x - p.x)) > 0;
}

@compute @workgroup_size(256)
fn simulate(@builtin(global_invocation_id) id : vec3u) {
  var p = positions[id.x];
  var a = angles[id.x];
  var v = vec2(cos(a), sin(a));

  // PPS delta_phi algorithm
  var l = 0.0;
  var r = 0.0;
  // For each other agent
  for (var i = 0u; i < count; i++) {
    if (i == id.x) { continue; } // ignore self
    var op = positions[i];  // other position

    if (distance(p, op) < radius) {
      if (isOnRightSide(p, v, op)) {
        r += 1.0;
      } else {
        l += 1.0;
      }
    }
  }
  var n = r + l;
  var delta_phi = alpha + beta * n * sign(r - l);

  // Rotate
  a += delta_phi;

  // Move
  p += v;
  p = (p + rez) % rez;

  // Write
  positions[id.x] = p;
  angles[id.x] = a;

  // Draw
  pixels[index(p)] = vec4(hsv2rgb(n/35, 1.0, 1.0), 1.0);
}


@compute @workgroup_size(256)
fn fade(@builtin(global_invocation_id) id : vec3u) {
  pixels[id.x] *= 0.90;
}