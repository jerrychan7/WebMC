import Block from "./Block.js";
import { CHUNK_X_WIDTH, CHUNK_Z_WIDTH } from "./Chunk.js";

const HEIGHT = 16;

class Piece {
    static get SIZE() { return HEIGHT ** 3; };
    static get HEIGHT() { return HEIGHT; };
    static get Y_HEIGHT() {return HEIGHT; };
    static getPiecePos(chunkX, blockY, chunkZ) {
        return [chunkX, blockY >> 4, chunkZ];
    };
    static pieceKey(pieceY) {
        return pieceY;
    };
    constructor(chunk, pieceY, renderer = chunk.renderer, generator = chunk.generator) {
        this.chunk = chunk; this.world = chunk.world;
        this.y = pieceY; this.x = chunk.x; this.z = chunk.z;
        this.renderer = renderer;
        // CHUNK_X_WIDTH * HEIGHT * CHUNK_Z_WIDTH    array
        this.tileMap = [...new Array(CHUNK_X_WIDTH)].map(_ => [...new Array(HEIGHT)].map(_ => new Array(CHUNK_Z_WIDTH)));
        this.generator = generator;
        generator(chunk.x, pieceY, chunk.z, this.tileMap);
        this.updata();
        this.setRenderer(renderer);
    };
    setRenderer(renderer = null) {
        if (!renderer) return;
        this.renderer = renderer;
        this.pos = renderer.createVbo(this.vec);
        this.color = renderer.createVbo(this.col);
        this.texture = renderer.createVbo(this.tex);
        this.ibo = renderer.createIbo(this.element);
    };
    getTile(blockX, blockY, blockZ) {
        try { return this.tileMap[blockX][blockY][blockZ] || null; }
        catch(e) { return null; }
    };
    setTile(blockX, blockY, blockZ, blockName) {
        this.tileMap[blockX][blockY][blockZ] = Block.getBlockByBlockName(blockName);
        this.updata();
    };
    updata() {
        let vec = [], element = [], tex = [], totalVec = 0;
        for (let i = 0; i < HEIGHT; ++i)
          for (let j = 0; j < HEIGHT; ++j)
            for (let k = 0; k < HEIGHT; ++k) {
                let cblock = this.getTile(i, j, k);
                if (cblock.name === "air") continue;
                let wx = i + this.x * CHUNK_X_WIDTH, wy = j + this.y * HEIGHT, wz = k + this.z * CHUNK_Z_WIDTH;
                // 如果周围方块透明 绘制
                switch(cblock.renderType) {
                case Block.renderType.NORMAL: {
                    [[1,0,0,"x+"], [-1,0,0,"x-"], [0,1,0,"y+"], [0,-1,0,"y-"], [0,0,1,"z+"], [0,0,-1,"z-"]]
                    .forEach(([dx, dy, dz, face]) => {
                        let rx = i + dx, ry = j + dy, rz = k + dz,
                            b = (rx < 0 || rx >= CHUNK_X_WIDTH || rz < 0 || rz >= CHUNK_Z_WIDTH)
                                ? this.world.getTile(wx + dx, wy + dy, wz + dz)
                                : (ry < 0 || ry >= HEIGHT)
                                ? this.chunk.getTile(this.x, this.y + dy, this.z)
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
        this.vec = new Float32Array(vec);
        this.tex = new Float32Array(tex);
        this.col = new Float32Array((() => {
            let len = totalVec, ans = [];
            while (len--) ans.push(1.0, 1.0, 1.0, 1.0);
            return ans;
        })());
        this.element = new Int16Array(element);
        if (!this.renderer) return;
        if (this.pos) {
            this.renderer.ctx.bindBuffer(this.pos.type, this.pos);
            this.renderer.ctx.bufferData(this.pos.type, this.vec, this.renderer.ctx.STATIC_DRAW);
            this.renderer.ctx.bindBuffer(this.color.type, this.color);
            this.renderer.ctx.bufferData(this.color.type, this.col, this.renderer.ctx.STATIC_DRAW);
            this.renderer.ctx.bindBuffer(this.texture.type, this.texture);
            this.renderer.ctx.bufferData(this.texture.type, this.tex, this.renderer.ctx.STATIC_DRAW);
            this.renderer.ctx.bindBuffer(this.ibo.type, this.ibo);
            this.renderer.ctx.bufferData(this.ibo.type, this.element, this.renderer.ctx.STATIC_DRAW);
            this.ibo.length = this.element.length;
        }
        else {
            this.pos = this.renderer.createVbo(this.vec);
            this.color = this.renderer.createVbo(this.col);
            this.texture = this.renderer.createVbo(this.tex);
            this.ibo = this.renderer.createIbo(this.element);
        }
    };
    draw() {
        if (!this.renderer) return;
        const gl = this.renderer.gl;
        this.renderer.getProgram("showBlock")
            .use()
            .setAtt("position", this.pos)
            .setAtt("color", this.color)
            .setAtt("textureCoord", this.texture);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        // gl.drawElements(gl.LINES, this.ibo.length, gl.UNSIGNED_SHORT, 0);
        gl.drawElements(gl.TRIANGLES, this.ibo.length, gl.UNSIGNED_SHORT, 0);
    };
};

export {
    Piece,
    Piece as default,
    HEIGHT as PIECE_Y_HEIGHT
};
