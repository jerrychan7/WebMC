
import { defineLineAlge } from "./solver.js";

let ARRAY_TYPE = window.Float32Array || Array;

const mat4 = defineLineAlge("Mat4", () => new ARRAY_TYPE(16), {
    getArrType: { fn: () => ARRAY_TYPE, input: 0, output: 0, argsLen: 0 },
    setArrType: { fn(type) { ARRAY_TYPE = type }, input: 0, output: 0, argsLen: 1 },
    identity: { alias: ["E"],
        fn(dest = new ARRAY_TYPE(16)) {
            dest[0] = 1; dest[1] = 0; dest[2] = 0; dest[3] = 0;
            dest[4] = 0; dest[5] = 1; dest[6] = 0; dest[7] = 0;
            dest[8] = 0; dest[9] = 0; dest[10] = 1; dest[11] = 0;
            dest[12] = 0; dest[13] = 0; dest[14] = 0; dest[15] = 1;
            return dest;
        },
        input: 0,
    },
    copy: { alias: ["copyTo", "copy2", "clone", ],
        fn(mat, dest = new ARRAY_TYPE(16)) {
            if (mat === dest) return dest;
            dest[0] = mat[0];
            dest[1] = mat[1];
            dest[2] = mat[2];
            dest[3] = mat[3];
            dest[4] = mat[4];
            dest[5] = mat[5];
            dest[6] = mat[6];
            dest[7] = mat[7];
            dest[8] = mat[8];
            dest[9] = mat[9];
            dest[10] = mat[10];
            dest[11] = mat[11];
            dest[12] = mat[12];
            dest[13] = mat[13];
            dest[14] = mat[14];
            dest[15] = mat[15];
            return dest;
        },
        derived: {
            copyFrom: { alias: ["set", "=", ],
                fn: mat => mat,
                input: 2, output: 1,
            },
        },
    },
    // 相乘 参3 = 参1 * 参2
    multiply: { alias: ["mul", "preMultiply", "preMul", "leftMultiply", "leftMul", "*", ],
        fn(
            [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p],
            [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P],
            dest = new ARRAY_TYPE(16)
        ) {
            dest[0] = A * a + B * e + C * i + D * m;
            dest[1] = A * b + B * f + C * j + D * n;
            dest[2] = A * c + B * g + C * k + D * o;
            dest[3] = A * d + B * h + C * l + D * p;
            dest[4] = E * a + F * e + G * i + H * m;
            dest[5] = E * b + F * f + G * j + H * n;
            dest[6] = E * c + F * g + G * k + H * o;
            dest[7] = E * d + F * h + G * l + H * p;
            dest[8] = I * a + J * e + K * i + L * m;
            dest[9] = I * b + J * f + K * j + L * n;
            dest[10] = I * c + J * g + K * k + L * o;
            dest[11] = I * d + J * h + K * l + L * p;
            dest[12] = M * a + N * e + O * i + P * m;
            dest[13] = M * b + N * f + O * j + P * n;
            dest[14] = M * c + N * g + O * k + P * o;
            dest[15] = M * d + N * h + O * l + P * p;
            return dest;
        },
        derived: { postMultiply: { input: 2, alias: ["rightMultiply", "rightMul", "postMul", ] } },
    },
    // 原始矩阵 缩放向量 保存结果的矩阵
    scale: {
        fn(mat, [x, y, z], dest = new ARRAY_TYPE(16)) {
            const [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = mat;
            dest[0] = a * x; dest[1] = b * x; dest[2] = c * x; dest[3] = d * x;
            dest[4] = e * y; dest[5] = f * y; dest[6] = g * y; dest[7] = h * y;
            dest[8] = i * z; dest[9] = j * z; dest[10] = k * z; dest[11] = l * z;
            if (mat !== dest) dest[12] = m, dest[13] = n, dest[14] = o, dest[15] = p;
            return dest;
        },
    },
    // 原始矩阵 从原点开始移动一定距离的向量 结果矩阵
    translate: {
        fn(mat, [x, y, z], dest = new ARRAY_TYPE(16)) {
            const [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = mat;
            if (mat !== dest)
                dest[0] = a, dest[1] = b, dest[2] = c, dest[3] = d,
                dest[4] = e, dest[5] = f, dest[6] = g, dest[7] = h,
                dest[8] = i, dest[9] = j, dest[10] = k, dest[11] = l;
            dest[12] = m + a * x + e * y + i * z;
            dest[13] = n + b * x + f * y + j * z;
            dest[14] = o + c * x + g * y + k * z;
            dest[15] = p + d * x + h * y + l * z;
            return dest;
        },
    },
    // 原始矩阵 旋转角度 旋转轴向量 结果矩阵
    rotate: {
        fn(mat, angle, axis, dest = new ARRAY_TYPE(16)) {
            const { hypot, sin, cos } = Math;
            let [a, b, c] = axis, sq = hypot(a, b, c);
            if (!sq) return null;
            if (sq != 1) { sq = 1 / sq; a *= sq; b *= sq; c *= sq; }
            const d = sin(angle), e = cos(angle), f = 1 - e,
                [g, h, i, j, k, l, m, n, o, p, q, r] = mat,
                af = a * f, bf = b * f, cf = c * f,
                s = a * af + e, t = b * af + c * d, u = c * af - b * d,
                v = a * bf - c * d, w = b * bf + e, x = c * bf + a * d,
                y = a * cf + b * d, z = b * cf - a * d, A = c * cf + e;
            dest[0] = g * s + k * t + o * u;
            dest[1] = h * s + l * t + p * u;
            dest[2] = i * s + m * t + q * u;
            dest[3] = j * s + n * t + r * u;
            dest[4] = g * v + k * w + o * x;
            dest[5] = h * v + l * w + p * x;
            dest[6] = i * v + m * w + q * x;
            dest[7] = j * v + n * w + r * x;
            dest[8] = g * y + k * z + o * A;
            dest[9] = h * y + l * z + p * A;
            dest[10] = i * y + m * z + q * A;
            dest[11] = j * y + n * z + r * A;
            if (mat !== dest) dest[12] = mat[12], dest[13] = mat[13], dest[14] = mat[14], dest[15] = mat[15];
            return dest;
        },
    },
    // 视图变换矩阵
    // 镜头位置向量 镜头参考点向量 镜头方向向量 结果矩阵
    // 将镜头理解为人头 镜头方向就是头顶的朝向
    // https://www.3dgep.com/understanding-the-view-matrix/
    lookAt: {
        fn(eye, target, up, dest = new ARRAY_TYPE(16)) {
            const { hypot } = Math;
            let [eyeX, eyeY, eyeZ] = eye,
                [upX, upY, upZ] = up,
                [targetX, targetY, targetZ] = target;
            if (eyeX == targetX && eyeY == targetY && eyeZ == targetZ) return mat4.identity(dest);
            // z = normal(eye - target)
            // x = normal(cross(up, z))
            // y = cross(z, x)
            let x0, x1, x2, y0, y1, y2,
                z0 = eyeX - targetX,
                z1 = eyeY - targetY,
                z2 = eyeZ - targetZ,
                l = 1 / hypot(z0, z1, z2);
            z0 *= l; z1 *= l; z2 *= l;
            x0 = upY * z2 - upZ * z1;
            x1 = upZ * z0 - upX * z2;
            x2 = upX * z1 - upY * z0;
            l = hypot(x0, x1, x2);
            if (l) { l = 1 / l; x0 *= l; x1 *= l; x2 *= l; }
            else x0 = x1 = x2 = 0;
            y0 = z1 * x2 - z2 * x1; y1 = z2 * x0 - z0 * x2; y2 = z0 * x1 - z1 * x0;
            l = hypot(y0, y1, y2);
            if (l) { l = 1 / l; y0 *= l; y1 *= l; y2 *= l; }
            else y0 = y1 = y2 = 0;
            dest[0] = x0; dest[1] = y0; dest[2] = z0; dest[3] = 0;
            dest[4] = x1; dest[5] = y1; dest[6] = z1; dest[7] = 0;
            dest[8] = x2; dest[9] = y2; dest[10] = z2; dest[11] = 0;
            // -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
            dest[12] = -(x0 * eyeX + x1 * eyeY + x2 * eyeZ);
            dest[13] = -(y0 * eyeX + y1 * eyeY + y2 * eyeZ);
            dest[14] = -(z0 * eyeX + z1 * eyeY + z2 * eyeZ);
            dest[15] = 1;
            return dest;
        },
    },
    fpsView: {
        fn(eye, pitch, yaw, rollZ = 0, dest = new ARRAY_TYPE(16)) {
            const { cos, sin } = Math;
            let [eyeX, eyeY, eyeZ] = eye,
                cosPitch = cos(pitch), sinPitch = sin(pitch),
                cosYaw = cos(yaw), sinYaw = sin(yaw),
                cosZ = cos(-rollZ), sinZ = sin(-rollZ),
                x0 = cosYaw * cosZ, x1 = cosYaw * sinZ, x2 = -sinYaw,
                y0 = sinPitch * sinYaw * cosZ - cosPitch * sinZ,
                y1 = sinPitch * sinYaw * sinZ + cosPitch * cosZ,
                y2 = sinPitch * cosYaw,
                z0 = cosPitch * sinYaw * cosZ + sinPitch * sinZ,
                z1 = cosPitch * sinYaw * sinZ - sinPitch * cosZ,
                z2 = cosPitch * cosYaw;
            dest[0] = x0; dest[1] = y0; dest[2] = z0; dest[3] = 0;
            dest[4] = x1; dest[5] = y1; dest[6] = z1; dest[7] = 0;
            dest[8] = x2; dest[9] = y2; dest[10] = z2; dest[11] = 0;
            // -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
            dest[12] = -(x0 * eyeX + x1 * eyeY + x2 * eyeZ);
            dest[13] = -(y0 * eyeX + y1 * eyeY + y2 * eyeZ);
            dest[14] = -(z0 * eyeX + z1 * eyeY + z2 * eyeZ);
            dest[15] = 1;
            return dest;
        },
        argsLen: 5,
    },
    // 投影变换矩阵
    // 视角(degrees) 屏幕高宽比 近截面位置>0 远截面位置 结果矩阵
    // 当想要转换左右手坐标系时，用
    // 将视图矩阵最后一行的前三个取反 乘 将下面的投影矩阵2fn*d和1取反
    // 当转换左右手坐标系时 三角形的旋转方向就反过来了 需要注意
    perspective: {
        fn(fovy, aspect, near, far, dest = new ARRAY_TYPE(16)) {
            const t = 1 / Math.tan(fovy * Math.PI / 360),
                d = 1 / (far - near);
            dest[0] = t / aspect; dest[1] = dest[2] = dest[3] = 0;
            dest[4] = 0; dest[5] = t; dest[6] = dest[7] = 0;
            dest[8] = dest[9] = 0; dest[10] = -(far + near) * d; dest[11] = -1;
            dest[12] = dest[13] = 0; dest[14] = -2 * far * near * d; dest[15] = 0;
            return dest;
        },
    },
    ortho: {
        fn(left, right, bottom, top, near, far, dest = new ARRAY_TYPE(16)) {
            const lr = 1 / (left - right),
                bt = 1 / (bottom - top),
                nf = 1 / (near - far);
            dest[0] = -2 * lr; dest[1] = dest[2] = dest[3] = 0;
            dest[4] = 0; dest[5] = -2 * bt; dest[6] = dest[7] = 0;
            dest[8] = dest[9] = 0; dest[10] = 2 * nf; dest[11] = 0;
            dest[12] = (left + right) * lr;
            dest[13] = (top + bottom) * bt;
            dest[14] = (far + near) * nf; dest[15] = 1;
            return dest;
        },
    },
    // 转置
    transpose: { alias: ["T"],
        fn(mat, dest = new ARRAY_TYPE(16)) {
            const [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = mat;
            dest[1] = e; dest[2] = i; dest[3] = m;
            dest[4] = b; dest[6] = j; dest[7] = n;
            dest[8] = c; dest[9] = g; dest[11] = o;
            dest[12] = d; dest[13] = h; dest[14] = l;
            if (mat !== dest) dest[0] = a, dest[5] = f, dest[10] = k, dest[15] = p;
            return dest;
        },
    },
    // 逆矩阵
    inverse: { alias: ["inv"],
        fn([a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p], dest = new ARRAY_TYPE(16)) {
            const q = a * f - b * e, r = a * g - c * e,
                s = a * h - d * e, t = b * g - c * f,
                u = b * h - d * f, v = c * h - d * g,
                w = i * n - j * m, x = i * o - k * m,
                y = i * p - l * m, z = j * o - k * n,
                A = j * p - l * n, B = k * p - l * o,
                det = q * B - r * A + s * z + t * y - u * x + v * w;
            if (det === 0) return mat4.identity(dest);
            const ivd = 1 / det;
            dest[0] = (f * B - g * A + h * z) * ivd;
            dest[1] = (-b * B + c * A - d * z) * ivd;
            dest[2] = (n * v - o * u + p * t) * ivd;
            dest[3] = (-j * v + k * u - l * t) * ivd;
            dest[4] = (-e * B + g * y - h * x) * ivd;
            dest[5] = (a * B - c * y + d * x) * ivd;
            dest[6] = (-m * v + o * s - p * r) * ivd;
            dest[7] = (i * v - k * s + l * r) * ivd;
            dest[8] = (e * A - f * y + h * w) * ivd;
            dest[9] = (-a * A + b * y - d * w) * ivd;
            dest[10] = (m * u - n * s + p * q) * ivd;
            dest[11] = (-i * u + j * s - l * q) * ivd;
            dest[12] = (-e * z + f * x - g * w) * ivd;
            dest[13] = (a * z - b * x + c * w) * ivd;
            dest[14] = (-m * t + n * r - o * q) * ivd;
            dest[15] = (i * t - j * r + k * q) * ivd;
            return dest;
        },
    },
});

export {
    mat4 as default,
    mat4,
};
