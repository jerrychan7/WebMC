import EntityController from "./EntityController.js";
import Intup from "./Input.js";
import { vec3 } from "./gmath.js";
import spa from "./spa.js";

class PlayerLocalController extends EntityController {
    constructor(player, canvas, {
        mousemoveSensitivity = 200,
    } = {}) {
        super(player);
        this.mousemoveSensitivity = mousemoveSensitivity;
        this.input = new Intup(canvas);
        // this.input.enableAutoPointerLock();
        this.input.addEventListener("mousemove", this.mousemove.bind(this));
        this.input.addEventListener("mousedown", this.mousedown.bind(this));
        this.input.addEventListener("keydown", this.keydown.bind(this));
        this.input.addEventListener("keyup", this.keyup.bind(this));
        this.input.addEventListener("wheelup", this.wheelup.bind(this));
        this.input.addEventListener("wheeldown", this.wheeldown.bind(this));
        this.input.addEventListener("pointerlockchange", (e, locked) => {
            if (!locked && this.showStopPage) {
                spa.openPage("stop_game_page");
            }
            else if (locked) this.input.requestPointerLock();
            this.showStopPage = true;
        });
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
        if (!locked) {
            this.input.requestPointerLock();
            return;
        }
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
                if (locked) {
                    this.showStopPage = false;
                    this.input.exitPointerLock();
                    this.entity.inventory.showInventoryPage();
                }
                else this.entity.inventory.closeInventoryPage();
            }
        }
        if (!locked) return;
        if (String.fromCharCode(e.keyCode) === ' ') {
            let {spaceDownTime, spaceUpTime} = this;
            let now = new Date();
            if (spaceDownTime - spaceUpTime < 0 && now - spaceDownTime > 90 && now - spaceDownTime < 250)
                this.doubleClickSpace = true;
            else this.doubleClickSpace = false;
            if (this.doubleClickSpace) {
                this.entity.toFlyMode?.(!this.entity.isFly);
            }
            this.spaceDownTime = now;
        }
        if (this.keys.W) {
            let {moveDownTime, moveUpTime} = this;
            let now = new Date();
            if (moveDownTime - moveUpTime < 0 && now - moveDownTime > 90 && now - moveDownTime < 250)
                this.doubleClickMove = true;
            else this.doubleClickMove = false;
            if (this.doubleClickMove) {
                this.entity.toRunMode?.(!this.entity.isRun);
            }
            this.moveDownTime = now;
        }
    };
    keyup(e, locked) {
        if (!locked) return;
        if (!this.keys[" "]) this.spaceUpTime = new Date();
        if (!this.keys.W) {
            this.moveUpTime = new Date();
            this.entity.toRunMode?.(false);
        }
    };
    wheelup(e, locked) {
        if (!locked) return;
        const t = new Date();
        if (t - this.lastWeelTime < 100) return;
        this.entity.inventory?.hotbarSelectNext();
        this.lastWeelTime = t;
    };
    wheeldown(e, locked) {
        if (!locked) return;
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
