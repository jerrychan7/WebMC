
let Mat4Type = Float32Array,
    Vec3Type = Float32Array;

const mat4 = {
    identity(src = new Mat4Type(16)) {
        src.set([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
        return src;
    },
    //相乘 参3=参1x参2
    multiply(mat1, mat2, dest = new Mat4Type(16)){
        let [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = mat1,
            [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P] = mat2;
        dest.set([
            A * a + B * e + C * i + D * m,
            A * b + B * f + C * j + D * n,
            A * c + B * g + C * k + D * o,
            A * d + B * h + C * l + D * p,
            E * a + F * e + G * i + H * m,
            E * b + F * f + G * j + H * n,
            E * c + F * g + G * k + H * o,
            E * d + F * h + G * l + H * p,
            I * a + J * e + K * i + L * m,
            I * b + J * f + K * j + L * n,
            I * c + J * g + K * k + L * o,
            I * d + J * h + K * l + L * p,
            M * a + N * e + O * i + P * m,
            M * b + N * f + O * j + P * n,
            M * c + N * g + O * k + P * o,
            M * d + N * h + O * l + P * p
        ]);
        return dest;
    },
    //原始矩阵 缩放向量 保存结果的矩阵
    scale(mat, vec, dest = new Mat4Type(16)) {
        dest.set([
            mat[0]  * vec[0],
            mat[1]  * vec[0],
            mat[2]  * vec[0],
            mat[3]  * vec[0],
            mat[4]  * vec[1],
            mat[5]  * vec[1],
            mat[6]  * vec[1],
            mat[7]  * vec[1],
            mat[8]  * vec[2],
            mat[9]  * vec[2],
            mat[10] * vec[2],
            mat[11] * vec[2],
            mat[12], mat[13], mat[14], mat[15]
        ]);
        return dest;
    },
    //原始矩阵 从原点开始移动一定距离的向量 结果矩阵
    translate(mat, vec, dest = new Mat4Type(16)) {
        dest.set([
            mat[0], mat[1], mat[2], mat[3],
            mat[4], mat[5], mat[6], mat[7],
            mat[8], mat[9], mat[10], mat[11],
            mat[0] * vec[0] + mat[4] * vec[1] + mat[8]  * vec[2] + mat[12],
            mat[1] * vec[0] + mat[5] * vec[1] + mat[9]  * vec[2] + mat[13],
            mat[2] * vec[0] + mat[6] * vec[1] + mat[10] * vec[2] + mat[14],
            mat[3] * vec[0] + mat[7] * vec[1] + mat[11] * vec[2] + mat[15]
        ]);
        return dest;
    },
    //原始矩阵 旋转角度 旋转轴向量 结果矩阵
    rotate(mat, angle, axis, dest = new Mat4Type(16)) {
        let sq = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
        if (!sq) return null;
        let [a, b, c] = axis;
        if (sq != 1) {sq = 1 / sq; a *= sq; b *= sq; c *= sq;}
        let d = Math.sin(angle), e = Math.cos(angle), f = 1 - e,
            [g, h, i, j, k, l, m, n, o, p, q, r] = mat,
            s = a * a * f + e,
            t = b * a * f + c * d,
            u = c * a * f - b * d,
            v = a * b * f - c * d,
            w = b * b * f + e,
            x = c * b * f + a * d,
            y = a * c * f + b * d,
            z = b * c * f - a * d,
            A = c * c * f + e;
        dest.set([
            g * s + k * t + o * u,
            h * s + l * t + p * u,
            i * s + m * t + q * u,
            j * s + n * t + r * u,
            g * v + k * w + o * x,
            h * v + l * w + p * x,
            i * v + m * w + q * x,
            j * v + n * w + r * x,
            g * y + k * z + o * A,
            h * y + l * z + p * A,
            i * y + m * z + q * A,
            j * y + n * z + r * A,
            mat[12], mat[13], mat[14], mat[15]
        ]);
        return dest;
    },
    //视图变换矩阵
    //镜头位置向量 镜头参考点向量 镜头方向向量 结果矩阵
    //将镜头理解为人头 镜头方向就是头顶的朝向
    lookAt(eye, center, up, dest = new Mat4Type(16)) {
        let [eyeX, eyeY, eyeZ] = eye,
            [upX, upY, upZ] = up,
            [centerX, centerY, centerZ] = center;
        if (eyeX == centerX && eyeY == centerY && eyeZ == centerZ) return mat4.identity(dest);
        let x0, x1, x2, y0, y1, y2,
            z0 = eyeX - centerX,
            z1= eyeY - centerY,
            z2 = eyeZ - centerZ,
            l = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
        z0 *= l; z1 *= l; z2 *= l;
        x0 = upY * z2 - upZ * z1;
        x1 = upZ * z0 - upX * z2;
        x2 = upX * z1 - upY * z0;
        l = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
        if (!l) x0 = x1 = x2 = 0;
        else {
            l = 1 / l;
            x0 *= l; x1 *= l; x2 *= l;
        }
        y0 = z1 * x2 - z2 * x1; y1 = z2 * x0 - z0 * x2; y2 = z0 * x1 - z1 * x0;
        l = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
        if (!l) y0 = y1 = y2 = 0;
        else {
            l = 1 / l;
            y0 *= l; y1 *= l; y2 *= l;
        }
        dest.set([
            x0, y0, z0, 0,
            x1, y1, z1, 0,
            x2, y2, z2, 0,
            -(x0 * eyeX + x1 * eyeY + x2 * eyeZ),
            -(y0 * eyeX + y1 * eyeY + y2 * eyeZ),
            -(z0 * eyeX + z1 * eyeY + z2 * eyeZ),
            1
        ]);
        return dest;
    },
    //投影变换矩阵
    //视角 屏幕高宽比 近截面位置>0 远截面位置 结果矩阵
    //视角不是镜头方向 理解为视野范围
    perspective(fovy, aspect, near, far, dest = new Mat4Type(16)) {
        let t = near * Math.tan(fovy * Math.PI / 360),
            r = t * aspect,
            a = r * 2, b = t * 2, c = far - near;
        dest.set([
            near * 2 / a, 0, 0, 0,
            0, near * 2 / b, 0, 0,
            0, 0, -(far + near) / c, -1,
            0, 0, -(far * near * 2) / c, 0
        ]);
        return dest;
    },
    //转置
    transpose(mat, dest = new Mat4Type(16)) {
        dest.set([
            mat[0], mat[4], mat[8], mat[12],
            mat[1], mat[5], mat[9], mat[13],
            mat[2], mat[6], mat[10], mat[14],
            mat[3], mat[7], mat[11], mat[15]
        ]);
        return dest;
    },
    //逆矩阵
    inverse(mat, dest = new Mat4Type(16)) {
        let [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = mat,
            q = a * f - b * e, r = a * g - c * e,
            s = a * h - d * e, t = b * g - c * f,
            u = b * h - d * f, v = c * h - d * g,
            w = i * n - j * m, x = i * o - k * m,
            y = i * p - l * m, z = j * o - k * n,
            A = j * p - l * n, B = k * p - l * o,
            ivd = 1 / (q * B - r * A + s * z + t * y - u * x + v * w);
        dest.set([
            ( f * B - g * A + h * z) * ivd,
            (-b * B + c * A - d * z) * ivd,
            ( n * v - o * u + p * t) * ivd,
            (-j * v + k * u - l * t) * ivd,
            (-e * B + g * y - h * x) * ivd,
            ( a * B - c * y + d * x) * ivd,
            (-m * v + o * s - p * r) * ivd,
            ( i * v - k * s + l * r) * ivd,
            ( e * A - f * y + h * w) * ivd,
            (-a * A + b * y - d * w) * ivd,
            ( m * u - n * s + p * q) * ivd,
            (-i * u + j * s - l * q) * ivd,
            (-e * z + f * x - g * w) * ivd,
            ( a * z - b * x + c * w) * ivd,
            (-m * t + n * r - o * q) * ivd,
            ( i * t - j * r + k * q) * ivd
        ]);
        return dest;
    }
};

const vec3 = {
    create(x = 0, y = 0, z = 0, ArrayType = Vec3Type) {
        return new ArrayType([x, y, z]);
    },
    length(src) {
        return Math.sqrt(src[0] ** 2 + src[1] ** 2 + src[2] ** 2);
    },
    get len() { return vec3.length; },
    add(v1, v2, dest = new Vec3Type(3)) {
        dest.set([v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]]);
        return dest;
    },
    subtract(v1, v2, dest = new Vec3Type(3)) {
        dest.set([v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]]);
        return dest;
    },
    get sub() { return vec3.subtract; },
    multiply(v1, v2, dest = new Vec3Type(3)) {
        dest.set([v1[0] * v2[0], v1[1] * v2[1], v1[2] * v2[2]]);
        return dest;
    },
    get mul() { return vec3.multiply; },
    scale(v, s, dest = new Vec3Type(3)) {
        dest.set([v[0] * s, v[1] * s, v[2] * s]);
        return dest;
    },
    divide(v1, v2, dest = new Vec3Type(3)) {
        dest.set([v1[0] / v2[0], v1[1] / v2[1], v1[2] / v2[2]]);
        return dest;
    },
    get div() { return vec3.divide; },
    normalize(v, dest = new Vec3Type(3)) {
        // return vec3.scale(v, 1 / vec3.length(v), dest);
        let len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
        dest.set([v[0] / len, v[1] / len, v[2] / len]);
        return dest;
    },
    negate(v, dest = new Vec3Type(3)) {
        dest.set([-v[0], -v[1], -v[2]]);
        return dest;
    },
    inverse(v, dest = new Vec3Type(3)) {
        dest.set([1 / v[0], 1 / v[1], 1 / v[2]]);
        return dest;
    },
    exactEquals(v1, v2) {
        return v1[0] === v2[0] && v1[1] === v2[1] && v1[2] === v2[2];
    },
    equals(v1, v2) {
        let [x, y, z] = v1, [u, v, w] = v2,
            abs=Math.abs, max=Math.max,
            EPSILON=0.000001;
        return (abs(x - u) <= EPSILON*max(1.0, abs(x), abs(u)) &&
                abs(y - v) <= EPSILON*max(1.0, abs(y), abs(v)) &&
                abs(z - w) <= EPSILON*max(1.0, abs(z), abs(w)));
    },
    transformMat4(v, m, dest = new Vec3Type(3)) {
        let [x, y, z] = v,
            w = (m[3] * x + m[7] * y + m[11] * z + m[15]) || 1.0;
        dest.set([
            (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
            (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
            (m[2] * x + m[6] * y + m[10]* z + m[14]) / w
        ]);
        return dest;
    },
};

export { mat4, vec3 };
