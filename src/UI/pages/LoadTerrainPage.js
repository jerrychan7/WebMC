
import { Page, pm } from "./Page.js";

import { World } from "../../World/World.js";
import { WorldRenderer } from "../../Renderer/WorldRenderer.js";

const sleep = ms => new Promise(s => window.setTimeout(s, ms));

class LoadTerrainPage extends Page {
    async onTransitionedToThis(from, eventName, fromPage, ...data) {
        let [storageId] = data;
        let p = this.shadowRoot.getElementById("gen-out");
        p.innerHTML = "Generating terrain...";
        await sleep(70);
        let world = new World({ storageId });
        p.innerHTML = "Ready to render...";
        await sleep(70);
        let canvas = pm.getPageByID("play").mainCanvas;
        let renderer = new WorldRenderer(canvas, world);
        pm.dispatchEvent("load-terrain.loaded", {world, renderer});
        this.close({world, renderer});
    };
}

LoadTerrainPage.asyncLoadAndDefine();


export {
    LoadTerrainPage,
};
