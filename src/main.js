
let sUserAgent = navigator.userAgent.toLowerCase();
window.isTouchDevice = [
    "android", "ucweb",
    "iphone os", "ipad", "ipod",
    "windows phone os", "windows ce", "windows mobile",
    "midp", "symbianos", "blackberry", "hpwos", "rv:1.2.3.4",
].some(s => sUserAgent.includes(s));

import {preloaded} from "./loadResources.js";
import Block from "./Block.js";
import spa from "./spa.js";
// load resources
import "./processingPictures.js";
spa.addPageByDefault();

spa.addPage("about", "");
spa.addEventListener("about", "load", (lastID) => {
    alert("Dev by qinshou2017.");
    spa.openPage(lastID);
});
spa.addPage("full-screen-btn", '<div class="mc-button full-screen-btn" style="display: none;">full screen</div>');
spa.addEventListener("full-screen-btn", "load", (lastID) => {
    if (!window.isTouchDevice) return;
    let requestFullscreen = document.body.requestFullscreen || document.body.mozRequestFullScreen || document.body.webkitRequestFullScreen || document.body.msRequestFullscreen;
    const isFullscreen = () => document.body === (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    let fullBtn = document.getElementsByClassName("full-screen-btn")[0];
    if (!isFullscreen()) fullBtn.style.display = "";
    document.body.onfullscreenchange =
    document.body.onmozfullscreenchange =
    document.body.onwebkitfullscreenchange =
    document.body.MSFullscreenChange = function(e) {
        if (e.target === null) return;
        const full = isFullscreen();
        spa.targetEvent("full-screen-btn", "onfullscreenchange", full);
        fullBtn.style.display = full? "none": "";
    };
    fullBtn.onclick = requestFullscreen.bind(document.body);
});

preloaded.onloadend(async _ => {
    Block.initBlocksByDefault();
    // Page-driven
    spa.openPage("start_game_page");
});
