// 计算顶点，材质坐标，下标
import { Block } from "../World/Block.js";
import { 
    Chunk,
    CHUNK_X_SIZE as X_SIZE,
    CHUNK_Y_SIZE as Y_SIZE,
    CHUNK_Z_SIZE as Z_SIZE,
} from "../World/Chunk.js";

const rxyz2int = Chunk.getLinearBlockIndex;

const calCol = (verNum, blockLight) => {
    let ans = new Array(verNum * 4);
    for (let i = 0; i < verNum * 4; i += 4) {
        ans[i] = ans[i + 1] = ans[i + 2] = Math.pow(0.9, 15 - blockLight);
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
         *     buffer object: bo { ver, col, tex, ele, disableCullFace: { ver, col, tex, ele } }
         * }
         */
        this.meshs = {};
        this.needUpdateMeshChunks = new Set();
        this.needUpdateColMeshChunks = new Set();
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
        if (!renderer) return;
        this.renderer = renderer;
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
                    let verNum = cblock.vertexs[face].length / 3,
                        bff = bf[face] || {},
                        bl = inOtherChunk
                            ? world.getLight(wx + dx, wy + dy, wz + dz)
                            : chunk.getLight(rx, ry, rz);
                    if (bl === null) bl = 15;
                    bff.disableCullFace = cblock.renderType === Block.renderType.CACTUS;
                    if (cblock.isLeaves && !(b && b.isLeaves)) bff.disableCullFace = true;
                    bff.ver = cblock.vertexs[face].map((v, ind) => ind%3===0? v+wx: ind%3===1? v+wy: v+wz);
                    bff.col = calCol(verNum, bl);
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
                    verNum = cblock.vertexs.face.length / 3;
                bf.face = {
                    disableCullFace: true,
                    ver: cblock.vertexs.face.map((v, ind) => ind%3===0? v+wx: ind%3===1? v+wy: v+wz),
                    col: calCol(verNum, bl),
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
        const world = this.world, cblock = world.getBlock(blockX, blockY, blockZ);
        if (cblock === null) return;
        let bf = {};
        // handle center
        if (cblock.name !== "air") switch (cblock.renderType) {
            case Block.renderType.CACTUS:
            case Block.renderType.NORMAL: {
                [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                .forEach(([dx, dy, dz, face]) => {
                    let wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                        b = world.getBlock(wx, wy, wz);
                    if (b && b.isOpaque) return;
                    if (cblock.isGlass && b && b.isGlass) return delete bf[face];
                    let bl = world.getLight(wx, wy, wz),
                        verNum = cblock.vertexs[face].length / 3;
                    if (bl === null) bl = 15;
                    bf[face] = {
                        disableCullFace: cblock.renderType === Block.renderType.CACTUS,
                        ver: cblock.vertexs[face].map((v, ind) => ind%3===0? v+blockX: ind%3===1? v+blockY: v+blockZ),
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
                    verNum = cblock.vertexs.face.length / 3;
                bf.face = {
                    disableCullFace: true,
                    ver: cblock.vertexs.face.map((v, ind) => ind%3===0? v+blockX: ind%3===1? v+blockY: v+blockZ),
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
            case Block.renderType.CACTUS:
            case Block.renderType.NORMAL: {
                if ((cblock.isGlass && ablock.isGlass) || cblock.isOpaque){
                    delete abf[inverseFace];
                    break;
                }
                let verNum = ablock.vertexs[inverseFace].length / 3;
                abf[inverseFace] = {
                    ver: ablock.vertexs[inverseFace].map((v, ind) => ind%3===0? v+awx: ind%3===1? v+awy: v+awz),
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
            case Block.renderType.CACTUS:
            case Block.renderType.NORMAL: {
                [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                .forEach(([dx, dy, dz, face]) => {
                    if (!(face in bf)) return;
                    let rx = i + dx, ry = j + dy, rz = k + dz,
                        verNum = cblock.vertexs[face].length / 3,
                        bl = chunk.inOtherChunk(rx, ry, rz)
                            ? world.getLight(wx + dx, wy + dy, wz + dz)
                            : chunk.getLight(rx, ry, rz);
                    if (bl === null) bl = 15;
                    bf[face].col = calCol(verNum, bl);
                });
                break;}
            case Block.renderType.FLOWER: {
                let bl = chunk.getLight(i, j, k),
                    verNum = cblock.vertexs.face.length / 3;
                bf.face.col = calCol(verNum, bl);
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
        ver = this.meshs[chunkKey].ver,
        col = this.meshs[chunkKey].col,
        tex = this.meshs[chunkKey].tex,
        ele = this.meshs[chunkKey].ele,
        disableCullFace: {
            ver: dcfVer = this.meshs[chunkKey].disableCullFace.ver,
            col: dcfCol = this.meshs[chunkKey].disableCullFace.col,
            tex: dcfTex = this.meshs[chunkKey].disableCullFace.tex,
            ele: dcfEle = this.meshs[chunkKey].disableCullFace.ele,
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
        const bufferObj = mesh.bo || {}, {renderer} = this;
        if (!renderer) {
            if (bufferObj.ver) for (let k of ["ver", "col", "tex", "ele"]) {
                bufferObj[k] = bufferObj.disableCullFace[k] = null;
                if (bufferObj.disableCullFace) bufferObj.disableCullFace[k] = null;
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
        }
        mesh.bo = bufferObj;
    };
    update() {
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
                let col = [], dcfCol = [];
                this.blockFace[chunkKey].forEach(bf => {
                    for (let face in bf) {
                        let bff = bf[face];
                        if (bff.disableCullFace)
                            dcfCol.push(...bff.col);
                        else col.push(...bff.col);
                    }
                });
                this.updateMesh(chunkKey, {col, disableCullFace: { col: dcfCol, }});
            });
            this.needUpdateColMeshChunks.clear();
        }
        if (this.needUpdateMeshChunks.size === 0) return;
        this.needUpdateMeshChunks.forEach(chunkKey => {
            if (!(chunkKey in this.blockFace)) return;
            let ver = [], col = [], ele = [], tex = [], totalVer = 0,
                dcfVer = [], dcfCol = [], dcfEle = [], dcfTex = [], dcfTotalver = 0;
            this.blockFace[chunkKey].forEach(bf => {
                for (let face in bf) {
                    let bff = bf[face], verNum = bff.ver.length / 3;
                    if (bff.disableCullFace) {
                        dcfVer.push(...bff.ver);
                        dcfTex.push(...bff.tex);
                        dcfCol.push(...bff.col);
                        dcfEle.push(...bff.ele.map(v => v + dcfTotalver));
                        dcfTotalver += verNum;
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
            }});
        });
        this.needUpdateMeshChunks.clear();
    };
    draw() {
        const {renderer} = this, {ctx} = renderer;
        const prg = renderer.getProgram("showBlock");
        prg.use().setUni("mvpMatrix", renderer.mainCamera.projview);
        const meshs = this.meshs;
        for (let ck in meshs) {
            const mesh = meshs[ck], bufferObj = mesh.bo;
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
                ctx.bindBuffer(bufferObj.disableCullFace.ele.type, bufferObj.disableCullFace.ele);
                // ctx.drawElements(ctx.LINES, bufferObj.disableCullFace.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.drawElements(ctx.TRIANGLES, bufferObj.disableCullFace.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.disable(ctx.POLYGON_OFFSET_FILL);
                ctx.enable(ctx.CULL_FACE);
            }
        }
    };
};

export {
    ChunksModule,
    ChunksModule as default,
};
