// Calculate fluid level
import {
    Chunk,
    CHUNK_X_SIZE as X_SIZE,
    CHUNK_Y_SIZE as Y_SIZE,
    CHUNK_Z_SIZE as Z_SIZE,
} from "./Chunk.js";
import { Block } from "./Block.js";

class FluidCalculator {
    constructor(world) {
        // wx, wy, wz
        this.spreadQueue = [];
        this.removalQueue = [];
        this.updatingTile = false;
        this.waterID = Block.getBlockByBlockName("water").id;
        this.flowingWaterID = Block.getBlockByBlockName("flowing_water").id;
        this.lavaID = Block.getBlockByBlockName("lava").id;
        this.flowingLavaID = Block.getBlockByBlockName("flowing_lava").id;
        this.timeCount = 0;
        this.setWorld(world);
    };
    setWorld(world) {
        this.world = world;
        const getChunkFlowingFluid = (chunk) => {
            for (let rx = 0; rx < X_SIZE; ++rx)
            for (let ry = 0; ry < Y_SIZE; ++ry)
            for (let rz = 0; rz < Z_SIZE; ++rz) {
                let {id, bd} = chunk.getBlock(rx, ry, rz);
                if (id == this.flowingWaterID || id == this.flowingLavaID) {
                    this.spreadQueue.push(chunk.blockRXYZ2BlockXYZ(rx, ry, rz));
                }
            }
            chunk.addEventListener("onTileChanges", (blockRX, blockRY, blockRZ, newInfo, oldInfo) => {
                if (this.updatingTile || (!oldInfo.block.isFluid && !newInfo.block.isFluid)) return;
                if (newInfo.block.isFluid)
                    this.spreadQueue.push(chunk.blockRXYZ2BlockXYZ(blockRX, blockRY, blockRZ));
                else this.removalQueue.push([...chunk.blockRXYZ2BlockXYZ(blockRX, blockRY, blockRZ), oldInfo.longID.id, oldInfo.longID.bd]);
            });
        };
        Object.values(world.chunkMap).forEach(getChunkFlowingFluid);
        this.spreadFluid();
        world.addEventListener("onChunkLoad", (chunk) => {
            getChunkFlowingFluid(chunk);
            this.spreadFluid();
        });
    };
    spreadFluid(depth = Infinity, spreadQueue = this.spreadQueue) {
        const {world, waterID, lavaID, flowingWaterID, flowingLavaID} = this;
        while (depth-- > 0 && spreadQueue.length) {
            let nextQueue = [];
            const push2queue = (x, y, z) => {
                const k = x + "," + y + "," + z;
                if (nextQueue[k]) return;
                nextQueue.push([x, y, z]);
                nextQueue[k] = true;
            };
            while (spreadQueue.length) {
                let [cwx, cwy, cwz] = spreadQueue.shift();
                let chunk = world.getChunkByBlockXYZ(cwx, cwy, cwz);
                // 如果区块还未加载
                if (chunk == null) {
                    push2queue(cwx, cwy, cwz);
                    // nextQueue.push([cwx, cwy, cwz]);
                    continue;
                }
                // chunk.updatedFluidLevel = true;
                let longID = world.getTile(cwx, cwy, cwz), cid = longID.id, cbd = longID.bd;
                // console.log(longID, cid, cbd)
                let cblock = Block.getBlockByBlockIDandData(cid, cbd);
                const fluidID =
                    cid == waterID || cid == flowingWaterID? waterID:
                    cid == lavaID || cid == flowingLavaID? lavaID: cid;
                const flowingID =
                    cid == waterID || cid == flowingWaterID? flowingWaterID:
                    cid == lavaID || cid == flowingLavaID? flowingLavaID: cid;
                if (cid != fluidID) {
                    world.setTile(cwx, cwy, cwz, fluidID, cbd);
                    cid = fluidID;
                }
                let downBlock = world.getBlock(cwx, cwy - 1, cwz);
                longID = world.getTile(cwx, cwy - 1, cwz);
                let downBlockId = longID?.id, downBlockBd = longID?.bd;
                // 如果下面的区块还未加载
                // if (downBlock == null) nextQueue.push([cwx, cwy, cwz]);
                if (downBlock == null) push2queue(cwx, cwy, cwz);
                // 如果是向下传播的液体方块
                if (cbd >= 8 && downBlock != null) {
                    // 如果能向下传播
                    if (downBlock.name == "air" || downBlockId == fluidID || downBlockId == flowingID) {
                        if (downBlock.name == "air" || downBlockBd) world.setTile(cwx, cwy - 1, cwz, flowingID, cbd);
                        else world.setTile(cwx, cwy - 1, cwz, flowingID, downBlockBd);
                        // nextQueue.push([cwx, cwy - 1, cwz]);
                        push2queue(cwx, cwy - 1, cwz);
                        continue;
                    }
                    // 否则作为水源向外传播
                    else {
                        cbd = 0;
                    }
                }
                // 若等级到最小且无法向下方流动时终止传播
                if (cbd == cblock.maxLevel && (downBlock == null || downBlock.name != "air"))
                    continue;
                // 非水源方块且下面方块为空 直接向下传播
                if (downBlock && (downBlock.name == "air" || downBlockId == fluidID || downBlockId == flowingID)) {
                    world.setTile(cwx, cwy - 1, cwz, flowingID, cbd + 8);
                    // nextQueue.push([cwx, cwy - 1, cwz]);
                    push2queue(cwx, cwy - 1, cwz);
                    if (cbd != 0) continue;
                }
                // 找到最近的坑
                const blockKey = (x, z) => x + "," + z;
                let holes = [], level = cbd;
                let queue = [[[1,0], [-1,0], [0,1], [0,-1]].map(
                    ([dx, dz]) => [cwx + dx, cwz + dz])];
                while (queue.length && level <= cblock.maxLevel) {
                    ++level;
                    let q = queue.shift(), nextQ = [];
                    queue.push(nextQ);
                    while (q.length) {
                        let [x, z] = q.shift();
                        let b = world.getBlock(x, cwy - 1, z);
                        if (b && (b.name == "air" || b.id == fluidID || b.id == flowingID)) {
                            queue.length = 0;
                            holes.push([x, z]);
                        }
                        else for (let [dx, dz] of [[1,0], [-1,0], [0,1], [0,-1]]) {
                            if (queue[blockKey(x + dx, z + dz)] != true) {
                                nextQ.push([x + dx, z + dz]);
                                queue[blockKey(x + dx, z + dz)] = true;
                            }
                        }
                    }
                }
                // console.log(holes);
                // 若有坑 向坑内传播 否则向四周传播
                let sp = holes.length
                    ? [[1,0], [-1,0], [0,1], [0,-1]].reduce((ans, [dx, dz]) => {
                        let x = cwx + dx, z = cwz + dz;
                        const {abs} = Math;
                        for (let [i, k] of holes) {
                            if (abs(x - i) + abs(z - k) == level - 1 - cbd) {
                                ans.push([dx, dz]);
                                break;
                            }
                        }
                        return ans;
                    }, [])
                    : [[1,0], [-1,0], [0,1], [0,-1]];
                for (let [dx, dz] of sp) {
                    let awx = cwx + dx, awy = cwy, awz = cwz + dz;
                    let ablock = world.getBlock(awx, awy, awz);
                    if (ablock == null) {
                        // nextQueue.push([awx, awy, awz]);
                        push2queue(awx, awy, awz);
                        continue;
                    }
                    if (ablock.name == "air") {
                        world.setTile(awx, awy, awz, flowingID, cbd + 1);
                        // nextQueue.push([awx, awy, awz]);
                        push2queue(awx, awy, awz);
                    }
                    else if (ablock.id == fluidID || ablock.id == flowingID) {
                        let abd = world.getTile(awx, awy, awz).bd;
                        if (abd >= 8) abd = 0;
                        // 向旁边传播
                        if (abd > cbd) {
                            world.setTile(awx, awy, awz, flowingID, cbd + 1);
                            // nextQueue.push([awx, awy, awz]);
                            push2queue(awx, awy, awz);
                        }
                        // 向中间传播
                        else if (abd < cbd - 1) {
                            world.setTile(awx, awy, awz, flowingID, abd + 1);
                            // nextQueue.push([awx, awy, awz]);
                            push2queue(awx, awy, awz);
                        }
                    }
                }
                // 无限水源
            }
            this.spreadQueue = spreadQueue = nextQueue;
            // console.log(nextQueue.map(t => t.join(",")))
        }
    };
    // removalQueue = [[wx, wy, wz, center block id, center block fluid level]]
    removeFluid(depth = Infinity, removalQueue = this.removalQueue) {
        const {world, waterID, lavaID, flowingWaterID, flowingLavaID} = this;
        while (depth-- > 0 && removalQueue.length) {
            let nextQueue = [];
            const push2queue = (x, y, z) => {
                const k = x + "," + y + "," + z;
                if (nextQueue[k]) return;
                nextQueue.push([x, y, z]);
                nextQueue[k] = true;
            };
            while (removalQueue.length) {
                let [cwx, cwy, cwz, cid, cbd] = removalQueue.shift();
                let chunk = world.getChunkByBlockXYZ(cwx, cwy, cwz);
                // 如果区块还未加载
                if (chunk == null) {
                    push2queue(cwx, cwy, cwz);
                    continue;
                }
                let cblock = Block.getBlockByBlockIDandData(cid, cbd);
                const fluidID =
                    cid == waterID || cid == flowingWaterID? waterID:
                    cid == lavaID || cid == flowingLavaID? lavaID: cid;
                const flowingID =
                    cid == waterID || cid == flowingWaterID? flowingWaterID:
                    cid == lavaID || cid == flowingLavaID? flowingLavaID: cid;
                
            }
            this.removalQueue = removalQueue = nextQueue;
        }
    };
    updateTile(blockX, blockY, blockZ) {
        if (this.updatingTile) return;
        let b = this.world.getBlock(blockX, blockY, blockZ);
        if (!b.isFluid) return;
        this.spreadQueue.push([blockX, blockY, blockZ]);
    };
    update(dt) {
        if (this.timeCount >= 250) {
            this.updatingTile = true;
            this.spreadFluid(1);
            this.updatingTile = false;
            this.timeCount = 0;
        }
        this.timeCount += dt;
    };
}

export {
    FluidCalculator,
    FluidCalculator as default
};
