import Chunk from "./Chunk.js";
import Entity from "./Entity.js";
import { vec3 } from "./gmath.js";

class Player extends Entity {
    constructor(world = null, {
        position = [0, 10, 0]
    } = {}) {
        super({
            min: [-0.25, 0, -0.25],
            max: [0.25, 1.8, 0.25]
        }, [0, 1.65, 0], world);
        super.position = vec3.create(...position);
        this.moveSpeed = 4.317;     // block / s
        this.jumpSpeed = 4.95;      // h = v^2 / 2g = 1.25 -> v = √2gh = √24.5 ≈ 4.95
        super.gravityAcceleration = 9.8; // block / s ^ 2
        this.velocity = vec3.create();
        this.rest = vec3.create();
        this.acceleration = vec3.create(0, -this.gravityAcceleration, 0);
    };
    setController(controller) {
        this.controller = controller;
    };
    move(dt) {
        vec3.scaleAndAdd(this.velocity, dt, this.acceleration, this.velocity);
        let dv = vec3.scale(this.velocity, dt);
        let chunkFn = (x, y, z) => {
            let b = this.world.getTile(x, y, z);
            return b?.name !== "air";
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
        let [cx, cy, cz] = Chunk.getChunkXYZByBlockXYZ(...this.position);
        for (let dx = -1; dx <= 1; ++dx)
          for (let dy = -1; dy <= 1; ++dy)
            for (let dz = -1; dz <= 1; ++dz)
                this.world.loadChunk(cx + dx, cy + dy, cz + dz);
    };
    updata(dt) {
        dt /= 1000;
        if (!this.controller)
            return this.move(dt);
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
