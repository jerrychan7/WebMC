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
            bo: { ver: null, col: null, tex: null, ele: null, },
        };
        this.needRebuild = false;
        this.needRebuildBlockLight = new Set();
        this.updataAllTile();
        this.setRenderer(renderer);
    };
    setRenderer(renderer = null) {
        if (!renderer) return;
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
    onAroundChunkLoad(chunkKey) {
        let skyQueue = [], torchQueue = [];
        this.unloadChunkData[chunkKey].forEach(blockRXYZ => {
            const [blockRX, blockRY, blockRZ] = blockRXYZ.split(",").map(Number),
                  blockX = blockRX + this.x * X_SIZE,
                  blockY = blockRY + this.y * Y_SIZE,
                  blockZ = blockRZ + this.z * Z_SIZE,
                  cblock = this.getTile(blockRX, blockRY, blockRZ),
                  csl = this.lightMap.getSkylight(blockRX, blockRY, blockRZ),
                  ctl = this.lightMap.getTorchlight(blockRX, blockRY, blockRZ);
            // spread sky and torch light
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let rx = blockRX + dx, ry = blockRY + dy, rz = blockRZ + dz,
                    wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                    [sl, tl] = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
                        ? [this.world.getSkylight(wx, wy, wz), this.world.getTorchlight(wx, wy, wz),]
                        : [this.lightMap.getSkylight(rx, ry, rz), this.lightMap.getTorchlight(rx, ry, rz),];
                if (sl === null) return;
                if (sl >= csl + 2) skyQueue.push([wx, wy, wz, sl]);
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
                        b = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
                            ? this.world.getTile(wx, wy, wz)
                            : this.getTile(rx, ry, rz);
                    if (b?.isOpaque) return;
                    let bl = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
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
            let [wx, wy, wz, cbl] = skyQueue.shift();
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let x = wx + dx, y = wy + dy, z = wz + dz,
                    b = this.world.getTile(x, y, z),
                    bl = this.world.getSkylight(x, y, z);
                if (b === null || b.isOpaque) return;
                if (cbl === 15 && dy === -1) {
                    setSkylight(x, y, z, 15);
                    skyQueue.push([x, y, z, 15]);
                }
                else if (bl + 2 <= cbl) {
                    setSkylight(x, y, z, cbl - b.opacity - 1);
                    skyQueue.push([x, y, z, cbl - b.opacity - 1]);
                }
                else if (bl > cbl) {
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
        element = this.mesh.element
    } = this.mesh) {
        const {mesh, renderer} = this;
        mesh.ver     = ver;
        mesh.col     = col;
        mesh.tex     = tex;
        mesh.element = element;
        if (!renderer) return;
        const bufferObj = mesh.bo;
        if (bufferObj.ver) {
            const {ctx} = renderer;
            ctx.bindBuffer(bufferObj.ver.type, bufferObj.ver);
            ctx.bufferData(bufferObj.ver.type, ver, ctx.STATIC_DRAW);
            ctx.bindBuffer(bufferObj.col.type, bufferObj.col);
            ctx.bufferData(bufferObj.col.type, col, ctx.STATIC_DRAW);
            ctx.bindBuffer(bufferObj.tex.type, bufferObj.tex);
            ctx.bufferData(bufferObj.tex.type, tex, ctx.STATIC_DRAW);
            ctx.bindBuffer(bufferObj.ele.type, bufferObj.ele);
            ctx.bufferData(bufferObj.ele.type, element, ctx.STATIC_DRAW);
            bufferObj.ele.length = element.length;
        }
        else {
            bufferObj.ver = renderer.createVbo(ver);
            bufferObj.col = renderer.createVbo(col);
            bufferObj.tex = renderer.createVbo(tex);
            bufferObj.ele = renderer.createIbo(element);
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
                wx = i + this.x * X_SIZE, wy = j + this.y * Y_SIZE, wz = k + this.z * Z_SIZE;
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let rx = i + dx, ry = j + dy, rz = k + dz;
                let [b, bl] = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
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
            if (this.getTile(x, y, z).isOpaque) continue;
            lightMap.setSkylight(x, y, z, 15);
            queue.push([x, y, z]);
          }
        while (queue.length) {
            let [i, j, k] = queue.shift(), l = lightMap.getSkylight(i, j, k),
                wx = i + this.x * X_SIZE, wy = j + this.y * Y_SIZE, wz = k + this.z * Z_SIZE;
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let rx = i + dx, ry = j + dy, rz = k + dz;
                let [b, bl] = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
                        ? [this.world.getTile(wx + dx, wy + dy, wz + dz),
                            this.world.getSkylight(wx + dx, wy + dy, wz + dz)]
                        : [this.getTile(rx, ry, rz), lightMap.getSkylight(rx, ry, rz)];
                if (b === null || b.isOpaque) return;
                if (l === 15 && dy === -1) {
                    lightMap.setSkylight(rx, ry, rz, 15);
                    queue.push([rx, ry, rz]);
                }
                else if (bl + 2 <= l) {
                    // TODO: If the block is in another chunk, it needs to be notified to update.
                    lightMap.setSkylight(rx, ry, rz, l - b.opacity - 1);
                    queue.push([rx, ry, rz]);
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
        let {unloadChunkData} = this;
        for (let j = 0; j < Y_SIZE; ++j)
          for (let k = 0; k < Z_SIZE; ++k)
            for (let i = 0; i < X_SIZE; ++i) {
                let cblock = this.getTile(i, j, k);
                if (cblock.name === "air") continue;
                let wx = i + this.x * X_SIZE, wy = j + this.y * Y_SIZE, wz = k + this.z * Z_SIZE;
                // 如果周围方块透明 绘制
                switch(cblock.renderType) {
                case Block.renderType.NORMAL: {
                    let bf = blockFace[i][j][k];
                    [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                    .forEach(([dx, dy, dz, face]) => {
                        let rx = i + dx, ry = j + dy, rz = k + dz,
                            b = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
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
                        let bl = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
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
        });
    };
    updataTile(blockRX, blockRY, blockRZ) {
        if (blockRX < 0 || blockRX >= X_SIZE || blockRY < 0 || blockRY >= Y_SIZE || blockRZ < 0 || blockRZ >= Z_SIZE)
            return;

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
        let blockX = blockRX + this.x * X_SIZE,
            blockY = blockRY + this.y * Y_SIZE,
            blockZ = blockRZ + this.z * Z_SIZE,
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
                        b = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
                            ? this.world.getTile(blockX + dx, blockY + dy, blockZ + dz)
                            : this.getTile(rx, ry, rz);
                    if (b?.isOpaque) return;
                    let bl = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
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
            }
        }
        this.mesh.blockFace[blockRX][blockRY][blockRZ] = bf;
        this.needRebuild = true;
        // handle around block
        let cbl = this.getLight(blockRX, blockRY, blockRZ);
        [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
        .forEach(([dx, dy, dz]) => {
            let rx = blockRX + dx, ry = blockRY + dy, rz = blockRZ + dz,
                awx = rx + this.x * X_SIZE,
                awy = ry + this.y * Y_SIZE,
                awz = rz + this.z * Z_SIZE,
                chunk = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
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
        this.mesh.blockFace.forEach(bfx => {
            bfx.forEach(bfxy => {
                bfxy.forEach(bfxyz => {
                    for (let face in bfxyz) {
                        let bff = bfxyz[face],
                            verNum = bff.ver.length / 3;
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
        });
        this.needRebuild = false;
    };
    draw() {
        if (!this.renderer) return;
        const ctx = this.renderer.ctx, bufferObj = this.mesh.bo;
        this.renderer.getProgram("showBlock")
            .use()
            .setAtt("position", bufferObj.ver)
            .setAtt("color", bufferObj.col)
            .setAtt("textureCoord", bufferObj.tex);
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, bufferObj.ele);
        // ctx.drawElements(ctx.LINES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
        ctx.drawElements(ctx.TRIANGLES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
    };
};

export {
    Chunk,
    Chunk as default,
    X_SIZE as CHUNK_X_SIZE,
    Y_SIZE as CHUNK_Y_SIZE,
    Z_SIZE as CHUNK_Z_SIZE,
};
