// Pixels
@group(0) @binding(0)  
  var<storage, read_write> pixels : array<vec4f>;

// Uniforms
@group(1) @binding(0) 
  var<uniform> rez : f32;

@group(1) @binding(1) 
  var<uniform> time : f32;


@group(1) @binding(2) 
  var<uniform> predatorCount : f32;

@group(1) @binding(3) 
  var<uniform> preyCount : f32;

// Agents
@group(2) @binding(0)  
  var<storage, read_write> predators : array<vec4f>;

@group(2) @binding(1)  
  var<storage, read_write> predatorSizes : array<f32>;


@group(2) @binding(2)  
  var<storage, read_write> prey : array<vec4f>;
@group(2) @binding(3)  
  var<storage, read_write> preyStates : array<f32>;


fn r(n: f32) -> f32 {
  let x = sin(n) * 43758.5453;
  return fract(x);
}

fn index(p: vec2f) -> i32 {
  return i32(p.x) + i32(p.y) * i32(rez);
}

@compute @workgroup_size(256)
fn reset(@builtin(global_invocation_id) id : vec3u) {
  let seed = f32(id.x);
  if(id.x < u32(predatorCount)) {
    var xy = vec2(r(seed), r(seed + 1)) * rez;
    var vxy = vec2(r(seed+4), r(seed + 5)) - 0.5;
    predators[id.x] = vec4(xy, vxy);
    predatorSizes[id.x] = 4.0;
  }
  if(id.x < u32(preyCount)) {
    var xy = vec2(r(seed + 2 ), r(seed+ 3)) * rez;
    var vxy = vec2(r(seed+4), r(seed + 5)) - 0.5;
    prey[id.x] = vec4(xy, vxy);
    preyStates[id.x] = 1.0;
  }
}

const radius = 20;
const preyRadiusFactor = 4.0;
const predatorRadiusFactor = 2.0;

const maxSpeed = 0.5;
const maxPredatorSpeed = maxSpeed * 1.0;
const maxPreySpeed = maxSpeed * 0.6;

const predatorTurnFactor = 0.26;
const predatorrFactor = 0.1;

const preyTurnFactor = 0.04;
const preyrFactor = 0.01;


@compute @workgroup_size(256)
fn predatorSim(@builtin(global_invocation_id) id : vec3u) {
  // Read
  var p = predators[id.x].xy;
  var v = predators[id.x].zw;
  var size = predatorSizes[id.x];

  // Move
  p += v;

  var eaten = false;

  // Seek
  var acceleration = vec2(0.0);
  var count = 0.0;
  for(var i=0; i < i32(preyCount); i++) {
    if(preyStates[i] < 1) {
      continue;
    }
    let prey = prey[i];
    let d = distance(prey.xy, p);
    if(d < size) {
      if(size < 24) {
        eaten = true;
        size += 0.2;
      }
    }
    else if(d < radius * predatorRadiusFactor) {
      count += 1.0;
      acceleration += (prey.xy - p);
    }
  }



  for(var i=0; i < i32(predatorCount); i++) {
    if(i == i32(id.x)) {
      continue;
    }
    let predator = predators[i];
    let size = predatorSizes[i];
    let d =  distance(predator.xy, p);
    if(d < radius * 2  * size/8) {
      count += 1;
      v += (p - predator.xy) / d;
    }
  }



  if(count > 0) {
    v += (acceleration/count) * predatorTurnFactor;
  }

  if(count == 0) {
    v += (vec2(r(f32(id.x)+p.x), r(f32(id.y)+p.y)) - 0.5) * predatorrFactor;
  } else {
    v += (vec2(r(f32(id.x)+p.x), r(f32(id.y)+p.y)) - 0.5) * predatorrFactor * 0.1;
  }

  if(length(v) > maxPredatorSpeed)  {
    v = maxPredatorSpeed * (v / length(v));
  }

  p = (p + rez) % rez;
  predators[id.x] = vec4(p, v);

  if(size > 3) {
    size *= 0.995;
  }
  predatorSizes[id.x] = size;

  var color = vec4(0.9, 0.1, 0.0, 1.0);
  if(eaten)  {
    color = vec4(0.0, 1.0, 1.0, 1.0);
  }
  let sizei = i32(ceil(size));
  for(var x = -sizei; x<= sizei; x++) {
    for(var y=-sizei; y<= sizei; y++) {
      let l = (length(vec2(f32(x), f32(y))));
      if(l < size) {
        pixels[index(p+vec2(f32(x), f32(y)))] += .2 * (color * (1-l/size));
      }
    }
  }
}

@compute @workgroup_size(256)
fn preySim(@builtin(global_invocation_id) id : vec3u) {
  // Read
  var p = prey[id.x].xy;
  var v = prey[id.x].zw;

  var color : vec4f;
  var acceleration = vec2(0.0);

  // Move
  p += v;

  // Avoid
  var closest = 100.0;
  if(preyStates[id.x] >= 1) {
    for(var i=0; i < i32(predatorCount); i++) {
      let predator = predators[i];
      let size = predatorSizes[i];
      let d =  distance(predator.xy, p);
      closest = min(d, closest);
      if(d < radius * preyRadiusFactor * size/18) {
        acceleration += (p - predator.xy) / d;
      }
      if(d <= size) {
        preyStates[id.x] = 0;
      }
    }
    v += acceleration * preyTurnFactor;

  }
  v += (vec2(r(f32(id.x)+p.x), r(f32(id.y)+p.y)) - 0.5) * preyrFactor;

  let angle = atan2(p.y-rez/2,  p.x-rez/2);
  v -= vec2(sin(angle), -cos(angle)) * 0.0003;
  v -= vec2(p.x - rez/2, p.y-rez/2) * 0.000003;

  if(length(v) > maxPreySpeed)  {
    v = maxPreySpeed * (v / length(v));
  }


  p = (p + rez) % rez;

  color = vec4((100-closest)/400, 1.0 - length(v)/maxPreySpeed, closest/100 - .7, 1.0);
  if(preyStates[id.x] < 1) {
    v += (vec2(r(f32(id.x)+p.x), r(f32(id.y)+p.y)) - 0.5) * .01;
    p += v;
    if(length(v) > maxPreySpeed * 0.4)  {
      v = maxPreySpeed * (v / length(v) * 0.4);
    }
    preyStates[id.x] += 0.0005;
  }  else {

  }

  if(preyStates[id.x] < 0.5) {
    color = vec4(0.20, 0, 0, 1);
  } else {
    color = mix(vec4(0.70, 0, 0, 1), color, preyStates[id.x]);
  }
  color *= 3.0;

  prey[id.x] = vec4(p, v);

  var depth = sin(time/100.0 + f32(id.x)) + 0.8;
  let size = i32(1 + 8 * (f32(id.x) % 20.0) / 20.0 * .5 * (1.3 + sin(time / 100 + f32(id.x))));

  for(var x = -size; x<= size; x++) {
    for(var y=-size; y<= size; y++) {
      let l = (length(vec2(f32(x), f32(y))));
      if(l < f32(size)) {
        pixels[index(p+vec2(f32(x), f32(y)))] += depth * .008 * color * smoothstep(.3, .4, 1-l/f32(size));
      }
    }
  }

}

@compute @workgroup_size(16, 16)
fn fade(@builtin(global_invocation_id) id : vec3u) {
  pixels [id.x + id.y * u32(rez)] *= 1.0 - smoothstep(.89, 1.2, length(vec2f(id.xy) - rez/2)/(rez/2));
  pixels[id.x + id.y * u32(rez)] *= .95;
}