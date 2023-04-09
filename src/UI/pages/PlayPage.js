
import { Page, pm } from "./Page.js";
import { PlayerLocalController } from "../../Entity/PlayerLocalController.js";

class PlayPage extends Page {
    static get outdegree() { return ["load-terrain", "pause", ]; };
    constructor() {
        super();
        this.moveButtons = this.shadowRoot.querySelector("mc-move-buttons");
        this.inventory = this.shadowRoot.querySelector("mc-inventory");
        this.hotbar = this.shadowRoot.querySelector("mc-hotbar");
        this.mainCanvas = this.shadowRoot.getElementById("mainCanvas");
        this.debugOutput = this.shadowRoot.getElementById("mc-f3-out");

        this.world = this.worldRenderer = null;
    };
    onConnected() {
        this.hotbar.addEventListener("inventoryBtnClick", e => {
            if (this.isShownInventory) this.closeInventory();
            else this.showInventory();
        });
        this.inventory.addEventListener("closeBtnClick", e => {
            this.closeInventory();
        });
        this.inventory.addEventListener("inventoryItemClick", e => {
            this.hotbar.setItem(e.detail);
            this.hotbar.showName();
        });
        if (!window.isTouchDevice) {
            this.moveButtons.style.display = "none";
        }
        else {
            this.hotbar.setAttribute("showInventoryBtn", "");
        }
        this.playerLocalController = new PlayerLocalController(null, { playPage: this, });
    };
    dispose() {
        if (!this.worldRenderer) return;
        this.worldRenderer.dispose();
        this.playerLocalController.dispose();
        this.world = this.worldRenderer = null;
    };
    onDisconnected() { this.dispose(); };
    onTransitionedFromThis(to, eventName, toPage, ...data) {
        if (to == "pause") this.worldRenderer.stop();
    };
    onTransitionedToThis(from, eventName, fromPage, ...data) {
        switch (from) {
        case "select-world":
        case "create-new-world": {
            pm.openPageByID("load-terrain", data[0]);
            break; }
        case "load-terrain": {
            this.dispose();
            const [{world: w, renderer}] = data;
            this.world = w;
            this.worldRenderer = renderer;
            this.playerLocalController.setPlayPage(this);
            this.playerLocalController.setEntity(w.mainPlayer);
            renderer.play();
            pm.openPageByID("pause");
            break; }
        case "pause": {
            this.worldRenderer.play();
            break; }
        }
    };
    get isShownInventory() { return this.inventory.style.display !== "none"; };
    showInventory() {
        this.inventory.style.display = "";
        this.hotbar.activeInventoryBtn(true);
        this.dispatchEvent(new Event("showInventory"));
    };
    closeInventory() {
        this.inventory.style.display = "none";
        this.hotbar.activeInventoryBtn(false);
        this.dispatchEvent(new Event("closeInventory"));
    };
    onTransitioned(from, to, eventName, fromPage, toPage, ...data) {
        if (to == "welcome") this.close();
    };
};

const onHistoryBack = e => pm.openPageByID("pause");
pm.addEventListener("onfullscreenchange", isFull => {
    if (window.isTouchDevice && !isFull && pm.getCurrentPage().pageID === PlayPage.pageID) {
        window.removeEventListener("back", onHistoryBack);
        pm.openPageByID("pause");
    }
});

pm.addEventListener("pause=>play", (pause, play) => {
    window.addEventListener("back", onHistoryBack, {once: true});
});

PlayPage.asyncLoadAndDefine();


export {
    PlayPage,
};
