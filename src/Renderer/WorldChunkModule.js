// 负责计算顶点，材质坐标，以及区块的绘制工作
import { Block } from "../World/Block.js";
import { 
    Chunk,
    CHUNK_X_SIZE as X_SIZE,
    CHUNK_Y_SIZE as Y_SIZE,
    CHUNK_Z_SIZE as Z_SIZE,
} from "../World/Chunk.js";
import { manhattanDis } from "../utils/math/index.js";
import * as glsl from "./glsl.js";

const rxyz2int = Chunk.getLinearBlockIndex;

const calCol = blockLight => Math.pow(0.9, 15 - blockLight);
const genColArr = (verNum, blockLight, calcCol = calCol) => {
    let ans = new Array(verNum * 4), l = calcCol(blockLight);
    for (let i = 0; i < verNum * 4; i += 4) {
        ans[i] = ans[i + 1] = ans[i + 2] = l;
        ans[i + 3] = 1;
    }
    return ans;
};

class ChunksModule {
    constructor(world, renderer) {
        /* render cache (help to quick update chunk module without recalculate)
         * blockFace: chunkKey => [yxz]["x+|x-|y+|y-|z+|z-|face"]: {
         *   ver: vertex coordiate (length == 3n)
         *   tex: texture uv corrdiate (length == 2n)
         *   col: vertex color (length == 4n)
         *   ele: element (length == 3n/2)
         * }
         */
        this.blockFace = {};
        /** meshs: chunkKey => {
         *     ver[], col[], tex[], ele[],
         *     disableCullFace: { ver[], col[], tex[], ele[] }
         *     buffer object: bo { ver, col, tex, ele, disableCullFace&fluidSurface: { ver, col, tex, ele } }
         * }
         */
        this.meshs = {};
        this.needUpdateMeshChunks = new Set();
        this.needUpdateColMeshChunks = new Set();
        this.needUpdateTile = [];
        this.setRenderer(renderer);
        this.setWorld(world);
    };
    setWorld(world) {
        this.world = world;
        for (let chunkKey in world.chunkMap)
            this.buildChunkModule(chunkKey);
        world.addEventListener("onTileChanges", this.updateTile.bind(this));
        world.addEventListener("onChunkLoad", chunk => {
            this.buildChunkModule(chunk.chunkKey);
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                this.buildChunkModule(Chunk.chunkKeyByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz));
            }
        });
    };
    setRenderer(renderer = null) {
        if (this.renderer === renderer) return;
        if (this.renderer && this.meshs.bo.ver) {
            Object.values(this.meshs).forEach((mesh) => {
                const {bo} = mesh;
                this.renderer.delBo(bo.ver);
                this.renderer.delBo(bo.col);
                this.renderer.delBo(bo.tex);
                this.renderer.delBo(bo.ele);
                this.renderer.delBo(bo.disableCullFace.ver);
                this.renderer.delBo(bo.disableCullFace.col);
                this.renderer.delBo(bo.disableCullFace.tex);
                this.renderer.delBo(bo.disableCullFace.ele);
                this.renderer.delBo(bo.fluidSurface.ver);
                this.renderer.delBo(bo.fluidSurface.col);
                this.renderer.delBo(bo.fluidSurface.tex);
                this.renderer.delBo(bo.fluidSurface.ele);
                mesh.bo = {};
            });
        }
        this.renderer = renderer;
        if (!renderer) return;
        if (renderer.isWebGL2)
            renderer.createProgram("showBlock", glsl.showBlock_webgl2.vert, glsl.showBlock_webgl2.frag)
                .use().bindTex("blockTex", renderer.createTextureArray(Block.defaultBlockTextureImg));
        else
            renderer.createProgram("showBlock", glsl.showBlock.vert, glsl.showBlock.frag)
                .use().bindTex("blockTex", renderer.createTexture(Block.defaultBlockTextureImg));
        this.updateMeshs();
    };
    buildChunkModule(chunkKey) {
        const world = this.world, chunk = world.getChunkByChunkKey(chunkKey);
        if (chunk === null) return;
        let blockFace = this.blockFace[chunkKey] || [...Array(X_SIZE * Y_SIZE * Z_SIZE)].map(() => ({}));
        this.blockFace[chunkKey] = blockFace;
        // build vertex
        for (let j = 0; j < Y_SIZE; ++j)
        for (let k = 0; k < Z_SIZE; ++k)
        for (let i = 0; i < X_SIZE; ++i) {
            let cblock = chunk.getBlock(i, j, k);
            if (cblock.name === "air") continue;
            let [wx, wy, wz] = chunk.blockRXYZ2BlockXYZ(i, j, k),
                bf = blockFace[rxyz2int(i, j, k)];
            // 如果周围方块透明 绘制
            switch(cblock.renderType) {
            case Block.renderType.FLUID:
            case Block.renderType.CACTUS:
            case Block.renderType.NORMAL: {
                [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                .forEach(([dx, dy, dz, face]) => {
                    let rx = i + dx, ry = j + dy, rz = k + dz,
                        inOtherChunk = chunk.inOtherChunk(rx, ry, rz),
                        b = inOtherChunk
                            ? world.getBlock(wx + dx, wy + dy, wz + dz)
                            : chunk.getBlock(rx, ry, rz);
                    if (b && b.isOpaque) return delete bf[face];
                    if (cblock.isGlass && b && b.isGlass) return delete bf[face];
                    let verNum = cblock.vertices[face].length / 3,
                        bff = bf[face] || {},
                        bl = inOtherChunk
                            ? world.getLight(wx + dx, wy + dy, wz + dz)
                            : chunk.getLight(rx, ry, rz);
                    if (bl === null) bl = 15;
                    bff.disableCullFace = cblock.renderType === Block.renderType.CACTUS;
                    if (cblock.isLeaves && !(b && b.isLeaves)) bff.disableCullFace = true;
                    bff.ver = cblock.vertices[face].map((v, ind) => ind%3===0? v+wx: ind%3===1? v+wy: v+wz);
                    bff.col = genColArr(verNum, bl);
                    bff.ele = cblock.elements[face];
                    bff.tex = cblock.texture.uv[face];
                    bf[face] = bff;
                });
                break;}
            case Block.renderType.FLOWER: {
                let aroundOpaque = 0;
                for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                    let rx = i + dx, ry = j + dy, rz = k + dz,
                        b = chunk.inOtherChunk(rx, ry, rz)
                            ? world.getBlock(wx + dx, wy + dy, wz + dz)
                            : chunk.getBlock(rx, ry, rz);
                    if (b && b.isOpaque) ++aroundOpaque;
                }
                if (aroundOpaque === 6) {
                    delete bf.face;
                    break;
                }
                let bl = chunk.getLight(i, j, k),
                    verNum = cblock.vertices.face.length / 3;
                bf.face = {
                    disableCullFace: true,
                    ver: cblock.vertices.face.map((v, ind) => ind%3===0? v+wx: ind%3===1? v+wy: v+wz),
                    col: genColArr(verNum, bl),
                    ele: cblock.elements.face,
                    tex: cblock.texture.uv.face,
                };
                break;}
            }
        }
        chunk.updatedLightMap = false;
        this.needUpdateMeshChunks.add(chunkKey);
    };
    updateTile(blockX, blockY, blockZ) {
        this.needUpdateTile.push([blockX, blockY, blockZ]);
    };
    updateTiles(blockXYZs) {
        // console.log(performance.now())
        while (blockXYZs.length) {
            let [blockX, blockY, blockZ] = blockXYZs.shift();
            const world = this.world, cblock = world.getBlock(blockX, blockY, blockZ);
            if (cblock === null) return;
            let bf = {};
            // handle center
            let yp = {};
            if (cblock.name !== "air") switch (cblock.renderType) {
                case Block.renderType.FLUID: {
                    if (cblock.bd > cblock.maxLevel) {
                        yp.y0 = yp.y1 = yp.y2 = yp.y3 = yp.y4 = 1;
                    }
                    else {
                        // 液体影响 该顶点的高度等于周围相同液体高度的平均值
                        // 空气影响 斜对角是没有碰撞箱的方块会让顶点变低【压力板和梯子除外
                        // 左上角
                        let luflevel = Infinity;
                        for (let [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
                            const longID = world.getTile(blockX + dx, blockY, blockZ + dz);
                            if (!longID) continue;
                            let abd = longID.bd;
                            const ablock = Block.getBlockByBlockLongID(longID);
                            if (ablock === cblock
                            || (cblock.name === "water" && ablock.name === "flowing_water")
                            || (cblock.name === "flowing_water" && ablock.name === "water")
                            || (cblock.name === "lava" && ablock.name === "flowing_lava")
                            || (cblock.name === "flowing_lava" && ablock.name === "lava"))
                                luflevel = Math.min(luflevel, abd > cblock.maxLevel? -Infinity: abd);
                        }
                        // 左下角
                        let lbflevel = Infinity;
                        for (let [dx, dz] of [[-1, 0], [0, 0], [-1, 1], [0, 1]]) {
                            const longID = world.getTile(blockX + dx, blockY, blockZ + dz);
                            if (!longID) continue;
                            let abd = longID.bd;
                            const ablock = Block.getBlockByBlockLongID(longID);
                            if (ablock === cblock
                            || (cblock.name === "water" && ablock.name === "flowing_water")
                            || (cblock.name === "flowing_water" && ablock.name === "water")
                            || (cblock.name === "lava" && ablock.name === "flowing_lava")
                            || (cblock.name === "flowing_lava" && ablock.name === "lava"))
                                lbflevel = Math.min(lbflevel, abd > cblock.maxLevel? -Infinity: abd);
                        }
                        // 右上角
                        let ruflevel = Infinity;
                        for (let [dx, dz] of [[0,-1], [1,-1], [0, 0], [1, 0]]) {
                            const longID = world.getTile(blockX + dx, blockY, blockZ + dz);
                            if (!longID) continue;
                            let abd = longID.bd;
                            const ablock = Block.getBlockByBlockLongID(longID);
                            if (ablock === cblock
                            || (cblock.name === "water" && ablock.name === "flowing_water")
                            || (cblock.name === "flowing_water" && ablock.name === "water")
                            || (cblock.name === "lava" && ablock.name === "flowing_lava")
                            || (cblock.name === "flowing_lava" && ablock.name === "lava"))
                                ruflevel = Math.min(ruflevel, abd > cblock.maxLevel? -Infinity: abd);
                        }
                        // 右下角
                        let rbflevel = Infinity;
                        for (let [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                            const longID = world.getTile(blockX + dx, blockY, blockZ + dz);
                            if (!longID) continue;
                            let abd = longID.bd;
                            const ablock = Block.getBlockByBlockLongID(longID);
                            if (ablock === cblock
                            || (cblock.name === "water" && ablock.name === "flowing_water")
                            || (cblock.name === "flowing_water" && ablock.name === "water")
                            || (cblock.name === "lava" && ablock.name === "flowing_lava")
                            || (cblock.name === "flowing_lava" && ablock.name === "lava"))
                                rbflevel = Math.min(rbflevel, abd > cblock.maxLevel? -Infinity: abd);
                        }
                        let level2ver = level => level == -Infinity? 1: ((cblock.maxLevel + 1) - level - 0.75) / (cblock.maxLevel + 1);
                        yp = {
                            y0: level2ver(luflevel), y1: level2ver(lbflevel),
                            y2: level2ver(rbflevel), y3: level2ver(ruflevel),
                        };
                        yp.y4 = (yp.y0 + yp.y1 + yp.y2 + yp.y3) / 4;
                        // console.log(blockX, blockY, blockZ, cid, cbd, {luflevel, lbflevel, rbflevel, ruflevel}, yp);
                    }

                    [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                    .forEach(([dx, dy, dz, face]) => {
                        let wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                            b = world.getBlock(wx, wy, wz);
                        if (b && (b.isOpaque || b.isFluid)) return;
                        let bl = world.getLight(wx, wy, wz),
                            verNum = cblock.vertices[face].length / 3;
                        if (bl === null) bl = 15;
                        let ver = cblock.vertices[face].map(v => typeof v == "string"? yp[v]: v),
                            uv = cblock.texture.uv[face];
                        bf[face] = {
                            fluidSurface: true,// disableCullFace: true,
                            ver: ver.map((v, ind) => ind%3===0? v+blockX: ind%3===1? v+blockY: v+blockZ),
                            ele: cblock.elements[face],
                            tex: face[0] === 'y'? uv: cblock.texture.img.texture4array
                                ? [
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
                                ],
                            col: face[0] !== 'y'
                                ? [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: 0)
                                : [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - bl)),
                        };
                    });
                    break; }
                case Block.renderType.CACTUS:
                case Block.renderType.NORMAL: {
                    [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                    .forEach(([dx, dy, dz, face]) => {
                        let wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                            b = world.getBlock(wx, wy, wz);
                        if (b && b.isOpaque) return;
                        if (cblock.isGlass && b && b.isGlass) return delete bf[face];
                        let bl = world.getLight(wx, wy, wz),
                            verNum = cblock.vertices[face].length / 3;
                        if (bl === null) bl = 15;
                        bf[face] = {
                            disableCullFace: cblock.renderType === Block.renderType.CACTUS,
                            ver: cblock.vertices[face].map((v, ind) => ind%3===0? v+blockX: ind%3===1? v+blockY: v+blockZ),
                            ele: cblock.elements[face],
                            tex: cblock.texture.uv[face],
                            col: [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - bl)),
                        };
                        if (cblock.isLeaves && !(b && b.isLeaves)) bf[face].disableCullFace = true;
                    });
                    break;}
                case Block.renderType.FLOWER: {
                    let aroundOpaque = 0;
                    for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                        let wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                            b = world.getBlock(wx, wy, wz);
                        if (b && b.isOpaque) ++aroundOpaque;
                    }
                    if (aroundOpaque === 6) break;
                    let bl = world.getLight(blockX, blockY, blockZ),
                        verNum = cblock.vertices.face.length / 3;
                    bf.face = {
                        disableCullFace: true,
                        ver: cblock.vertices.face.map((v, ind) => ind%3===0? v+blockX: ind%3===1? v+blockY: v+blockZ),
                        ele: cblock.elements.face,
                        tex: cblock.texture.uv.face,
                        col: [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - bl)),
                    };
                    break;}
            }
            let [blockRX, blockRY, blockRZ] = Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ),
                chunkKey = Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ);
            this.blockFace[chunkKey][rxyz2int(blockRX, blockRY, blockRZ)] = bf;
            this.needUpdateMeshChunks.add(chunkKey);
            // handle around block
            let cbl = world.getLight(blockX, blockY, blockZ);
            [[1,0,0,"x-"], [-1,0,0,"x+"], [0,1,0,"y-"], [0,-1,0,"y+"], [0,0,1,"z-"], [0,0,-1,"z+"]]
            .forEach(([dx, dy, dz, inverseFace]) => {
                let awx = blockX + dx, awy = blockY + dy, awz = blockZ + dz,
                    ablock = world.getBlock(awx, awy, awz);
                if (ablock === null || ablock.name === "air") return;
                let achunkKey = Chunk.chunkKeyByBlockXYZ(awx, awy, awz),
                    [arx, ary, arz] = Chunk.getRelativeBlockXYZ(awx, awy, awz),
                    abf = this.blockFace[achunkKey][rxyz2int(arx, ary, arz)];
                switch (ablock.renderType) {
                case Block.renderType.FLUID: {
                    if ((cblock.isOpaque && inverseFace === "y-") || (cblock.isFluid && (
                        ablock === cblock
                        || (cblock.name === "water" && ablock.name === "flowing_water")
                        || (cblock.name === "flowing_water" && ablock.name === "water")
                        || (cblock.name === "lava" && ablock.name === "flowing_lava")
                        || (cblock.name === "flowing_lava" && ablock.name === "lava")
                    ))) {
                        delete abf[inverseFace];
                        break;
                    }
                    if (cblock.renderType !== Block.renderType.FLUID) break;
                    let verNum = ablock.vertices[inverseFace].length / 3;
                    let fn = v => ({v0: "v1", v1: "v0", v2: "v3", v3: "v2"})[v];
                    let ver = ablock.vertices[inverseFace].map(v => typeof v == "string"? yp[fn(v)]: v),
                        uv = ablock.texture.uv[inverseFace];
                    abf[inverseFace] = {
                        fluidSurface: true,// disableCullFace: true,
                        ver: ver.map((v, ind) => ind%3===0? v+awx: ind%3===1? v+awy: v+awz),
                        ele: ablock.elements[inverseFace],
                        tex: inverseFace[0] === 'y'? uv: ablock.texture.img.texture4array
                            ? [
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
                            ],
                        col: inverseFace[0] !== 'y'
                            ? [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: 0)
                            : [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - cbl)),
                    };
                    break;}
                case Block.renderType.CACTUS:
                case Block.renderType.NORMAL: {
                    if ((cblock.isGlass && ablock.isGlass) || cblock.isOpaque){
                        delete abf[inverseFace];
                        break;
                    }
                    let verNum = ablock.vertices[inverseFace].length / 3;
                    abf[inverseFace] = {
                        ver: ablock.vertices[inverseFace].map((v, ind) => ind%3===0? v+awx: ind%3===1? v+awy: v+awz),
                        ele: ablock.elements[inverseFace],
                        tex: ablock.texture.uv[inverseFace],
                        col: [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - cbl)),
                    };
                    if ((!cblock.isLeaves) && ablock.isLeaves) abf[inverseFace].disableCullFace = true;
                    break;}
                case Block.renderType.FLOWER: break;
                }
                this.needUpdateMeshChunks.add(achunkKey);
            });
            // 更新斜对角液体顶点?
        }
    };
    updateLight(chunkKey) {
        let blockFace = this.blockFace[chunkKey];
        if (!blockFace) return;
        const world = this.world, chunk = world.getChunkByChunkKey(chunkKey);
        for (let j = 0; j < Y_SIZE; ++j)
        for (let k = 0; k < Z_SIZE; ++k)
        for (let i = 0; i < X_SIZE; ++i) {
            let cblock = chunk.getBlock(i, j, k);
            if (cblock.name === "air") continue;
            let [wx, wy, wz] = chunk.blockRXYZ2BlockXYZ(i, j, k),
                bf = blockFace[rxyz2int(i, j, k)];
            switch(cblock.renderType) {
            case Block.renderType.FLUID:
            case Block.renderType.CACTUS:
            case Block.renderType.NORMAL: {
                [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                .forEach(([dx, dy, dz, face]) => {
                    if (!(face in bf)) return;
                    let rx = i + dx, ry = j + dy, rz = k + dz,
                        verNum = cblock.vertices[face].length / 3,
                        b = chunk.inOtherChunk(rx, ry, rz)
                            ? world.getBlock(wx + dx, wy + dy, wz + dz)
                            : chunk.getBlock(rx, ry, rz),
                        bl = chunk.inOtherChunk(rx, ry, rz)
                            ? world.getLight(wx + dx, wy + dy, wz + dz)
                            : chunk.getLight(rx, ry, rz);
                    if (bl === null) bl = 15;
                    if (cblock.isFluid && b && b.isOpaque)
                        bl = Math.max(0, bl - 1);
                    bf[face].col = genColArr(verNum, bl);
                });
                break;}
            case Block.renderType.FLOWER: {
                let bl = chunk.getLight(i, j, k),
                    verNum = cblock.vertices.face.length / 3;
                bf.face.col = genColArr(verNum, bl);
                break;}
            }
        }
        this.needUpdateColMeshChunks.add(chunkKey);
    };
    updateMeshs() {
        for (let chunkKey in this.meshs)
            this.updateMesh(chunkKey);
    };
    updateMesh(chunkKey, {
        ver = this.meshs[chunkKey]?.ver,
        col = this.meshs[chunkKey]?.col,
        tex = this.meshs[chunkKey]?.tex,
        ele = this.meshs[chunkKey]?.ele,
        disableCullFace: {
            ver: dcfVer = this.meshs[chunkKey]?.disableCullFace.ver,
            col: dcfCol = this.meshs[chunkKey]?.disableCullFace.col,
            tex: dcfTex = this.meshs[chunkKey]?.disableCullFace.tex,
            ele: dcfEle = this.meshs[chunkKey]?.disableCullFace.ele,
        } = {},
        fluidSurface: {
            ver: fluidVer = this.meshs[chunkKey]?.fluidSurface.ver,
            col: fluidCol = this.meshs[chunkKey]?.fluidSurface.col,
            tex: fluidTex = this.meshs[chunkKey]?.fluidSurface.tex,
            ele: fluidEle = this.meshs[chunkKey]?.fluidSurface.ele,
        } = {},
    } = this.meshs[chunkKey]) {
        let mesh = this.meshs[chunkKey];
        if (!mesh) mesh = this.meshs[chunkKey] = {};
        mesh.ver = ver;
        mesh.tex = tex;
        mesh.col = col;
        mesh.ele = ele;
        mesh.disableCullFace = {
            ver: dcfVer, tex: dcfTex,
            col: dcfCol, ele: dcfEle,
        };
        mesh.fluidSurface = {
            ver: fluidVer, tex: fluidTex,
            col: fluidCol, ele: fluidEle,
        };
        const bufferObj = mesh.bo || {}, {renderer} = this;
        if (!renderer) {
            if (bufferObj.ver) for (let k of ["ver", "col", "tex", "ele"]) {
                bufferObj[k] = bufferObj.disableCullFace[k] = null;
                if (bufferObj.disableCullFace) bufferObj.disableCullFace[k] = null;
                if (bufferObj.fluidSurface) bufferObj.fluidSurface[k] = null;
            }
            return;
        }
        if (bufferObj.ver) {
            renderer.bindBoData(bufferObj.ver, ver);
            renderer.bindBoData(bufferObj.col, col);
            renderer.bindBoData(bufferObj.tex, tex);
            renderer.bindBoData(bufferObj.ele, ele);
            renderer.bindBoData(bufferObj.disableCullFace.ver, dcfVer);
            renderer.bindBoData(bufferObj.disableCullFace.col, dcfCol);
            renderer.bindBoData(bufferObj.disableCullFace.tex, dcfTex);
            renderer.bindBoData(bufferObj.disableCullFace.ele, dcfEle);
            renderer.bindBoData(bufferObj.fluidSurface.ver, fluidVer);
            renderer.bindBoData(bufferObj.fluidSurface.col, fluidCol);
            renderer.bindBoData(bufferObj.fluidSurface.tex, fluidTex);
            renderer.bindBoData(bufferObj.fluidSurface.ele, fluidEle);
        }
        else {
            bufferObj.ver = renderer.createVbo(ver);
            bufferObj.col = renderer.createVbo(col);
            bufferObj.tex = renderer.createVbo(tex);
            bufferObj.ele = renderer.createIbo(ele);
            bufferObj.disableCullFace = {
                ver: renderer.createVbo(dcfVer),
                col: renderer.createVbo(dcfCol),
                tex: renderer.createVbo(dcfTex),
                ele: renderer.createIbo(dcfEle),
            };
            bufferObj.fluidSurface = {
                ver: renderer.createVbo(fluidVer),
                col: renderer.createVbo(fluidCol),
                tex: renderer.createVbo(fluidTex),
                ele: renderer.createIbo(fluidEle),
            };
        }
        mesh.bo = bufferObj;
    };
    update() {
        if (this.needUpdateTile.length)
            this.updateTiles(this.needUpdateTile);
        // rebuild light
        Object.values(this.world.chunkMap)
        .filter(chunk => chunk.updatedLightMap)
        .forEach(chunk => {
            chunk.updatedLightMap = false;
            const chunkKey = chunk.chunkKey;
            this.updateLight(chunkKey);
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]])
                this.updateLight(Chunk.chunkKeyByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz));
        });
        if (this.needUpdateColMeshChunks.size) {
            this.needUpdateColMeshChunks.forEach(chunkKey => {
                if (this.needUpdateMeshChunks.has(chunkKey)) return;
                let col = [], dcfCol = [], fluidCol = [];
                this.blockFace[chunkKey].forEach(bf => {
                    for (let face in bf) {
                        let bff = bf[face];
                        if (bff.disableCullFace)
                            dcfCol.push(...bff.col);
                        else if (bff.fluidSurface)
                            fluidCol.push(...bff.col);
                        else col.push(...bff.col);
                    }
                });
                this.updateMesh(chunkKey, {
                    col, disableCullFace: {
                        col: dcfCol,
                    }, fluidSurface: {
                        col: fluidCol,
                    },
                });
            });
            this.needUpdateColMeshChunks.clear();
        }
        if (this.needUpdateMeshChunks.size === 0) return;
        this.needUpdateMeshChunks.forEach(chunkKey => {
            if (!(chunkKey in this.blockFace)) return;
            let ver = [], col = [], ele = [], tex = [], totalVer = 0,
                dcfVer = [], dcfCol = [], dcfEle = [], dcfTex = [], dcfTotalVer = 0,
                fluidVer = [], fluidCol = [], fluidEle = [], fluidTex = [], fluidTotalVer = 0;
            this.blockFace[chunkKey].forEach(bf => {
                for (let face in bf) {
                    let bff = bf[face], verNum = bff.ver.length / 3;
                    if (bff.disableCullFace) {
                        dcfVer.push(...bff.ver);
                        dcfTex.push(...bff.tex);
                        dcfCol.push(...bff.col);
                        dcfEle.push(...bff.ele.map(v => v + dcfTotalVer));
                        dcfTotalVer += verNum;
                        continue;
                    }
                    if (bff.fluidSurface) {
                        fluidVer.push(...bff.ver);
                        fluidTex.push(...bff.tex);
                        fluidCol.push(...bff.col);
                        fluidEle.push(...bff.ele.map(v => v + fluidTotalVer));
                        fluidTotalVer += verNum;
                        continue;
                    }
                    ver.push(...bff.ver);
                    tex.push(...bff.tex);
                    col.push(...bff.col);
                    ele.push(...bff.ele.map(v => v + totalVer));
                    totalVer += verNum;
                }
            });
            this.updateMesh(chunkKey, {ver, tex, col, ele, disableCullFace: {
                ver: dcfVer, tex: dcfTex,
                col: dcfCol, ele: dcfEle,
            }, fluidSurface: {
                ver: fluidVer, tex: fluidTex,
                col: fluidCol, ele: fluidEle,
            }, });
        });
        this.needUpdateMeshChunks.clear();
    };
    draw() {
        const {renderer} = this, {ctx} = renderer;
        const prg = renderer.getProgram("showBlock");
        prg.use()
        // .setUni("vMatrix", renderer.mainCamera.view)
        // .setUni("pMatrix", renderer.mainCamera.projection)
        .setUni("mvMatrix", renderer.mainCamera.view)
        .setUni("mvpMatrix", renderer.mainCamera.projview)
        .setUni("fogColor", [0.62, 0.81, 1.0, 1.0])
        // 3 ~ 4 chunks
        .setUni("fogNear", 48)
        .setUni("fogFar", 64);
        const mainPlayer = this.world.mainPlayer;
        let chunk = this.world.getChunkByBlockXYZ(...[...mainPlayer.position].map(n => n < 0? n - 1: n));
        const meshs = Object.entries(this.meshs).map(([chunkKey, mesh]) => {
            const chunkPos = Chunk.getChunkXYZByChunkKey(chunkKey);
            return {
                chunkKey, mesh, chunkPos,
                dis: manhattanDis(chunkPos, [chunk.x, chunk.y, chunk.z]),
            };
        });
        meshs.sort((a, b) => b.dis - a.dis);
        for (const { mesh } of meshs) {
            const bufferObj = mesh.bo;
            if (bufferObj.ele.length) {
                prg.setAtt("position", bufferObj.ver)
                    .setAtt("color", bufferObj.col)
                    .setAtt("textureCoord", bufferObj.tex);
                ctx.bindBuffer(bufferObj.ele.type, bufferObj.ele);
                // ctx.drawElements(ctx.LINES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.drawElements(ctx.TRIANGLES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
            }
            if (bufferObj.disableCullFace.ele.length) {
                prg.setAtt("position", bufferObj.disableCullFace.ver)
                    .setAtt("color", bufferObj.disableCullFace.col)
                    .setAtt("textureCoord", bufferObj.disableCullFace.tex);
                ctx.disable(ctx.CULL_FACE);
                ctx.enable(ctx.POLYGON_OFFSET_FILL);
                ctx.polygonOffset(1.0, 1.0);
                ctx.enable(ctx.BLEND);
                ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
                ctx.bindBuffer(bufferObj.disableCullFace.ele.type, bufferObj.disableCullFace.ele);
                // ctx.drawElements(ctx.LINES, bufferObj.disableCullFace.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.drawElements(ctx.TRIANGLES, bufferObj.disableCullFace.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.blendFunc(ctx.ONE, ctx.ZERO);
                ctx.disable(ctx.BLEND);
                ctx.disable(ctx.POLYGON_OFFSET_FILL);
                ctx.enable(ctx.CULL_FACE);
            }
        }
        for (const { mesh } of meshs) {
            const bufferObj = mesh.bo;
            if (bufferObj.fluidSurface.ele.length) {
                prg.setAtt("position", bufferObj.fluidSurface.ver)
                    .setAtt("color", bufferObj.fluidSurface.col)
                    .setAtt("textureCoord", bufferObj.fluidSurface.tex);
                ctx.depthMask(false);
                if (mainPlayer.eyeInFluid)
                    ctx.disable(ctx.CULL_FACE);
                ctx.disable(ctx.POLYGON_OFFSET_FILL);
                ctx.polygonOffset(1.0, 1.0);
                ctx.enable(ctx.BLEND);
                ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
                ctx.bindBuffer(bufferObj.fluidSurface.ele.type, bufferObj.fluidSurface.ele);
                // ctx.drawElements(ctx.LINES, bufferObj.fluidSurface.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.drawElements(ctx.TRIANGLES, bufferObj.fluidSurface.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.blendFunc(ctx.ONE, ctx.ZERO);
                ctx.disable(ctx.BLEND);
                ctx.disable(ctx.POLYGON_OFFSET_FILL);
                if (mainPlayer.eyeInFluid)
                    ctx.enable(ctx.CULL_FACE);
                ctx.depthMask(true);
            }
        }
    };
    dispose() {
        if (!this.renderer) return;
        const ctx = this.renderer.ctx;
        Object.values(this.meshs).forEach(({bo}) => {
            for (let k of ["ver", "col", "tex", "ele"]) {
                ctx.deleteBuffer(bo[k]);
                ctx.deleteBuffer(bo.disableCullFace[k]);
            }
        });
    };
};

export {
    ChunksModule,
    ChunksModule as default,
    genColArr,
    calCol,
};
