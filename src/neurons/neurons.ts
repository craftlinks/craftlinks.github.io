import { SwissGL } from '../swissgl.js'

const uniforms = {
  rez: 1024,
  time: 0,
  radius: 50,
  count: 15000,
  number_of_colors: 3
}

async function main (): Promise<void> {
  const canvas = document.createElement('canvas')
  const scale = (0.95 * Math.min(window.innerHeight, window.innerWidth)) / uniforms.rez
  canvas.width = canvas.height = uniforms.rez * scale
  document.body.appendChild(canvas)

  const glsl = SwissGL(canvas)
  glsl.loop(({ time }: { time: number }) => {
    // glsl.adjustCanvas()
    const tex = glsl({ time, FP: 'int((float(I.y^I.x)*(cos(time)*0.076))) & int((float(I.x&I.y)))' }, { scale: 1 / 4, tag: 'tmp' })
    glsl({ tex, FP: 'tex(abs(XY))' })
  })
}

void main()
