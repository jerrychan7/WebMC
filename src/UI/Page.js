
import { MCComponent } from "./Component.js";
import { edm } from "../utils/EventDispatcher.js";

import { FSM } from "../utils/FiniteStateMachine.js";

edm.getOrNewEventDispatcher("mc.preload")
.addEventListener("done", () => {
    history.pushState(null, document.title);
    window.addEventListener("popstate", e => {
        history.pushState(null, document.title);
        window.dispatchEvent(new Event("back"));
    }, false);
    window.addEventListener("exit", e => {
        history.go(-2);
    });
}, { once: true, });

class PageManager extends FSM {
    constructor() {
        super({
            id: "pageManager",
            initial: "preload",
            transitions: [
                { from: "preload", to: "welcome", },
                { from: "welcome", to: "play", },
                { from: "welcome", to: "how-to-play", },
                { from: "welcome", to: "setting", },
                { from: "play", to: "load-terrain", },
                { from: "play", to: "pause", },
                { from: "load-terrain", to: "play", },
                { from: "pause", to: "play", },
                { from: "pause", to: "welcome", },
                { from: "pause", to: "setting", },
                { from: "setting", to: "welcome", },
                { from: "setting", to: "pause", },
                { from: "how-to-play", to: "welcome", },
            ],
        });
        edm.addEventDispatcher("mc.page", this);
    };
    getCurrentPage() { return document.body.lastChild; };
    getPageByID(pageID) {
        pageID = "mcpage-" + pageID;
        let page = [...document.body.childNodes].reverse().find(page => page.pageID == pageID);
        return page || null;
    };
    openPageByID(pageID) {
        if (pageID === "*pop") return this.closeCurrentPage();
        let currentPage = this.getCurrentPage();
        let page = document.createElement("mcpage-" + pageID);
        document.body.appendChild(page);
        this.dispatchEvent("open", page);
        this.transition(pageID, currentPage, page);
        return page;
    };
    closePage(pageID) {
        if (pageID === "*pop") return this.closeCurrentPage();
        let page = this.getPageByID(pageID);
        if (!page) return null;
        if (page === this.getCurrentPage()) return this.closeCurrentPage();
        document.body.removeChild(page);
        this.dispatchEvent("close", page);
        return page;
    };
    closeCurrentPage() {
        let page = this.getCurrentPage();
        document.body.removeChild(page);
        this.dispatchEvent("close", page);
        let nowPage = this.getCurrentPage();
        this.transition(nowPage.shortPageID, page, nowPage);
        return page;
    };
};

const pageManager = new PageManager();

let pageStyle = document.createElement("style");
pageStyle.innerHTML = `
    :host {
        width: 100vw;
        height: 100vh;
        position: absolute;
        top: 0; left: 0;
    }
`;
pageStyle.id = "pageStyle";
class Page extends MCComponent {
    static get pageID() { return "mcpage-" + this.shortPageID; };
    static get componentName() { return this.pageID; };
    get shortPageID() { return this.constructor.shortPageID; };
    get pageID() { return this.constructor.pageID; };
    constructor() {
        super();
        this.onHistoryBack = this.onHistoryBack.bind(this);
        this._transitionedCallbackID =
        pageManager.addEventListener("transitioned", (from, to, en, [fromPage, toPage]) => {
            if (fromPage === this) {
                this.onTransitionedFromThis(to, en, toPage);
                window.removeEventListener("back", this.onHistoryBack);
            }
            else if (toPage === this) {
                this.onTransitionedToThis(from, en, fromPage);
                window.addEventListener("back", this.onHistoryBack);
            }
        });
    };
    onTransitionedFromThis(to, en, toPage) {};
    onTransitionedToThis(from, en, fromPage) {};
    onHistoryBack() {};
    async disconnectedCallback() {
        await super.disconnectedCallback();
        pageManager.removeEventListenerByID(this._transitionedCallbackID);
        window.removeEventListener("back", this.onHistoryBack);
    };
    appendTemplate(template = this.template) {
        let tmp = super.appendTemplate(template);
        if (!tmp) return;
        this.shadowRoot.prepend(pageStyle.cloneNode(true));
        customElements.whenDefined("mc-full-screen-button").then(_ => {
            this.shadowRoot.append(document.createElement("mc-full-screen-button"));
        });
        return tmp;
    };
    close() {
        // pageManager.dispatchEvent("close", this);
        // this.parentElement.removeChild(this);
        pageManager.closePage(this.shortPageID);
    };
};

export {
    Page,
    pageManager, pageManager as pm,
};
