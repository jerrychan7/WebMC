
import { EPSILON } from "./common.js";
import { defineLineAlge } from "./solver.js";

let ARRAY_TYPE = window.Float32Array || Array;
const vec3 = defineLineAlge("Vec3", () => new ARRAY_TYPE(3), {
    getArrType: { fn: () => ARRAY_TYPE },
    setArrType: { fn(type) { ARRAY_TYPE = type } },
    create: {
        fn(x = 0, y = 0, z = 0, dest = new ARRAY_TYPE(3)) {
            dest[0] = x; dest[1] = y; dest[2] = z;
            return dest;
        },
        input:0, argsLen: 4,
    },
    copy: { alias: ["copyTo", "copy2", "clone",],
        fn(v, dest = new ARRAY_TYPE(3)) {
            if (v === dest) return dest;
            dest[0] = v[0];
            dest[1] = v[1];
            dest[2] = v[2];
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
        fn(src) { return Math.hypot(src[0], src[1], src[2]); },
        argsLen: 1, output: 0,
    },
    add: { alias: ["+", "plus",],
        fn(v1, v2, dest = new ARRAY_TYPE(3)) {
            dest[0] = v1[0] + v2[0]; dest[1] = v1[1] + v2[1]; dest[2] = v1[2] + v2[2];
            return dest;
        },
    },
    subtract: { alias: ["sub", "-", "minus",],
        fn(v1, v2, dest = new ARRAY_TYPE(3)) {
            dest[0] = v1[0] - v2[0]; dest[1] = v1[1] - v2[1]; dest[2] = v1[2] - v2[2];
            return dest;
        },
    },
    multiply: { alias: ["mul",],
        fn(v1, v2, dest = new ARRAY_TYPE(3)) {
            dest[0] = v1[0] * v2[0]; dest[1] = v1[1] * v2[1]; dest[2] = v1[2] * v2[2];
            return dest;
        },
    },
    cross: { alias: ["x", "×",],
        fn([a, b, c], [x, y, z], dest = new ARRAY_TYPE(3)) {
            dest[0] = b * z - c * y;
            dest[1] = c * x - a * z;
            dest[2] = a * y - b * x;
            return dest;
        },
    },
    dot: { alias: [".", "·",],
        fn(v1, v2) { return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]; }, argsLen: 2, output: 0,
    },
    scale: { alias: ["times",],
        fn(v, s, dest = new ARRAY_TYPE(3)) {
            dest[0] = v[0] * s; dest[1] = v[1] * s; dest[2] = v[2] * s;
            return dest;
        },
    },
    scaleAndAdd: {
        fn(src, v, s, dest = new ARRAY_TYPE(3)) {
            dest[0] = src[0] + v[0] * s; dest[1] = src[1] + v[1] * s; dest[2] = src[2] + v[2] * s;
            return dest;
        },
    },
    ["*"]: {
        fn(v, s, dest = new ARRAY_TYPE(3)) {
            return typeof v == "number" || typeof v == "bigint" ? vec3.scale(v, dest) :
                typeof s == "undefined" ? vec3.multiply(v, dest) :
                    vec3.scaleAndAdd(v, s, dest);
        },
    },
    divide: { alias: ["div", "/", "dividedBy",],
        fn(v1, v2, dest = new ARRAY_TYPE(3)) {
            dest[0] = v1[0] / v2[0]; dest[1] = v1[1] / v2[1]; dest[2] = v1[2] / v2[2];
            return dest;
        },
    },
    normalize: { alias: ["norm", "unit",],
        fn([x, y, z], dest = new ARRAY_TYPE(3)) {
            const len = Math.hypot(x, y, z);
            if (len) dest[0] = x / len, dest[1] = y / len, dest[2] = z / len;
            else dest[0] = dest[1] = dest[2] = 0;
            return dest;
        },
    },
    negate: { alias: ["neg", "negated",],
        fn(v, dest = new ARRAY_TYPE(3)) {
            dest[0] = -v[0]; dest[1] = -v[1]; dest[2] = -v[2];
            return dest;
        },
    },
    rotateX: {
        fn(v, rad, dest = new ARRAY_TYPE(3)) {
            const [x, y, z] = v, s = Math.sin(rad), c = Math.cos(rad);
            dest[0] = x;
            dest[1] = y * c - z * s;
            dest[2] = y * s + z * c;
            return dest;
        },
    },
    rotateY: {
        fn(v, rad, dest = new ARRAY_TYPE(3)) {
            const [x, y, z] = v, s = Math.sin(rad), c = Math.cos(rad);
            dest[0] = z * s + x * c;
            dest[1] = y;
            dest[2] = z * c - x * s;
            return dest;
        },
    },
    rotateZ: {
        fn(v, rad, dest = new ARRAY_TYPE(3)) {
            const [x, y, z] = v, s = Math.sin(rad), c = Math.cos(rad);
            dest[0] = x * c - y * s;
            dest[1] = x * s + y * c;
            dest[2] = z;
            return dest;
        },
    },
    inverse: { alias: ["inv", "'",],
        fn([x, y, z], dest = new ARRAY_TYPE(3)) {
            dest[0] = x && 1 / x; dest[1] = y && 1 / y; dest[2] = z && 1 / z;
            return dest;
        },
    },
    exactEquals: { alias: ["==="],
        fn(v1, v2) {
            return v1[0] === v2[0] && v1[1] === v2[1] && v1[2] === v2[2];
        },
        argsLen: 2, output: 0,
    },
    equals: { alias: ["=="],
        fn([x, y, z], [u, v, w]) {
            const { abs, max } = Math;
            return (abs(x - u) <= EPSILON * max(1.0, abs(x), abs(u)) &&
                abs(y - v) <= EPSILON * max(1.0, abs(y), abs(v)) &&
                abs(z - w) <= EPSILON * max(1.0, abs(z), abs(w)));
        },
        argsLen: 2, output: 0,
    },
    transformMat4: {
        fn([x, y, z], m, dest = new ARRAY_TYPE(3)) {
            const w = (m[3] * x + m[7] * y + m[11] * z + m[15]) || 1;
            dest[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
            dest[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
            dest[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
            return dest;
        },
    },
    moveToward: { alias: ["move_toward",],
        fn(v, target, delta, dest = new ARRAY_TYPE(3)) {
            const [x, y, z] = target,
                // target - v
                dx = x - v[0], dy = y - v[1], dz = z - v[2],
                len = Math.hypot(dx, dy, dz);
            if (len <= delta || len <= EPSILON) dest[0] = x, dest[1] = y, dest[2] = z;
            else // dest = v + (vd / len * delta);
                vec3.scaleAndAdd(v, [dx, dy, dz], delta / len, dest);
            return dest;
        },
    },
    lerpUnclamped: {
        fn(src, v, t, dest = new ARRAY_TYPE(3)) {
            // dest = src + (v - src) * t
            const [x, y, z] = src, dx = v[0] - x, dy = v[1] - y, dz = v[2] - z;
            dest[0] = x + dx * t;
            dest[1] = y + dy * t;
            dest[2] = z + dz * t;
            return dest;
        },
    },
    lerp: {
        fn(src, v, t, dest = new ARRAY_TYPE(3)) {
            return vec3.lerpUnclamped(src, v, Math.max(0, Math.min(1, t)), dest);
        },
    },
});

export {
    vec3 as default,
    vec3,
};

window.vec3 = vec3;