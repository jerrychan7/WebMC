
import { Page, pm } from "./Page.js";

import { World } from "../World/World.js";
import { WorldRenderer } from "../Renderer/WorldRenderer.js";

const sleep = ms => new Promise(s => window.setTimeout(s, ms));

class LoadTerrainPage extends Page {
    static get shortPageID() { return "load-terrain"; };
    static get templateUrl() { return "src/UI/LoadTerrainPage.html"; };
    async connectedCallback() {
        await super.connectedCallback();
        let p = this.shadowRoot.getElementById("gen-out");
        p.innerHTML = "Generating terrain...";
        await sleep(70);
        let world = new World();
        p.innerHTML = "Ready to render...";
        await sleep(70);
        let canvas = pm.getPageByID("play").mainCanvas;
        let renderer = new WorldRenderer(canvas, world);
        pm.dispatchEvent("load-terrain.loaded", {world, renderer});
        this.close();
    };
}

LoadTerrainPage.asyncLoadAndDefine();


export {
    LoadTerrainPage,
};
