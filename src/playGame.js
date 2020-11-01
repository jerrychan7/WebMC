
import spa from "./spa.js";
let worldRender = null, world = null;

spa.addEventListener("full-screen-btn", "onfullscreenchange", (full) => {
    if (window.isTouchDevice && !full && worldRender)
        spa.openPage("stop_game_page");
});

spa.addEventListener("play_game_page", "load", (pageID, data) => {
    if (!window.isTouchDevice) {
        document.getElementsByClassName("mc-move-buttons")[0].style.display = "none";
        document.getElementsByClassName("mc-inventory-btn")[0].style.display = "none";
    }
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
        if (window.isTouchDevice) spa.openPage("full-screen-btn");
        worldRender = render;
        world = w;
        render.play();
        spa.openPage("stop_game_page");
        render.stop();
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
