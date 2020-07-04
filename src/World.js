import Chunk from "./Chunk.js";
import Block from "./Block.js";
import Player from "./Player.js";
import PlayerLocalController from "./PlayerLocalController.js";
import { vec3 } from "./gmath.js";

class World {
    constructor({
        worldName = "My World",
        worldType = "flat",
        renderer = null
    } = {}) {
        this.name = worldName;
        this.type = worldType;
        this.chunkMap = {};
        this.mainPlayer = new Player(this);
        this.entitys = [this.mainPlayer];
        this.renderer = renderer;
        this.generator = this.generator.bind(this);
        for (let dx of [-1,0,1])
            for (let dz of [-1,0,1])
                this.loadChunk(dx, dz);
        this.setRenderer(renderer);
    };
    generator(chunkX, pieceY, chunkZ, pieceMap) {
        switch(this.type) {
        case "flat":
            let block = Block.getBlockByBlockName(pieceY >= 0? "air":
                chunkX%2? chunkZ%2? "grass": "stone"
                : chunkZ%2? "stone": "grass");
            pieceMap.forEach(yz => {
                yz.forEach(z => {
                    for (let i = 0; i < Chunk.Z_WIDTH; ++i)
                        z[i] = block;
                });
            });
        break;
        }
    };
    setRenderer(renderer = null) {
        if (!renderer) return;
        this.renderer = renderer;
        for (let ck in this.chunkMap) {
            this.chunkMap[ck].setRenderer(renderer);
        }
        this.mainPlayer.setController(new PlayerLocalController(this.mainPlayer, renderer.ctx.canvas));
    };
    loadChunk(chunkX, chunkZ) {
        let ck = Chunk.chunkKey(chunkX, chunkZ),
            chunk = this.chunkMap[ck];
        if (chunk) return chunk;
        return this.chunkMap[ck] = new Chunk(this, chunkX, chunkZ);
    };
    getChunk(chunkX, chunkZ) {
        return this.chunkMap[Chunk.chunkKey(chunkX, chunkZ)] || null;
    };
    getTile(blockX, blockY, blockZ) {
        let locPos = Chunk.getChunkPos(blockX, blockY, blockZ),
            c = this.getChunk(locPos[0], locPos[2]);
        const mod = (n, m) => (m + (n % m)) % m;
        if (c) return c.getTile(mod(blockX, Chunk.X_WIDTH), blockY, mod(blockZ, Chunk.Z_WIDTH));
        return null;
    };
    setTile(blockX, blockY, blockZ, blockName) {
        let locPos = Chunk.getChunkPos(blockX, blockY, blockZ),
            c = this.getChunk(locPos[0], locPos[2]);
        const mod = (n, m) => (m + (n % m)) % m;
        if (c) return c.setTile(mod(blockX, Chunk.X_WIDTH), blockY, mod(blockZ, Chunk.Z_WIDTH), blockName);
        return null;
    };
    updata(dt) {
        // for (let ck in this.chunkMap) {
        //     this.chunkMap[ck].updata();
        // }
        this.entitys.forEach(e => e.updata(dt));
    };
    draw() {
        for (let ck in this.chunkMap) {
            this.chunkMap[ck].draw();
        }
        this.entitys.forEach(e => e.draw());
        
        let mainPlayer = this.mainPlayer;
        // Need to decouple
        if (mainPlayer.camera === null) return;
        // highlight selected block
        let start = mainPlayer.position,
            end = mainPlayer.getDirection(20);
        vec3.add(start, end, end);
        let hit = this.rayTraceBlock(start, end, (x, y, z) => {
            let b = this.getTile(x, y, z);
            return b && b.name !== "air";
        });
        if (hit === null) return;

        let block = this.getTile(...hit.blockPos),
            [bx, by, bz] = hit.blockPos,
            selector = this.renderer.getProgram("selector").use().setUni("mvp", mainPlayer.camera.projview),
            ctx = this.renderer.ctx,
            linever = [], linecol = [], lineEle = [];
        let {lineverVbo, linecolVbo, lineIbo} = selector;
        switch (block.renderType) {
        case Block.renderType.NORMAL: {
            for (let f in block.vertexs)
                linever.push(...block.vertexs[f].map((v, ind) => ind%3===0? v+bx: ind%3===1? v+by: v+bz));
            linecol = (_ => {
                let len = linever.length, ans = [];
                while (len--) ans.push(1.0, 1.0, 1.0, 0.5);
                return ans;
            })();
            lineEle = (len => {
                if (!len) return [];
                let base = [0,1, 1,2, 2,3, 3,0], out = [];
                for(let i = 0, j = 0; i < len; j = ++i*4)
                    out.push(...base.map(x => x + j));
                return out;
            })(linever.length / 12);
            break;}
        }
        linever = new Float32Array(linever);
        linecol = new Float32Array(linecol);
        lineEle = new Int16Array(lineEle);
        if (lineIbo) {
            ctx.bindBuffer(lineverVbo.type, lineverVbo);
            ctx.bufferData(lineverVbo.type, linever, ctx.DYNAMIC_DRAW);
            ctx.bindBuffer(linecolVbo.type, linecolVbo);
            ctx.bufferData(linecolVbo.type, linecolVbo, ctx.DYNAMIC_DRAW);
            ctx.bindBuffer(lineIbo.type, lineIbo);
            ctx.bufferData(lineIbo.type, lineEle, ctx.DYNAMIC_DRAW);
            lineIbo.length = lineEle.length;
        }
        else {
            lineverVbo = selector.lineverVbo = this.renderer.createVbo(linever);
            linecolVbo = selector.linecolVbo = this.renderer.createVbo(linecol);
            lineIbo = selector.lineIbo = this.renderer.createIbo(lineEle);
        }
        ctx.enable(ctx.BLEND);
        ctx.blendFunc(ctx.SRC_ALPHA,ctx.ONE_MINUS_SRC_ALPHA);
        // draw line
        ctx.bindBuffer(lineIbo.type, lineIbo);
        selector.setAtt("pos", lineverVbo).setAtt("col", linecolVbo);
        // ctx.drawArrays(ctx.LINE_STRIP, 0, linever.length / 3);
        ctx.drawElements(ctx.LINES, lineIbo.length, ctx.UNSIGNED_SHORT, 0);
        ctx.disable(ctx.BLEND);
        
        if (!hit.axis) return;
        let ver = [], col = [], ele = [], {verVbo, colVbo, ibo} = selector;
        switch (block.renderType) {
        case Block.renderType.NORMAL: {
            ver.push(...block.vertexs[hit.axis].map((v, ind) => ind%3===0? v+bx: ind%3===1? v+by: v+bz));
            ele.push(...block.elements[hit.axis]);
            col = (_ => {
                let len = ver.length / 3, ans = [];
                while (len--) ans.push(1.0, 1.0, 1.0, 0.15);
                return ans;
            })();
            break;}
        }
        ver = new Float32Array(ver);
        col = new Float32Array(col);
        ele = new Int16Array(ele);
        if (ibo) {
            ctx.bindBuffer(verVbo.type, verVbo);
            ctx.bufferData(verVbo.type, ver, ctx.DYNAMIC_DRAW);
            ctx.bindBuffer(colVbo.type, colVbo);
            ctx.bufferData(colVbo.type, col, ctx.DYNAMIC_DRAW);
            ctx.bindBuffer(ibo.type, ibo);
            ctx.bufferData(ibo.type, ele, ctx.DYNAMIC_DRAW);
            ibo.length = ele.length;
        }
        else {
            verVbo = selector.verVbo = this.renderer.createVbo(ver),
            colVbo = selector.colVbo = this.renderer.createVbo(col),
            ibo = selector.ibo = this.renderer.createIbo(ele);
        }
        selector.setUni("mvp", mainPlayer.camera.projview);
        ctx.enable(ctx.BLEND);
        ctx.blendFunc(ctx.SRC_ALPHA,ctx.ONE_MINUS_SRC_ALPHA);
        // draw surface
        ctx.bindBuffer(ibo.type, ibo);
        ctx.depthMask(false);
        selector.setAtt("pos", verVbo).setAtt("col", colVbo);
        ctx.drawElements(ctx.TRIANGLES, ibo.length, ctx.UNSIGNED_SHORT, 0);
        ctx.depthMask(true);
        ctx.disable(ctx.BLEND);
    };
    // return null->uncollision    else { axis->"x+-y+-z+-": collision face, "": in block, blockPos}
    rayTraceBlock(start, end, chunkFn) {
        if (start.some(Number.isNaN) || end.some(Number.isNaN) || vec3.equals(start, end))
            return null;
        if (chunkFn(...start.map(Math.floor))) return {
            axis: "", blockPos: start.map(Math.floor)
        };
        let vec = vec3.subtract(end, start),
            len = vec3.length(vec),
            delta = vec.map(n => len / Math.abs(n)),
            axisStepDir = vec.map(n => n < 0? -1: 1),
            // 当等于整数时 向上取整-1和向下取整不一样
            blockPos = vec.map((n, i) => n > 0? Math.ceil(start[i]) - 1: Math.floor(start[i])),
            nextWay = vec3.mul(delta, vec.map((n, i) => n > 0? Math.ceil(start[i]) - start[i]: start[i] - Math.floor(start[i])));
        for (let way = 0, axis; way <= len;) {
            axis = nextWay[0] < nextWay[1] && nextWay[0] < nextWay[2]
                ? 0 : nextWay[1] < nextWay[2]? 1: 2;
            way = nextWay[axis];
            if (way > len) break;
            blockPos[axis] += axisStepDir[axis];
            if (chunkFn(...blockPos))
                return {
                    axis: "xyz"[axis] + (axisStepDir[axis] > 0? '-': '+'),
                    blockPos
                };
            nextWay[axis] += delta[axis];
        }
        return null;
    };
};

export {
    World,
    World as default
};
