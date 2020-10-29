
import spa from "./spa.js";
let worldRender = null;

spa.addEventListener("play_game_page", "load", (pageID, data) => {
    if (worldRender === null) spa.openPage("loading_terrain_page");
});
spa.addEventListener("play_game_page", "unload", (pageID, data) => {
    if (!worldRender) return;
    worldRender.stop();
    worldRender = null;
});
spa.addEventListener("play_game_page", "overlap", (pageID, data) => {
    if (!worldRender) return;
    worldRender.stop();
});
spa.addEventListener("play_game_page", "unoverlap", (pageID, {world, render}) => {
    if (worldRender === null && pageID === "loading_terrain_page")
        worldRender = render;
    if (!worldRender) return;
    worldRender.play();
});
