"use strict";
function header() {
    return ` <div class="titleName">CraftLinks</div>
<div class="subtitle">Creator of Digital Artificial Life</div>`;
}
function navigationButtons() {
    let baseURL = "";
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        baseURL = ""; // Set the base URL to empty string for localhost
    }
    else {
        baseURL = "https://www.craftlinks.art";
    }
    return `<a href = "${baseURL}/pages/julia.html" class="button">Julia</a>
    <a href = "${baseURL}/pages/predator-prey.html" class="button">Predator-prey</a>
    <a href = "${baseURL}/pages/pps.html" class="button">Primordial Particle System</a>`;
}
