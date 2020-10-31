
import spa from "./spa.js";
let worldRender = null, world = null;

spa.addEventListener("play_game_page", "load", (pageID, data) => {
    let requestFullscreen = document.body.requestFullscreen ||  document.body.mozRequestFullScreen ||  document.body.webkitRequestFullScreen ||  document.body.msRequestFullscreen;
    requestFullscreen = requestFullscreen.bind(document.body);
    const isFullscreen = () => document.body === (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    if (!window.isTouchDevice)
        document.getElementsByClassName("mc-move-buttons")[0].style.display = "none";
    else {
        let fullBtn = document.getElementsByClassName("full-screen-btn")[0];
        if (!isFullscreen()) fullBtn.style.display = "";
        document.body.onfullscreenchange =
        document.body.onmozfullscreenchange =
        document.body.onwebkitfullscreenchange =
        document.body.MSFullscreenChange = function(e) {
            if (e.target === null) return;
            console.log("asdf", isFullscreen())
            if (!isFullscreen()) {
                fullBtn.style.display = "";
                spa.openPage("stop_game_page");
            }
            else fullBtn.style.display = "none";
        };
        fullBtn.onclick = requestFullscreen;
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
