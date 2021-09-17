
import { Page, pm } from "./Page.js";

import { WelcomeRenderer } from "../Renderer/WelcomePageRenderer.js";

class WelcomePage extends Page {
    static get shortPageID() { return "welcome"; };
    static get templateUrl() { return "src/UI/WelcomePage.html"; };
    constructor() {
        super();
        this.bgCanvas = this.shadowRoot.getElementById("background-canvas");
        this.renderer = null;
    };
    async connectedCallback() {
        await super.connectedCallback();
        this.renderer = new WelcomeRenderer(this.bgCanvas);
        this.renderer.play();
    };
    async disconnectedCallback() {
        await super.disconnectedCallback();
        this.renderer.stop();
        this.renderer = null;
    };
};

pm.addEventListener("transitioned", (from, to, en, [fromPage, toPage]) => {
    if (from == "welcome") switch(to) {
        case "play": {
            fromPage.close();
            break; }
        case "how-to-play": case "setting": {
            fromPage.renderer.stop();
            break; }
    }
    else if (to == "welcome")
        toPage.renderer && toPage.renderer.play();
});

WelcomePage.asyncLoadAndDefine();


export {
    WelcomePage,
};
