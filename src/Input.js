
class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.doc = canvas.ownerDocument;
        this[Symbol.for("callbacks")] = ("keydown,keyup,mousedown,mouseup,mousemove,mousewheel,wheelup,wheeldown").split(",")
            .reduce((obj, event) => {
                obj[event] = [];
                return obj;
            }, {});
        this.keys = [];
        canvas.requestPointerLock = canvas.requestPointerLock    ||
                                    canvas.mozRequestPointerLock ||
                                    canvas.webkitRequestPointerLock;
        this.autoLock = false;
        this.locked = false;
        this.doc.addEventListener("pointerlockchange", (e) => {
            this.locked = document.pointerLockElement === this.canvas;
        });
        this.doc.addEventListener("keydown", this[Symbol.for("onKeyDown")].bind(this), false);
        this.doc.addEventListener("keyup", this[Symbol.for("onKeyUp")].bind(this), false);
        canvas.addEventListener("mousedown", this[Symbol.for("onMouseDown")].bind(this), false);
        canvas.addEventListener("mouseup", this[Symbol.for("onMouseUp")].bind(this), false);
        canvas.addEventListener("mousemove", this[Symbol.for("onMouseMove")].bind(this), false);
        canvas.addEventListener("mousewheel", this[Symbol.for("onMouseWheel")].bind(this), false);
        canvas.addEventListener("DOMMouseScroll", this[Symbol.for("onMouseWheel")].bind(this), false);
        canvas.addEventListener("contextmenu", e => {e.preventDefault();}, false);
        this.addEventListener("mousewheel", (e) => {
            if (e.deltaY < 0) this[Symbol.for("targetEvent")]("wheelup", e, this.locked);
            else if (e.deltaY > 0) this[Symbol.for("targetEvent")]("wheeldown", e, this.locked);
        });
    };
    // 鼠标点击第一次锁定，同时让注册的回调函数只有在鼠标锁定的情况下才回调
    enableAutoPointerLock() {
        if (this.autoLock !== false) return;
        this[Symbol.for("callbacks")].mousedown.unshift((e, locked) => {
            if (!locked) {
                this.canvas.requestPointerLock();
                return false;
            }
        });
        Object.entries(this[Symbol.for("callbacks")]).forEach(([event, cbs]) => {
            if (event === "mousedown") return;
            cbs.unshift((_, locked) => locked);
        });
        this.autoLock = true;
    };
    disableAutoPointerLock() {
        if (this.autoLock === false) return;
        Object.values(this[Symbol.for("callbacks")]).forEach(cbs => cbs.shift());
        this.autoLock = false;
    };
    exitPointerLock() {
        this.doc.exitPointerLock();
    };

    [Symbol.for("onKeyDown")](e) {
        this.keys[e.keyCode] = this.keys[String.fromCharCode(e.keyCode)] = true;
        this[Symbol.for("targetEvent")]("keydown", e, this.locked);
        return true;
    };
    [Symbol.for("onKeyUp")](e) {
        this.keys[e.keyCode] = this.keys[String.fromCharCode(e.keyCode)] = false;
        this[Symbol.for("targetEvent")]("keyup", e, this.locked);
        return true;
    };
    [Symbol.for("onMouseDown")](e) {
        this[Symbol.for("targetEvent")]("mousedown", e, this.locked);
        return true;
    };
    [Symbol.for("onMouseUp")](e) {
        this[Symbol.for("targetEvent")]("mouseup", e, this.locked);
        return true;
    };
    [Symbol.for("onMouseMove")](e) {
        this[Symbol.for("targetEvent")]("mousemove", e, this.locked);
        return true;
    };
    [Symbol.for("onMouseWheel")](e) {
        this[Symbol.for("targetEvent")]("mousewheel", e, this.locked);
        return true;
    };

    [Symbol.for("targetEvent")](event, ...arg) {
        if (event in this[Symbol.for("callbacks")])
            for (let fn of this[Symbol.for("callbacks")][event])
                if (fn.apply(this, arg) === false)
                    break;
    };

    addEventListener(event, callback) {
        if (event in this[Symbol.for("callbacks")])
            this[Symbol.for("callbacks")][event].push(callback);
        else throw "Input addEventListener error: Unrecognized event \"" + event + '"';
    };
    removeEventListener(event, callback) {
        if (!(event in this[Symbol.for("callbacks")])) return false;
        return this[Symbol.for("callbacks")][event].some((cb, i, cbs) => {
            if (cb === callback) {
                cbs.splice(i, 1);
                return true;
            }
            return false;
        });
    };
};

export {
    Input,
    Input as default
};
