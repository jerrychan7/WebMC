import EntityController from "./EntityController.js";
import Intup from "./Input.js";
import { vec3 } from "./gmath.js";

class PlayerLocalController extends EntityController {
    constructor(player, canvas, {
        mousemoveSensitivity = 360,
    } = {}) {
        super(player);
        this.mousemoveSensitivity = mousemoveSensitivity;
        this.input = new Intup(canvas);
        this.input.enableAutoPointerLock();
        this.input.addEventListener("mousemove", this.mousemove.bind(this));
        this.input.addEventListener("mousedown", this.mousedown.bind(this));
        this.input.addEventListener("keydown", this.keydown.bind(this));
        this.input.addEventListener("keyup", this.keyup.bind(this));
        this.input.addEventListener("wheelup", this.wheelup.bind(this));
        this.input.addEventListener("wheeldown", this.wheeldown.bind(this));
        this.keys = this.input.keys;
    };
    mousemove(e, locked) {
        if (!locked) return;
        let i = this.mousemoveSensitivity * (Math.PI / 180);
        // movementX left- right+    movementY up- down+
        this.entity.yaw -= (e.movementX || e.mozMovementX || e.webkitMovementX || 0) * i / this.input.canvas.width;
        this.entity.pitch -= (e.movementY || e.mozMovementY || e.webkitMovementY || 0) * i / this.input.canvas.height;
        if (this.entity.pitch > Math.PI / 2)
            this.entity.pitch = Math.PI / 2;
        else if (this.entity.pitch < -Math.PI / 2)
            this.entity.pitch = -Math.PI / 2;
    };
    mousedown(e, locked) {
        if (!locked) return;
        if (e.button !== 0 && e.button !== 2) return;
        let entity = this.entity,
            world = entity.world,
            //start = entity.position,
            start = entity.getEyePosition(),
            end = entity.getDirection(20);
        vec3.add(start, end, end);
        // 当实体有碰撞箱时 这里需要按碰撞箱检测
        let hit = world.rayTraceBlock(start, end, (x, y, z) => {
            let b = world.getTile(x, y, z);
            return b && b.name !== "air";
        });
        if (hit === null || hit.axis === "") return;
        let pos = hit.blockPos;
        // left button
        if (e.button === 2) {
            pos["xyz".indexOf(hit.axis[0])] += hit.axis[1] === '-'? -1: 1;
            if (vec3.exactEquals(pos, start.map(Math.floor))) return;
            let blockName = this.entity.inventory.getOnHands().name;
            if (blockName !== "air") world.setTile(...pos, blockName);
        }
        // right button
        else if (e.button === 0) {
            world.setTile(...pos, "air");
        }
    };
    keydown(e, locked) {
        if (this.entity.inventory) {
            if (String.fromCharCode(e.keyCode) === 'E') {
                this.input.exitPointerLock();
                this.entity.inventory.showInventoryPage();
            }
        }
    };
    keyup(e, locked) { };
    wheelup() {
        const t = new Date();
        if (t - this.lastWeelTime < 100) return;
        this.entity.inventory?.hotbarSelectNext();
        this.lastWeelTime = t;
    };
    wheeldown() {
        const t = new Date();
        if (t - this.lastWeelTime < 100) return;
        this.entity.inventory?.hotbarSelectPrev();
        this.lastWeelTime = t;
    };
};

export {
    PlayerLocalController,
    PlayerLocalController as default
};
