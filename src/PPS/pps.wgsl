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
// Converts a color from the HSV (Hue, Saturation, Value) color space to the RGB (Red, Green, Blue) color space.
// See https://en.wikipedia.org/wiki/HSL_and_HSV for more information, including pseudocode for this algorithm.
{
  var c = vec3(h, s, v);
  var K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  var p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, vec3(0.0), vec3(1.0)), c.y);
}

fn isOnRightSide(p : vec2f, v : vec2f, op : vec2f) -> bool {
  var b = p + v;
  return ((b.x - p.x) * (op.y - p.y) - (b.y - p.y) * (op.x - p.x)) > 0;
  /*
  Let's break down the mathematics used in the code:

  var b = p + v;: This line calculates the end point of the line segment by adding the vector v to the starting point p. This gives us the coordinates of the point b.

  ((b.x - p.x) * (op.y - p.y) - (b.y - p.y) * (op.x - p.x)): This expression represents the cross product between two vectors. It can be written as:

  (b.x - p.x) * (op.y - p.y) - (b.y - p.y) * (op.x - p.x)

  Here's how this expression is computed:

  (b.x - p.x) and (b.y - p.y) represent the components of the vector from p to b.
  (op.x - p.x) and (op.y - p.y) represent the components of the vector from p to op.
  By calculating the cross product of these two vectors, we can determine the relative positions of op and the line segment.

  ((b.x - p.x) * (op.y - p.y) - (b.y - p.y) * (op.x - p.x)) > 0: This part of the code checks if the result of the cross product is greater than zero. 
  If the result is positive, it means that op is on the right side of the line segment defined by p and b. 
  If the result is zero or negative, it means that op is on the left side or collinear with the line segment.

  Therefore, the isOnRightSide function uses the cross product of vectors to determine whether a point is on the right side of a line segment.

  For two-dimensional vectors, the cross product is computed as follows:

  Given two vectors:

  Vector A: A = (A_x, A_y)
  Vector B: B = (B_x, B_y)
  The cross product of A and B is defined as:

  A x B = A_x * B_y - A_y * B_x

  The result of the cross product is a scalar value (not a vector) in two dimensions.

  The sign of the resulting scalar indicates the orientation of the vectors. If the result is positive, it means that vector B need to move counterclockwise to align with vector A (andn lays on the 'right side' of A).
  If the result is negative, it means that vector B needs to move clockwise to align with vector A (and lays on the 'left side' of A).
  If the result is zero, it means that the vectors are collinear (lie on the same line).
  */

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
  pixels[id.x] *= 0.95;
}