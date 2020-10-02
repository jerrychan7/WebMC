import Block from "./Block.js";

const SHIFT_X = 4, SHIFT_Y = 4, SHIFT_Z = 4,
      X_SIZE = 1 << SHIFT_X,
      Y_SIZE = 1 << SHIFT_Y,
      Z_SIZE = 1 << SHIFT_Z;

// low 4 bit save sky light, and hight 4 bit save torch light
// https://www.seedofandromeda.com/blogs/29-fast-flood-fill-lighting-in-a-blocky-voxel-game-pt-1
class LightMap extends Uint8Array {
    constructor() { super(Chunk.Y_SIZE * Chunk.Z_SIZE * Chunk.X_SIZE); };
    get(x, y, z) { return this[Chunk.getLinearBlockIndex(x, y, z)]; };
    set(x, y, z, l) { return this[Chunk.getLinearBlockIndex(x, y, z)] = l; };
    getSkylight(x, y, z) { return this[Chunk.getLinearBlockIndex(x, y, z)] & 0xF; };
    getTorchlight(x, y, z) { return (this[Chunk.getLinearBlockIndex(x, y, z)] >> 4) & 0xF; };
    getMax(x, y, z) {
        let l = this[Chunk.getLinearBlockIndex(x, y, z)];
        return Math.max(l & 0xF, (l >> 4) & 0xF);
    };
    setSkylight(x, y, z, l) {
        let i = Chunk.getLinearBlockIndex(x, y, z);
        this[i] = (this[i] & 0xF0) | l;
        return l;
    };
    setTorchlight(x, y, z, l) {
        let i = Chunk.getLinearBlockIndex(x, y, z);
        this[i] = (this[i] & 0xF) | (l << 4);
        return l;
    };
};

class Chunk {
    static get X_SIZE() { return X_SIZE; };
    static get Y_SIZE() { return Y_SIZE; };
    static get Z_SIZE() { return Z_SIZE; };
    static getChunkXYZByBlockXYZ(blockX, blockY, blockZ) { return [blockX >> SHIFT_X, blockY >> SHIFT_Y, blockZ >> SHIFT_Z]; };
    static chunkKeyByChunkXYZ(chunkX, chunkY, chunkZ) { return chunkX + "," + chunkY + "," + chunkZ; };
    static chunkKeyByBlockXYZ(blockX, blockY, blockZ) { return (blockX >> SHIFT_X) + "," + (blockY >> SHIFT_Y) + "," + (blockZ >> SHIFT_Z); };
    static getRelativeBlockXYZ(blockX, blockY, blockZ) {
        const mod = (n, m) => (m + (n % m)) % m;
        return [mod(blockX, X_SIZE), mod(blockY, Y_SIZE), mod(blockZ, Z_SIZE)];
    };
    // YZX
    static getLinearBlockIndex(blockRX, blockRY, blockRZ) { return (((blockRY << SHIFT_Y) + blockRZ) << SHIFT_Z) + blockRX; };

    constructor(world, chunkX, chunkY, chunkZ, renderer = world.renderer, generator = world.generator) {
        this.world = world;
        this.x = chunkX; this.y = chunkY; this.z = chunkZ;
        // Y_SIZE * Z_SIZE * X_SIZE    array
        this.tileMap = new Array(Y_SIZE * Z_SIZE * X_SIZE);
        this.lightMap = new LightMap();
        // [chunk key] = Set("block relateive x, y, z"), callbackID
        this.unloadChunkData = {};
        this.generator = generator;
        generator(chunkX, chunkY, chunkZ, this.tileMap);
        this.mesh = {
            /*
             * blockFace: [x][y][z]["x+|x-|y+|y-|z+|z-"]: {
             *   ver: vertex coordiate (length == 12)
             *   tex: texture uv corrdiate (length == 8)
             *   col: vertex color (length == 16)
             *   ele: element length
             * }
             */
            blockFace: undefined,
            ver: new Float32Array(),
            col: new Float32Array(),
            tex: new Float32Array(),
            element: new Int16Array(),
            disableCullFace: {
                ver: new Float32Array(),
                col: new Float32Array(),
                tex: new Float32Array(),
                element: new Int16Array(),
            },
            bo: { ver: null, col: null, tex: null, ele: null,
                disableCullFace: { ver: null, col: null, tex: null, ele: null, },
            },
        };
        this.needRebuild = false;
        this.needRebuildBlockLight = new Set();
        this.updataAllTile();
        this.setRenderer(renderer);
    };
    setRenderer(renderer = null) {
        if (!renderer) return;
        if (this.renderer !== renderer) {
            for (let k of ["ver", "col", "tex", "ele"]) {
                this.mesh.bo[k] = null;
                this.mesh.bo.disableCullFace[k] = null;
            }
        }
        this.renderer = renderer;
        this.updataMesh();
    };
    getTile(blockRX, blockRY, blockRZ) {
        return this.tileMap[Chunk.getLinearBlockIndex(blockRX, blockRY, blockRZ)];
    };
    setTile(blockRX, blockRY, blockRZ, blockName) {
        this.tileMap[Chunk.getLinearBlockIndex(blockRX, blockRY, blockRZ)] = Block.getBlockByBlockName(blockName);
        this.updataTile(blockRX, blockRY, blockRZ);
    };
    getLight(blockRX, blockRY, blockRZ) {
        return this.lightMap.getMax(blockRX, blockRY, blockRZ);
    };
    getSkylight(blockRX, blockRY, blockRZ) {
        return this.lightMap.getSkylight(blockRX, blockRY, blockRZ);
    };
    getTorchlight(blockRX, blockRY, blockRZ) {
        return this.lightMap.getTorchlight(blockRX, blockRY, blockRZ);
    };
    static inOtherChunk(blockRX, blockRY, blockRZ) {
        return blockRX < 0 || blockRX >= X_SIZE || blockRZ < 0 || blockRZ >= Z_SIZE || blockRY < 0 || blockRY >= Y_SIZE;
    };
    inOtherChunk(blockRX, blockRY, blockRZ) {
        return blockRX < 0 || blockRX >= X_SIZE || blockRZ < 0 || blockRZ >= Z_SIZE || blockRY < 0 || blockRY >= Y_SIZE;
    };
    blockRXYZ2BlockXYZ(blockRX, blockRY, blockRZ) {
        return [blockRX + this.x * X_SIZE, blockRY + this.y * Y_SIZE, blockRZ + this.z * Z_SIZE];
    };
    onAroundChunkLoad(chunkKey) {
        let skyQueue = [], torchQueue = [];
        this.unloadChunkData[chunkKey].forEach(blockRXYZ => {
            const [blockRX, blockRY, blockRZ] = blockRXYZ.split(",").map(Number),
                  [blockX, blockY, blockZ] = this.blockRXYZ2BlockXYZ(blockRX, blockRY, blockRZ),
                  cblock = this.getTile(blockRX, blockRY, blockRZ),
                  csl = this.lightMap.getSkylight(blockRX, blockRY, blockRZ),
                  ctl = this.lightMap.getTorchlight(blockRX, blockRY, blockRZ);
            // spread sky and torch light
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let rx = blockRX + dx, ry = blockRY + dy, rz = blockRZ + dz,
                    wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                    [sl, tl] = this.inOtherChunk(rx, ry, rz)
                        ? [this.world.getSkylight(wx, wy, wz), this.world.getTorchlight(wx, wy, wz),]
                        : [this.lightMap.getSkylight(rx, ry, rz), this.lightMap.getTorchlight(rx, ry, rz),];
                if (sl === null) return;
                if (sl - 1 < csl) skyQueue.push([blockRX, blockRY, blockRZ, csl]);
                if (tl >= ctl + 2) torchQueue.push([wx, wy, wz, tl]);
            });
            // updata block face
            if (cblock.name === "air") return;
            let bf = {};
            switch (cblock.renderType) {
            case Block.renderType.NORMAL: {
                [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                .forEach(([dx, dy, dz, face]) => {
                    let rx = blockRX + dx, ry = blockRY + dy, rz = blockRZ + dz,
                        wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                        inOtherChunk = this.inOtherChunk(rx, ry, rz),
                        b = inOtherChunk
                            ? this.world.getTile(wx, wy, wz)
                            : this.getTile(rx, ry, rz);
                    if (b?.isOpaque) return;
                    let bl = inOtherChunk
                        ? this.world.getLight(wx, wy, wz)
                        : this.getLight(rx, ry, rz),
                        verNum = cblock.vertexs[face].length / 3;
                    if (bl === null) bl = 15;
                    bf[face] = {
                        ver: cblock.vertexs[face].map((v, ind) => ind%3===0? v+blockX: ind%3===1? v+blockY: v+blockZ),
                        ele: cblock.elements[face],
                        tex: cblock.texture.uv[face],
                        col: [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - bl)),
                    };
                });
                break;}
            }
            this.mesh.blockFace[blockRX][blockRY][blockRZ] = bf;
            this.needRebuild = true;
        });
        delete this.unloadChunkData[chunkKey];
        const setSkylight = (x, y, z, l) => {
            let c = this.world.getChunkByBlockXYZ(x, y, z);
            c.needRebuildBlockLight.add([x, y, z].join());
            return c.lightMap.setSkylight(...Chunk.getRelativeBlockXYZ(x, y, z), l);
        };
        const setTorchlight = (x, y, z, l) => {
            let c = this.world.getChunkByBlockXYZ(x, y, z);
            c.needRebuildBlockLight.add([x, y, z].join());
            return c.lightMap.setTorchlight(...Chunk.getRelativeBlockXYZ(x, y, z), l);
        };
        while (skyQueue.length) {
            let [rx, ry, rz, cbl] = skyQueue.shift();
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let x = rx + dx, y = ry + dy, z = rz + dz,
                    inOtherChunk = this.inOtherChunk(x, y, z),
                    [b, bl] = inOtherChunk
                        ? [this.world.getTile(...this.blockRXYZ2BlockXYZ(x, y, z)),
                            this.world.getSkylight(...this.blockRXYZ2BlockXYZ(x, y, z))]
                        : [this.getTile(x, y, z), this.lightMap.getSkylight(x, y, z)];
                if (b === null || b.isOpaque) return;
                if (cbl === 15 && dy === -1) {
                    this.lightMap.setSkylight(x, y, z, 15);
                    if (!inOtherChunk)
                        skyQueue.push([x, y, z, 15]);
                }
                else if (bl + 2 <= cbl) {
                    this.lightMap.setSkylight(x, y, z, cbl - b.opacity - 1);
                    if (!inOtherChunk)
                        skyQueue.push([x, y, z, cbl - b.opacity - 1]);
                }
                else if (bl - 1 > cbl) {
                    if (!inOtherChunk)
                        skyQueue.push([x, y, z, bl]);
                }
            });
        }
        while (torchQueue.length) {
            let [wx, wy, wz, cbl] = torchQueue.shift();
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let x = wx + dx, y = wy + dy, z = wz + dz,
                    b = this.world.getTile(x, y, z),
                    bl = this.world.getTorchlight(x, y, z);
                if (b === null || b.isOpaque) return;
                if (bl + 2 <= cbl) {
                    setTorchlight(x, y, z, cbl - b.opacity - 1);
                    torchQueue.push([x, y, z, cbl - b.opacity - 1]);
                }
                else if (bl > cbl + 1) {
                    torchQueue.push([x, y, z, bl]);
                }
            });
        }
    };
    updataMesh({
        ver = this.mesh.ver,
        col = this.mesh.col,
        tex = this.mesh.tex,
        element = this.mesh.element,
        disableCullFace: {
            ver: disableCullFaceVer = this.mesh.disableCullFace.ver,
            col: disableCullFaceCol = this.mesh.disableCullFace.col,
            tex: disableCullFaceTex = this.mesh.disableCullFace.tex,
            element: disableCullFaceElement = this.mesh.disableCullFace.element,
        } = {}
    } = this.mesh) {
        const {mesh, renderer} = this;
        mesh.ver     = ver;
        mesh.col     = col;
        mesh.tex     = tex;
        mesh.element = element;
        mesh.disableCullFace.ver = disableCullFaceVer;
        mesh.disableCullFace.col = disableCullFaceCol;
        mesh.disableCullFace.tex = disableCullFaceTex;
        mesh.disableCullFace.element = disableCullFaceElement;
        const bufferObj = mesh.bo;
        if (!renderer) {
            if (bufferObj.ver)
                for (let k of ["ver", "col", "tex", "ele"]) {
                    bufferObj[k] = null;
                    bufferObj.disableCullFace[k] = null;
                }
            return;
        }
        if (bufferObj.ver) {
            renderer.bindBoData(bufferObj.ver, ver);
            renderer.bindBoData(bufferObj.col, col);
            renderer.bindBoData(bufferObj.tex, tex);
            renderer.bindBoData(bufferObj.ele, element);
            renderer.bindBoData(bufferObj.disableCullFace.ver, disableCullFaceVer);
            renderer.bindBoData(bufferObj.disableCullFace.col, disableCullFaceCol);
            renderer.bindBoData(bufferObj.disableCullFace.tex, disableCullFaceTex);
            renderer.bindBoData(bufferObj.disableCullFace.ele, disableCullFaceElement);
        }
        else {
            bufferObj.ver = renderer.createVbo(ver);
            bufferObj.col = renderer.createVbo(col);
            bufferObj.tex = renderer.createVbo(tex);
            bufferObj.ele = renderer.createIbo(element);
            bufferObj.disableCullFace.ver = renderer.createVbo(disableCullFaceVer);
            bufferObj.disableCullFace.col = renderer.createVbo(disableCullFaceCol);
            bufferObj.disableCullFace.tex = renderer.createVbo(disableCullFaceTex);
            bufferObj.disableCullFace.ele = renderer.createIbo(disableCullFaceElement);
        }
    };
    updataAllTile() {
        // build torch light
        let queue = [], lightMap = this.lightMap;
        for (let j = 0; j < Y_SIZE; ++j)
          for (let k = 0; k < Z_SIZE; ++k)
            for (let i = 0; i < X_SIZE; ++i) {
                let b = this.getTile(i, j, k);
                lightMap.setSkylight(i, j, k, 0);
                lightMap.setTorchlight(i, j, k, b.luminance);
                if (b.luminance) queue.push([i, j, k]);
            }
        while (queue.length) {
            let [i, j, k] = queue.shift(), l = lightMap.getTorchlight(i, j, k),
                [wx, wy, wz] = this.blockRXYZ2BlockXYZ(i, j, k);
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let rx = i + dx, ry = j + dy, rz = k + dz;
                let [b, bl] = this.inOtherChunk(rx, ry, rz)
                        ? [this.world.getTile(wx + dx, wy + dy, wz + dz),
                            this.world.getTorchlight(wx + dx, wy + dy, wz + dz)]
                        : [this.getTile(rx, ry, rz), lightMap.getTorchlight(rx, ry, rz)];
                if (b === null || b.isOpaque) return;
                if (bl + 2 <= l) {
                    // TODO: If the block is in another chunk, it needs to be notified to update.
                    lightMap.setTorchlight(rx, ry, rz, l - b.opacity - 1);
                    queue.push([rx, ry, rz]);
                }
            });
        }
        // build sky light
        for (let z = 0, y = Y_SIZE - 1; z < Z_SIZE; ++z)
        for (let x = 0; x < X_SIZE; ++x) {
            let b = this.getTile(x, y, z);
            if (b.isOpaque) continue;
            let bl = this.world.getSkylight(...this.blockRXYZ2BlockXYZ(x, y + 1, z));
            let l = bl === null || bl === 15? 15: bl - b.opacity - 1;
            if (l > 0) {
                lightMap.setSkylight(x, y, z, l);
                queue.push([x, y, z]);
            }
        }
        while (queue.length) {
            let [i, j, k] = queue.shift(), l = lightMap.getSkylight(i, j, k),
                [wx, wy, wz] = this.blockRXYZ2BlockXYZ(i, j, k);
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let rx = i + dx, ry = j + dy, rz = k + dz;
                let inOtherChunk = this.inOtherChunk(rx, ry, rz);
                let [b, bl] = inOtherChunk
                        ? [this.world.getTile(wx + dx, wy + dy, wz + dz),
                            this.world.getSkylight(wx + dx, wy + dy, wz + dz)]
                        : [this.getTile(rx, ry, rz), lightMap.getSkylight(rx, ry, rz)];
                if (b === null || b.isOpaque) return;
                if (l === 15 && dy === -1) {
                    lightMap.setSkylight(rx, ry, rz, 15);
                    queue.push([rx, ry, rz]);
                }
                else if (bl + 2 <= l) {
                    if (!inOtherChunk) {
                        lightMap.setSkylight(rx, ry, rz, l - b.opacity - 1);
                        queue.push([rx, ry, rz]);
                    }
                    // TODO: If the block is in another chunk, it needs to be notified to update.
                }
            });
        }

        let blockFace = this.mesh.blockFace;
        if (!blockFace) {
            // first-time build
            blockFace = this.mesh.blockFace =
                [...Array(X_SIZE)].map(_ =>
                    [...Array(Y_SIZE)].map(_ =>
                        [...Array(Z_SIZE)].map(_ => ({}))
                    )
                );
        }

        // build vertex
        let ver = [], color = [], element = [], tex = [], totalVer = 0;
        let dcfVer = [], dcfCol = [], dcfEle = [], dcfTex = [], dcfTotalver = 0;
        let {unloadChunkData} = this;
        for (let j = 0; j < Y_SIZE; ++j)
          for (let k = 0; k < Z_SIZE; ++k)
            for (let i = 0; i < X_SIZE; ++i) {
                let cblock = this.getTile(i, j, k);
                if (cblock.name === "air") continue;
                let [wx, wy, wz] = this.blockRXYZ2BlockXYZ(i, j, k);
                // 如果周围方块透明 绘制
                switch(cblock.renderType) {
                case Block.renderType.NORMAL: {
                    let bf = blockFace[i][j][k];
                    [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                    .forEach(([dx, dy, dz, face]) => {
                        let rx = i + dx, ry = j + dy, rz = k + dz,
                            inOtherChunk = this.inOtherChunk(rx, ry, rz),
                            b = inOtherChunk
                                ? this.world.getTile(wx + dx, wy + dy, wz + dz)
                                : this.getTile(rx, ry, rz);
                        if (b === null) {
                            let ck = Chunk.chunkKeyByBlockXYZ(wx + dx, wy + dy, wz + dz),
                                d = unloadChunkData[ck];
                            if (!d) d = unloadChunkData[ck] = new Set();
                            d.add([i, j, k].join());
                        }
                        else if (b.isOpaque) return delete bf[face];
                        let verNum = cblock.vertexs[face].length / 3;
                        let bff = bf[face] || {};
                        bff.ver = cblock.vertexs[face].map((v, ind) => ind%3===0? v+wx: ind%3===1? v+wy: v+wz);
                        bff.ele = cblock.elements[face];
                        bff.tex = cblock.texture.uv[face];
                        ver.push(...bff.ver);
                        tex.push(...bff.tex);
                        element.push(...bff.ele.map(v => v + totalVer));
                        let bl = inOtherChunk
                            ? this.world.getLight(wx + dx, wy + dy, wz + dz)
                            : this.getLight(rx, ry, rz);
                        if (bl === null) bl = 15;
                        bff.col = (() => {
                            let ans = new Array(verNum * 4);
                            for (let i = 0; i < verNum * 4; i += 4) {
                                ans[i] = ans[i + 1] = ans[i + 2] = Math.pow(0.9, 15 - bl);
                                ans[i + 3] = 1;
                            }
                            return ans;
                        })();
                        color.push(...bff.col);
                        bf[face] = bff;
                        totalVer += verNum;
                    });
                    break;}
                case Block.renderType.FLOWER: {
                    let aroundOpaque = 0;
                    for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                        let rx = i + dx, ry = j + dy, rz = k + dz,
                            b = this.inOtherChunk(rx, ry, rz)
                                ? this.world.getTile(wx + dx, wy + dy, wz + dz)
                                : this.getTile(rx, ry, rz);
                        if (b?.isOpaque) ++aroundOpaque;
                    }
                    if (aroundOpaque === 6) {
                        delete bf.face;
                        break;
                    }
                    let bl = this.getLight(i, j, k),
                        verNum = cblock.vertexs.face.length / 3;
                    bf.face = {
                        disableCullFace: true,
                        ver: cblock.vertexs.face.map((v, ind) => ind%3===0? v+wx: ind%3===1? v+wy: v+wz),
                        ele: cblock.elements.face,
                        tex: cblock.texture.uv.face,
                        col: (() => {
                            let ans = new Array(verNum * 4);
                            for (let i = 0; i < verNum * 4; i += 4) {
                                ans[i] = ans[i + 1] = ans[i + 2] = Math.pow(0.9, 15 - bl);
                                ans[i + 3] = 1;
                            }
                            return ans;
                        })(),
                    };
                    dcfVer.push(...bf.face.ver);
                    dcfTex.push(...bf.face.tex);
                    dcfCol.push(...bf.face.col);
                    dcfEle.push(...bf.face.ele.map(v => v + dcfTotalver));
                    dcfTotalver += verNum;
                    break;}
                }
            }
        for (let ck in unloadChunkData) {
            unloadChunkData[ck].callbackID = this.world.addLoadChunkListener(ck, () => {
                this.onAroundChunkLoad(ck);
            }, true);
        }
        this.updataMesh({
            ver: new Float32Array(ver),
            tex: new Float32Array(tex),
            col: new Float32Array(color),
            element: new Int16Array(element),
            disableCullFace: {
                ver: new Float32Array(dcfVer),
                tex: new Float32Array(dcfTex),
                col: new Float32Array(dcfCol),
                element: new Int16Array(dcfEle),
            },
        });
    };
    updataTile(blockRX, blockRY, blockRZ) {
        if (this.inOtherChunk(blockRX, blockRY, blockRZ)) return;

        const setSkylight = (x, y, z, l) => {
            let c = this.world.getChunkByBlockXYZ(x, y, z);
            c.needRebuildBlockLight.add([x, y, z].join());
            return c.lightMap.setSkylight(...Chunk.getRelativeBlockXYZ(x, y, z), l);
        };
        const setTorchlight = (x, y, z, l) => {
            let c = this.world.getChunkByBlockXYZ(x, y, z);
            c.needRebuildBlockLight.add([x, y, z].join());
            return c.lightMap.setTorchlight(...Chunk.getRelativeBlockXYZ(x, y, z), l);
        };
        let [blockX, blockY, blockZ] = this.blockRXYZ2BlockXYZ(blockRX, blockRY, blockRZ),
            cblock = this.getTile(blockRX, blockRY, blockRZ);
        // calculate sky light
        let obstructed = blockY, oblock = null, queue = [];
        while ((oblock = this.world.getTile(blockX, ++obstructed, blockZ))?.opacity === 0);
        for (let y = obstructed - 1; this.world.getTile(blockX, y, blockZ)?.opacity === 0; --y) {
            if (oblock !== null) {
                setSkylight(blockX, y, blockZ, 0);
                queue.push([blockX, y, blockZ]);
            }
            // If there is no obstruction directly above
            else if (this.world.getSkylight(blockX, y, blockZ) !== 15) {
                setSkylight(blockX, y, blockZ, 15);
                queue.push([blockX, y, blockZ]);
            }
        }
        // remove below sky light
        let removalLightQueue = [];
        removalLightQueue.push([blockX, blockY, blockZ, this.lightMap.getSkylight(blockRX, blockRY, blockRZ)]);
        this.lightMap.setSkylight(blockRX, blockRY, blockRZ, oblock === null? 15 - cblock.opacity: 0);
        this.needRebuildBlockLight.add([blockX, blockY, blockZ].join());
        queue.push([blockX, blockY, blockZ]);
        while (removalLightQueue.length) {
            let [wx, wy, wz, cbl] = removalLightQueue.shift();
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let x = wx + dx, y = wy + dy, z = wz + dz,
                    b = this.world.getTile(x, y, z),
                    bl = this.world.getSkylight(x, y, z);
                if (b === null) return;
                if (bl === 15 && dy === -1) {
                    setSkylight(x, y, z, 0);
                    removalLightQueue.push([x, y, z, bl]);
                }
                else if (bl !== 0 && bl < cbl) {
                    setSkylight(x, y, z, 0);
                    removalLightQueue.push([x, y, z, bl]);
                }
                else if (bl > cbl) {
                    queue.push([x, y, z]);
                }
            });
        }
        while (queue.length) {
            let [wx, wy, wz] = queue.shift();
            let l = this.world.getSkylight(wx, wy, wz);
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let x = wx + dx, y = wy + dy, z = wz + dz,
                    b = this.world.getTile(x, y, z),
                    bl = this.world.getSkylight(x, y, z);
                if (b === null || b.isOpaque) return;
                if (l === 15 && dy === -1) {
                    setSkylight(x, y, z, 15);
                    queue.push([x, y, z]);
                }
                else if (bl + 2 <= l) {
                    setSkylight(x, y, z, l - b.opacity - 1);
                    queue.push([x, y, z]);
                }
                else if (bl > l) {
                    queue.push([x, y, z]);
                }
            });
        }

        // calculate torch light
        let oldLight = this.lightMap.getTorchlight(blockRX, blockRY, blockRZ);
        if (oldLight > cblock.luminance) {
            // remove light
            let removalLightQueue = [[blockX, blockY, blockZ, oldLight]];
            this.lightMap.setTorchlight(blockRX, blockRY, blockRZ, 0);
            while (removalLightQueue.length) {
                let [wx, wy, wz, cbl] = removalLightQueue.shift();
                [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
                .forEach(([dx, dy, dz]) => {
                    let x = wx + dx, y = wy + dy, z = wz + dz,
                        b = this.world.getTile(x, y, z),
                        bl = this.world.getTorchlight(x, y, z);
                    if (b === null) return;
                    if (bl !== 0 && bl < cbl) {
                        setTorchlight(x, y, z, 0);
                        removalLightQueue.push([x, y, z, bl]);
                    }
                    else if (bl >= cbl) {
                        queue.push([x, y, z, bl]);
                    }
                });
            }
        }
        if (this.lightMap.setTorchlight(blockRX, blockRY, blockRZ, cblock.luminance)) {
            this.needRebuildBlockLight.add([blockX, blockY, blockZ].join());
            queue.push([blockX, blockY, blockZ, cblock.luminance]);
        }
        else {
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                    l = this.world.getTorchlight(wx, wy, wz);
                if (l !== null && l !== 0) {
                    queue.push([wx, wy, wz, l]);
                }
            });
        }
        queue.reverse();
        while (queue.length) {
            let [wx, wy, wz, cbl] = queue.shift();
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let x = wx + dx, y = wy + dy, z = wz + dz,
                    b = this.world.getTile(x, y, z),
                    bl = this.world.getTorchlight(x, y, z);
                if (b === null) return;
                if (b.isOpaque) return;
                if (bl + 2 <= cbl) {
                    setTorchlight(x, y, z, cbl - b.opacity - 1);
                    queue.push([x, y, z, cbl - b.opacity - 1]);
                }
            });
        }

        // handle center block
        let bf = {};
        if (cblock.name !== "air") {
            switch (cblock.renderType) {
            case Block.renderType.NORMAL: {
                [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                .forEach(([dx, dy, dz, face]) => {
                    let rx = blockRX + dx, ry = blockRY + dy, rz = blockRZ + dz,
                        inOtherChunk = this.inOtherChunk(rx, ry, rz),
                        b = inOtherChunk
                            ? this.world.getTile(blockX + dx, blockY + dy, blockZ + dz)
                            : this.getTile(rx, ry, rz);
                    if (b?.isOpaque) return;
                    let bl = inOtherChunk
                        ? this.world.getLight(blockX + dx, blockY + dy, blockZ + dz)
                        : this.getLight(rx, ry, rz),
                        verNum = cblock.vertexs[face].length / 3;
                    if (bl === null) bl = 15;
                    bf[face] = {
                        ver: cblock.vertexs[face].map((v, ind) => ind%3===0? v+blockX: ind%3===1? v+blockY: v+blockZ),
                        ele: cblock.elements[face],
                        tex: cblock.texture.uv[face],
                        col: [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - bl)),
                    };
                });
                break;}
            case Block.renderType.FLOWER: {
                let aroundOpaque = 0;
                for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                    let rx = blockRX + dx, ry = blockRY + dy, rz = blockRZ + dz,
                        b = this.inOtherChunk(rx, ry, rz)
                            ? this.world.getTile(blockX + dx, blockY + dy, blockZ + dz)
                            : this.getTile(rx, ry, rz);
                    if (b?.isOpaque) ++aroundOpaque;
                }
                if (aroundOpaque === 6) {
                    delete bf.face;
                    break;
                }
                let bl = this.getLight(blockRX, blockRY, blockRZ),
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
        }
        this.mesh.blockFace[blockRX][blockRY][blockRZ] = bf;
        this.needRebuild = true;
        // handle around block
        let cbl = this.getLight(blockRX, blockRY, blockRZ);
        [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
        .forEach(([dx, dy, dz]) => {
            let rx = blockRX + dx, ry = blockRY + dy, rz = blockRZ + dz,
                [awx, awy, awz] = this.blockRXYZ2BlockXYZ(rx, ry, rz),
                chunk = this.inOtherChunk(rx, ry, rz)
                    ? this.world.getChunkByBlockXYZ(awx, awy, awz)
                    : this;
            if (!chunk) return;
            let [arx, ary, arz] = Chunk.getRelativeBlockXYZ(awx, awy, awz);
            let ablock = chunk.getTile(arx, ary, arz);
            if (ablock.name === "air") return;
            let inverseFace = dx
                    ? 'x' + (dx === 1? '-': '+'): dy
                    ? 'y' + (dy === 1? '-': '+')
                    : 'z' + (dz === 1? '-': '+'),
                abf = chunk.mesh.blockFace[arx][ary][arz];
            switch (ablock.renderType) {
            case Block.renderType.NORMAL: {
                let hasFace = inverseFace in abf;
                if (cblock.isOpaque && hasFace){
                    delete abf[inverseFace];
                    break;
                }
                else if ((!cblock.isOpaque) && (!hasFace)) {
                    let verNum = ablock.vertexs[inverseFace].length / 3;
                    abf[inverseFace] = {
                        ver: ablock.vertexs[inverseFace].map((v, ind) => ind%3===0? v+awx: ind%3===1? v+awy: v+awz),
                        ele: ablock.elements[inverseFace],
                        tex: ablock.texture.uv[inverseFace],
                        col: [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - cbl)),
                    };
                }
                break;}
            case Block.renderType.FLOWER: break;
            }
            chunk.needRebuild = true;
        });
    };
    updata() {
        if (this.needRebuildBlockLight.size) {
            this.needRebuildBlockLight.forEach(s => {
                let [x, y, z] = s.split(",").map(Number),
                    cbl = this.world.getLight(x, y, z);
                [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
                .forEach(([dx, dy, dz]) => {
                    let wx = x + dx, wy = y + dy, wz = z + dz,
                        achunk = this.world.getChunkByBlockXYZ(wx, wy, wz),
                        [rx, ry, rz] = Chunk.getRelativeBlockXYZ(wx, wy, wz),
                        ablock = achunk?.getTile(rx, ry, rz) || null;
                    if (ablock === null || ablock.name === "air") return;
                    let inverseFace = dx
                            ? 'x' + (dx === 1? '-': '+'): dy
                            ? 'y' + (dy === 1? '-': '+')
                            : 'z' + (dz === 1? '-': '+'),
                        abf = achunk?.mesh.blockFace[rx][ry][rz];
                    if (!(inverseFace in abf)) return;
                    switch (ablock.renderType) {
                    case Block.renderType.NORMAL: {
                        let verNum = ablock.vertexs[inverseFace].length / 3;
                        abf[inverseFace].col = [...Array(verNum * 4)].map((_, ind) => ind % 4 === 3? 1.0: Math.pow(0.9, 15 - cbl));
                        break;}
                    }
                    achunk.needRebuild = true;
                });
            });
            this.needRebuildBlockLight = new Set();
        }
        if (!this.needRebuild) return;
        let ver = [], color = [], element = [], tex = [], totalVer = 0;
        let dcfVer = [], dcfCol = [], dcfEle = [], dcfTex = [], dcfTotalver = 0;
        this.mesh.blockFace.forEach(bfx => {
            bfx.forEach(bfxy => {
                bfxy.forEach(bfxyz => {
                    for (let face in bfxyz) {
                        let bff = bfxyz[face],
                            verNum = bff.ver.length / 3;
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
                        color.push(...bff.col);
                        element.push(...bff.ele.map(v => v + totalVer));
                        totalVer += verNum;
                    }
                });
            });
        });
        this.updataMesh({
            ver: new Float32Array(ver),
            tex: new Float32Array(tex),
            col: new Float32Array(color),
            element: new Int16Array(element),
            disableCullFace: {
                ver: new Float32Array(dcfVer),
                tex: new Float32Array(dcfTex),
                col: new Float32Array(dcfCol),
                element: new Int16Array(dcfEle),
            },
        });
        this.needRebuild = false;
    };
    draw() {
        if (!this.renderer) return;
        const ctx = this.renderer.ctx, bufferObj = this.mesh.bo,
              prg = this.renderer.getProgram("showBlock").use();
        if (bufferObj.ele.length) {
            prg.setAtt("position", bufferObj.ver)
                .setAtt("color", bufferObj.col)
                .setAtt("textureCoord", bufferObj.tex);
            ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, bufferObj.ele);
            // ctx.drawElements(ctx.LINES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
            ctx.drawElements(ctx.TRIANGLES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
        }
        if (bufferObj.disableCullFace.ele.length) {
            prg.setAtt("position", bufferObj.disableCullFace.ver)
                .setAtt("color", bufferObj.disableCullFace.col)
                .setAtt("textureCoord", bufferObj.disableCullFace.tex);
            ctx.disable(ctx.CULL_FACE);
            ctx.drawElements(ctx.TRIANGLES, bufferObj.disableCullFace.ele.length, ctx.UNSIGNED_SHORT, 0);
            ctx.enable(ctx.CULL_FACE);
        }
    };
};

export {
    Chunk,
    Chunk as default,
    X_SIZE as CHUNK_X_SIZE,
    Y_SIZE as CHUNK_Y_SIZE,
    Z_SIZE as CHUNK_Z_SIZE,
};
