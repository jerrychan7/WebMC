
import { Page, pm } from "./Page.js";

class CreateNewWorldPage extends Page {
    constructor() {
        super();
        this.typeBtn = this.shadowRoot.getElementById("world-type-btn");
        this.typeEcho = this.shadowRoot.getElementById("world-type-echo");
        this.createBtn = this.shadowRoot.getElementById("create-new-word");
        this.worldName = this.shadowRoot.getElementById("world-name");
        this.worldSeed = this.shadowRoot.getElementById("world-seed");

        this.typeBtn.addEventListener("click", () => {
            if (this.typeEcho.innerHTML == "Normal")
                this.typeEcho.innerHTML = "Flat";
            else this.typeEcho.innerHTML = "Normal";
        });

        this.createBtn.addEventListener("click", () => {
            let seed = this.worldSeed.value;
            if (seed !== "" && !Number.isNaN(+seed)) seed = +seed;
            pm.openPageByID("play", {
                worldName: this.worldName.value,
                worldType: ({
                    Normal: "pre-classic",
                    Flat: "flat",
                })[this.typeEcho.innerHTML],
                seed,
            });
        });
    };
    onHistoryBack() { this.close(); };
};

pm.addEventListener("transitioned", (from, to) => {
    if (to == "play") pm.closePage("create-new-world");
});

CreateNewWorldPage.asyncLoadAndDefine();


export {
    CreateNewWorldPage,
};
