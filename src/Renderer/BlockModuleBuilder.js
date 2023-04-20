
import { Block } from "../World/Block.js";
import { Chunk } from "../World/Chunk.js";
import { settings } from "../settings.js";

const {
    X_SIZE, Y_SIZE, Z_SIZE,
    getRelativeBlockXYZ,
    getLinearBlockIndex,
} = Chunk;

const lightLevel_col = Array(16).fill(0).map((_, i) => Math.pow(0.9, 15 - i));
const calCol = blockLight => lightLevel_col[blockLight];
const genColArr = (verNum, blockLight, scale = 1, calcCol = calCol) => {
    verNum *= 4;
    let ans = new Array(verNum), l = calcCol(blockLight) * scale;
    for (let i = 0; i < verNum; i += 4) {
        ans[i] = ans[i + 1] = ans[i + 2] = l;
        ans[i + 3] = 1;
    }
    return ans;
};

const isEmptyObj = obj => {
    for (let _ in obj) return false;
    return true;
};

const faces = [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]];

// 这个类专门负责构建单个方块的渲染所需信息 例如 顶点 uv 颜色 索引
// 这个类生成的是js数据而不是缓存对象 这么做的好处之一就是可以放入多线程
class BlockModuleBuilder {
    constructor(world = null) { this.setWorld(world); };
    setWorld(world = null) {
        if (this.world === world) return;
        if (this.world) this.blockFaceCache = {};
        this.world = world;
        if (!world) return;
        /* render cache (help to quick update chunk module without recalculate)
         * blockFace: chunkKey => [linear block index]["x+|x-|y+|y-|z+|z-|face"]: {
         *   ver: vertex coordiate (length == 3n)
         *   tex: texture uv corrdiate (length == 2n)
         *   col: vertex color (length == 4n)
         *   ele: element (length == 3n/2)
         * }
         */
        this.blockFaceCache = {};
    };
    updateChunkColor(chunk) {
        const { chunkKey } = chunk;
        const blockFaceCache = this.blockFaceCache[chunkKey];
        if (!blockFaceCache) return;
        for (let cry = 0; cry < Y_SIZE; ++cry)
        for (let crz = 0; crz < Z_SIZE; ++crz)
        for (let crx = 0; crx < X_SIZE; ++crx) {
            const cblockIdx = getLinearBlockIndex(crx, cry, crz);
            if (!(cblockIdx in blockFaceCache)) continue;
            const [cwx, cwy, cwz] = chunk.blockRXYZ2BlockXYZ(crx, cry, crz);
            this.gen(cwx, cwy, cwz, { chunk, crx, cry, crz, colorOnly: true, });
        }
    };
    // 对周围方块的更新只需要用周围坐标调用6次该函数就行 简单方便
    // cw[xyz] 是中心方块的世界坐标
    // return: chunkKey || ""，空字符串表示不需要更新mesh
    gen(cwx, cwy, cwz, {
        chunk = this.world?.getChunkByBlockXYZ(cwx, cwy, cwz),
        chunkKey = chunk?.chunkKey,
        crx, cry, crz,
        cLongID, cblock,
        shade = settings.shade,
        colorOnly = false,
        justUpdateFaces = faces,
    } = {}) {
        if (chunk === null) return "";
        if (crx === undefined)
            [crx, cry, crz] = getRelativeBlockXYZ(cwx, cwy, cwz);
        if (cLongID === undefined) {
            cLongID = chunk.getTile(crx, cry, crz);
            cblock = Block.getBlockByBlockLongID(cLongID);
        }
        const blockFaceCache = this.blockFaceCache[chunkKey] || [];
        this.blockFaceCache[chunkKey] = blockFaceCache;
        const cblockIndex = getLinearBlockIndex(crx, cry, crz);
        if (cblock.name === "air") {
            let t = cblockIndex in blockFaceCache;
            delete blockFaceCache[cblockIndex];
            return t? "": chunkKey;
        }
        const world = this.world || chunk.world,
            bfc = blockFaceCache[cblockIndex] || {},
            yPos = { y0: 1, y1: 1, y2: 1, y3: 1, average: 1, },
            isSameFluid = (ablock) => ablock.isFluid && ablock === cblock
                // water == flowing_water, lava == flowing_lava
                || (ablock.name === "flowing_" + cblock.name)
                || ("flowing_" + ablock.name === cblock.name);
        switch(cblock.renderType) {
        case Block.renderType.FLUID: {
            // 计算中间方块的液体四个角的高度
            // 当液体向下流时会出现等级比最大值大的情况
            if (!colorOnly && cLongID.bd <= cblock.maxLevel) {
                // 液体影响 该顶点的高度等于周围相同的液体的高度的平均值 现在实现上是用的最小值
                // 空气影响 斜对角没有碰撞箱的方块会让顶点变低【压力板和梯子除外
                const level2ver = level => level == -1? 1: ((cblock.maxLevel + 1) - level - 0.75) / (cblock.maxLevel + 1);
                [
                    [[-1, -1], [0, -1], [-1, 0]],   // y0 左上角
                    [[-1, 0], [-1, 1], [0, 1]],     // y1 左下角
                    [[1, 0], [0, 1], [1, 1]],       // y2 右下角
                    [[0,-1], [1,-1], [1, 0]],       // y3 右上角
                ].forEach((arr, verIdx) => {
                    let fluidLevel = cLongID.bd;
                    for (const [dx, dz] of arr) {
                        const aLongID = world.getTile(cwx + dx, cwy, cwz + dz);
                        if (aLongID === null) continue;
                        const alevel = aLongID.bd,
                            ablock = Block.getBlockByBlockLongID(aLongID);
                        if (isSameFluid(ablock)) {
                            // 当液体向下流时会出现等级比最大值大的情况
                            if (alevel > cblock.maxLevel) {
                                fluidLevel = -1;
                                break;
                            }
                            fluidLevel = Math.min(fluidLevel, alevel);
                        }
                    }
                    yPos["y" + verIdx] = level2ver(fluidLevel);
                });
                // yPos.average = (yPos.y0 + yPos.y1 + yPos.y2 + yPos.y3) / 4;
                // console.log(cwx, cwy, cwz, cLongID.id, cLongID.bd, yPos);
            }
            // 这里没有break 复用下面渲染正常方块的逻辑
        }
        case Block.renderType.CACTUS:
        case Block.renderType.NORMAL: {
            // 遍历周围方块 如果符合条件则添加/更新缓存 否则删除缓存
            for (const [dx, dy, dz, face] of justUpdateFaces) {
                if (colorOnly && !(face in bfc)) continue;
                let arx = crx + dx, ary = cry + dy, arz = crz + dz,
                    inOtherChunk = chunk.inOtherChunk(arx, ary, arz),
                    ablock = inOtherChunk
                        ? world.getBlock(cwx + dx, cwy + dy, cwz + dz)
                        : chunk.getBlock(arx, ary, arz);
                // 如果周围方块是不透明的 或者这两个方块都是玻璃 则不需要绘制这个面
                // 如果是流体 且周围方块是相同的液体 则不需要绘制这个面
                if (!colorOnly && ablock && (ablock.isOpaque
                    || (cblock.isGlass && ablock.isGlass)
                    || (cblock.isFluid && isSameFluid(ablock))
                )) {
                    delete bfc[face];
                    continue;
                }
                let verNum = cblock.vertices[face].length / 3,
                    bfcf = bfc[face] || {};
                bfc[face] = bfcf;
                let aLight = inOtherChunk
                        ? world.getLight(cwx + dx, cwy + dy, cwz + dz)
                        : chunk.getLight(arx, ary, arz);
                // 如果区块没加载出来 则假设亮度是15
                if (aLight === null) aLight = 15;
                let scale = shade
                    ? dz? .8: dx? .6: dy == -1? .5: 1
                    : 1;
                bfcf.col = genColArr(verNum, aLight, scale);
                if (!colorOnly) {
                    if (!cblock.isFluid) {
                        delete bfcf.fluidSurface;
                        // 如果是仙人掌 或中间是树叶而旁边不是 则关闭多边形剔除功能（正反面都渲染）
                        bfcf.disableCullFace =
                            cblock.renderType === Block.renderType.CACTUS
                        || (cblock.isLeaves && !(ablock && ablock.isLeaves));
                    }
                    else {
                        delete bfcf.disableCullFace;
                        bfcf.fluidSurface = true;
                    }
                    bfcf.ele = cblock.elements[face];
                    if (!cblock.isFluid) {
                        bfcf.ver = cblock.vertices[face].map((v, ind) => ind % 3 === 0? v + cwx: ind % 3 === 1? v + cwy: v + cwz);
                        bfcf.tex = cblock.texture.uv[face];
                    }
                    else {
                        let ver = cblock.vertices[face].map(v => yPos[v] || v),
                            uv = cblock.texture.uv[face];
                        bfcf.ver = ver.map((v, ind) => ind % 3 === 0? v + cwx: ind % 3 === 1? v + cwy: v + cwz);
                        bfcf.tex = dy? uv: cblock.texture.img.texture4array
                            ? [  // webgl2 纹理数组
                                uv[0], 1 - ver[(1 >> 1) * 3 + 1], uv[2],
                                uv[3], uv[4], uv[5],
                                uv[6], uv[7], uv[8],
                                uv[9], 1 - ver[(7 >> 1) * 3 + 1], uv[11],
                            ]
                            : [
                                uv[0], uv[4] -(uv[4] - uv[1]) * ver[(1 >> 1) * 3 + 1], uv[2],
                                uv[3], uv[4], uv[5],
                                uv[6], uv[7], uv[8],
                                uv[9], uv[7] -(uv[7] - uv[10]) * ver[(7 >> 1) * 3 + 1], uv[11],
                            ];
                    }
                }
            }
            break; }
        case Block.renderType.FLOWER: {
            if (colorOnly) {
                let bl = chunk.getLight(crx, cry, crz),
                    verNum = cblock.vertices.face.length / 3;
                if (bfc.face) bfc.face.col = genColArr(verNum, bl);
                break;
            }
            let aoc = bfc.aroundOpaqueCounter || {};
            bfc.aroundOpaqueCounter = aoc;
            for (let [dx, dy, dz, face] of justUpdateFaces) {
                let arx = crx + dx, ary = cry + dy, arz = crz + dz,
                    ablock = chunk.inOtherChunk(arx, ary, arz)
                        ? world.getBlock(cwx + dx, cwy + dy, cwz + dz)
                        : chunk.getBlock(arx, ary, arz);
                aoc[face] = ablock && ablock.isOpaque;
            }
            let aroundOpaqueCount = 0;
            for (let face in aoc) aroundOpaqueCount += aoc[face];
            // 如果给不透明方块包围 则不需要绘制这朵花儿了
            if (aroundOpaqueCount === 6) {
                delete bfc.face;
                break;
            }
            let bl = chunk.getLight(crx, cry, crz),
                verNum = cblock.vertices.face.length / 3;
            bfc.face = {
                disableCullFace: true,
                ver: cblock.vertices.face.map((v, ind) => ind % 3 === 0? v + cwx: ind % 3 === 1? v + cwy: v + cwz),
                col: genColArr(verNum, bl),
                ele: cblock.elements.face,
                tex: cblock.texture.uv.face,
            };
            break; }
        }
        // TODO: 判断缓存前后是否有变更
        if (!isEmptyObj(bfc)) blockFaceCache[cblockIndex] = bfc;
        else delete blockFaceCache[cblockIndex];
        return chunkKey;
    };
    // 将 blockFaceCache 中所有的信息导出成数组
    getMeshArrays(chunkKey, colorOnly = false) {
        if (!(chunkKey in this.blockFaceCache)) return null;
        // { "normal|disableCullFace|fluidSurface": { "col|ver|tex|ele": [] } }
        const ans = {}, totalVerCounts = {};
        const addArr = (group, type, data) => {
            if (!(group in ans)) ans[group] = {};
            if (!(type in ans[group])) ans[group][type] = [];
            ans[group][type].push(...data);
        };
        // 稀疏数组中缺失项不会给 forEach 遍历到
        this.blockFaceCache[chunkKey].forEach(bfc => {
            for (const face in bfc) {
                const bfcf = bfc[face];
                if (!("ele" in bfcf)) continue;
                for (const group of ["disableCullFace", "fluidSurface", "normal"]) {
                    if (bfcf[group] || group === "normal") {
                        addArr(group, "col", bfcf.col);
                        if (!colorOnly) {
                            addArr(group, "ver", bfcf.ver);
                            addArr(group, "tex", bfcf.tex);
                            const verNum = bfcf.ver.length / 3,
                                totalVer = totalVerCounts[group] || 0;
                            totalVerCounts[group] = totalVer + verNum;
                            addArr(group, "ele", bfcf.ele.map(v => v + totalVer));
                        }
                        break;
                    }
                }
            }
        });
        return ans;
    };
    dispose() {
        this.setWorld();
    };
};

export {
    BlockModuleBuilder as default,
    BlockModuleBuilder,
    genColArr,
    calCol,
};
