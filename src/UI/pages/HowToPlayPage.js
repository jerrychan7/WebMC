
import { Page } from "./Page.js";

class HowToPlayPage extends Page {
    onHistoryBack() { this.close(); };
}

HowToPlayPage.asyncLoadAndDefine();


export {
    HowToPlayPage,
};
