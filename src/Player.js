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
        this.lastChunk = Chunk.getChunkXYZByBlockXYZ(this.position);
    };
    setController(controller) {
        this.controller = controller;
    };
    get onGround() { return this.rest[1] === -1; };
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
        let cxyz = Chunk.getChunkXYZByBlockXYZ(...this.position),
            [cx, cy, cz] = cxyz;
        if (vec3.exactEquals(cxyz, this.lastChunk))
            for (let dx = -1; dx <= 1; ++dx)
            for (let dz = -1; dz <= 1; ++dz)
            for (let dy = 1; dy >= -1; --dy)
                this.world.loadChunk(cx + dx, cy + dy, cz + dz);
        this.lastChunk = cxyz;
    };
    update(dt) {
        dt /= 1000;
        if (!this.controller)
            return this.move(dt);
        const {keys} = this.controller;
        let dirvec = this.getForward(this.moveSpeed);
        if (keys[" "] && this.onGround)
            this.velocity[1] += this.jumpSpeed;
        if ((keys[16] || keys.X) && !this.onGround)
            this.velocity[1] -= this.jumpSpeed;
        let up = keys.W || keys[38],
            down = keys.S || keys[40],
            left = keys.A || keys[37],
            right = keys.D || keys[39];
        if (up && down) up = down = false;
        if (left && right) left = right = false;
        if (up || down || left || right) {
            if ((up || down) && (left || right))
                vec3.rotateY(dirvec, ((left? 1: -1) * (up? 45: 135)) * Math.PI / 180, dirvec);
            else if (left)
                vec3.rotateY(dirvec, Math.PI / 2, dirvec);
            else if (right)
                vec3.rotateY(dirvec, -Math.PI / 2, dirvec);
            else if (down)
                vec3.rotateY(dirvec, Math.PI, dirvec);

            let block = this.world.getTile(...this.position),
                blockFriction = block?.friction || 1,
                fp = vec3.create(), // motive power
                ff = vec3.create(), // friction (resistance)
                nowXZspeed = Math.sqrt(this.velocity[0] ** 2 + this.velocity[2] ** 2);
            fp = vec3.scale(vec3.normalize(dirvec, fp), blockFriction * 20, fp);
            if (nowXZspeed <= 0.000001)
                ff = vec3.scale(vec3.normalize(dirvec, ff), -blockFriction, ff);
            else if (nowXZspeed >= this.moveSpeed - 0.000001) {
                let nv = vec3.normalize([this.velocity[0], 0, this.velocity[2]], ff),
                    t = vec3.scale(nv, this.moveSpeed);
                this.velocity[0] = t[0]; this.velocity[2] = t[2];
                ff = vec3.scale(nv, -blockFriction * 20, ff);
            }
            else
                ff = vec3.scale(vec3.normalize([this.velocity[0], 0, this.velocity[2]], ff), -blockFriction, ff);
            let resultantForce = vec3.add(ff, fp);
            this.acceleration[0] = resultantForce[0];
            this.acceleration[2] = resultantForce[2];
        }
        else {
            let nowXZspeed = Math.sqrt(this.velocity[0] ** 2 + this.velocity[2] ** 2);
            if (nowXZspeed > 0.000001) {
                let block = this.world.getTile(...this.position),
                    blockFriction = block?.friction || 1,
                    ff = vec3.create(); // friction (resistance)
                ff = vec3.scale(vec3.normalize([this.velocity[0], 0, this.velocity[2]], ff), -blockFriction * 20, ff);
                let nextv = vec3.scaleAndAdd([this.velocity[0], 0, this.velocity[2]], dt, [this.acceleration[0], 0, this.acceleration[2]]);
                // If next frame direction of velocity is opposite to direction of friction
                if (vec3.dot(ff, nextv) < 0) {
                    this.acceleration[0] = ff[0];
                    this.acceleration[2] = ff[2];
                }
                else {
                    this.acceleration[0] = this.acceleration[2] = 0;
                    this.velocity[0] = this.velocity[2] = 0;
                }
            }
            else {
                this.acceleration[0] = this.acceleration[2] = 0;
                this.velocity[0] = this.velocity[2] = 0;
            }
        }
        this.move(dt);
    };
};

export {
    Player,
    Player as default
};
