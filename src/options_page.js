
import spa from "./spa.js";
import World from "./World.js";

spa.addEventListener("options_page", "load", (pageID, data) => {
    function onWorldTerrainChange() {
        for (let btn of document.querySelectorAll("#options_page .world-terrain")) {
            if (btn === this)
                btn.setAttribute("disabled", "true");
            else btn.removeAttribute("disabled");
        }
        World.config.terrain = this.innerHTML;
    }
    for (let btn of document.querySelectorAll("#options_page .world-terrain")) {
        btn.onclick = onWorldTerrainChange;
        if (btn.innerHTML == World.config.terrain)
            btn.setAttribute("disabled", "true");
    }
});
