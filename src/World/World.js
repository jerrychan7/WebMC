import Chunk from "./Chunk.js";
import { Block, LongID } from "./Block.js";
import Player from "../Entity/Player.js";
import { vec3, radian2degree } from "../utils/math/index.js";
import { PerlinNoise } from "./noise.js";
import { FluidCalculator } from "./WorldFluidCal.js";
import { ChunksLightCalculation } from "./WorldLight.js";
import { asyncLoadResByUrl } from "../utils/loadResources.js";
import { EventDispatcher } from "../utils/EventDispatcher.js";

let worldDefaultConfig = {};
asyncLoadResByUrl("src/World/worldDefaultConfig.json")
.then(cfg => {
    worldDefaultConfig = cfg;
});

class WorldStorage {
    constructor(id) {
        this.id = id;
        let worlds = this._getWorlds();
        if (!(id in worlds)) worlds[id] = {
            createAt: Date.now(),
            modifyAt: Date.now(),
        };
        this._setWorlds(worlds);
    };
    _getWorlds() { return JSON.parse(localStorage.getItem("worlds") || "{}"); };
    _setWorlds(data) { localStorage.setItem("worlds", JSON.stringify(data)); };
    _updateWorld(fn) {
        let worlds = this._getWorlds();
        let ans = fn(worlds[this.id]);
        worlds[this.id].modifyAt = Date.now();
        this._setWorlds(worlds);
        return ans;
    };
    get(key, defaultValue) {
        key = key.split(">");
        return this._updateWorld(world => {
            let p = world;
            for (let k of key)
                if (!(p = p[k]))
                    return defaultValue;
            return p;
        });
    };
    set(key, value) {
        key = key.split(">");
        return this._updateWorld(world => {
            let lp = null, p = world;
            for (let i = 0; i < key.length; ++i) {
                let k = key[i];
                lp = p; p = p[k];
                if (i != key.length - 1) {
                    if (!p) lp[k] = p = {};
                }
                else return lp[k] = value;
            }
        });
    };
    del(key) {
        key = key.split(">");
        return this._updateWorld(world => {
            let lp = null, p = world;
            for (let i = 0; i < key.length; ++i) {
                let k = key[i];
                lp = p; p = p[k];
                if (!p) return;
                if (i == key.length - 1)
                    return delete lp[k];
            }
        });
    };
};

class World extends EventDispatcher {
    static get config() { return worldDefaultConfig; };

    constructor({
        worldName = "My World",
        worldType = World.config.terrain,
        renderer = null,
        seed = Date.now(),
        storageId = null,
    } = {}) {
        super();
        if (storageId != null) {
            this.storager = new WorldStorage(storageId);
            seed = this.storager.get("seed");
            worldName = this.storager.get("name");
            worldType = this.storager.get("type");
            this.seed = seed;
            this.noise = new PerlinNoise(seed);
        }
        else {
            this.seed = seed;
            this.noise = new PerlinNoise(seed);
            storageId = this.noise.seed;
            this.storager = new WorldStorage(storageId);
            this.storager.set("name", worldName);
            this.storager.set("type", worldType);
            this.storager.set("seed", seed);
        }
        this.name = worldName;
        this.type = worldType;
        this.chunkMap = {};
        this.callbacks = {};
        let entities = this.storager.get("entities", []);
        if (entities.length) {
            this.entities = entities.map(entity => {
                switch (entity.type) {
                case "Player": return Player.from(entity).setWorld(this);
                // case "Entity": return Entity.from(entity).setWorld(this);
                }
            });
            let mainPlayerUid = this.storager.get("mainPlayer");
            this.mainPlayer = this.entities.find(ent => ent.uid == mainPlayerUid);
        }
        else {
            this.mainPlayer = new Player(this);
            this.entities = [this.mainPlayer];
            this.saveEntities();
            this.storager.set("mainPlayer", this.mainPlayer.uid);
        }
        this.renderer = renderer;
        for (let x = -2; x <= 2; ++x)
        for (let z = -2; z <= 2; ++z)
        for (let y = 2; y >= -2; --y)
            this.loadChunk(x, y, z);
        this.fluidCalculator = new FluidCalculator(this);
        this.lightingCalculator = new ChunksLightCalculation(this);
        this.setRenderer(renderer);
    };

    saveEntities() {
        this.storager.set("entities", this.entities.map(ent => ent.toObj()));
    };

    generator = (chunkX, chunkY, chunkZ, tileMap) => {
        switch(this.type) {
        case "flat":
            let block = Block.getBlockByBlockName(chunkY >= 0? "air":
                chunkX%2? chunkZ%2? "grass": "stone"
                : chunkZ%2? "stone": "grass");
            for (let i = 0; i < tileMap.length; ++i)
                tileMap[i] = block.longID;
            break;
        case "pre-classic": {
            const {X_SIZE, Y_SIZE, Z_SIZE} = Chunk;
            const noise = this.noise, fn = noise.gen2d.bind(noise);
            let air = Block.getBlockByBlockName("air"),
                stone = Block.getBlockByBlockName(
                    chunkY%2
                    ? chunkX%2
                        ? chunkZ%2? "grass": "stone"
                        : chunkZ%2? "stone": "grass"
                    : chunkX%2
                        ? chunkZ%2? "stone": "grass"
                        : chunkZ%2? "grass": "stone"
                );
            let fn3 = noise.gen3d.bind(noise);
            let elevations = [];
            for (let x = 0; x < X_SIZE; ++x)
            for (let z = 0; z < Z_SIZE; ++z) {
                let i = chunkX * X_SIZE + x, k = chunkZ * Z_SIZE + z;
                let elevation = (fn(i/200,k/200)+fn(i/50,k/50)/2+fn(i/10,k/10)/64)/2;
                elevation = Math.floor(elevation * 128);
                elevations[x] = elevations[x] || [];
                elevations[x][z] = elevation;
                for (let y = 0; y < Y_SIZE; ++y) {
                    let j = chunkY * Y_SIZE + y;
                    if (j < elevation) {
                        let n3 = (fn3(i / 16, j / 16, k / 16));
                        let n33 = (fn3(i/256,j/256,k/256) +fn3(i/128,j/128,k/128)/2 + fn3(i/64, j/64, k/64) / 4+fn3(i/25,j/25,k/25)/8);
                        let vein = (fn3(i / 5, j / 5, k / 5) + 1) / 2;
                        tileMap[Chunk.getLinearBlockIndex(x, y, z)] =
                            (vein < 0.18? air: n33 > 0 && n3 < -0.1? air: stone).longID;
                    }
                    else {
                        elevations.haveSurface = elevations.haveSurface || j === elevation;
                        tileMap[Chunk.getLinearBlockIndex(x, y, z)] = air.longID;
                    }
                }
            }
            let treeNoise = [], R = 5;
            for (let x = -R - 2; x < X_SIZE + R + 2; ++x)
            for (let z = -R - 2; z < Z_SIZE + R + 2; ++z) {
                let i = chunkX * X_SIZE + x, k = chunkZ * Z_SIZE + z;
                treeNoise[x] = treeNoise[x] || [];
                treeNoise[x][z] = (fn(k/10, i/10)+1)/2 + fn(k/5, i/5)/2;
            }
            let treePlacement = [], haveTreeAround = [];
            for (let x = -2; x < X_SIZE + 2; ++x)
            for (let z = -2; z < Z_SIZE + 2; ++z) {
                treePlacement[x] = treePlacement[x] || [];
                let max = -10;
                for (let a = -R; a <= R; ++a)
                for (let b = -R; b <= R; ++b) {
                    let t = treeNoise[x + a][z + b];
                    if (t > max) max = t;
                }
                treePlacement[x][z] = treeNoise[x][z] === max;
            }
            let afterEle = [];
            for (let x = 0; x < X_SIZE; ++x)
            for (let z = 0, y; z < Z_SIZE; ++z) {
                afterEle[x] = afterEle[x] || [];
                if (elevations[x][z] >= chunkY * Y_SIZE && elevations[x][z] < (chunkY + 1) * Y_SIZE) {
                    for (y = Chunk.getRelativeBlockXYZ(0, elevations[x][z], 0)[1]; y > 0; --y)
                        if (Block.getBlockByBlockLongID(tileMap[Chunk.getLinearBlockIndex(x, y - 1, z)]).name !== "air") {
                            elevations[x][z] = chunkY * Y_SIZE + y;
                            break;
                        }
                    if (y == -1) elevations[x][z] = chunkY * Y_SIZE;
                }
            }
            for (let x = 0; x < X_SIZE; ++x)
            for (let z = 0; z < Z_SIZE; ++z) {
                let f = true;
                for (let a = -2; a <= 2 && f; ++a)
                for (let b = -2; b <= 2 && f; ++b) {
                    if (treePlacement[x + a][z + b]) f = false;
                }
                haveTreeAround[x] = haveTreeAround[x] || [];
                haveTreeAround[x][z] = !f;
            }
            for (let x = 0; x < X_SIZE; ++x)
            for (let z = 0; z < Z_SIZE; ++z)
            for (let y = Y_SIZE - 1; y >= 0; --y) {
                if (Block.getBlockByBlockLongID(tileMap[Chunk.getLinearBlockIndex(x, y, z)]).name !== "air")
                    break;
                let elevation = elevations[x][z];
                let j = chunkY * Y_SIZE + y;
                let flowerPlacement = treeNoise[x][z] < 0.15;
                if (treePlacement[x][z] && j - elevation < 5 && elevations.haveSurface)
                    tileMap[Chunk.getLinearBlockIndex(x, y, z)] = Block.getBlockByBlockName("oak_log").longID;
                else if (j - elevation < 7 && j - elevation > 3 && haveTreeAround[x][z] !== false)
                    tileMap[Chunk.getLinearBlockIndex(x, y, z)] = Block.getBlockByBlockName("oak_leaves").longID;
                else if (flowerPlacement && j <= elevation && y > 0 && elevations.haveSurface
                && Block.getBlockByBlockLongID(tileMap[Chunk.getLinearBlockIndex(x, y - 1, z)]).name !== "air")
                    tileMap[Chunk.getLinearBlockIndex(x, y, z)] = Block.getBlockByBlockName("dandelion").longID;
            }
            break;}
        }
        let ck = Chunk.chunkKeyByChunkXYZ(chunkX, chunkY, chunkZ);
        let data = this.storager.get("chunks>" + ck, {});
        for (let lb in data) {
            tileMap[lb] = new LongID(data[lb]);
        }
    };
    setRenderer(renderer = null) {
        if (!renderer) return;
        this.renderer = renderer;
        for (let ck in this.chunkMap) {
            this.chunkMap[ck].setRenderer(renderer);
        }
    };
    getChunkByChunkKey(chunkKey) {
        return this.chunkMap[chunkKey] || null;
    };
    getChunkByChunkXYZ(chunkX, chunkY, chunkZ) {
        return this.getChunkByChunkKey(Chunk.chunkKeyByChunkXYZ(chunkX, chunkY, chunkZ));
    };
    getChunkByBlockXYZ(blockX, blockY, blockZ) {
        return this.getChunkByChunkKey(Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ));
    };
    loadChunk(chunkX, chunkY, chunkZ) {
        let ck = Chunk.chunkKeyByChunkXYZ(chunkX, chunkY, chunkZ),
            chunk = this.chunkMap[ck];
        if (chunk) return chunk;
        chunk = this.chunkMap[ck] = new Chunk(this, chunkX, chunkY, chunkZ);
        this.dispatchEvent("onChunkLoad", chunk);
        return chunk;
    };

    getTile(blockX, blockY, blockZ) {
        [blockX, blockY, blockZ] = [blockX, blockY, blockZ].map(Math.floor);
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) return c.getTile(...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ));
        return null;
    };
    setTile(blockX, blockY, blockZ, id, bd) {
        [blockX, blockY, blockZ] = [blockX, blockY, blockZ].map(Math.floor);
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) {
            let t = c.setTile(...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ), id, bd);
            this.dispatchEvent("onTileChanges", blockX, blockY, blockZ);
            return t;
        }
        return null;
    };
    getBlock(blockX, blockY, blockZ) {
        [blockX, blockY, blockZ] = [blockX, blockY, blockZ].map(Math.floor);
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) return c.getBlock(...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ));
        return null;
    };
    setBlock(blockX, blockY, blockZ, blockName) {
        [blockX, blockY, blockZ] = [blockX, blockY, blockZ].map(Math.floor);
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) {
            let rxyz = Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ);
            let t = c.setBlock(...rxyz, blockName);
            let data = this.storager.get("chunks>" + c.chunkKey, {});
            data[Chunk.getLinearBlockIndex(...rxyz)] = this.getTile(blockX, blockY, blockZ);
            this.storager.set("chunks>" + c.chunkKey, data);
            this.saveEntities();
            this.dispatchEvent("onTileChanges", blockX, blockY, blockZ);
            return t;
        }
        return null;
    };
    getLight(blockX, blockY, blockZ) {
        [blockX, blockY, blockZ] = [blockX, blockY, blockZ].map(Math.floor);
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) return c.getLight(...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ));
        return null;
    };
    getSkylight(blockX, blockY, blockZ) {
        [blockX, blockY, blockZ] = [blockX, blockY, blockZ].map(Math.floor);
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) return c.getSkylight(...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ));
        return null;
    };
    getTorchlight(blockX, blockY, blockZ) {
        [blockX, blockY, blockZ] = [blockX, blockY, blockZ].map(Math.floor);
        let c = this.chunkMap[Chunk.chunkKeyByBlockXYZ(blockX, blockY, blockZ)];
        if (c) return c.getTorchlight(...Chunk.getRelativeBlockXYZ(blockX, blockY, blockZ));
        return null;
    };
    update(dt) {
        for (let ck in this.chunkMap) {
            this.chunkMap[ck].update(dt);
        }
        this.fluidCalculator.update(dt);
        this.lightingCalculator.update(dt);
        this.entities.forEach(e => e.update(dt));

        const {mainPlayer} = this;

        const hit = mainPlayer.controller.getHitting?.() ?? null;
        let block = hit? this.getBlock(...hit.blockPos): null;
        let longID = hit? this.getTile(...hit.blockPos): null;
        let chunk = this.getChunkByBlockXYZ(...[...mainPlayer.position].map(n => n < 0? n - 1: n));
        if (!this.fpss) this.fpss = [];
        this.fpss.push(dt);
        if (this.fpss.length > 15) this.fpss.shift();
        document.getElementsByTagName("mcpage-play")[0].debugOutput.innerHTML = Object.entries({
            "FPS: ": (1000 / (this.fpss.reduce((n, i) => n + i, 0) / this.fpss.length)).toFixed(2),
            "Player:": [
                "XYZ: " + [...mainPlayer.position].map(n => n.toFixed(1)).join(", "),
                `Pitch: ${radian2degree(mainPlayer.pitch).toFixed(2)}°, Yaw: ${Math.abs(radian2degree(mainPlayer.yaw) * 100 % 36000 / 100).toFixed(2)}°`,
                `Chunk: ${chunk? Chunk.getRelativeBlockXYZ(...mainPlayer.position).map(n => ~~n).join(" ") + " in " + [chunk.x, chunk.y, chunk.z].join(" "): "null"}`,
                `Light: ${this.getLight(...mainPlayer.position)} (${this.getSkylight(...mainPlayer.position)} sky, ${this.getTorchlight(...mainPlayer.position)} block)`,
            ],
            "Crosshairs:": [
                "XYZ: " + (hit? hit.blockPos.join(", "): "null") + " (" + (hit? hit.axis? hit.axis: "in block": "null") + ")",
                `Block: ${block? block.name: "null"} (${longID?.id ?? "null"}, ${longID?.bd ?? "null"}, ${longID? longID: "null"})`,
            ],
        }).map(([k, v]) => `<p>${k}${
            Array.isArray(v)
            ? v.map(str => `<p>\t${str}</p>`).join("")
            : v
        }</p>`).join("");

        let cxyz = Chunk.getChunkXYZByBlockXYZ(...mainPlayer.position),
            [cx, cy, cz] = cxyz;
        if (vec3.exactEquals(cxyz, mainPlayer.lastChunk || []))
            for (let dx = -1; dx <= 1; ++dx)
            for (let dz = -1; dz <= 1; ++dz)
            for (let dy = 1; dy >= -1; --dy)
                this.loadChunk(cx + dx, cy + dy, cz + dz);
        mainPlayer.lastChunk = cxyz;

        // 每 20s 存一次实体信息
        if (Date.now() - (this.lastEntitiesSaveTime || 0) > 20_000) {
            this.lastEntitiesSaveTime = Date.now();
            this.saveEntities();
        }
    };
    // return null->uncollision    else -> { axis->("x+-y+-z+-": collision face, "": in block, b)lockPos}
    rayTraceBlock(start, end, chunkFn) {
        if (start.some(Number.isNaN) || end.some(Number.isNaN) || vec3.equals(start, end))
            return null;
        if (chunkFn(...start.map(Math.floor))) return {
            axis: "", blockPos: start.map(Math.floor)
        };
        let vec = vec3.subtract(end, start, end),
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
                if(chunkFn(x, y, z)) return {
                    axis: axis,
                    step: step[axis],
                    pos:  lead[axis] + way * (vec[axis] / len),
                };
        }
        return null;
    };
};

export {
    World as default,
    World,
};
