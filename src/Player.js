import Entity from "./Entity.js";
import { vec3 } from "./gmath.js";

class Player extends Entity {
    constructor(world = null, {
        position = [0, 10, 0]
    } = {}) {
        super(world);
        this.position = vec3.create(...position);
        this.moveSpeed = 11.317;
        this.jumpSpeed = 7.5;
        this.velocity = vec3.create();
        this.acceleration = vec3.create();
    };
    setController(controller) {
        this.controller = controller;
    };
    move(dirVec) {
        vec3.add(this.position, dirVec, this.position);
    };
    updata(dt) {
        if (!this.controller) return;
        dt /= 1000;
        const {keys} = this.controller;
        let dirvec = this.getForward(this.moveSpeed * dt);
        if (keys[" "]) dirvec[1] = this.jumpSpeed * dt;
        // shift
        if (keys[16] || keys.X) dirvec[1] = -this.jumpSpeed * dt;
        let up = keys.W || keys[38],
            down = keys.S || keys[40],
            left = keys.A || keys[37],
            right = keys.D || keys[39];
        if (up || down || left || right) {
            if (up && down) up = down = false;
            if (left && right) left = right = false;
            if ((up || down) && (left || right))
                vec3.rotateY(dirvec, ((left? 1: -1) * (up? 45: 135)) * Math.PI / 180, dirvec);
            else if (left)
                vec3.rotateY(dirvec, Math.PI / 2, dirvec);
            else if (right)
                vec3.rotateY(dirvec, -Math.PI / 2, dirvec);
            else if (down)
                vec3.rotateY(dirvec, Math.PI, dirvec);
        }
        else dirvec[0] = dirvec[2] = 0;
        this.move(dirvec);
    };
};

export {
    Player,
    Player as default
};
