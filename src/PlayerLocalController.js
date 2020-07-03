import EntityController from "./EntityController.js";
import Intup from "./Input.js";

class PlayerLocalController extends EntityController {
    constructor(player, canvas, {
        mousemoveSensitivity = 360,
    } = {}) {
        super(player);
        this.mousemoveSensitivity = mousemoveSensitivity;
        this.input = new Intup(canvas);
        this.input.enableAutoPointerLock();
        this.input.addEventListener("mousemove", this.mousemove.bind(this));
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
    keydown(e, locked) { };
    keyup(e, locked) { };
};

export {
    PlayerLocalController,
    PlayerLocalController as default
};
