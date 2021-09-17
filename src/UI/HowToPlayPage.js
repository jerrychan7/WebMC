
import { Page } from "./Page.js";

class HowToPlayPage extends Page {
    static get shortPageID() { return "how-to-play"; };
    static get templateUrl() { return "src/UI/HowToPlayPage.html"; };
}

HowToPlayPage.asyncLoadAndDefine();


export {
    HowToPlayPage,
};
