
import { Page, pm } from "./Page.js";

// TODO: 使用单个设置单例来同步设置以及持久化

class SettingPage extends Page {
    static get outdegree() { return ["welcome", "pause", ]; };
    constructor() {
        super();
        const welcome = pm.getPageByID("welcome");
        if (welcome) {
            this.homepageBlur = this.shadowRoot.getElementById("homepage-blur");
            let blurLevel = (window.getComputedStyle(
                welcome.bgCanvas).filter.replace(/[^\d.]+/g, "") * window.devicePixelRatio).toFixed(1);
            this.homepageBlur.setAttribute("value", blurLevel);
            this.homepageBlur.setAttribute("progress", blurLevel);
            this.homepageBlur.addEventListener("valueChange", ({ detail }) => {
                welcome.bgCanvas.style.filter = `blur(calc(${detail}px / var(--device-pixel-ratio)))`;
                this.homepageBlur.setAttribute("progress", (+detail).toFixed(1));
            });
            this.homepageBlur.addEventListener("pointerdown", e => {
                const x = this.homepageBlur.offsetLeft, y = this.homepageBlur.offsetTop;
                const w = this.homepageBlur.offsetWidth, h = this.homepageBlur.offsetHeight;
                this.style.clipPath = `polygon(${x}px ${y}px, ${x + w}px ${y}px, ${x + w}px ${y + h}px, ${x}px ${y + h}px)`;
            });
            for (let e of "pointerup,pointercancel,pointerout".split(","))
                this.addEventListener(e, () => {
                    this.style.clipPath = null;
                });
        }
    };
    onHistoryBack() { this.close(); };
};

SettingPage.asyncLoadAndDefine();


export {
    SettingPage,
};
