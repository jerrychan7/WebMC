
import "./globalVeriable.js";

window.addEventListener("contextmenu", e => { if (e.cancelable) e.preventDefault(); }, true);

const updatePixelRatio = () => {
    let dpr = window.devicePixelRatio;
    document.documentElement.style.setProperty("--device-pixel-ratio", dpr);
    window.dispatchEvent(new Event("dprchange"));
    matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", updatePixelRatio, { once: true });
};
updatePixelRatio();


import "./UI/index.js";
import "./processingPictures.js";
