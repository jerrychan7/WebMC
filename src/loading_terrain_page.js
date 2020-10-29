
import spa from "./spa.js";
import World from "./World.js";
import { WorldRender } from "./WorldRender.js";

const sleep = (ms = 0) => new Promise(s => {
    window.setTimeout(s, ms);
});

spa.addEventListener("loading_terrain_page", "load", async (pageID, data) => {
    let p = document.getElementById("gen-out");
    p.innerHTML = "Generating terrain...";
    await sleep(100);
    let world = new World();
    p.innerHTML = "Ready to render...";
    await sleep(100);
    let render = new WorldRender(document.getElementById("mainGamePage"), world);
    spa.openPage("play_game_page", {world, render});
});
