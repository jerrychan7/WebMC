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
        for (let i = 0; i < 6; ++i)
        for (let j = 0; j < 9; ++j) {
            let div = document.createElement("div");
            div.classList = "mc-inventory-item-background";
            let b = listBlocks[i * 9 + j]? listBlocks[i * 9 + j]: listBlocks[0];
            div.append(b.texture.inventory.cloneNode());
            div.block = b;
            div.onclick = this.onInventoryItemClick.bind(this, div);
            document.getElementsByClassName("mc-inventory-items-background")[0].append(div);
        }
    };
    getOnHands() {
        return this.hotbar[this.hotbar.selectOn];
    };
    showInventoryPage() {
        this.inventoryPage.style.display = "block";
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
        i = Math.max(0, Math.min(i, this.hotbar.length - 1));
        console.log(i)
        this.hotbar.selectOn = i;
        let div = document.getElementsByClassName("mc-hotbar-selector-background")[0];
        div.style.left = (this.hotbar.selectOn * 40 - 2) + "px";
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
