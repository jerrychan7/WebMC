
import { Page } from "./Page.js";

class PausePage extends Page {
    onHistoryBack() { this.close(); };
    onTransitionedFromThis(to) {
        if (to != "welcome") return;
        let play = Page.pm.getPageByID("play");
        play && play.close();
        this.close();
    };
};

PausePage.asyncLoadAndDefine();


export {
    PausePage,
};
