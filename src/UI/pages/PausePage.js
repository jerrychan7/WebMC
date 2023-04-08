
import { Page } from "./Page.js";

class PausePage extends Page {
    static get outdegree() { return ["play", "welcome", "setting", ]; };
    onHistoryBack() { this.close(); };
    onTransitionedFromThis(to) {
        if (to == "welcome") this.close();
    };
};

PausePage.asyncLoadAndDefine();


export {
    PausePage,
};
