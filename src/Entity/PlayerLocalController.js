
import { EntityController } from "./EntityController.js";
import { Block } from "../World/Block.js";
import { vec3 } from "../utils/math/index.js";
import { pm } from "../UI/pages/Page.js";
import { Item } from "./Item.js";

class PlayerLocalController extends EntityController {
    constructor(player = null, {
        playPage = pm.getPageByID("play"),
        canvas = playPage? playPage.mainCanvas: null,
        moveButtons = playPage? playPage.moveButtons: null,
        hotbarUI = playPage? playPage.hotbar: null,
        mousemoveSensitivity = 200,
    } = {}) {
        super(player);
        this.mousemoveSensitivity = mousemoveSensitivity;
        this.eventHandler = this.eventHandler.bind(this);
        this["pause=>play"] = this.requestPointerLock.bind(this);
        this["play=>pause"] = this.exitPointerLock.bind(this);
        this._locked = false;
        this.showStopPage = false;
        this.canvasLastTouchPos = this.canvasBeginTouch = this.canvasTouchTimer = null;
        this.canvasTouchMoveLen = 0;
        this.canvasDestroying = false;
        this.keys = [];
        this.hotbar = [];
        this.inventoryStore = Block.listBlocks();
        this.setPlayPage(playPage, { canvas, moveButtons, hotbarUI });
    };
    setPlayPage(playPage = null, {
        canvas = playPage? playPage.mainCanvas: null,
        moveButtons = playPage? playPage.moveButtons: null,
        hotbarUI = playPage? playPage.hotbar: null,
    } = {}) {
        if (this.playPage) {
            this.hotbarUI.removeEventListener("selectBlock", this.onHotbarUISelectBlock);
            this.playPage.removeEventListener("closeInventory", this.onCloseInventory);
            this.playPage.removeEventListener("showInventory", this.onShowInventory);
            this.setCanvas();
            this.setMoveBtns();
        }
        this.playPage = playPage;
        this.hotbarUI = hotbarUI;
        this.setCanvas(canvas);
        this.setMoveBtns(moveButtons);
        this.hotbar = [];
        if (!playPage) return;
        playPage.inventory.clear();
        const listBlocks = this.inventoryStore;
        for (let b of listBlocks)
            playPage.inventory.appendItem(b);
        for (let i = 0; i < hotbarUI.length; ++i) {
            this.hotbar.push(listBlocks[i]);
            hotbarUI.setItem(listBlocks[i], i);
        }
        hotbarUI.addEventListener("selectBlock", this.onHotbarUISelectBlock);
        playPage.addEventListener("closeInventory", this.onCloseInventory);
        playPage.addEventListener("showInventory", this.onShowInventory);
    };
    onHotbarUISelectBlock = e => {
        this.entity.onHandItem = e.detail || Block.getBlockByBlockName("air");
    };
    onCloseInventory = e => { this.requestPointerLock(); };
    onShowInventory = e => { this.exitPointerLock(); };
    dispose() {
        super.dispose();
        this.setPlayPage();
    };
    get locked() { return window.isTouchDevice || this._locked; };
    setCanvas(canvas = null) {
        if (this.canvas) {
            this.exitPointerLock();
            for (let eventType of ["keydown", "keyup", "pointerlockchange", ])
                this.docOfCanvas.removeEventListener(eventType, this.eventHandler);
            for (let eventType of ["mousedown", "mouseup", "mousemove", "wheel", "touchstart", "touchend", "touchcancel", "touchmove", ])
                this.canvas.removeEventListener(eventType, this.eventHandler);
            if (this.canvasTouchTimer !== null) window.clearTimeout(this.canvasTouchTimer);
            this.canvasTouchTimer = null;
            pm.removeEventListener("pause=>play", this["pause=>play"]);
            pm.removeEventListener("play=>pause", this["play=>pause"]);
        }
        this.canvas = canvas; this.rootOfCanvas = this.docOfCanvas = null;
        if (!canvas) return;
        this.docOfCanvas = canvas.ownerDocument;
        this.rootOfCanvas = canvas.getRootNode();
        for (let eventType of ["keydown", "keyup", "pointerlockchange", ])
            this.docOfCanvas.addEventListener(eventType, this.eventHandler);
        for (let eventType of ["mousedown", "mouseup", "mousemove", "wheel", ])
            canvas.addEventListener(eventType, this.eventHandler, { passive: true, });
        if (window.isTouchDevice)
            for (let eventType of ["touchstart", "touchend", "touchcancel", "touchmove", ])
                canvas.addEventListener(eventType, this.eventHandler);
        pm.addEventListener("pause=>play", this["pause=>play"]);
        pm.addEventListener("play=>pause", this["play=>pause"]);
    };
    // 转换成键盘消息 复用键盘的处理逻辑
    setMoveBtns(moveBtns = null) {
        if (this.moveBtns) {
            for (let btn of "up,left,down,right,jump,upleft,upright,flyup,flydown,fly,sneak".split(",")) {
                this.moveBtns.removeEventListener(btn + "BtnPress", this.eventHandler);
                this.moveBtns.removeEventListener(btn + "BtnUp", this.eventHandler);
            }
            this.moveBtns.removeEventListener("flyBtnDblPress", this.eventHandler);
        }
        this.moveBtns = moveBtns;
        if (!moveBtns) return;
        for (let [btn, keys] of [
            ["up", ["w"]],
            ["left", ["a"]],
            ["down", ["s"]],
            ["right", ["d"]],
            ["jump", [" "]],
            ["upleft", ["w", "a"]],
            ["upright", ["w", "d"]],
            ["flyup", [" "]],
            ["flydown", ["Shift"]],
            // ["fly"],
            // ["sneak"],
        ]) {
            this[btn + "BtnPress"] = () => {
                keys.forEach(key => this.dispatchKeyEvent("down", key));
            };
            this[btn + "BtnUp"] = () => {
                for (let i = keys.length - 1; i >= 0; --i)
                    this.dispatchKeyEvent("up", keys[i]);
            };
            this.moveBtns.addEventListener(btn + "BtnPress", this.eventHandler);
            this.moveBtns.addEventListener(btn + "BtnUp", this.eventHandler);
        }
        this["flyBtnDblPress"] = () => {
            this.entity.toFlyMode && this.entity.toFlyMode(false);
            const {moveBtns} = this;
            moveBtns.activeFlyBtn(false);
        };
        this.moveBtns.addEventListener("flyBtnDblPress", this.eventHandler);
    };
    requestPointerLock() {
        if (!this.canvas || window.isTouchDevice) return;
        this.canvas.requestPointerLock();
    };
    exitPointerLock() {
        if (this.canvas === null || window.isTouchDevice) return;
        this.docOfCanvas.exitPointerLock();
    };
    eventHandler(event) {
        if (!this.entity) return;
        const { type } = event;
        if (type in this) this[type](event);
        this.dispatchEvent(type, event);
    };
    getHitting(bTypes = [Block.renderType.NORMAL, Block.renderType.FLOWER, Block.renderType.CACTUS]) {
        let entity = this.entity,
            world = entity.world,
            start = entity.getEyePosition(),
            end = entity.getDirection(20);
        vec3.add(start, end, end);
        return world.rayTraceBlock(start, end, (x, y, z) => {
            let b = world.getBlock(x, y, z);
            return b && b.name !== "air" && bTypes.includes(b.renderType);
        });
    };
    _setEntityPitchAndYaw(movementX, movementY) {
        let i = this.mousemoveSensitivity * (Math.PI / 180);
        // movementX left- right+    movementY up- down+
        this.entity.yaw -= movementX * i / this.canvas.width;
        this.entity.pitch -= movementY * i / this.canvas.height;
        if (this.entity.pitch > Math.PI / 2)
            this.entity.pitch = Math.PI / 2;
        else if (this.entity.pitch < -Math.PI / 2)
            this.entity.pitch = -Math.PI / 2;
    };
    mousemove(e) {
        if (!this.locked) return;
        this._setEntityPitchAndYaw(
            (e.movementX || e.mozMovementX || e.webkitMovementX || 0),
            (e.movementY || e.mozMovementY || e.webkitMovementY || 0)
        );
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
            const world = this.entity.world, hit = this.getHitting();
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
                let blockName = this.entity.onHandItem.name;
                if (blockName !== "air") world.setBlock(...pos, blockName);
            }
            else if (this.mouseRightBtnDown) {
                world.setBlock(...pos, "air");
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
        if (!this.locked) return;
        if (e.cancelable) e.preventDefault();
        if (e.repeat) return;
        if (e.key == 'Q' || e.key == 'q') {
            let item = new Item({
                thrower: this.entity,
                longID: this.entity.onHandItem.longID,
                position: this.entity.position,
                world: this.entity.world,
            });
            this.entity.world.entities.push(item);
            this.entity.world.dispatchEvent("onAddEntity", item);
        }
        if (e.key == 'E' || e.key == 'e') {
            if (this.locked) {
                this.showStopPage = false;
                this.playPage.showInventory();
            }
            else this.playPage.closeInventory();
        }
        if (window.isTouchDevice) {
            if (e.repeat !== true) {
                if (e.keyCode) this.keys[e.keyCode] = (this.keys[e.keyCode] || 0) + 1;
                this.keys[e.key] = this.keys[e.code] = (this.keys[e.key] || 0) + 1;
            }
        }
        else {
            if (e.keyCode) this.keys[e.keyCode] = true;
            this.keys[e.key] = this.keys[e.code] = true;
        }
        if (e.key == ' ') {
            if (this.spaceDownTime === 0)
                this.spaceDownTime = new Date();
            else if ((new Date()) - this.spaceDownTime < 300) {
                this.entity.toFlyMode && this.entity.toFlyMode(!this.entity.isFly);
                this.moveBtns.activeFlyBtn(this.entity.isFly);
                this.spaceDownTime = 0;
            }
            else this.spaceDownTime = new Date();
        }
        if (e.code == "KeyW") {
            if (this.moveDownTime === 0)
                this.moveDownTime = new Date();
            else if ((new Date()) - this.moveDownTime < 300) {
                this.entity.toRunMode && this.entity.toRunMode(!this.entity.isRun);
                this.moveDownTime = 0;
            }
            else this.moveDownTime = new Date();
        }
        this.entity.vertMoveDir = (this.keys.Space || 0) - (this.keys.Shift || this.keys.KeyX || 0);
        this.entity.horiMoveDir = [
            (this.keys.KeyD || 0) - (this.keys.KeyA || 0),
            (this.keys.KeyW || 0) - (this.keys.KeyS || 0),
        ];
    };
    keyup(e) {
        if (!this.locked) return;
        if (e.cancelable) e.preventDefault();
        if (window.isTouchDevice) {
            if (e.keyCode) this.keys[e.keyCode] = (this.keys[e.keyCode] || 1) - 1;
            this.keys[e.key] = this.keys[e.code] = (this.keys[e.key] || 1) - 1;
        }
        else {
            if (e.keyCode) this.keys[e.keyCode] = false;
            this.keys[e.key] = this.keys[e.code] = false;
        }
        if (!this.keys.KeyW) {
            this.entity.toRunMode && this.entity.toRunMode(false);
        }
        this.entity.vertMoveDir = (this.keys.Space || 0) - (this.keys.Shift || this.keys.KeyX || 0);
        this.entity.horiMoveDir = [
            (this.keys.KeyD || 0) - (this.keys.KeyA || 0),
            (this.keys.KeyW || 0) - (this.keys.KeyS || 0),
        ];
    };
    wheel(e) {
        if (!this.locked) return;
        const t = new Date();
        if (t - this.lastWeelTime < 5) return;
        if (e.deltaY < 0) {
            // wheelup
            this.hotbarUI.selectNext();
        }
        else if (e.deltaY > 0) {
            // wheeldown
            this.hotbarUI.selectPrev();
        }
        this.lastWeelTime = t;
    };
    pointerlockchange(e) {
        let locked = this.rootOfCanvas.pointerLockElement === this.canvas;
        if (this.locked === locked) return;
        if (!locked && this.showStopPage) {
            pm.openPageByID("pause");
        }
        this.showStopPage = true;
        this._locked = locked;
    };
    dispatchMouseEventByTouchEvt(type, touchEvt, {
        button = 0, buttons = button,
        movementX = 0, movementY = 0
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
        let ratio = this.canvas.width / this.canvas.height;
        movementX *= ratio * 2.5;
        movementY *= 2.5;
        this._setEntityPitchAndYaw(movementX,movementY);
        this.canvasLastTouchPos = e;
    };
    dispatchKeyEvent(type, key,
        code = {" ": "Space", "Shift": "ShiftLeft"}[key] || "Key" + key.toUpperCase(),
        keyCode = key == "Shift"? 16: key.toUpperCase().charCodeAt(0),
        repeat = false
    ) {
        this.docOfCanvas.dispatchEvent(new KeyboardEvent("key" + type, {
            bubbles: true, cancelable: true,
            key, code, keyCode, repeat, which: keyCode,
        }));
    };
};



export {
    PlayerLocalController,
    PlayerLocalController as default,
};
