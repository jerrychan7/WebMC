
import { Page, pm } from "./Page.js";
let worldRenderer = null, world = null;

pm.addEventListener("load-terrain.loaded", ({world: w, renderer}) => {
    world = w;
    worldRenderer = renderer;
});

class PlayPage extends Page {
    static get shortPageID() { return "play"; };
    static get templateUrl() { return "src/UI/PlayPage.html"; };
    constructor() {
        super();
        this.moveButtons = this.shadowRoot.querySelector("mc-move-buttons");
        this.inventory = this.shadowRoot.querySelector("mc-inventory");
        this.hotbar = this.shadowRoot.querySelector("mc-hotbar");
        this.mainCanvas = this.shadowRoot.getElementById("mainCanvas");
        this.debugOutput = this.shadowRoot.getElementById("mc-f3-out");
    };
    async connectedCallback() {
        await super.connectedCallback();
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
        if (worldRenderer === null) pm.openPageByID("load-terrain");
    };
    async disconnectedCallback() {
        await super.disconnectedCallback();
        if (!worldRenderer) return;
        worldRenderer.stop();
        try { world.mainPlayer.controller.exitPointerLock(); } catch {}
        worldRenderer = world = null;
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
};

pm.addEventListener("onfullscreenchange", isFull => {
    if (window.isTouchDevice && !isFull && pm.getCurrentPage().pageID === PlayPage.pageID)
        pm.openPageByID("pause");
});

pm.addEventListener("load-terrain=>play", () => {
    worldRenderer.play();
    pm.openPageByID("pause");
});
pm.addEventListener("pause=>play", (pause, play) => {
    worldRenderer.play();
});
pm.addEventListener("play=>pause", (play, pause) => {
    worldRenderer.stop();
});
pm.addEventListener("pause=>welcome", () => {
    world.mainPlayer.controller.setCanvas();
    world = null;
    worldRenderer = null;
});

PlayPage.asyncLoadAndDefine();


export {
    PlayPage,
};
