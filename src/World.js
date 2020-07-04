import Chunk from "./Chunk.js";
import Block from "./Block.js";
import Player from "./Player.js";
import PlayerLocalController from "./PlayerLocalController.js";

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
    };
};

export {
    World,
    World as default
};
