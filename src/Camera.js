import {vec3, mat4} from "./gmath.js";

class Camera {
    constructor(aspectRatio, {
        fovy = 90, near = 0.1, far = 256,
        position = [0, 0, 3], pitch = 0, yaw = 0, rollZ = 0
    } = {}) {
        this.aspectRatio = aspectRatio;
        this.fovy = fovy; this.near = near; this.far = far;
        this.position = vec3.create(...position);
        this.pitch = pitch; this.yaw = yaw; this.rollZ = rollZ;
        this.vM = mat4.fpsView(this.position, pitch, yaw, rollZ);
        this.pM = mat4.perspective(this.fovy, this.aspectRatio, this.near, this.far);
        this.pvM = mat4.multiply(this.pM, this.vM);
        this.pChange = this.vChange = false;
        this.entity = null;
    };
    setPos(pos) { this.position = vec3.create(...pos); this.vChange = true; return this; };
    setPitch(pitch) {  this.pitch = pitch; this.vChange = true; return this; };
    setYaw(yaw) { this.yaw = yaw; this.vChange = true; return this; };
    setRollZ(z) { this.rollZ = z; this.vChange = true; return this; };
    setFovy(fovy) { this.fovy = fovy; this.pChange = true; return this; };
    setNear(near) { this.near = near; this.pChange = true; return this; };
    setFar(far) { this.far = far; this.pChange = true; return this; };
    setAspectRatio(aspectRatio) { this.aspectRatio = aspectRatio; this.pChange = true; return this; };
    get projection() {
        if (this.pChange) {
            this.pChange = false;
            return mat4.perspective(this.fovy, this.aspectRatio, this.near, this.far, this.pM);
        }
        return this.pM;
    };
    get view() {
        if (this.entity) {
            let e = this.entity;
            if (this.pitch == e.pitch && this.yaw == e.yaw && vec3.exactEquals(this.position, e.position))
                return this.vM;
            vec3.create(...e.position, this.position);
            this.pitch = e.pitch; this.yaw = e.yaw;
            return mat4.fpsView(this.position, this.pitch, this.yaw, this.rollZ, this.vM);
        }
        if (this.vChange) {
            this.vChange = false;
            return mat4.fpsView(this.position, this.pitch, this.yaw, this.rollZ, this.vM);
        }
        return this.vM;
    };
    get projview() {
        if (this.entity || this.pChange || this.vChange)
            return mat4.multiply(this.projection, this.view, this.pvM);
        return this.pvM;
    };
    bindEntity(entity) {
        if (this.entity) this.entity.setCamera(null);
        this.entity = entity;
        entity.setCamera(this);
    };
};

export {
    Camera,
    Camera as default
};
