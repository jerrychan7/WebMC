
import { MCComponent } from "./Component.js";
// import { Block } from "../../World/Block.js";

const normIndex = (i, len) => (i + len) % len;

class MCHotbar extends MCComponent {
    constructor() {
        super();
        this.itemsDOM = this.shadowRoot.getElementById("items");
        this.shownameBox = this.shadowRoot.querySelector(".showname");
        this.inventoryBtn = this.shadowRoot.querySelector(".inventory-btn");
        this.inventoryBtn.addEventListener("click", e => {
            e.preventDefault();
            this.dispatchEvent(new Event("inventoryBtnClick"));
            return false;
        });
        this.length = 9;
        this.blocks = [];
        for (let i = 0; i < this.length; ++i) {
            let img = document.createElement("img");
            img.onclick = e => this.updateSelector(i);
            img.draggable = false;
            this.itemsDOM.append(img);
        }
    };
    get selectOn() { return 1 * getComputedStyle(this).getPropertyValue("--offset"); };
    onConnected() {
        let showInventoryBtn = this.hasAttribute("showInventoryBtn") || window.isTouchDevice;
        this.inventoryBtn.style.display = showInventoryBtn? "": "none";
    };
    static get observedAttributes() { return ["offset", "inventory_btn_active"]; };
    onAttrChanged(name, oldValue, newValue) {
        switch (name) {
        case "inventory_btn_active": {
            this.activeInventoryBtn(this.hasAttribute(name));
            break; }
        case "offset": {
            this.style.setProperty("--offset", newValue);
            break; }
        }
    };
    activeInventoryBtn(bool) {
        if (bool) {
            this.inventoryBtn.setAttribute("active", "");
            if (!this.hasAttribute("inventory_btn_active")) this.setAttribute("inventory_btn_active", "");
        }
        else {
            this.inventoryBtn.removeAttribute("active");
            if (this.hasAttribute("inventory_btn_active")) this.removeAttribute("inventory_btn_active");
        }
    };
    updateSelector(i = this.selectOn) {
        i = normIndex(i, this.length);
        this.style.setProperty("--offset", i);
        this.showName();
        this.dispatchEvent("selectBlock", { global: true, data: this.blocks[i], });
    };
    setItem(block, index = this.selectOn) {
        index = normIndex(index, this.length);
        const { blocks, itemsDOM } = this;
        blocks[index] = block;

        itemsDOM.innerHTML = "";
        for (let i = 0; i < this.length; ++i) {
            let b = blocks[i];
            let img = b
                ? b.texture.inventory.cloneNode()
                : document.createElement("img");
            img.draggable = false;
            img.onclick = e => this.updateSelector(i);
            itemsDOM.append(img);
        }
        this.updateSelector();
    };
    getSelectedItem(index = this.selectOn) {
        return this.blocks[index];
    };
    selectPrev() {
        this.updateSelector(this.selectOn + 1);
    };
    selectNext() {
        this.updateSelector(this.selectOn - 1);
    };
    showName(index = this.selectOn) {
        const block = this.blocks[index];
        if (!block || block.name == "air") return;
        const shownameBox = this.shownameBox;
        shownameBox.innerHTML = block.showName;
        shownameBox.classList.remove("fadeout");
        setTimeout(() => {shownameBox.classList.add("fadeout");}, 10);
    };
};

MCHotbar.setBackgroundAndWaitImg("hotbar-background", ".hotbar-background");
MCHotbar.setBackgroundAndWaitImg("hotbar-selector-background", ".selector-background");
MCHotbar.setBackgroundAndWaitImg("hotbar-inventory-btn-foreground", ".inventory-btn > .foreground");
MCHotbar.setBorderAndWaitImg("hotbar-inventory-btn-bg", ".inventory-btn > .background");
MCHotbar.setBorderAndWaitImg("hotbar-inventory-btn-bg-active", ".inventory-btn[active] > .background, .inventory-btn > .background[active]");

MCHotbar.asyncLoadAndDefine();


export {
    MCHotbar,
};
