
import { Page } from "./Page.js";

class HowToPlayPage extends Page {
    static get outdegree() { return ["welcome", ]; };
    onHistoryBack() { this.close(); };
}

HowToPlayPage.asyncLoadAndDefine();


export {
    HowToPlayPage,
};
