import { vec3, vec2 } from "../utils/math/index.js";

function lerp(a, b, t) {
    return (1 - t) * a + t * b;
}

// ease curves 3t^2 - 2t^3
function fade(t) {
    return t * t * ((2 * t) - 3);
}
// 6t^5 - 15t^4 + 10t^3
function fade2(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

// return (-1.0, 1.0]
function fnoise(int32) {
    int32 = (int32 << 13) ^ int32;
    return (1.0 - ((int32 * (int32 * int32 * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0);
}

// 在JS中，按照IEEE 754-2008标准的定义，所有数字都以双精度64位浮点格式表示。
// 在此标准下，无法精确表示的非常大的整数将自动四舍五入。
// 确切地说，JS 中的Number类型只能安全地表示-9007199254740991(-(2^53-1))和9007199254740991(2^53-1)之间的整数，
// 任何超出此范围的整数值都可能失去精度。

// 基于这点 种子的范围[-(2^53-1), 2^53-1]，一共2^54-1个。
// 最接近2^53的质数 = 9007199254740881 = 1FFFFFFFFFFF91
// Number.MAX_SAFE_INTEGER (2^53-1) > max prime number = 9007199254740881 = 1FFFFFFFFFFF91
const MAX_SAFE_PRIME = 0x1FFFFFFFFFFF91;

function toSeed(seed) {
    let s = Number(seed);
    if (!Number.isNaN(s)) seed = s;
    if (typeof seed === "number") {
        if (Number.isInteger(seed)) {
            s = seed % MAX_SAFE_PRIME;
        }
        else {
            seed *= Math.PI;
            s = Number(seed.toString().replace(".", "").slice(0, 16)) % MAX_SAFE_PRIME;
        }
    }
    else if (typeof seed === "string") {
        let i = 0, t = "";
        for (; i < seed.length; ++i) {
            let j = seed.charCodeAt(i);
            if ((t + j).length > 53) break;
            t += j;
        }
        s = Number(t);
        for (; i < seed.length; ++i) {
            s = ((s + seed.charCodeAt(i)) * 48271 + 57) % MAX_SAFE_PRIME;
        }
    }
    return s;
}

class RandomGen {
    constructor(seed = Date.now()) {
        this.seed = toSeed(seed);
    };
}

class LCG extends RandomGen {
    constructor(seed = Date.now()) {
        super(seed);
        this.x = seed;
    };
    nextInt(n) {
        this.x = (48271 * this.x + 57) % MAX_SAFE_PRIME;
        if (n) return this.x % n;
        return this.x;
    };
}

class Noise {
    constructor(seed = Date.now()) {
        this.setSeed(seed);
        let random = this.random = new LCG(this.seed);
        let perm = [...Array(256)].map((_, i) => i);
        for (let i = 0, j, t; i < 256; ++i) {
            j = random.nextInt(256 - i) + i;
            t = perm[i];
            perm[i] = perm[i + 256] = perm[j];
            perm[j] = t;
        }
        this.permutations = perm;
    };
    setSeed(seed) {
        this.originalSeed = seed;
        this.seed = toSeed(seed);
    };
    getSeed() { return this.seed; };
}

// perlin noise
class PerlinNoise extends Noise {
    constructor(seed) {
        super(seed);
        let grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
        ].map(([x, y, z]) => vec3.create(x, y, z));
        let gradP = this.gradP = [];
        this.permutations.forEach(i => gradP.push(grad3[i % 12]));
        // console.log(this.gradP.join("|"))
    };
    gen(x, y, z) {
        if (y == 1) return this.gen2d(x, z);
        return this.gen3d(x, y, z);
    };
    // return [-1, 1];
    gen2d(x, y) {
        const {floor} = Math, perm = this.permutations, gradP = this.gradP;
        let fx = floor(x), fy = floor(y),
            rx = x - fx, ry = y - fy;
        fx &= 255; fy &= 255; // %= 256
        let n00 = vec2.dot(gradP[fx + perm[fy]        ], [    rx,     ry]),
            n01 = vec2.dot(gradP[fx + perm[fy + 1]    ], [    rx, ry - 1]),
            n10 = vec2.dot(gradP[fx + perm[fy]     + 1], [rx - 1,     ry]),
            n11 = vec2.dot(gradP[fx + perm[fy + 1] + 1], [rx - 1, ry - 1]),
            u = fade2(rx);
        return lerp(
            lerp(n00, n10, u),
            lerp(n01, n11, u),
            fade2(ry)
        );
    };
    // return [-1, 1];
    gen3d(x, y, z) {
        const {floor} = Math,
              {gradP, permutations: perm} = this;
        // Find unit grid cell containing point
        let X = floor(x), Y = floor(y), Z = floor(z);
        // Get relative xyz coordinates of point within that cell
        x -= X; y -= Y; z -= Z;
        X &= 255; Y &= 255; Z &= 255; // %= 256

        // Calculate noise contributions from each of the eight corners
        let n000 = vec3.dot(gradP[X+  perm[Y+  perm[Z  ]]], [  x,   y,   z]),
            n001 = vec3.dot(gradP[X+  perm[Y+  perm[Z+1]]], [  x,   y, z-1]),
            n010 = vec3.dot(gradP[X+  perm[Y+1+perm[Z  ]]], [  x, y-1,   z]),
            n011 = vec3.dot(gradP[X+  perm[Y+1+perm[Z+1]]], [  x, y-1, z-1]),
            n100 = vec3.dot(gradP[X+1+perm[Y+  perm[Z  ]]], [x-1,   y,   z]),
            n101 = vec3.dot(gradP[X+1+perm[Y+  perm[Z+1]]], [x-1,   y, z-1]),
            n110 = vec3.dot(gradP[X+1+perm[Y+1+perm[Z  ]]], [x-1, y-1,   z]),
            n111 = vec3.dot(gradP[X+1+perm[Y+1+perm[Z+1]]], [x-1, y-1, z-1]);

        // Compute the fade curve value for x, y, z
        // let [u, v, w] = [x, y, z].map(fade);
        let u = fade2(x), v = fade2(y), w = fade2(z);

        // Interpolate
        return lerp(
            lerp(
                lerp(n000, n100, u),
                lerp(n001, n101, u), w),
            lerp(
                lerp(n010, n110, u),
                lerp(n011, n111, u), w), v);
    };
}

// simplex noise
class SimplexNoise extends Noise {}

// Fractal Brownian Motion (fbm) 分形叠加
// freq frequency 频率
// amp amplitude 振幅
// octave 倍频
function fbm(noise, x, freq, amp, octave, normalized) {

}

export {
    PerlinNoise
}
