
import { MCComponent } from "./Component.js";

const sleep = (ms = 0) => new Promise(s => setTimeout(s, ms));
const sleepFrame = (frame = 1) => frame? new Promise(s => {
    const fn = () => frame-- > 0? window.requestAnimationFrame(fn): s();
    fn();
}): sleep();

// 由于原生的input无法显示下划线样式的光标，故自己实现了一个
// 仍然还有很多东西不合理，但目前来说够用就行
class MCInput extends MCComponent {
    #input = this.shadowRoot.getElementById("input");
    // 获取目前闪烁的光标的全局位置
    // https://javascript.plainenglish.io/how-to-find-the-caret-inside-a-contenteditable-element-955a5ad9bf81
    #getCaretRect = () => {
        const ans = { x: 0, width: 0, };
        const root = "getSelection" in this.shadowRoot? this.shadowRoot
                    : "getSelection" in window? window
                    : null;
        if (!root) return ans;
        const selection = root.getSelection();
        if (selection.rangeCount === 0) return ans;
        const rect = selection.getRangeAt(0).getClientRects()[0];
        if (rect) ans.x = rect.left, ans.width = rect.width;
        return ans;
    };
    #updateCaret = async () => {
        await sleepFrame();
        const input = this.#input;
        let { x, width } = this.#getCaretRect();
        input.classList.toggle("has-select-text", !!width);
        input.classList.toggle("blink", false);
        if (width) {}
        else if (x) {
            const startAt = this.getBoundingClientRect().left + this.clientLeft + parseFloat(getComputedStyle(this).paddingLeft);
            x -= startAt;
            const width = input.clientWidth;
            const widthFor1ch = parseFloat(getComputedStyle(input, "::after").width);
            if (x <= width - widthFor1ch)
                input.style.setProperty("--caret-x", x);
            else {
                input.style.setProperty("--caret-x", width - widthFor1ch);
                input.scrollLeft += x - (width - widthFor1ch);
            }
        }
        else input.style.setProperty("--caret-x", "");
        await sleep(500);
        input.classList.toggle("blink", true);
    };
    constructor() {
        super();
        this.addEventListener("pointerdown", async () => {
            if (this.disabled) return;
            if (!this.shadowRoot.activeElement) {
                await sleep();
                this.#input.focus();
            }
        });
        this.addEventListener("pointerup", this.#updateCaret);
        this.addEventListener("keydown", e => {
            // prevent Enter
            if (e.keyCode === 13) e.preventDefault();
        });
        this.addEventListener("keyup", this.#updateCaret);
        this.#input.addEventListener("input", this.#updateCaret);
        this.#input.addEventListener("blur", () => {
            this.#input.scrollLeft = 0;
        });
        this.spellcheck = false;
    };
    static get observedAttributes() { return ["disabled", "value", "placeholder", "spellcheck"]; };
    onAttrChanged(name, oldValue, newValue) {
        if (name === "placeholder") this.#input.setAttribute("placeholder", newValue);
        else if (name == "value") this.value = newValue;
        else if (name == "spellcheck") this.spellcheck = newValue != null;
        else if (name == "disabled") this.disabled = newValue != null;
    };
    get spellcheck() { return this.#input.spellcheck; };
    set spellcheck(val) {
        this.#input.spellcheck = !!val;
    };
    get disabled() { return this.hasAttribute("disabled"); };
    set disabled(val) {
        if (!!val) {
            this.setAttribute("disabled", "");
            this.#input.removeAttribute("contenteditable");
        }
        else {
            this.removeAttribute("disabled");
            this.#input.setAttribute("contenteditable", "");
        }
    };
    get value() { return this.#input.innerText; };
    set value(val) {
        this.#input.innerHTML = val.replace(/[\r\n]+/g, "");
    };
};

MCInput.asyncLoadAndDefine();


export {
    MCInput,
};
