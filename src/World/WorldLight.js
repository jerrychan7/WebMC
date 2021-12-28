// 计算光照
import { 
    Chunk,
    CHUNK_X_SIZE as X_SIZE,
    CHUNK_Y_SIZE as Y_SIZE,
    CHUNK_Z_SIZE as Z_SIZE,
} from "./Chunk.js";

// low 4 bit save sky light, and hight 4 bit save torch light
// https://www.seedofandromeda.com/blogs/29-fast-flood-fill-lighting-in-a-blocky-voxel-game-pt-1
// https://www.reddit.com/r/gamedev/comments/2k7gxt/fast_flood_fill_lighting_in_a_blocky_voxel_game/
class LightMap extends Uint8Array {
    constructor() { super(Y_SIZE * Z_SIZE * X_SIZE); };
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

class ChunksLightCalculation {
    constructor(world) {
        this.setWorld(world);
    };
    setWorld(world) {
        this.world = world;
        let chunks = Object.values(world.chunkMap);
        let topChunks = chunks.sort(({y: y1, y: y2}) => y2 - y1).reduce((arr, chunk) => {
            if (chunk.y === chunks[0].y) arr.push(chunk);
            return arr;
        }, []);
        let queue = [];
        topChunks.forEach(chunk => {
            for (let rx = 0; rx < X_SIZE; ++rx)
            for (let rz = 0; rz < Z_SIZE; ++rz) {
                let cblock = chunk.getBlock(rx, Y_SIZE - 1, rz);
                if (cblock.isOpaque) continue;
                let abl = 15;
                let cbl = cblock.opacity === 0 && abl === 15? 15: abl - cblock.opacity - 1;
                chunk.lightMap.setSkylight(rx, Y_SIZE - 1, rz, cbl);
                if (cbl > 1) queue.push([rx, Y_SIZE - 1, rz, chunk]);
            }
        });
        this.spreadSkylight(queue);
        chunks.forEach(chunk => {
            for (let rx = 0; rx < X_SIZE; ++rx)
            for (let ry = 0; ry < Y_SIZE; ++ry)
            for (let rz = 0; rz < Z_SIZE; ++rz) {
                let b = chunk.getBlock(rx, ry, rz);
                if (b.luminance) {
                    chunk.lightMap.setTorchlight(rx, ry, rz, b.luminance);
                    queue.push([rx, ry, rz, chunk]);
                }
            }
        });
        this.spreadTorchlight(queue);
        world.addEventListener("onTileChanges", this.updateTile.bind(this));
        world.addEventListener("onChunkLoad", chunk => {
            this.buildChunkLight(chunk.chunkKey);
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                this.buildChunkLight(world.getChunkByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz));
            }
        });
    };
    // queue = [[rx, ry, rz, chunk]]
    spreadSkylight(queue) {
        const world = this.world, {max} = Math;
        while (queue.length) {
            let [crx, cry, crz, chunk] = queue.shift(),
                csl = chunk.lightMap.getSkylight(crx, cry, crz),
                cblock = chunk.getBlock(crx, cry, crz);
            chunk.updatedLightMap = true;
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                let arx = crx + dx, ary = cry + dy, arz = crz + dz, achunk = chunk;
                if (chunk.inOtherChunk(arx, ary, arz)) {
                    [arx, ary, arz] = Chunk.getRelativeBlockXYZ(crx + dx, cry + dy, crz + dz);
                    achunk = world.getChunkByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz);
                    if (achunk === null) continue;
                }
                let ablock = achunk.getBlock(arx, ary, arz);
                if (ablock.isOpaque) continue;
                // 向下无衰减传播
                if (csl === 15 && dy === -1 && ablock.opacity === 0) {
                    achunk.lightMap.setSkylight(arx, ary, arz, 15);
                    queue.push([arx, ary, arz, achunk]);
                    continue;
                }
                let asl = achunk.lightMap.getSkylight(arx, ary, arz);
                // 中间比旁边亮 向旁边传播
                if (csl - ablock.opacity - 1 > asl) {
                    achunk.lightMap.setSkylight(arx, ary, arz, max(0, csl - ablock.opacity - 1));
                    queue.push([arx, ary, arz, achunk]);
                }
                // 旁边比中间亮 向中间传播
                else if (asl - cblock.opacity - 1 > csl) {
                    chunk.lightMap.setSkylight(crx, cry, crz, asl - cblock.opacity - 1);
                    queue.push([crx, cry, crz, chunk]);
                }
            }
        }
    };
    spreadTorchlight(queue) {
        const world = this.world;
        while (queue.length) {
            let [crx, cry, crz, chunk] = queue.shift(),
                ctl = chunk.lightMap.getTorchlight(crx, cry, crz),
                cblock = chunk.getBlock(crx, cry, crz);
            chunk.updatedLightMap = true;
            if (ctl <= 1) continue;
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                let arx = crx + dx, ary = cry + dy, arz = crz + dz, achunk = chunk;
                if (chunk.inOtherChunk(arx, ary, arz)) {
                    [arx, ary, arz] = Chunk.getRelativeBlockXYZ(crx + dx, cry + dy, crz + dz);
                    achunk = world.getChunkByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz);
                    if (achunk === null) continue;
                }
                let ablock = achunk.getBlock(arx, ary, arz);
                if (ablock.isOpaque) continue;
                let atl = achunk.lightMap.getTorchlight(arx, ary, arz);
                // 中间比旁边亮 向旁边传播
                if (ctl - ablock.opacity - 1 > atl) {
                    achunk.lightMap.setTorchlight(arx, ary, arz, ctl - ablock.opacity - 1);
                    queue.push([arx, ary, arz, achunk]);
                    continue;
                }
                // 旁边比中间亮 向中间传播
                else if (atl - cblock.opacity - 1 > ctl) {
                    chunk.lightMap.setTorchlight(crx, cry, crz, atl - cblock.opacity - 1);
                    queue.push([crx, cry, crz, chunk]);
                    continue;
                }
            }
        }
    };
    // removalLightQueue = [[rx, ry, rz, center block sky/torch light, chunk]]
    removeSkylight(removalLightQueue) {
        const world = this.world, spreadLightQueue = [];
        while (removalLightQueue.length) {
            let [crx, cry, crz, csl, chunk] = removalLightQueue.shift();
            chunk.updatedLightMap = true;
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                let arx = crx + dx, ary = cry + dy, arz = crz + dz, achunk = chunk;
                if (chunk.inOtherChunk(arx, ary, arz)) {
                    [arx, ary, arz] = Chunk.getRelativeBlockXYZ(crx + dx, cry + dy, crz + dz);
                    achunk = world.getChunkByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz);
                    if (achunk === null) continue;
                }
                let ablock = achunk.getBlock(arx, ary, arz),
                    asl = achunk.lightMap.getSkylight(arx, ary, arz);
                if (asl === 15 && dy === -1 && ablock.opacity === 0) {
                    achunk.lightMap.setSkylight(arx, ary, arz, 0);
                    removalLightQueue.push([arx, ary, arz, asl, achunk]);
                    continue;
                }
                else if (asl !== 0 && asl < csl) {
                    achunk.lightMap.setSkylight(arx, ary, arz, 0);
                    removalLightQueue.push([arx, ary, arz, asl, achunk]);
                    continue;
                }
                else if (asl >= csl) {
                    spreadLightQueue.push([arx, ary, arz, achunk]);
                    continue;
                }
            }
        }
        return spreadLightQueue;
    };
    removeTorchlight(removalLightQueue) {
        const world = this.world, spreadLightQueue = [];
        while (removalLightQueue.length) {
            let [crx, cry, crz, ctl, chunk] = removalLightQueue.shift();
            chunk.updatedLightMap = true;
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                let arx = crx + dx, ary = cry + dy, arz = crz + dz, achunk = chunk;
                if (chunk.inOtherChunk(arx, ary, arz)) {
                    [arx, ary, arz] = Chunk.getRelativeBlockXYZ(crx + dx, cry + dy, crz + dz);
                    achunk = world.getChunkByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz);
                    if (achunk === null) continue;
                }
                let ablock = achunk.getBlock(arx, ary, arz),
                    atl = achunk.lightMap.getTorchlight(arx, ary, arz);
                if (atl !== 0 && atl < ctl && ablock.luminance === 0) {
                    achunk.lightMap.setTorchlight(arx, ary, arz, 0);
                    removalLightQueue.push([arx, ary, arz, atl, achunk]);
                }
                else if (atl >= ctl || ablock.luminance) {
                    spreadLightQueue.push([arx, ary, arz, achunk]);
                }
            }
        }
        return spreadLightQueue;
    };
    buildChunkLight(chunkKey) {
        const {world} = this, chunk = world.getChunkByChunkKey(chunkKey);
        if (!chunk) return;
        // build torch light
        let queue = [], lightMap = chunk.lightMap;
        for (let j = 0; j < Y_SIZE; ++j)
        for (let k = 0; k < Z_SIZE; ++k)
        for (let i = 0; i < X_SIZE; ++i) {
            let b = chunk.getBlock(i, j, k);
            lightMap.setSkylight(i, j, k, 0);
            let tl = b.luminance;
            lightMap.setTorchlight(i, j, k, tl);
            if (tl) queue.push([i, j, k, chunk]);
        }
        this.spreadTorchlight(queue);
        // build sky light
        [   [0,X_SIZE-1, 0,0, 0,Z_SIZE-1], [0,X_SIZE-1, Y_SIZE-1,Y_SIZE-1, 0,Z_SIZE-1],
            [0,0, 0,Y_SIZE-1, 0,Z_SIZE-1], [X_SIZE-1,X_SIZE-1, 0,Y_SIZE-1, 0,Z_SIZE-1],
            [0,X_SIZE-1, 0,Y_SIZE-1, 0,0], [0,X_SIZE-1, 0,Y_SIZE-1, Z_SIZE-1,Z_SIZE-1],
        ].forEach(([sx, ex, sy, ey, sz, ez]) => {
            let dx = sx === ex? sx? 1: -1: 0,
                dy = sy === ey? sy? 1: -1: 0,
                dz = sz === ez? sz? 1: -1: 0;
            for (let rx = sx; rx <= ex; ++rx)
            for (let ry = sy; ry <= ey; ++ry)
            for (let rz = sz; rz <= ez; ++rz) {
                let b = chunk.getBlock(rx, ry, rz);
                if (b.isOpaque) continue;
                let asl = world.getSkylight(...chunk.blockRXYZ2BlockXYZ(rx + dx, ry + dy, rz + dz));
                if (asl === null && dy !== 1) return;
                let csl = chunk.lightMap.getSkylight(rx, ry, rz),
                    l = Math.max(csl, dy == 1 && (asl === null || asl === 15)? 15: asl - b.opacity - 1);
                if (l > 1) {
                    lightMap.setSkylight(rx, ry, rz, l);
                    queue.push([rx, ry, rz, chunk]);
                }
            }
        });
        this.spreadSkylight(queue);
    };
    updateTile(blockX, blockY, blockZ) {
        const world = this.world;
        const cchunk = world.getChunkByBlockXYZ(blockX, blockY, blockZ);
        if (cchunk === null) return;
        const cblock = world.getBlock(blockX, blockY, blockZ);
        // calculate sky light
        let obstructed = blockY, oblock = null, queue = [];
        const setSkylight = (x, y, z, l) => {
            let c = world.getChunkByBlockXYZ(x, y, z);
            if (c === null) return;
            let rxyz = Chunk.getRelativeBlockXYZ(x, y, z);
            c.lightMap.setSkylight(...rxyz, l);
            queue.push([...rxyz, c]);
        };
        while (oblock = world.getBlock(blockX, ++obstructed, blockZ)) if (oblock.opacity === 0) break;
        for (let y = obstructed - 1, b; true; --y) {
            b = world.getBlock(blockX, y, blockZ); if (b === null || b.opacity === 0) break;
            if (oblock !== null)
                setSkylight(blockX, y, blockZ, 0);
            // If there is no obstruction directly above
            else if (world.getSkylight(blockX, y, blockZ) !== 15)
                setSkylight(blockX, y, blockZ, 15);
        }
        // remove below sky light
        let removalLightQueue = [];
        removalLightQueue.push([
            ...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ),
            world.getSkylight(blockX, blockY, blockZ),
            cchunk]);
        setSkylight(blockX, blockY, blockZ, oblock === null? 15 - cblock.opacity: 0);
        queue.push(...this.removeSkylight(removalLightQueue));
        this.spreadSkylight(queue);

        // calculate torch light
        const setTorchlight = (x, y, z, l) => {
            let c = world.getChunkByBlockXYZ(x, y, z);
            if (c === null) return;
            let rxyz = Chunk.getRelativeBlockXYZ(x, y, z);
            c.lightMap.setTorchlight(...rxyz, l);
            queue.push([...rxyz, c]);
        };
        let oldLight = world.getTorchlight(blockX, blockY, blockZ);
        if (oldLight > cblock.luminance) {
            // remove light
            let removalLightQueue = [[...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ), oldLight, cchunk]];
            setTorchlight(blockX, blockY, blockZ, 0);
            queue.push(...this.removeTorchlight(removalLightQueue));
        }
        setTorchlight(blockX, blockY, blockZ, cblock.luminance);
        if (!cblock.luminance) {
            [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]
            .forEach(([dx, dy, dz]) => {
                let wx = blockX + dx, wy = blockY + dy, wz = blockZ + dz,
                    l = world.getTorchlight(wx, wy, wz);
                if (l !== null && l !== 0) {
                    queue.push([...Chunk.getRelativeBlockXYZ(wx, wy, wz), world.getChunkByBlockXYZ(wx, wy, wz)]);
                }
            });
        }
        this.spreadTorchlight(queue);
    };
    update() {};
}

export {
    LightMap,
    ChunksLightCalculation,
};
