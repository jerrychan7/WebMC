
import { EPSILON } from "./common.js";
import { defineLineAlge } from "./solver.js";

let ARRAY_TYPE = window.Float32Array || Array;
const vec2 = defineLineAlge("Vec2", () => new ARRAY_TYPE(2), {
    getArrType: { fn: () => ARRAY_TYPE },
    setArrType: { fn(type) { ARRAY_TYPE = type } },
    create: {
        fn(x = 0, y = 0, dest = new ARRAY_TYPE(2)) {
            dest[0] = x; dest[1] = y;
            return dest;
        },
        input:0, argsLen: 3,
    },
    copy: { alias: ["copyTo", "copy2", "clone",],
        fn(v, dest = new ARRAY_TYPE(2)) {
            if (v === dest) return dest;
            dest[0] = v[0];
            dest[1] = v[1];
            return dest;
        },
        derived: {
            copyFrom: { alias: ["set", "=",],
                fn: v => v,
                input: 2, output: 1,
            },
        },
    },
    length: { alias: ["len", "l",],
        fn(src) { return Math.hypot(src[0], src[1]); },
        argsLen: 1, output: 0,
    },
    add: { alias: ["+", "plus",],
        fn(v1, v2, dest = new ARRAY_TYPE(2)) {
            dest[0] = v1[0] + v2[0]; dest[1] = v1[1] + v2[1];
            return dest;
        },
    },
    subtract: { alias: ["sub", "-", "minus",],
        fn(v1, v2, dest = new ARRAY_TYPE(2)) {
            dest[0] = v1[0] - v2[0]; dest[1] = v1[1] - v2[1];
            return dest;
        },
    },
    multiply: { alias: ["mul",],
        fn(v1, v2, dest = new ARRAY_TYPE(2)) {
            dest[0] = v1[0] * v2[0]; dest[1] = v1[1] * v2[1];
            return dest;
        },
    },
    cross: { alias: ["x", "×",],
        fn(v1, v2) { return v1[0] * v2[1] - v1[1] * v2[0]; },
        argsLen: 2, output: 0,
    },
    dot: { alias: [".", "·",],
        fn(v1, v2) { return v1[0] * v2[0] + v1[1] * v2[1]; },
        argsLen: 2, output: 0,
    },
    scale: { alias: ["times",],
        fn(v, s, dest = new ARRAY_TYPE(2)) {
            dest[0] = v[0] * s; dest[1] = v[1] * s;
            return dest;
        },
    },
    scaleAndAdd: {
        fn(src, v, s, dest = new ARRAY_TYPE(2)) {
            dest[0] = src[0] + v[0] * s; dest[1] = src[1] + v[1] * s;
            return dest;
        },
    },
    ["*"]: {
        fn(v, s, dest = new ARRAY_TYPE(2)) {
            return typeof v == "number" || typeof v == "bigint" ? vec2.scale(v, dest) :
                typeof s == "undefined" ? vec2.multiply(v, dest) :
                    vec2.scaleAndAdd(v, s, dest);
        },
    },
    divide: { alias: ["div", "/", "dividedBy",],
        fn(v1, v2, dest = new ARRAY_TYPE(2)) {
            dest[0] = v1[0] / v2[0]; dest[1] = v1[1] / v2[1];
            return dest;
        },
    },
    normalize: { alias: ["norm", "unit",],
        fn([x, y], dest = new ARRAY_TYPE(2)) {
            const len = Math.hypot(x, y);
            if (len) dest[0] = x / len, dest[1] = y / len;
            else dest[0] = dest[1] = 0;
            return dest;
        },
    },
    negate: { alias: ["neg", "negated",],
        fn(v, dest = new ARRAY_TYPE(2)) {
            dest[0] = -v[0]; dest[1] = -v[1];
            return dest;
        },
    },
    rotateOrigin: { alias: ["rotateO",],
        fn([x, y], rad, dest = new ARRAY_TYPE(2)) {
            const s = Math.sin(rad), c = Math.cos(rad);
            dest[0] = x * c - y * s;
            dest[1] = x * s + y * c;
            return dest;
        },
    },
    roatePoint: { alias: ["rotateP",],
        fn(v1, [x, y], rad, dest = new ARRAY_TYPE(2)) {
            const s = Math.sin(rad), c = Math.cos(rad),
                p0 = v1[0] - x, p1 = v1[1] - y;
            dest[0] = p0 * c - p1 * s + x;
            dest[1] = p0 * s + p1 * c + y;
            return dest;
        },
    },
    // angle of parm1 relative to parm2
    angle: {
        fn([x1, y1], [x2, y2]) {
            const { atan2 } = Math;
            return atan2(y2, x2) - atan2(y1, x1);
        }, argsLen: 2, output: 0,
    },
    inverse: {
        fn([x, y], dest = new ARRAY_TYPE(2)) {
            dest[0] = x && 1 / x; dest[1] = y && 1 / y;
            return dest;
        },
    },
    exactEquals: {
        fn(v1, v2) { return v1[0] === v2[0] && v1[1] === v2[1]; },
        argsLen: 2, output: 0,
    },
    equals: {
        fn([x, y], [u, v]) {
            const { abs, max } = Math;
            return (abs(x - u) <= EPSILON * max(1.0, abs(x), abs(u)) &&
                abs(y - v) <= EPSILON * max(1.0, abs(y), abs(v)));
        },
        argsLen: 2, output: 0,
    },
    moveToward: { alias: ["move_toward",],
        fn(v, target, delta, dest = new ARRAY_TYPE(2)) {
            const [x, y] = target, dx = x - v[0], dy = y - v[1], len = Math.hypot(dx, dy);
            if (len <= delta || len <= EPSILON) dest[0] = x, dest[1] = y;
            else // dest = v + (vd / len * delta);
                vec2.scaleAndAdd(v, [dx, dy], delta / len, dest);
            return dest;
        },
    },
    lerpUnclamped: {
        fn(src, v, t, dest = new ARRAY_TYPE(2)) {
            // dest = src + (v - src) * t
            const [x, y] = src, dx = v[0] - x, dy = v[1] - y;
            dest[0] = x + dx * t;
            dest[1] = y + dy * t;
            return dest;
        },
    },
    lerp: {
        fn(src, v, t, dest = new ARRAY_TYPE(2)) {
            return vec2.lerpUnclamped(src, v, Math.max(0, Math.min(1, t)), dest);
        },
    },
});

export {
    vec2 as default,
    vec2,
};

window.vec2 = vec2;