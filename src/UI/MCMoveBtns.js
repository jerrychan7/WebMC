
import { MCComponent } from "./Component.js";

class MCMoveButtons extends MCComponent {
    static get componentName() { return "mc-move-buttons"; };
    static get templateUrl() { return "src/UI/MCMoveBtns.html"; };
    constructor() {
        super();
        this.lastMoveBtn = null;
        this.lastBtnPressTime = {};
        for (let id of "up,left,down,right,jump,upleft,upright,flyup,flydown,fly,sneak".split(",")) {
            this[id] = this.shadowRoot.getElementById(id);
            this.lastBtnPressTime[id] = 0;
        }
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        // if use { passive: true }, mobile browser will vibration,
        // else will get a warning
        this.addEventListener("touchstart", this.onTouchMove);
        this.addEventListener("touchend", this.onTouchEnd);
        this.addEventListener("touchcancel", this.onTouchEnd);
        this.addEventListener("touchmove", this.onTouchMove);
    };
    get size() { return 1 * getComputedStyle(this).getPropertyValue("--slice"); };
    set size(v) { return this.style.setProperty("--slice", v); };
    static get observedAttributes() { return ["fly_btn_active"]; };
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
        case "fly_btn_active": {
            this.activeFlyBtn(this.hasAttribute(name));
            break; }
        }
    };
    activeFlyBtn(bool) {
        if (bool) {
            this.jump.style.display = "none";
            this.fly.style.display = "";
            if (!this.hasAttribute("fly_btn_active")) this.setAttribute("fly_btn_active", "");
        }
        else {
            this.jump.style.display = "";
            this.fly.style.display = "none";
            if (this.hasAttribute("fly_btn_active")) this.removeAttribute("fly_btn_active");
        }
    };
    onTouchMove(e) {
        if (e.cancelable) e.preventDefault();
        let ele = this.shadowRoot.elementFromPoint(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        if (this.lastMoveBtn !== ele) {
            this.activeMoveBtn(ele, e);
            this.inactiveMoveBtn(this.lastMoveBtn, e);
            this.lastMoveBtn = ele;
        }
    };
    onTouchEnd(e) {
        if (e.cancelable) e.preventDefault();
        this.inactiveMoveBtn(this.lastMoveBtn, e);
        this.lastMoveBtn = null;
    };
    activeMoveBtn(btn, e) {
        if (!btn) return;
        btn.setAttribute("active", "");
        switch (btn) {
        case this.up: {
            this.upleft.style.display = this.upright.style.display = "";
            break; }
        case this.fly: {
            this.up.style.display = this.down.style.display = "none";
            this.flyup.style.display = this.flydown.style.display = "";
            break; }
        }
        this.dispatchEvent(btn.id + "BtnPress", { global: true, data: btn, });
        let now = new Date(), duringTime = now - this.lastBtnPressTime[btn.id];
        if (0 < duringTime && duringTime < 250)
            this.dispatchEvent(btn.id + "BtnDblPress", { global: true, data: btn, });
        this.lastBtnPressTime[btn.id] = now;
    };
    inactiveMoveBtn(btn, e) {
        if (!btn) return;
        btn.removeAttribute("active");
        switch (btn) {
        case this.up: case this.upleft: case this.upright: {
            if (this.up.hasAttribute("active") || this.upleft.hasAttribute("active") || this.upright.hasAttribute("active"))
                break;
            this.upleft.style.display = this.upright.style.display = "none";
            break; }
        case this.fly: case this.flyup: case this.flydown: {
            if (this.fly.hasAttribute("active") || this.flyup.hasAttribute("active") || this.flydown.hasAttribute("active"))
                break;
            this.flyup.style.display = this.flydown.style.display = "none";
            this.up.style.display = this.down.style.display = "";
            break; }
        }
        this.dispatchEvent(btn.id + "BtnUp", { global: true, data: btn });
    };
};

for (let name of "up,left,down,right,jump,upleft,upright,flyup,flydown,fly,sneak".split(",")) {
    MCMoveButtons.setBackgroundAndWaitImg(`mc-ui-move-btn-${name}-img`, `#${name}`);
    MCMoveButtons.setBackgroundAndWaitImg(`mc-ui-move-btn-${name}-active-img`, `#${name}[active]`);
}

MCMoveButtons.asyncLoadAndDefine();


export {
    MCMoveButtons,
};
