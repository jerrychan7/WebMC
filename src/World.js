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
        for (let x = -1; x <= 1; ++x)
          for (let z = -1; z <= 1; ++z)
            for (let y = -1; y <= 1; ++y)
                this.loadChunk(x, y, z);
        this.setRenderer(renderer);
    };
    generator(chunkX, chunkY, chunkZ, tileMap) {
        switch(this.type) {
        case "flat":
            let block = Block.getBlockByBlockName(chunkY >= 0? "air":
                chunkX%2? chunkZ%2? "grass": "stone"
                : chunkZ%2? "stone": "grass");
            for (let i = 0; i < tileMap.length; ++i)
                tileMap[i] = block;
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
    loadChunk(chunkX, chunkY, chunkZ) {
        let ck = Chunk.chunkKeyByChunkXYZ(chunkX, chunkY, chunkZ),
            chunk = this.chunkMap[ck];
        if (chunk) return chunk;
        return this.chunkMap[ck] = new Chunk(this, chunkX, chunkY, chunkZ);
    };
    getTile(blockX, blockY, blockZ) {
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) return c.getTile(...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ));
        return null;
    };
    setTile(blockX, blockY, blockZ, blockName) {
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) return c.setTile(...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ), blockName);
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
        //let start = mainPlayer.position,
        let start = mainPlayer.getEyePosition(),
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
            delta = vec3.create(),
            axisStepDir = vec3.create(),
            blockPos = vec3.create(),
            nextWay = vec3.create();
        vec.forEach((dir, axis) => {
            let d = delta[axis] = len / Math.abs(dir);
            axisStepDir[axis] = dir < 0? -1: 1;
            blockPos[axis] = dir > 0? Math.ceil(start[axis]) - 1: Math.floor(start[axis]);
            nextWay[axis] = d === Infinity? Infinity :d * (dir > 0
                ? Math.ceil(start[axis]) - start[axis]
                : start[axis] - Math.floor(start[axis]));
        });
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
    // 向大佬低头
    // from: https://github.com/guckstift/BlockWeb/blob/master/src/boxcast.js
    hitboxesCollision(box, vec, chunkFn) {
        let len      = vec3.length(vec);
        if(len === 0) return null;
        let boxmin   = box.min, boxmax = box.max,
            lead     = vec3.create(),
            leadvox  = vec3.create(),
            trailvox = vec3.create(),
            step     = vec.map(n => n > 0? 1: -1),
            waydelta = vec.map(n => len / Math.abs(n)),
            waynext  = vec3.create();
        for(let k = 0, distnext, trail; k < 3; k ++) {
            if(vec[k] > 0) {
                lead[k]     = boxmax[k];
                trail       = boxmin[k];
                trailvox[k] = Math.floor(trail);
                leadvox[k]  = Math.ceil(lead[k]) - 1;
                distnext    = Math.ceil(lead[k]) - lead[k];
            }
            else {
                lead[k]     = boxmin[k];
                trail       = boxmax[k];
                trailvox[k] = Math.ceil(trail) - 1;
                leadvox[k]  = Math.floor(lead[k]);
                distnext    = lead[k] - Math.floor(lead[k]);
            }
            waynext[k] = waydelta[k] === Infinity? Infinity: waydelta[k] * distnext;
        }
        for (let way = 0, axis; way <= len; ) {
            axis = waynext[1] < waynext[0] && waynext[1] < waynext[2]
                ? 1: waynext[0] < waynext[2]? 0: 2;
            // axis = waynext[0] < waynext[1] && waynext[0] < waynext[2]
            //     ? 0: waynext[1] < waynext[2]? 1: 2;
            way = waynext[axis];
            if (way > len) break;
            waynext[axis]  += waydelta[axis];
            leadvox[axis]  += step[axis];
            trailvox[axis] += step[axis];
            let [stepx, stepy, stepz] = step,
                xs = axis === 0? leadvox[0]: trailvox[0],
                ys = axis === 1? leadvox[1]: trailvox[1],
                zs = axis === 2? leadvox[2]: trailvox[2],
                [xe, ye, ze] = vec3.add(leadvox, step),
                x, y, z;
            for(x = xs; x !== xe; x += stepx)
              for(y = ys; y !== ye; y += stepy)
                for(z = zs; z !== ze; z += stepz)
                    if(chunkFn(x, y, z))
                        return {
                            axis: axis,
                            step: step[axis],
                            pos:  lead[axis] + way * (vec[axis] / len),
                        };
        }
        return null;
    };
};

export {
    World,
    World as default
};
