"use strict";
function header() {
    return ` <div class="title">CraftLinks</div>
<div class="subtitle">Creator of Digital Artificial Life</div>`;
}
function navigationButtons() {
    let baseURL = ""; // Initialize the baseURL variable
    // Check if running on localhost
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        baseURL = ""; // Set the base URL to empty string for localhost
    }
    else {
        baseURL = "https://www.craftlinks.art"; // Replace with your actual base URL for production
    }
    return `<a href = "${baseURL}/pages/julia.html" class="button">Julia</a>
    <a href = "${baseURL}/pages/predator-prey.html" class="button">Predator-prey</a>`;
}
