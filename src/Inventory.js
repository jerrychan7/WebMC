import { Block } from "./Block.js";

class Inventory {
    constructor(player) {
        this.player = player;
        this.hotbar = [];
        const listBlocks = Block.listBlocks();
        this.inventoryStore = listBlocks;
        this.inventoryPage = document.getElementsByClassName("mc-inventory")[0];
        this.hotbar.push(...listBlocks.slice(0, 9));
        this.hotbar.updated = true;
        this.hotbar.selectOn = 0;
        for (let b of listBlocks) {
            let div = document.createElement("div");
            div.classList = "mc-inventory-item-background";
            div.append(b.texture.inventory.cloneNode());
            div.block = b;
            div.onclick = this.onInventoryItemClick.bind(this, div);
            document.getElementsByClassName("mc-inventory-items")[0].append(div);
        }
        let closeBtns = this.inventoryPage.getElementsByClassName("mc-close-btn");
        for (let btn of closeBtns) {
            btn.onclick = this.closeInventoryPage.bind(this);
        }
        document.getElementsByClassName("mc-hotbar-inventory-btn")[0]
        .onclick = () => {
            if (this.inventoryPage.style.display === "none")
                this.showInventoryPage();
            else this.closeInventoryPage();
        };
    };
    getOnHands() {
        return this.hotbar[this.hotbar.selectOn];
    };
    showInventoryPage() {
        this.inventoryPage.style.display = "";
        document.getElementsByClassName("mc-hotbar-inventory-btn-bg")[0]
        .setAttribute("active", "true");
    };
    closeInventoryPage() {
        this.inventoryPage.style.display = "none";
        document.getElementsByClassName("mc-hotbar-inventory-btn-bg")[0]
        .removeAttribute("active");
        this.player.controller.input.requestPointerLock();
    };
    onInventoryItemClick(div) {
        this.hotbar[this.hotbar.selectOn] = div.block;
        this.hotbar.updated = true;
    };
    OnHotbarItemClick(img) {
        this.updateHotbarSelector(img.index);
    };
    hotbarSelectPrev() {
        this.updateHotbarSelector(this.hotbar.selectOn + 1);
    };
    hotbarSelectNext() {
        this.updateHotbarSelector(this.hotbar.selectOn - 1);
    };
    updateHotbarSelector(i = this.hotbar.selectOn) {
        // i = Math.max(0, Math.min(i, this.hotbar.length - 1));
        i = (i + this.hotbar.length) % this.hotbar.length;
        this.hotbar.selectOn = i;
        let div = document.getElementsByClassName("mc-hotbar-selector-background")[0];
        div.style.setProperty("--offset", i);
    };
    update() {
        if (this.hotbar.updated) {
            let div = document.getElementById("mc-hotbar-items");
            if (div) {
                div.innerHTML = "";
                for (let i = 0; i < this.hotbar.length; ++i) {
                    let block = this.hotbar[i];
                    let img = block.texture.inventory.cloneNode();
                    img.block = block; img.index = i;
                    img.onclick = this.OnHotbarItemClick.bind(this, img);
                    div.append(img);
                }
            }
            this.hotbar.updated = false;
        }
    };
}

export {
    Inventory,
    Inventory as default
};
