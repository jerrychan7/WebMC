
import { EventDispatcher } from "./utils/EventDispatcher.js";

class Settings extends EventDispatcher {
    _getStorage() { return JSON.parse(localStorage.getItem("mcSettings") || "{}"); };
    _setStorage(data) { localStorage.setItem("mcSettings", JSON.stringify(data)); };
    _changeProp(key, value) {
        const storage = this._getStorage();
        storage[key] = value;
        this._setStorage(storage);
        this.dispatchEvent("changedValue", key, value);
    };
    constructor() {
        super();
        const storage = this._getStorage();
        this._addNumberProp("fov", 30, 110, 60, storage.fov);
        this._addNumberProp("mousemoveSensitivity", 60, 800, 200, storage.mousemoveSensitivity);
        this._addNumberProp("renderDistance", 1, 32, 4, storage.renderDistance);
        this._addNumberProp("homepageBlur", 0, 10, 3.5, storage.homepageBlur);
        this._addBoolProp("shade", true, storage.shade);
        this._addBoolProp("showDebugOutput", false, storage.showDebugOutput);
    };
    _addNumberProp(key, min, max, defaultVal, currentVal = defaultVal) {
        Object.defineProperty(this, "_" + key, {
            value: { type: "number", min, max, defaultVal, currentVal, },
        });
        Object.defineProperty(this, key, {
            enumerable: true,
            get: () => this["_" + key].currentVal,
            set: (newValue) => {
                let o = this["_" + key];
                o.currentVal = Math.max(o.min, Math.min(o.max, newValue));
                this._changeProp(key, o.currentVal);
            },
        });
        Object.defineProperty(this, key + "Min", {
            get: () => this["_" + key].min,
            set: (newValue) => o.min = newValue,
        });
        Object.defineProperty(this, key + "Max", {
            get: () => this["_" + key].max,
            set: (newValue) => o.max = newValue,
        });
        Object.defineProperty(this, key + "Default", {
            get: () => this["_" + key].defaultVal,
            set: (newValue) => o.defaultVal = newValue,
        });
    };
    _addBoolProp(key, defaultVal, currentVal = defaultVal) {
        Object.defineProperty(this, "_" + key, {
            value: { type: "boolean", defaultVal, currentVal, },
        });
        Object.defineProperty(this, key, {
            enumerable: true,
            get: () => this["_" + key].currentVal,
            set: (newValue) => {
                let o = this["_" + key];
                o.currentVal = !!newValue;
                this._changeProp(key, o.currentVal);
            },
        });
        Object.defineProperty(this, key + "Default", {
            get: () => this["_" + key].defaultVal,
            set: (newValue) => o.defaultVal = newValue,
        });
    };
};

const settings = new Settings();

export {
    settings as default,
    settings,
};
