
import { MCButton } from "./MCButton.js";
import { pm } from "../pages/Page.js";

const requestFullscreen = document.body.requestFullscreen || document.body.mozRequestFullScreen || document.body.webkitRequestFullScreen || document.body.msRequestFullscreen;
const isFullscreen = () => document.body === (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
document.body.onfullscreenchange =
document.body.onmozfullscreenchange =
document.body.onwebkitfullscreenchange =
document.body.MSFullscreenChange = function(e) {
    if (e.target === null) return;
    const isFull = isFullscreen();
    pm.dispatchEvent("onfullscreenchange", isFull);
};

class MCFullScreenButton extends MCButton {
    static get templateUrlFilename() { return "MCButton"; };
    constructor() {
        super();
        this.onfullscreenchange = this.onfullscreenchange.bind(this);
        this.onclick = this.onclick.bind(this);
        pm.addEventListener("onfullscreenchange", this.onfullscreenchange);
        this.addEventListener("click", this.onclick);
    };
    onfullscreenchange(isFull) {
        this.style.display = isFull? "none": "";
    };
    onConnected() {
        this.innerHTML = "full screen";
        this.style.position = "absolute";
        this.style.top = this.style.right = "10px";
        this.style.display = window.isTouchDevice && !isFullscreen()? "": "none";
    };
    onDisconnected() {
        pm.removeEventListener("onfullscreenchange", this.onfullscreenchange);
        this.removeEventListener("click", this.onclick);
    };
    onclick() {
        requestFullscreen.call(document.body).then(async _ => {
            try {
                await screen.orientation.lock("landscape");
            } catch (e) {
                console.warn(e);
                let lockOrientation = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;
                if (lockOrientation) lockOrientation.call(screen, "landscape");
            }
            await new Promise(res => setTimeout(res, 200));
            if (["landscape-primary", "landscape-secondary", "landscape"].includes(screen.orientation.type))
                return;
            // cannot lock screen orientation to landscape
            // remove all callback hooks and exit fullscreen
            document.documentElement.onfullscreenchange =
            document.documentElement.onmozfullscreenchange =
            document.documentElement.onwebkitfullscreenchange =
            document.documentElement.MSFullscreenChange = null;
            const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            exitFullscreen.call(document);
            this.style.display = "none";
        }, err => {
            console.warn(err);
        });
    };
}

customElements.whenDefined(MCButton.componentName).then(_ => MCFullScreenButton.define());

export {
    MCFullScreenButton,
};
