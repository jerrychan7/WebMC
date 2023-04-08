
import { MCComponent } from "./Component.js";

// progress 存在的意义是可以自定义显示的value值，例如精确到小数点后几位
class MCSlider extends MCComponent {
    #input = this.shadowRoot.querySelector("input");
    #progress = this.shadowRoot.getElementById("progress");
    constructor() {
        super();
        this.#input.addEventListener("input", e => {
            e.preventDefault();
            this.refresh();
            this.dispatchEvent("valueChange", { global: true, data: this.#input.value });
        });
    };
    onConnected() {
        this.initVar();
    };
    refresh() {
        const input = this.#input;
        this.setAttribute("value", input.value);
        if (!this.hasAttribute("progress"))
            this.#progress.innerHTML = input.value;
    };
    initVar() {
        const input = this.#input;
        input.min = this.getAttribute("min") || 0;
        input.max = this.getAttribute("max") || 100;
        input.step = this.getAttribute("step") || 1;
        input.value = this.getAttribute("value") || 50;
        this.refresh();
    };
    static get observedAttributes() { return ["label", "echo", "prefix", "progress", "unit", "min", "step", "max", "value", "disabled"]; };
    onAttrChanged(name, oldVal, newVal) {
        if (name === "echo") {
            this.shadowRoot.getElementById("default-echo").style.display = newVal? "none": null;
            const se = this.shadowRoot.getElementById("specified-echo");
            se.innerHTML = newVal;
            se.style.display = newVal? null: "none";
        }
        else if (name === "label" || name === "prefix")
            this.shadowRoot.querySelector(`[name=${name}]`).innerHTML = newVal;
        else if (name === "unit")
            this.shadowRoot.querySelector("[name=unit]").innerHTML = newVal || "%";
        else if (name === "progress")
            this.#progress.innerHTML = newVal;
        else if (name === "disabled")
            this.#input.disabled = newVal !== null;
        else this.initVar();
    };
};

MCSlider.setBorderAndWaitImg("button-disabled", ":host");
MCSlider.setBorderAndWaitImg("slider-thumb", "input::-webkit-slider-thumb", {
    keepCenter: false,
});
MCSlider.setBorderAndWaitImg("slider-thumb", "input::-moz-range-thumb", {
    keepCenter: false,
});
MCSlider.setBorderAndWaitImg("slider-thumb-hover", "input:not(:disabled)::-webkit-slider-thumb:hover", {
    keepCenter: false,
});

MCSlider.asyncLoadAndDefine();

export {
    MCSlider,
};
