
import spa from "./spa.js";
let worldRender = null, world = null;

spa.addEventListener("play_game_page", "load", (pageID, data) => {
    if (worldRender === null) spa.openPage("loading_terrain_page");
});
spa.addEventListener("play_game_page", "unload", (pageID, data) => {
    if (!worldRender) return;
    worldRender.stop();
    world?.mainPlayer?.controller?.input?.exitPointerLock?.();
    worldRender = world = null;
});
spa.addEventListener("play_game_page", "overlap", (pageID, data) => {
    if (!worldRender) return;
    worldRender.stop();
});
spa.addEventListener("play_game_page", "unoverlap", (pageID, {world: w, render}) => {
    if (worldRender === null && pageID === "loading_terrain_page") {
        worldRender = render;
        world = w;
        render.play();
        spa.openPage("stop_game_page");
        return;
    }
    if (!worldRender) return;
    worldRender.play();
});

spa.addEventListener("stop_game_page", "unload", (pageID) => {
    // wait before play_game_page unload callback called
    setTimeout(_ => {
        world?.mainPlayer?.controller?.input?.requestPointerLock?.();
    }, 0);
});
