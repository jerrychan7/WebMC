
import { MCComponent } from "../components/Component.js";
import { edm } from "../../utils/EventDispatcher.js";

import { FSM } from "../../utils/FiniteStateMachine.js";

edm.getOrNewEventDispatcher("mc.preload")
.addEventListener("done", () => {
    // 设一层空的历史记录作为拦截
    history.pushState(null, document.title);
    // 如果点击了历史回退或手机上按了返回按钮
    window.addEventListener("popstate", e => {
        // 把退掉的空历史记录再加回去
        history.pushState(null, document.title);
        // 在 window 上发送 back 事件
        window.dispatchEvent(new Event("back"));
    }, false);
    // 当接收到 exit 事件则绕过上面的拦截，视为真正的回退
    window.addEventListener("exit", e => {
        history.go(-2);
    });
}, { once: true, });

class PageManager extends FSM {
    constructor() {
        super({
            id: "pageManager",
            initial: "preload",
        });
        edm.addEventDispatcher("mc.page", this);
    };
    getCurrentPage() { return document.body.lastChild; };
    getPageByID(pageID) {
        pageID = "mcpage-" + pageID;
        let page = [...document.body.childNodes].reverse().find(page => page.pageID == pageID);
        return page || null;
    };
    openPageByID(pageID, ...data) {
        if (pageID === "*pop") return this.closeCurrentPage();
        let currentPage = this.getCurrentPage();
        let page = document.createElement("mcpage-" + pageID);
        document.body.appendChild(page);
        this.dispatchEvent("opened", page, ...data);
        this.transition(pageID, currentPage, page, ...data);
        return page;
    };
    closePage(pageID, ...data) {
        if (pageID === "*pop") return this.closeCurrentPage(...data);
        let page = this.getPageByID(pageID);
        if (!page) return null;
        if (page === this.getCurrentPage()) return this.closeCurrentPage(...data);
        document.body.removeChild(page);
        this.dispatchEvent("closed", page, ...data);
        return page;
    };
    closeCurrentPage(...data) {
        let page = this.getCurrentPage();
        document.body.removeChild(page);
        this.dispatchEvent("closed", page, ...data);
        let nowPage = this.getCurrentPage();
        this.transition(nowPage.shortPageID, page, nowPage, ...data);
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
    static get pm() { return pageManager; };
    static get pageManager() { return pageManager; };
    static get shortPageID() { return super.componentName.replace(/-page$/, ""); };
    static get pageID() { return "mcpage-" + this.shortPageID; };
    static get componentName() { return this.pageID; };
    static get templateUrlPrefix() { return "src/UI/pages/"; };
    static get outdegree() { return []; };
    get shortPageID() { return this.constructor.shortPageID; };
    get pageID() { return this.constructor.pageID; };
    get outdegree() { return this.constructor.outdegree; };
    constructor() {
        super();
        if (new.target.name === "Page")
            throw "Class 'Page' cannot be instantiated!";
        pageManager.addTransitions(this.outdegree.map(to => ({
            from: this.shortPageID, to,
        })));
        this.onHistoryBack = this.onHistoryBack.bind(this);
        this._transitionedCallbackID =
        pageManager.addEventListener("transitioned", (from, to, eventName, fromPage, toPage, ...data) => {
            this.onTransitioned(from, to, eventName, fromPage, toPage, ...data);
            if (fromPage === this) {
                this.onTransitionedFromThis(to, eventName, toPage, ...data);
                window.removeEventListener("back", this.onHistoryBack);
            }
            else if (toPage === this) {
                this.onTransitionedToThis(from, eventName, fromPage, ...data);
                window.addEventListener("back", this.onHistoryBack);
            }
        });
    };
    onTransitioned(from, to, eventName, fromPage, toPage, ...data) {};
    onTransitionedFromThis(to, eventName, toPage, ...data) {};
    onTransitionedToThis(from, eventName, fromPage, ...data) {};
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
    close(...data) {
        // pageManager.dispatchEvent("close", this);
        // this.parentElement.removeChild(this);
        pageManager.closePage(this.shortPageID, ...data);
    };
};

export {
    Page,
    pageManager, pageManager as pm,
};
