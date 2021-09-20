
import { Page } from "./Page.js";
import { World } from "../World/World.js";

class SettingPage extends Page {
    static get shortPageID() { return "setting"; };
    static get templateUrl() { return "src/UI/SettingPage.html"; };
    constructor() {
        super();
        this.worldTerrainBtns = this.shadowRoot.querySelectorAll(".world-terrain");
        for (let btn of this.worldTerrainBtns) {
            if (btn.innerHTML == World.config.terrain)
                btn.setAttribute("disabled", "true");
            btn.onclick = (e) => {
                btn.setAttribute("disabled", "");
                for (let b of this.worldTerrainBtns)
                    if (b !== btn) b.removeAttribute("disabled");
                World.config.terrain = btn.innerHTML;
            };
        }
    };
    onHistoryBack() { this.close(); };
};

SettingPage.asyncLoadAndDefine();


export {
    SettingPage,
};
