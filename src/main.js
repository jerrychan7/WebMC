
let sUserAgent = navigator.userAgent.toLowerCase();
window.isTouchDevice = [
    "android", "ucweb",
    "iphone os", "ipad", "ipod",
    "windows phone os", "windows ce", "windows mobile",
    "midp", "symbianos", "blackberry", "hpwos", "rv:1.2.3.4",
].some(s => sUserAgent.includes(s));
// for iPadOS
if (!isTouchDevice && sUserAgent.includes("safari") && sUserAgent.includes("version")) {
    if (!sUserAgent.includes("iphone") && "ontouchend" in document)
        window.isTouchDevice = true;
}

window.addEventListener("contextmenu", e => { if (e.cancelable) e.preventDefault(); }, true);

const updatePixelRatio = () => {
    let dpr = window.devicePixelRatio;
    document.documentElement.style.setProperty("--device-pixel-ratio", dpr);
    window.dispatchEvent(new Event("dprchange"));
    matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", updatePixelRatio, { once: true });
};
updatePixelRatio();

import { edm } from "./utils/EventDispatcher.js";
edm.getOrNewEventDispatcher("mc.preload")
.addEventListener("done", async _ => {
    const {Block} = await import("./World/Block.js");
    Block.initBlocksByDefault();
}, { once: true, });

import {} from "./UI/index.js";
import {} from "./processingPictures.js";
