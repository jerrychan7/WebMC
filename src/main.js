import {preloaded} from "./loadResources.js";
import Block from "./Block.js";
import World from "./World.js";
import { WorldRender } from "./WorldRender.js";

window.onload = async function() {
    await preloaded.loadend();
    Block.initBlocksByDefault();
    let world = new World(),
        render = new WorldRender(document.getElementById("canvas"), world);
    render.play();
};
