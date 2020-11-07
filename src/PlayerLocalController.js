import EntityController from "./EntityController.js";
import { vec3 } from "./gmath.js";
import spa from "./spa.js";

class PlayerLocalController extends EntityController {
    constructor(player, {
        canvas = null,
        movesButtons = null,
        mousemoveSensitivity = 200,
    } = {}) {
        super(player);
        this.callbacks = {};
        this.eventHandler = this.eventHandler.bind(this);
        this.triggerWheelUpOrDown = this.triggerWheelUpOrDown.bind(this);
        this.setCanvas(canvas);
        this.setMoveBtns(movesButtons);
        this._locked = false;
        this.keys = [];
        this.showStopPage = false;
        this.mousemoveSensitivity = mousemoveSensitivity;
        this.canvasLastTouchPos = this.canvasBeginTouch = this.canvasTouchTimer = null;
        this.canvasTouchMoveLen = 0;
        this.canvasDestroying = false;
        this.lastMoveBtn = null;
    };
    get locked() {
        return window.isTouchDevice || this._locked;
    };
    setCanvas(canvas = null) {
        if (this.canvas) {
            for (let eventType of ["keydown", "keyup", "pointerlockchange", ])
                this.doc.removeEventListener(eventType, this.eventHandler);
            for (let eventType of ["mousedown", "mouseup", "mousemove", "mousewheel", "mousewheel", "DOMMouseScroll", "contextmenu", "touchstart", "touchend", "touchcancel", "touchmove", ])
                this.canvas.removeEventListener(eventType, this.eventHandler);
            this.canvas.removeEventListener("mousewheel", this.triggerWheelUpOrDown);
            this.setMoveBtns(this.moveBtns);
            this.disableTouchCanvas();
            this.canvas = this.doc = null;
        }
        this.canvas = canvas; this.doc = null;
        if (!canvas) return;
        const doc = this.doc = canvas.ownerDocument;
        this.canvas.requestPointerLock =
            canvas.requestPointerLock    ||
            canvas.mozRequestPointerLock ||
            canvas.webkitRequestPointerLock;
        for (let eventType of ["keydown", "keyup", "pointerlockchange", ])
            doc.addEventListener(eventType, this.eventHandler);
        for (let eventType of ["mousedown", "mouseup", "mousemove", "mousewheel", "mousewheel", "DOMMouseScroll", "contextmenu", ])
            canvas.addEventListener(eventType, this.eventHandler);
        canvas.addEventListener("mousewheel", this.triggerWheelUpOrDown);
        if (window.isTouchDevice) this.enableTouchCanvas();
    };
    enableTouchCanvas() {
        if (!this.canvas) return false;
        for (let eventType of ["touchstart", "touchend", "touchcancel", "touchmove", ])
            this.canvas.addEventListener(eventType, this.eventHandler);
    };
    disableTouchCanvas() {
        if (!this.canvas) return false;
        for (let eventType of ["touchstart", "touchend", "touchcancel", "touchmove", ])
            this.canvas.removeEventListener(eventType, this.eventHandler);
        if (this.canvasTouchTimer !== null) window.clearTimeout(this.canvasTouchTimer);
        this.canvasTouchTimer = null;
    };
    setMoveBtns(dom = null) {
        if (this.moveBtns) {
            for (let eventType of ["touchstart", "touchend", "touchcancel", "touchmove", ])
                this.moveBtns.removeEventListener(eventType, this.eventHandler);
            this.moveBtns = null;
            this.disableTouchCanvas();
        }
        this.moveBtns = dom;
        if (!dom) return;
        for (let eventType of ["touchstart", "touchend", "touchcancel", "touchmove", ])
            dom.addEventListener(eventType, this.eventHandler);
        if (window.isTouchDevice) this.enableTouchCanvas();
    };
    requestPointerLock() {
        if (this.canvas === null || window.isTouchDevice) return;
        this.canvas.requestPointerLock();
    };
    exitPointerLock() {
        if (this.canvas === null || window.isTouchDevice) return;
        this.doc.exitPointerLock();
    };
    eventHandler(e, eventType = e.type) {
        if (eventType.startsWith("touch") && e.target !== this.canvas) {
            eventType = "moveBtnsT" + eventType.substring(1);
        }
        if (eventType in this) this[eventType](e);
        if (eventType in this.callbacks)
            this.callbacks[eventType].some(cb => cb.call(this, e) === false);
    };
    triggerWheelUpOrDown(e) {
        if (e.deltaY < 0) this.eventHandler(e, "wheelup");
        else if (e.deltaY > 0) this.eventHandler(e, "wheeldown");
    };
    addEventListener(eventType, callback) {
        if (eventType in this.callbacks)
            this.callbacks[eventType].push(callback);
        else this.callbacks[eventType] = [callback];
    };
    removeEventListener(event, callback) {
        if (!(event in this.callbacks)) return false;
        return this.callbacks[event].some((cb, i, cbs) => {
            if (cb === callback) {
                cbs.splice(i, 1);
                return true;
            }
            return false;
        });
    };
    contextmenu(e) { if (e.cancelable) e.preventDefault(); };
    mousemove(e) {
        if (!this.locked) return;
        let i = this.mousemoveSensitivity * (Math.PI / 180);
        // movementX left- right+    movementY up- down+
        this.entity.yaw -= (e.movementX || e.mozMovementX || e.webkitMovementX || 0) * i / this.canvas.width;
        this.entity.pitch -= (e.movementY || e.mozMovementY || e.webkitMovementY || 0) * i / this.canvas.height;
        if (this.entity.pitch > Math.PI / 2)
            this.entity.pitch = Math.PI / 2;
        else if (this.entity.pitch < -Math.PI / 2)
            this.entity.pitch = -Math.PI / 2;
    };
    mousedown(e) {
        if (!this.locked) {
            this.requestPointerLock();
            return;
        }
        if (e.button !== 0 && e.button !== 2) return;
        if (e.button === 0) this.mouseRightBtnDown = true;
        if (e.button === 2) this.mouseLeftBtnDown = true;
        const destroyOrPlaceBlock = () => {
            let entity = this.entity,
                world = entity.world,
                start = entity.getEyePosition(),
                end = entity.getDirection(20);
            vec3.add(start, end, end);
            let hit = world.rayTraceBlock(start, end, (x, y, z) => {
                let b = world.getTile(x, y, z);
                return b && b.name !== "air";
            });
            if (hit === null || hit.axis === "") return;
            let pos = hit.blockPos;
            if (this.mouseLeftBtnDown) {
                pos["xyz".indexOf(hit.axis[0])] += hit.axis[1] === '-'? -1: 1;
                let box = this.entity.getGloBox();
                box.min = box.min.map(n => Math.floor(n));
                box.max = box.max.map(n => Math.ceil(n));
                if (pos[0] >= box.min[0] && pos[1] >= box.min[1] && pos[2] >= box.min[2]
                && pos[0] < box.max[0] && pos[1] < box.max[1] && pos[2] < box.max[2])
                    return;
                let blockName = this.entity.inventory.getOnHands().name;
                if (blockName !== "air") world.setTile(...pos, blockName);
            }
            else if (this.mouseRightBtnDown) {
                world.setTile(...pos, "air");
            }
        };
        destroyOrPlaceBlock();
        if (this.destroyOrPlaceBlockTimer !== null)
            window.clearInterval(this.destroyOrPlaceBlockTimer);
        this.destroyOrPlaceBlockTimer = window.setInterval(destroyOrPlaceBlock, 300);
    };
    mouseup(e) {
        if (!this.locked) return;
        if (e.button === 0) this.mouseRightBtnDown = false;
        if (e.button === 2) this.mouseLeftBtnDown = false;
        if (!(this.mouseRightBtnDown || this.mouseLeftBtnDown) && this.destroyOrPlaceBlockTimer !== null) {
            window.clearInterval(this.destroyOrPlaceBlockTimer);
            this.destroyOrPlaceBlockTimer = null;
        }
    };
    keydown(e) {
        if (this.entity.inventory) {
            if (e.key == 'E' || e.key == 'e') {
                if (this.locked) {
                    this.showStopPage = false;
                    this.exitPointerLock();
                    this.entity.inventory.showInventoryPage();
                }
                else this.entity.inventory.closeInventoryPage();
            }
        }
        if (!this.locked) return;
        if (e.repeat !== true) {
            if (e.keyCode) this.keys[e.keyCode] = (this.keys[e.keyCode] || 0) + 1;
            this.keys[e.key] = this.keys[e.code] = (this.keys[e.key] || 0) + 1;
        }
        if (e.key == ' ') {
            let {spaceDownTime, spaceUpTime} = this;
            let now = new Date();
            if (spaceDownTime - spaceUpTime < 0 && now - spaceDownTime > 90 && now - spaceDownTime < 250)
                this.doubleClickSpace = true;
            else this.doubleClickSpace = false;
            if (this.doubleClickSpace) {
                this.entity.toFlyMode && this.entity.toFlyMode(!this.entity.isFly);
                let {moveBtns} = this;
                try {
                    if (this.entity.isFly) {
                        moveBtns.querySelector(".mc-move-btn-jump").style.display = "none";
                        moveBtns.querySelector(".mc-move-btn-fly").style.display = "";
                    }
                    else {
                        moveBtns.querySelector(".mc-move-btn-jump").style.display = "";
                        moveBtns.querySelector(".mc-move-btn-fly").style.display = "none";
                    }
                } catch {}
            }
            this.spaceDownTime = now;
        }
        if (e.code == "KeyW") {
            let {moveDownTime, moveUpTime} = this;
            let now = new Date();
            if (moveDownTime - moveUpTime < 0 && now - moveDownTime > 90 && now - moveDownTime < 250)
                this.doubleClickMove = true;
            else this.doubleClickMove = false;
            if (this.doubleClickMove) {
                this.entity.toRunMode && this.entity.toRunMode(!this.entity.isRun);
            }
            this.moveDownTime = now;
        }
    };
    keyup(e) {
        if (!this.locked) return;
        if (e.keyCode) this.keys[e.keyCode] = (this.keys[e.keyCode] || 1) - 1;
        this.keys[e.key] = this.keys[e.code] = (this.keys[e.key] || 1) - 1;
        if (!this.keys.Space) this.spaceUpTime = new Date();
        if (!this.keys.KeyW) {
            this.moveUpTime = new Date();
            this.entity.toRunMode && this.entity.toRunMode(false);
        }
    };
    wheelup(e) {
        if (!this.locked) return;
        const t = new Date();
        if (t - this.lastWeelTime < 100) return;
        this.entity.inventory && this.entity.inventory.hotbarSelectNext();
        this.lastWeelTime = t;
    };
    wheeldown(e) {
        if (!this.locked) return;
        const t = new Date();
        if (t - this.lastWeelTime < 100) return;
        this.entity.inventory && this.entity.inventory.hotbarSelectPrev();
        this.lastWeelTime = t;
    };
    pointerlockchange(e) {
        let locked = document.pointerLockElement === this.canvas;
        if (this.locked === locked) return;
        if (!locked && this.showStopPage) {
            spa.openPage("stop_game_page");
        }
        else if (locked) this.requestPointerLock();
        this.showStopPage = true;
        this._locked = locked;
    };
    dispatchMouseEventByTouchEvt(type, touchEvt, {
        button = 0, buttons = button, movementX = 0, movementY = 0
    } = {}) {
        this.canvas.dispatchEvent(new MouseEvent("mouse" + type, {
            bubbles: true, cancelable: true, relatedTarget: this.canvas,
            screenX: touchEvt.changedTouches[0].screenX, screenY: touchEvt.changedTouches[0].screenY,
            clientX: touchEvt.changedTouches[0].clientX, clientY: touchEvt.changedTouches[0].clientY,
            ...(type !== "move"? {button, buttons,}: {movementX, movementY,}),
        }));
    };
    touchstart(e) {
        if (e.cancelable) e.preventDefault();
        this.canvasLastTouchPos = this.canvasBeginTouch = e;
        this.canvasTouchMoveLen = 0;
        this.canvasDestroying = false;
        if (this.canvasTouchTimer !== null) window.clearTimeout(this.canvasTouchTimer);
        this.canvasTouchTimer = window.setTimeout(() => {
            if (this.canvasTouchMoveLen < 10) {
                this.canvasDestroying = true;
                this.dispatchMouseEventByTouchEvt("down", this.canvasLastTouchPos);
            }
            this.canvasTouchTimer = null;
        }, 300);
    };
    get touchcancel() { return this.touchend; };
    touchend(e) {
        if (e.cancelable) e.preventDefault();
        if (e.timeStamp - this.canvasBeginTouch.timeStamp < 150) {
            this.dispatchMouseEventByTouchEvt("down", e, {button: 2});
            this.dispatchMouseEventByTouchEvt("up", e, {button: 2});
        }
        else if (this.canvasDestroying) {
            this.dispatchMouseEventByTouchEvt("up", e);
        }
        if (this.canvasTouchTimer !== null) window.clearTimeout(this.canvasTouchTimer);
        this.canvasLastTouchPos = null;
    };
    touchmove(e) {
        if (e.cancelable) e.preventDefault();
        if (!this.canvasLastTouchPos) {
            this.canvasLastTouchPos = e;
            return;
        }
        let movementX = e.targetTouches[0].screenX - this.canvasLastTouchPos.targetTouches[0].screenX,
            movementY = e.targetTouches[0].screenY - this.canvasLastTouchPos.targetTouches[0].screenY;
        this.canvasTouchMoveLen += Math.sqrt(movementX ** 2 + movementY ** 2);
        this.dispatchMouseEventByTouchEvt("move", e, {movementX: movementX * 2, movementY});
        this.canvasLastTouchPos = e;
    };
    dispatchKeyEvent(type, key, code = "Key" + key.toUpperCase(), keyCode = key.toUpperCase().charCodeAt(0), repeat = false) {
        this.doc.dispatchEvent(new KeyboardEvent("key" + type, {
            bubbles: true, cancelable: true,
            key, code, keyCode, repeat, which: keyCode,
        }));
    };
    activeMoveBtn(btn, e) {
        if (!btn) return;
        btn.setAttribute("active", "ture");
        const classList = [...btn.classList], {moveBtns} = this;
        if (classList.includes("mc-move-btn-up")) {
            for (let b of moveBtns.querySelectorAll('[class*="mc-move-btn-up"]'))
                b.style.display = "";
            this.dispatchKeyEvent("down", "w");
        }
        else if (classList.includes("mc-move-btn-fly")) {
            for (let b of moveBtns.querySelectorAll(".mc-move-btn-up, .mc-move-btn-down"))
                b.style.display = "none";
            for (let b of moveBtns.querySelectorAll('[class*="mc-move-btn-fly"]'))
                b.style.display = "";
        }
        else if (classList.includes("mc-move-btn-left"))
            this.dispatchKeyEvent("down", "a");
        else if (classList.includes("mc-move-btn-down"))
            this.dispatchKeyEvent("down", "s");
        else if (classList.includes("mc-move-btn-right"))
            this.dispatchKeyEvent("down", "d");
        else if (classList.includes("mc-move-btn-upleft")) {
            this.dispatchKeyEvent("down", "w");
            this.dispatchKeyEvent("down", "a");
        }
        else if (classList.includes("mc-move-btn-upright")) {
            this.dispatchKeyEvent("down", "w");
            this.dispatchKeyEvent("down", "d");
        }
        else if (classList.includes("mc-move-btn-jump"))
            this.dispatchKeyEvent("down", " ", "Space");
        else if (classList.includes("mc-move-btn-flyup"))
            this.dispatchKeyEvent("down", " ", "Space");
        else if (classList.includes("mc-move-btn-flydown"))
            this.dispatchKeyEvent("down", "Shift", "ShiftLeft", 16);
    };
    inactiveMoveBtn(btn, e) {
        if (!btn) return;
        btn.removeAttribute("active");
        const classList = [...btn.classList], {moveBtns} = this;
        if (classList.find(s => /mc-move-btn-up.*/g.test(s))) {
            let btns = moveBtns.querySelectorAll('[class*="mc-move-btn-up"]');
            let hasActive = [...btns].find(b => b.getAttribute("active"));
            if (!hasActive)
                for (let b of btns)
                    if (![...b.classList].includes("mc-move-btn-up"))
                        b.style.display = "none";
        }
        else if (classList.find(s => /mc-move-btn-fly.*/g.test(s))) {
            let btns = moveBtns.querySelectorAll('[class*="mc-move-btn-fly"]');
            let hasActive = [...btns].find(b => b.getAttribute("active"));
            if (!hasActive) {
                for (let b of btns)
                    if (![...b.classList].includes("mc-move-btn-fly"))
                        b.style.display = "none";
                for (let b of moveBtns.querySelectorAll(".mc-move-btn-up, .mc-move-btn-down"))
                    b.style.display = "";
            }
        }
        if (classList.includes("mc-move-btn-up"))
            this.dispatchKeyEvent("up", "w");
        else if (classList.includes("mc-move-btn-left"))
            this.dispatchKeyEvent("up", "a");
        else if (classList.includes("mc-move-btn-down"))
            this.dispatchKeyEvent("up", "s");
        else if (classList.includes("mc-move-btn-right"))
            this.dispatchKeyEvent("up", "d");
        else if (classList.includes("mc-move-btn-upleft")) {
            this.dispatchKeyEvent("up", "w");
            this.dispatchKeyEvent("up", "a");
        }
        else if (classList.includes("mc-move-btn-upright")) {
            this.dispatchKeyEvent("up", "w");
            this.dispatchKeyEvent("up", "d");
        }
        else if (classList.includes("mc-move-btn-jump"))
            this.dispatchKeyEvent("up", " ", "Space");
        else if (classList.includes("mc-move-btn-flyup"))
            this.dispatchKeyEvent("up", " ", "Space");
        else if (classList.includes("mc-move-btn-flydown"))
            this.dispatchKeyEvent("up", "Shift", "ShiftLeft", 16);
        else if (classList.includes("mc-move-btn-fly")) {
            if (e.target === btn && this.onFlyBtnClick)
                this.onFlyBtnClick();
        }
    };
    get moveBtnsTouchstart() {return this.moveBtnsTouchmove; };
    moveBtnsTouchmove(e) {
        if (e.cancelable) e.preventDefault();
        let ele = document.elementFromPoint(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        if (this.lastMoveBtn !== ele) {
            this.activeMoveBtn(ele, e);
            this.inactiveMoveBtn(this.lastMoveBtn, e);
            this.lastMoveBtn = ele;
        }
    };
    get moveBtnsTouchcancel() { return this.moveBtnsTouchend; };
    moveBtnsTouchend(e) {
        if (e.cancelable) e.preventDefault();
        this.inactiveMoveBtn(this.lastMoveBtn, e);
        this.lastMoveBtn = null;
    };
    onFlyBtnClick() {
        let {lastFlyBtnClick} = this, now = new Date();
        if (lastFlyBtnClick - now < 0 && now - lastFlyBtnClick < 250) {
            this.entity.toFlyMode && this.entity.toFlyMode(false);
            const {moveBtns} = this;
            if (this.entity.isFly) {
                moveBtns.querySelector(".mc-move-btn-jump").style.display = "none";
                moveBtns.querySelector(".mc-move-btn-fly").style.display = "";
            }
            else {
                moveBtns.querySelector(".mc-move-btn-jump").style.display = "";
                moveBtns.querySelector(".mc-move-btn-fly").style.display = "none";
            }
        }
        this.lastFlyBtnClick = now;
    };
};

export {
    PlayerLocalController,
    PlayerLocalController as default
};
