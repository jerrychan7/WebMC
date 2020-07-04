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
            start = entity.position,
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
        if (e.button === 0) {
            pos["xyz".indexOf(hit.axis[0])] += hit.axis[1] === '-'? -1: 1;
            if (vec3.exactEquals(pos, start.map(Math.floor))) return;
            world.setTile(...pos, "grass");
        }
        // right button
        else if (e.button === 2) {
            world.setTile(...pos, "air");
        }
    };
    keydown(e, locked) { };
    keyup(e, locked) { };
};

export {
    PlayerLocalController,
    PlayerLocalController as default
};
