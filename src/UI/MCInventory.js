
import { MCComponent } from "./Component.js";

class MCInventory extends MCComponent {
    static get componentName() { return "mc-inventory"; };
    static get templateUrl() { return "src/UI/MCInventory.html"; };
    constructor() {
        super();
        this.closeBtn = this.shadowRoot.querySelector(".mc-close-btn");
        this.closeBtn.addEventListener("click", e => {
            e.preventDefault();
            this.dispatchEvent(new Event("closeBtnClick"));
            return false;
        });
        this.itemList = this.shadowRoot.querySelector(".mc-inventory-items");
    };
    async connectedCallback() {
        await super.connectedCallback();
    };
    appendItem(block) {
        let div = document.createElement("div");
        div.classList = "mc-inventory-item-background";
        div.appendChild(block.texture.inventory.cloneNode()).draggable = false;
        div.data = block;
        div.onclick = e => {
            e.preventDefault();
            this.dispatchEvent("inventoryItemClick", { global: true, data: block });
            return false;
        };
        this.itemList.append(div);
    };
};

MCInventory.setBorderAndWaitImg("inventory-items", ".mc-inventory-items");
MCInventory.setBorderAndWaitImg("inventory-tab-background-right", ".mc-inventory-tab-background-right");
MCInventory.setBackgroundAndWaitImg("close-btn", ".mc-close-btn");
MCInventory.setBackgroundAndWaitImg("close-btn-active", ".mc-close-btn:active");
MCInventory.setBackgroundAndWaitImg("inventory-item-background", ".mc-inventory-item-background");

MCInventory.asyncLoadAndDefine();


export {
    MCInventory,
};
