import Entity from "./Entity.js";
import { vec3 } from "./gmath.js";

class Player extends Entity {
    constructor(world = null, {
        position = [0, 10, 0]
    } = {}) {
        super({
            min: [-0.25, 0, -0.25],
            max: [0.25, 1.7, 0.25]
        }, [0, 1.5, 0], world);
        super.position = vec3.create(...position);
        this.moveSpeed = 4.317;     // block / s
        super.gravity = 9.8;        // block / s ^ 2
        this.jumpSpeed = 4.95;      // h = v^2 / 2g = 1.25 -> v = √2gh = √24.5 ≈ 4.95
        this.velocity = vec3.create();
        this.rest = vec3.create();
        this.acceleration = vec3.create(0, -this.gravity, 0);
    };
    setController(controller) {
        this.controller = controller;
    };
    move(dt) {
        if (this.rest[1] === -1) this.acceleration[1] = 0;
        else this.acceleration[1] = -this.gravity;
        vec3.scaleAndAdd(this.velocity, dt, this.acceleration, this.velocity);
        let dv = vec3.scale(this.velocity, dt);
        if (vec3.len(dv) === 0) return;
        let chunkFn = (x, y, z) => {
            let b = this.world.getTile(x, y, z);
            return b && b.name !== "air";
        };
        vec3.create(0, 0, 0, this.rest);
        for (let i = 0, dvel = vec3.create(); i < 3; dvel[i++] = 0) {
            dvel[i] = dv[i];
            let hit = this.world.hitboxesCollision(this.getGloBox(), dvel, chunkFn);
            while (hit) {
                this.position[hit.axis] = hit.pos - (hit.step > 0
                    ? this.hitboxes.max[hit.axis]: this.hitboxes.min[hit.axis]);
                this.rest[hit.axis] = hit.step;
                this.velocity[hit.axis] = dv[hit.axis] = dvel[hit.axis] = 0;
                hit = this.world.hitboxesCollision(this.getGloBox(), dvel, chunkFn);
            }
        }
        vec3.add(this.position, dv, this.position);
    };
    updata(dt) {
        if (!this.controller)
            return this.move(dt);
        dt /= 1000;
        const {keys} = this.controller;
        let dirvec = this.getForward(this.moveSpeed);
        if (keys[" "] && this.rest[1] === -1)
            this.velocity[1] += this.jumpSpeed;
        if ((keys[16] || keys.X) && this.rest[1] !== -1)
            this.velocity[1] -= this.jumpSpeed;
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
        vec3.create(dirvec[0], this.velocity[1], dirvec[2], this.velocity);
        this.move(dt);
    };
};

export {
    Player,
    Player as default
};
