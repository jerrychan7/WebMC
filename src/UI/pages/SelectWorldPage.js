
import { Page, pm } from "./Page.js";

class SelectWorldPage extends Page {
    static get outdegree() { return ["welcome", "play", "create-new-world", ]; };
    constructor() {
        super();
        this.worldList = this.shadowRoot.getElementById("world-list");
        this.btnSelect = this.shadowRoot.getElementById("btn-select");
        this.btnDel = this.shadowRoot.getElementById("btn-del");
        this.selectedWordStorageId = null;
        this.btnSelect.addEventListener("click", this.onBtnSelectClick);
        this.btnDel.addEventListener("click", this.onBtnDelClick);
    };
    refreshList() {
        this.selectedWordStorageId = null;
        this.btnSelect.disabled = true;
        this.btnDel.disabled = true;
        const timestamp2str = ts => (new Date(ts)).toLocaleString();
        this.worldList.innerHTML =
            Object.entries(JSON.parse(localStorage.getItem("worlds") || "{}"))
            .sort((a, b) => b[1].modifyAt - a[1].modifyAt)
            .reduce((str, [storageId, world]) => str + `
                <li>
                    <span class="world-name">${world.name}</span>
                    <span class="create-at">Created - ${timestamp2str(world.createAt)}</span>
                    <span class="modify-at">Modified - ${timestamp2str(world.modifyAt)}</span>
                    <span class="world-mode">${world.type}</span>
                    <span class="storageId">${storageId}</span>
                </li>
            `, "");
        this.worldList.querySelectorAll("li").forEach(li => li.onclick = () => this.onLiClick(li));
    };
    onConnected() {
        this.refreshList();
    };
    onLiClick(li) {
        this.selectedWordStorageId = li.querySelector(".storageId").innerHTML;
        this.worldList.querySelector("li.selected")?.classList.remove("selected");
        li.classList.add("selected");
        this.btnSelect.disabled = false;
        this.btnDel.disabled = false;
    };
    onBtnSelectClick = () => {
        pm.openPageByID("play", { storageId: this.selectedWordStorageId, });
    };
    onBtnDelClick = () => {
        const worlds = JSON.parse(localStorage.getItem("worlds") || "{}");
        delete worlds[this.selectedWordStorageId];
        localStorage.setItem("worlds", JSON.stringify(worlds));
        this.refreshList();
    };
    onHistoryBack() { this.close(); };
    onTransitioned(from, to, eventName, fromPage, toPage, ...data) {
        if (to == "play") this.close();
    };
};

SelectWorldPage.asyncLoadAndDefine();

export {
    SelectWorldPage,
};
