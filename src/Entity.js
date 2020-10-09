import { vec3 } from "./gmath.js";

class Entity {
    constructor(hitboxes,
        eyePos = [
            (hitboxes.max[0] - hitboxes.min[0] / 2),
            (hitboxes.max[1] - hitboxes.min[1] / 2),
            (hitboxes.max[2] - hitboxes.min[2] / 2)
        ],
        world = null) {
        this.world = world;
        this.moveSpeed = 0;
        this.gravityAcceleration = 0;
        this.position = [0, 0, 0];
        this.pitch = 0; // 垂直角 y+为正方向 始于xz平面
        this.yaw = 0;   // 水平角 z-为正方向
        this.hitboxes = hitboxes;
        this.eyePos = eyePos;
        this.forward = vec3.create();
        this.direction = vec3.create();
        this.camera = null;
        this.model = null;
    };
    getEyePosition() {
        return vec3.add(this.eyePos, this.position);
    };
    getGloBox() {
        return {
            min: vec3.add(this.hitboxes.min, this.position),
            max: vec3.add(this.hitboxes.max, this.position)
        };
    };
    getForward(scale = 1) {
        vec3.create(0, 0, -scale, this.forward);
        vec3.rotateY(this.forward, this.yaw, this.forward);
        return this.forward;
    };
    getDirection(scale = 1) {
        vec3.create(0, 0, -scale, this.direction);
        vec3.rotateX(this.direction, this.pitch, this.direction);
        vec3.rotateY(this.direction, this.yaw, this.direction);
        return this.direction;
    };
    setCamera(camera) {
        this.camera = camera;
    };
    update(dt) {};
    draw() {};
};

export {
    Entity,
    Entity as default
};
