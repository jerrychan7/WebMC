
import { Page, pm } from "./Page.js";
import { settings } from "../../settings.js";

class SettingPage extends Page {
    static get outdegree() { return ["welcome", "pause", ]; };
    homepageBlur = this.shadowRoot.getElementById("homepage-blur");
    // renderDistance = this.shadowRoot.getElementById("render-distance");
    fov = this.shadowRoot.getElementById("fov");
    mousemoveSensitivity = this.shadowRoot.getElementById("mouse-sensitivity");
    shadeBtn = this.shadowRoot.getElementById("shade-btn");
    debugOutputBtn = this.shadowRoot.getElementById("debug-output-btn");
    constructor() {
        super();

        for (let key of [
            // "renderDistance",
            "fov",
            "mousemoveSensitivity",
            "homepageBlur",
        ]) {
            const defaultBtn = this[key].nextElementSibling;
            this[key].setAttribute("value", settings[key]);
            this[key].setAttribute("min", settings[key + "Min"]);
            this[key].setAttribute("max", settings[key + "Max"]);
            this[key].addEventListener("valueChange", ({ detail: value }) => {
                settings[key] = +value;
                value = settings[key];
                this[key].setAttribute("value", value);
                defaultBtn.disabled = value === settings[key + "Default"];
                if (key === "homepageBlur")
                    this[key].setAttribute("progress", value.toFixed(1));
            });
            defaultBtn.addEventListener("click", () => {
                const defaultVal = settings[key + "Default"];
                this[key].setAttribute("value", defaultVal);
                defaultBtn.disabled = true;
                settings[key] = defaultVal;
                if (key === "homepageBlur")
                    this[key].setAttribute("progress", defaultVal.toFixed(1));
            });
            defaultBtn.toggleAttribute("disabled", settings[key] === settings[key + "Default"]);
            if (key === "homepageBlur")
                this[key].setAttribute("progress", settings[key].toFixed(1));
        }

        let shadeEcho = this.shadowRoot.getElementById("shade-echo");
        shadeEcho.innerHTML = settings.shade? "ON": "OFF";
        this.shadeBtn.addEventListener("click", () => {
            settings.shade = !settings.shade;
            shadeEcho.innerHTML = settings.shade? "ON": "OFF";
        });

        let debugOutputEcho = this.shadowRoot.getElementById("debug-output-echo");
        debugOutputEcho.innerHTML = settings.showDebugOutput? "ON": "OFF";
        this.debugOutputBtn.addEventListener("click", () => {
            settings.showDebugOutput = !settings.showDebugOutput;
            debugOutputEcho.innerHTML = settings.showDebugOutput? "ON": "OFF";
        });

        const welcome = pm.getPageByID("welcome");
        this.shadowRoot.querySelector(".homepage-blur-group").style.display = welcome? null: "none";
        if (welcome) {
            this.homepageBlur.addEventListener("pointerdown", e => {
                const x = this.homepageBlur.offsetLeft, y = this.homepageBlur.offsetTop;
                const w = this.homepageBlur.offsetWidth, h = this.homepageBlur.offsetHeight;
                this.style.clipPath = `polygon(${x}px ${y}px, ${x + w}px ${y}px, ${x + w}px ${y + h}px, ${x}px ${y + h}px)`;
                welcome.renderer?.play();
            });
            for (let e of "pointerup,pointercancel,pointerout".split(","))
                this.addEventListener(e, () => {
                    this.style.clipPath = null;
                    welcome.renderer?.stop();
                });
        }

        if (pm.getPageByID("play")) {
            const pause = pm.getPageByID("pause");
            this.fov.addEventListener("pointerdown", e => {
                const x = this.fov.offsetLeft, y = this.fov.offsetTop;
                const w = this.fov.offsetWidth, h = this.fov.offsetHeight;
                this.style.clipPath = `polygon(${x}px ${y}px, ${x + w}px ${y}px, ${x + w}px ${y + h}px, ${x}px ${y + h}px)`;
                if (pause) pause.style.display = "none";
            });
            for (let e of "pointerup,pointercancel,pointerout".split(","))
                this.addEventListener(e, () => {
                    this.style.clipPath = null;
                    if (pause) pause.style.display = null;
                });
        }
    };
    onHistoryBack() { this.close(); };
};

SettingPage.asyncLoadAndDefine();


export {
    SettingPage,
};
