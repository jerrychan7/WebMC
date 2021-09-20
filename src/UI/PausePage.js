
import { Page, pm } from "./Page.js";

class PausePage extends Page {
    static get shortPageID() { return "pause"; };
    static get templateUrl() { return "src/UI/PausePage.html"; };
    onHistoryBack() { this.close(); };
};

pm.addEventListener("pause=>welcome", (pause, welcome) => {
    let play = pm.getPageByID("play");
    play && play.close();
    pause.close();
});

PausePage.asyncLoadAndDefine();


export {
    PausePage,
};
