import { vec3, mat4 } from "../utils/math/index.js";

class Camera {
    static get projectionType() {
        return {
            perspective: "perspective",
            ortho: "orthographic",
        };
    };
    static get viewType() {
        return {
            fps: "fpsView",
            lookAt: "lookAt",
        };
    };
    constructor(aspectRatio, {
        projectionType = Camera.projectionType.perspective,
        viewType = Camera.viewType.fps,
        fovy = 90, near = 0.1, far = 256,
        left = -1, right = 1, bottom = -1, top = 1,
        position = [0, 0, 3], pitch = 0, yaw = 0, rollZ = 0,
        target = [0, 0, 0], up = [0, 1, 0],
        entity = null,
    } = {}) {
        this.projectionType = projectionType;
        this.viewType = viewType;
        this.aspectRatio = aspectRatio;
        this.fovy = this.nowFovy = fovy; this.near = near; this.far = far;
        this.left = left; this.right = right; this.bottom = bottom; this.top = top;
        this.position = vec3.create(...position);
        this.pitch = pitch; this.yaw = yaw; this.rollZ = rollZ;
        this.target = target; this.up = up;
        switch (viewType) {
        case Camera.viewType.fps:
            this.vM = mat4.fpsView(this.position, pitch, yaw, rollZ);
            break;
        case Camera.viewType.lookAt:
            this.vM = mat4.lookAt(this.position, target, up);
            break;
        default:
            throw "Unrecognized view type";
        }
        switch (projectionType) {
        case Camera.projectionType.perspective:
            this.pM = mat4.perspective(this.fovy, this.aspectRatio, this.near, this.far);
            break;
        case Camera.projectionType.ortho:
            this.pM = mat4.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far);
            break;
        default:
            throw "Unrecognized projection type";
        }
        this.pvM = mat4.multiply(this.pM, this.vM);
        this.pChange = this.vChange = false;
        this.bindEntity(entity);
    };
    setPos(pos) { this.position = vec3.create(...pos); this.vChange = true; return this; };
    setPitch(pitch) { this.pitch = pitch; this.vChange = true; return this; };
    setYaw(yaw) { this.yaw = yaw; this.vChange = true; return this; };
    setRollZ(z) { this.rollZ = z; this.vChange = true; return this; };
    setTarget(target) { this.target = target; this.vChange = true; return this; }
    setUp(up) { this.up = up; this.vChange = true; return this; };

    setFovy(fovy) { if (fovy == this.fovy) return this; this.fovy = this.nowFovy = fovy; this.pChange = true; return this; };
    setNear(near) { this.near = near; this.pChange = true; return this; };
    setFar(far) { this.far = far; this.pChange = true; return this; };
    setAspectRatio(aspectRatio) { this.aspectRatio = aspectRatio; this.pChange = true; return this; };
    setLeft(left) { this.left = left; this.pChange = true; return this; };
    setRight(right) { this.right = right; this.pChange = true; return this; };
    setBottom(bottom) { this.bottom = bottom; this.pChange = true; return this; };
    setTop(top) { this.top = top; this.pChange = true; return this; };

    _linearGradient(sx, ex, sy, ey, x) {
        x = Math.max(0, Math.min((x - sx) / (ex - sx), 1));
        return sy > ey
            ? sy - (sy - ey) * x
            : sy + (ey - sy) * x;
    };
    _powerGradient(sx, ex, sy, ey, x) {
        x = Math.max(0, Math.min((x - sx) / (ex - sx), 1));
        return sy > ey
            ? ey + (sy - ey) * ((-x + 1) ** 2)
            : sy + (ey - sy) * (x ** 0.5);
    };
    changeFovyWithAnimation(deltaFovy = 0, deltaTime = 250) {
        if (deltaTime == 0) return this.setFovy(this.fovy + deltaFovy);
        if (this.fovy + deltaFovy === this.endFovy) return this;
        let now = this.nowTime = (new Date()).getTime();
        if (!("beginFovy" in this)) {
            this.endFovy = this.nowFovy = this.fovy;
            this.fovyAnimationEndTime = now;
        }
        if (this.fovyAnimationEndTime <= now) {
            this.fovyAnimationBeginTime = now;
            this.fovyAnimationEndTime = now + deltaTime;
        }
        else {
            this.fovyAnimationEndTime = now + (now - this.fovyAnimationBeginTime);
            this.fovyAnimationBeginTime = this.fovyAnimationEndTime - deltaTime;
        }
        this.beginFovy = this.endFovy;
        this.endFovy = this.fovy + deltaFovy;
        return this;
    };

    get projection() {
        if (this.pChange) {
            this.pChange = false;
            return this.projectionType === Camera.projectionType.perspective
                ? mat4.perspective(this.nowFovy, this.aspectRatio, this.near, this.far, this.pM)
                : mat4.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far, this.pM);
        }
        return this.pM;
    };
    get view() {
        if (this.entity) {
            let e = this.entity,
                pos = e.getEyePosition();
            if (this.pitch == e.pitch && this.yaw == e.yaw && vec3.exactEquals(pos, e.position))
                return this.vM;
            vec3.create(...pos, this.position);
            this.pitch = e.pitch; this.yaw = e.yaw;
            return mat4.fpsView(this.position, this.pitch, this.yaw, this.rollZ, this.vM);
        }
        if (this.vChange) {
            this.vChange = false;
            return this.viewType === Camera.viewType.fps
                ? mat4.fpsView(this.position, this.pitch, this.yaw, this.rollZ, this.vM)
                : mat4.lookAt(this.position, this.target, this.up, this.vM);
        }
        return this.vM;
    };
    get projview() {
        let now = (new Date()).getTime();
        // 60fps -> 0.0166spf -> 16 mspf
        if (this.nowFovy != this.endFovy && now - this.nowTime > 16) {
            this.nowTime = now;
            this.pChange = true;
            this.nowFovy = this._powerGradient(
                this.fovyAnimationBeginTime, this.fovyAnimationEndTime,
                this.beginFovy, this.endFovy, now);
        }
        if (this.entity || this.pChange || this.vChange)
            return mat4.multiply(this.projection, this.view, this.pvM);
        return this.pvM;
    };
    bindEntity(entity = null) {
        if (entity === this.entity) return;
        if (this.entity) this.entity.setCamera(null);
        this.entity = entity;
        if (entity) entity.setCamera(this);
    };
};

export {
    Camera as default,
    Camera,
};
