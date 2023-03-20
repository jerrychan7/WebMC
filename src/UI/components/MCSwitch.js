
import { MCComponent } from "./Component.js";

class MCSwitch extends MCComponent {
    #on = this.shadowRoot.querySelector("slot[name=on]");
    #off = this.shadowRoot.querySelector("slot[name=off");
    #refresh(checked = this.checked) {
        this.#on.style.display = checked? null: "none";
        this.#off.style.display = checked? "none": null;
    };
    constructor() {
        super();
        this.#refresh();
        this.addEventListener("click", e => {
            if (this.disabled) return false;
            this.checked = !this.checked;
            this.dispatchEvent("toggle", { global: true, data: this.checked, });
        });
    };
    static observedAttributes = ["disabled", "value", "sep", "checked", "on", "off"];
    onAttrChanged(name, oldValue, newValue) {
        if (name === "checked") this.#refresh(newValue !== null);
        else if (name === "disabled") this.disabled = newValue;
        else if (name === "value")
            this.shadowRoot.querySelector("slot").innerHTML = newValue;
        else if (name === "sep")
            this.shadowRoot.querySelector("slot[name=sep]").innerHTML = newValue;
        else if (name === "on")
            this.#on.innerHTML = newValue;
        else if (name === "off")
            this.#off.innerHTML = newValue;
    };
    get disabled() { return this.hasAttribute("disabled"); };
    set disabled(val) {
        if (val) this.setAttribute("disabled", "");
        else this.removeAttribute("disabled");
    };
    get checked() { return this.hasAttribute("checked"); };
    set checked(val) {
        if (this.disabled) return;
        if (val) this.setAttribute("checked", "");
        else this.removeAttribute("checked");
    };
};

MCSwitch.setBorderAndWaitImg("button", ":host");
MCSwitch.setBorderAndWaitImg("button-hover", ":host(:hover)");
MCSwitch.setBorderAndWaitImg("button-active", ":host(:active)");
MCSwitch.setBorderAndWaitImg("button-disabled", ":host([disabled])");

MCSwitch.asyncLoadAndDefine();

export {
    MCSwitch
};
