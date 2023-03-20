
import { MCComponent } from "./Component.js";

class MCMoveButtons extends MCComponent {
    static get templateUrlFilename() { return "MCMoveBtns"; };
    constructor() {
        super();
        this.lastBtnPressTime = {};
        this.isPress = {};
        this.btns = [];
        for (let id of "up,left,down,right,jump,upleft,upright,flyup,flydown,fly,sneak".split(",")) {
            this[id] = this.btns[id] = this.shadowRoot.getElementById(id);
            this.lastBtnPressTime[id] = 0;
            this.isPress[id] = false;
            this.btns.push(this[id]);
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
    activeFlyBtn(bool) {
        if (bool) {
            if (this.jump.hasAttribute("active")) this.inactiveMoveBtn(this.jump);
            this.jump.style.display = "none";
            this.fly.style.display = "";
            this.activeMoveBtn(this.fly, false);
        }
        else {
            if (this.fly.hasAttribute("active")) this.inactiveMoveBtn(this.fly);
            this.fly.style.display = "none";
            this.jump.style.display = "";
            this.activeMoveBtn(this.jump, false);
        }
    };
    onTouchMove(e) {
        if (e.cancelable) e.preventDefault();
        const pressedBtns = Object.entries(this.isPress).filter(([id, isPress]) => isPress).map(([id]) => this[id]);
        const targetBtns = Array.from(e.touches)
            .map(touch => this.shadowRoot.elementFromPoint(touch.clientX, touch.clientY))
            .filter(ele => this.btns.includes(ele));
        targetBtns.forEach(btn => this.activeMoveBtn(btn));
        pressedBtns.forEach(btn => {
            if (!targetBtns.includes(btn))
                this.inactiveMoveBtn(btn);
        });
    };
    onTouchEnd(e) {
        if (e.cancelable) e.preventDefault();
        const targetBtns = Array.from(e.changedTouches)
            .map(touch => this.shadowRoot.elementFromPoint(touch.clientX, touch.clientY))
            .filter(ele => this.btns.includes(ele));
        targetBtns.forEach(btn => this.inactiveMoveBtn(btn));
    };
    activeMoveBtn(btn, fireEvent = true) {
        if (!btn || this.isPress[btn.id]) return;
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
        this.isPress[btn.id] = true;
        if (!fireEvent) return;
        this.dispatchEvent(btn.id + "BtnPress", { global: true, data: btn, });
        if (this.lastBtnPressTime[btn.id] === 0)
            this.lastBtnPressTime[btn.id] = new Date();
        else if ((new Date()) - this.lastBtnPressTime[btn.id] < 250) {
            this.dispatchEvent(btn.id + "BtnDblPress", { global: true, data: btn, });
            this.lastBtnPressTime[btn.id] = 0;
        }
        else this.lastBtnPressTime[btn.id] = new Date();
    };
    inactiveMoveBtn(btn, fireEvent = true) {
        if (!btn || !this.isPress[btn.id]) return;
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
        this.isPress[btn.id] = false;
        if (!fireEvent) return;
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
