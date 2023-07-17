// eslint-disable-next-line @typescript-eslint/no-unused-vars
function header (): string {
  return ` <div class="titleName">CraftLinks</div>
<div class="subtitle">Creator of Digital Artificial Life</div>`
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function guiContainer (): string {
  return '<div id="guiContainer"></div>'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function navigationButtons (): string {
  let baseURL = ''

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    baseURL = '' // Set the base URL to empty string for localhost
  } else {
    baseURL = 'https://www.craftlinks.art'
  }
  return `<a href = "${baseURL}/pages/julia.html" class="button">Julia</a>
    <a href = "${baseURL}/pages/predator-prey.html" class="button">Predator-prey</a>
    <a href = "${baseURL}/pages/pps.html" class="button">Primordial Particle System</a>
    <a href = "${baseURL}/pages/particle-life.html" class="button">Particle Life</a>
    <a href = "${baseURL}/pages/grids.html" class="button">GRID</a>`
}
