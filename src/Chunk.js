import Piece from "./Piece.js";

const WIDTH = 16;

class Chunk {
    static get X_WIDTH() {return WIDTH; };
    static get Z_WIDTH() { return WIDTH; };
    static getChunkPos(blockX, blockY, blockZ) {
        return [blockX >> 4, blockY, blockZ >> 4];
    };
    static chunkKey(chunkX, chunkZ) {
        return chunkX + ',' + chunkZ;
    };

    constructor(world, chunkX, chunkZ, renderer = world.renderer, generator = world.generator) {
        this.world = world;
        this.x = chunkX; this.z = chunkZ;
        this.pieceMap = {};
        this.renderer = renderer;
        this.generator = generator;
        for (let dy of [1,0,-1]) this.loadPiece(dy);
        this.setRenderer(renderer);
    };
    setRenderer(renderer = null) {
        if (!renderer) return;
        this.renderer = renderer;
        for (let pk in this.pieceMap) {
            this.pieceMap[pk].setRenderer(renderer);
        }
    };
    loadPiece(pieceY) {
        let pk = Piece.pieceKey(pieceY),
            piece = this.pieceMap[pk];
        if (piece) return piece;
        return this.pieceMap[pk] = new Piece(this, pieceY);
    };
    getPiece(pieceY) {
        return this.pieceMap[Piece.pieceKey(pieceY)] || null;
    };
    // blockXZ position relative to chunk
    getTile(blockX, blockY, blockZ) {
        let locPos = Piece.getPiecePos(blockX, blockY, blockZ),
            p = this.getPiece(locPos[1]);
        const mod = (n, m) => (m + (n % m)) % m;
        if (p) return p.getTile(blockX, mod(blockY, Piece.Y_HEIGHT), blockZ);
        return null;
    };
    setTile(blockX, blockY, blockZ, blockName) {
        let locPos = Piece.getPiecePos(blockX, blockY, blockZ),
            c = this.getPiece(locPos[1]);
        const mod = (n, m) => (m + (n % m)) % m;
        if (c) return c.setTile(blockX, mod(blockY, Piece.Y_HEIGHT), blockZ, blockName);
        return null;
    };
    updata() {
        for (let pk in this.pieceMap) {
            this.pieceMap[pk].updata();
        }
    };
    draw() {
        for (let pk in this.pieceMap) {
            this.pieceMap[pk].draw();
        }
    };
};

export {
    Chunk,
    Chunk as default,
    WIDTH as CHUNK_X_WIDTH,
    WIDTH as CHUNK_Z_WIDTH
};
