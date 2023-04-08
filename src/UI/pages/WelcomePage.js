
import { Page } from "./Page.js";
import { settings } from "../../settings.js";

import { WelcomeRenderer } from "../../Renderer/WelcomePageRenderer.js";

class WelcomePage extends Page {
    static get outdegree() { return ["select-world", "how-to-play", "setting", ]; };
    constructor() {
        super();
        this.bgCanvas = this.shadowRoot.getElementById("background-canvas");
        this.renderer = null;
    };
    onConnected() {
        this.renderer = new WelcomeRenderer(this.bgCanvas);
        this.renderer.play();
        settings.addEventListener("changedValue", this.updateBlur);
        this.updateBlur();
    };
    onDisconnected() {
        this.renderer.dispose();
        this.renderer = null;
        settings.removeEventListener("changedValue", this.updateBlur);
    };
    updateBlur = (key = "homepageBlur", value = settings.homepageBlur) => {
        if (key !== "homepageBlur") return;
        this.bgCanvas.style.setProperty("--blur", value);
    };
    onTransitionedFromThis(to) {
        switch(to) {
        case "select-world":
        case "how-to-play": case "setting": {
            this.renderer.stop();
            break; }
        }
    };
    onTransitionedToThis() {
        if (this.renderer) this.renderer.play();
    };
    onHistoryBack() {
        window.dispatchEvent(new Event("exit"));
    };
    onTransitioned(from, to, eventName, fromPage, toPage, ...data) {
        if (to == "play") this.close();
    };
};

WelcomePage.asyncLoadAndDefine();


export {
    WelcomePage,
};
