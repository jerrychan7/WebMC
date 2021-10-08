
import { Page } from "./Page.js";

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
        this.renderer.dispose();
        this.renderer = null;
    };
    onTransitionedFromThis(to) {
        switch(to) {
        case "play": {
            this.close();
            break; }
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
};

WelcomePage.asyncLoadAndDefine();


export {
    WelcomePage,
};
