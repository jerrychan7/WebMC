import { Block, LongID } from "./Block.js";
import { LightMap } from "./WorldLight.js";
import { EventDispatcher } from "../utils/EventDispatcher.js";

const SHIFT_X = 4, SHIFT_Y = 4, SHIFT_Z = 4,
      X_SIZE = 1 << SHIFT_X,
      Y_SIZE = 1 << SHIFT_Y,
      Z_SIZE = 1 << SHIFT_Z;

class Chunk extends EventDispatcher {
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
    // YZX = y * Y_SIZE * Z_SIZE + z * Z_SIZE + x
    static getLinearBlockIndex(blockRX, blockRY, blockRZ) { return (((blockRY << SHIFT_Y) + blockRZ) << SHIFT_Z) + blockRX; };
    // x = index % X_SIZE; z = ((index - x) / Z_SIZE) % Z_SIZE; y = (index - x - z * Z_size) / (Y_SIZE * Z_SIZE);
    static getBlockRXYZBytLinearBlockIndex(index) {
        let blockX = index & (X_SIZE - 1);
        let blockZ = (index >> SHIFT_Z) & (Z_SIZE - 1);
        let blockY = (index >> SHIFT_Y >> SHIFT_Z) & (Y_SIZE - 1);
        return [blockX, blockY, blockZ];
    };
    static getChunkXYZByChunkKey(chunkKey) {
        return chunkKey.split(",").map(Number);
    };

    constructor(world, chunkX, chunkY, chunkZ, renderer = world.renderer, generator = world.generator) {
        super();
        this.world = world;
        this.x = chunkX; this.y = chunkY; this.z = chunkZ;
        this.chunkKey = Chunk.chunkKeyByChunkXYZ(chunkX, chunkY, chunkZ);
        this.tileMap = new Uint32Array(Y_SIZE * Z_SIZE * X_SIZE);
        this.lightMap = new LightMap();
        this.generator = generator;
        generator(chunkX, chunkY, chunkZ, this.tileMap);
        this.setRenderer(renderer);
    };
    setRenderer(renderer = null) {
        if (!renderer) return;
        this.renderer = renderer;
    };
    getTile(blockRX, blockRY, blockRZ) {
        return new LongID(this.tileMap[Chunk.getLinearBlockIndex(blockRX, blockRY, blockRZ)]);
    };
    getBlock(blockRX, blockRY, blockRZ) {
        return Block.getBlockByBlockLongID(this.getTile(blockRX, blockRY, blockRZ));
    };
    setTileByBlock(blockRX, blockRY, blockRZ, block, id = block?.id, bd = block?.bd) {
        if (!block) return block;
        let lbi = Chunk.getLinearBlockIndex(blockRX, blockRY, blockRZ);
        let oldLongID = new LongID(this.tileMap[lbi]), oldBlock = Block.getBlockByBlockLongID(oldLongID);
        let newLongID = new LongID(id, bd);
        this.tileMap[lbi] = newLongID;
        this.dispatchEvent("onTileChanges", blockRX, blockRY, blockRZ, {
            longID: newLongID, block,
        }, {
            longID: oldLongID, block: oldBlock,
        });
        return block;
    };
    setTile(blockRX, blockRY, blockRZ, id, bd) {
        return this.setTileByBlock(blockRX, blockRY, blockRZ, Block.getBlockByBlockIDandData(id, bd), id, bd);
    };
    setBlock(blockRX, blockRY, blockRZ, blockName) {
        return this.setTileByBlock(blockRX, blockRY, blockRZ, Block.getBlockByBlockName(blockName));
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
    update() {};
};

export {
    Chunk,
    Chunk as default,
    X_SIZE as CHUNK_X_SIZE,
    Y_SIZE as CHUNK_Y_SIZE,
    Z_SIZE as CHUNK_Z_SIZE,
};
