
import { MCComponent } from "./Component.js";

import { pm } from "./Page.js";

class MCButton extends MCComponent {
    static get componentName() { return "mc-button"; };
    static get templateUrl() { return "src/UI/MCButton.html" };
    constructor() {
        super();
        this.addEventListener("click", e => {
            if (this.disabled || !this.hasAttribute("gotoPage")) return false;
            let pageID = this.getAttribute("gotoPage");
            pm.openPageByID(pageID);
        });
    };
    static get observedAttributes() { return ["disabled", "value"]; };
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "value")
            this.shadowRoot.querySelector("slot").innerHTML = newValue;
    };
    get disabled() { return this.hasAttribute("disabled"); };
    set disabled(val) {
        if (val) this.setAttribute("disabled", "");
        else this.removeAttribute("disabled");
    };
};

MCButton.setBorderAndWaitImg("button", ":host");
MCButton.setBorderAndWaitImg("button-hover", ":host(:hover)");
MCButton.setBorderAndWaitImg("button-active", ":host(:active)");
MCButton.setBorderAndWaitImg("button-disabled", ":host([disabled])");

MCButton.asyncLoadAndDefine();


export {
    MCButton,
};
