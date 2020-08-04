import Block from "./Block.js";

const SHIFT_X = 4, SHIFT_Y = 4, SHIFT_Z = 4,
      X_SIZE = 1 << SHIFT_X,
      Y_SIZE = 1 << SHIFT_Y,
      Z_SIZE = 1 << SHIFT_Z;

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
    static getLinearBlockIndex(blockRX, blockRY, blockRZ) { return (blockRY * Y_SIZE + blockRZ) * Z_SIZE + blockRX; };

    constructor(world, chunkX, chunkY, chunkZ, renderer = world.renderer, generator = world.generator) {
        this.world = world;
        this.x = chunkX; this.y = chunkY; this.z = chunkZ;
        // Y_SIZE * Z_SIZE * X_SIZE    array
        this.tileMap = new Array(Y_SIZE * Z_SIZE * X_SIZE);
        this.generator = generator;
        generator(chunkX, chunkY, chunkZ, this.tileMap);
        this.mesh = {
            vec: new Float32Array(),
            col: new Float32Array(),
            tex: new Float32Array(),
            element: new Int16Array(),
            bo: { vec: null, col: null, tex: null, ele: null, },
        };
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
        this.updataAllTile();
    };
    onAroundChunkLoad() {
        this.updataAllTile();
    };
    updataMesh({
        vec = this.mesh.vec,
        col = this.mesh.col,
        tex = this.mesh.tex,
        element = this.mesh.element
    } = this.mesh) {
        const {mesh, renderer} = this;
        mesh.vec     = vec;
        mesh.col     = col;
        mesh.tex     = tex;
        mesh.element = element;
        if (!renderer) return;
        const bufferObj = mesh.bo;
        if (bufferObj.vec) {
            const {ctx} = renderer;
            ctx.bindBuffer(bufferObj.vec.type, bufferObj.vec);
            ctx.bufferData(bufferObj.vec.type, vec, ctx.STATIC_DRAW);
            ctx.bindBuffer(bufferObj.col.type, bufferObj.col);
            ctx.bufferData(bufferObj.col.type, col, ctx.STATIC_DRAW);
            ctx.bindBuffer(bufferObj.tex.type, bufferObj.tex);
            ctx.bufferData(bufferObj.tex.type, tex, ctx.STATIC_DRAW);
            ctx.bindBuffer(bufferObj.ele.type, bufferObj.ele);
            ctx.bufferData(bufferObj.ele.type, element, ctx.STATIC_DRAW);
            bufferObj.ele.length = element.length;
        }
        else {
            bufferObj.vec = renderer.createVbo(vec);
            bufferObj.col = renderer.createVbo(col);
            bufferObj.tex = renderer.createVbo(tex);
            bufferObj.ele = renderer.createIbo(element);
        }
    };
    updataAllTile() {
        let vec = [], element = [], tex = [], totalVec = 0;
        for (let j = 0; j < Y_SIZE; ++j)
          for (let k = 0; k < Z_SIZE; ++k)
            for (let i = 0; i < X_SIZE; ++i) {
                let cblock = this.getTile(i, j, k);
                if (cblock.name === "air") continue;
                let wx = i + this.x * X_SIZE, wy = j + this.y * Y_SIZE, wz = k + this.z * Z_SIZE;
                // 如果周围方块透明 绘制
                switch(cblock.renderType) {
                case Block.renderType.NORMAL: {
                    [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                    .forEach(([dx, dy, dz, face]) => {
                        let rx = i + dx, ry = j + dy, rz = k + dz,
                            b = (rx < 0 || rx >= X_SIZE || rz < 0 || rz >= Z_SIZE || ry < 0 || ry >= Y_SIZE)
                                ? this.world.getTile(wx + dx, wy + dy, wz + dz)
                                : this.getTile(rx, ry, rz);
                        if (!(b === null || b.opacity !== 15)) return;
                        let verNum = cblock.vertexs[face].length / 3;
                        vec.push(...cblock.vertexs[face].map((v, ind) => ind%3===0? v+wx: ind%3===1? v+wy: v+wz));
                        element.push(...cblock.elements[face].map((v, ind) => v + totalVec));
                        tex.push(...cblock.texture.uv[face]);
                        totalVec += verNum;
                    });
                    break;}
                }
            }
        this.updataMesh({
            vec: new Float32Array(vec),
            tex: new Float32Array(tex),
            element: new Int16Array(element),
            col: new Float32Array((() => {
                let len = totalVec, ans = [];
                while (len--) ans.push(1.0, 1.0, 1.0, 1.0);
                return ans;
            })()),
        });
    };
    updataTile(blockRX, blockRY, blockRZ) {};
    updata() {};
    draw() {
        if (!this.renderer) return;
        const ctx = this.renderer.ctx, bufferObj = this.mesh.bo;
        this.renderer.getProgram("showBlock")
            .use()
            .setAtt("position", bufferObj.vec)
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
