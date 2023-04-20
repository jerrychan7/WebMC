// 负责计算顶点，材质坐标，以及区块的绘制工作
import { Block } from "../World/Block.js";
import { 
    Chunk,
    CHUNK_X_SIZE as X_SIZE,
    CHUNK_Y_SIZE as Y_SIZE,
    CHUNK_Z_SIZE as Z_SIZE,
} from "../World/Chunk.js";
import { settings } from "../settings.js";
import { manhattanDis } from "../utils/math/index.js";
import { BlockModuleBuilder, calCol, genColArr } from "./BlockModuleBuilder.js";
import * as glsl from "./glsl.js";

class ChunksModule {
    constructor(world, renderer) {
        /** meshes is a map for chunk key and buffer objects: chunkKey => {
         *     normal|disableCullFace|fluidSurface: {
         *         ver[], col[], tex[], ele[],
         *     }
         * }
         */
        this.meshes = {};
        this.needUpdateMeshChunks = new Set();
        this.needUpdateColMeshChunks = new Set();
        this.needUpdateTile = new Set();
        this.setRenderer(renderer);
        this.setWorld(world);
        settings.addEventListener("changedValue", this.onSettingsChange);
    };
    setWorld(world = null) {
        if (this.world === world) return;
        if (this.world) {
            this.blockModuleBuilder.dispose();
        }
        this.world = world;
        if (!world) return;
        this.blockModuleBuilder = new BlockModuleBuilder(world);
        for (let chunkKey in world.chunkMap)
            this.buildChunkModule(chunkKey);
        world.addEventListener("onTileChanges", this.updateTile.bind(this));
        world.addEventListener("onChunkLoad", chunk => {
            this.buildChunkModule(chunk.chunkKey);
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                this.buildChunkModule(Chunk.chunkKeyByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz));
            }
        });
    };
    onSettingsChange = (key, value) => {
        if (!this.world) return;
        if (key === "shade") {
            for (let chunkKey in this.world.chunkMap)
                this.updateLight(chunkKey);
        }
        this.onRender();
        this.renderer.draw();
    };
    setRenderer(renderer = null) {
        if (this.renderer === renderer) return;
        if (this.renderer) {
            Object.values(this.meshes).forEach((mesh) => {
                for (let k of ["ver", "col", "tex", "ele"]) {
                    this.renderer.delBo(mesh.normal[k]);
                    this.renderer.delBo(mesh.disableCullFace[k]);
                    this.renderer.delBo(mesh.fluidSurface[k]);
                }
            });
            this.meshes = {};
        }
        this.renderer = renderer;
        if (!renderer) return;
        if (renderer.isWebGL2)
            renderer.createProgram("showBlock", glsl.showBlock_webgl2.vert, glsl.showBlock_webgl2.frag)
                .use().bindTex("blockTex", renderer.createTextureArray(Block.defaultBlockTextureImg));
        else
            renderer.createProgram("showBlock", glsl.showBlock.vert, glsl.showBlock.frag)
                .use().bindTex("blockTex", renderer.createTexture(Block.defaultBlockTextureImg));
        this.updateMeshs();
    };
    buildChunkModule(chunkKey) {
        const world = this.world, chunk = world.getChunkByChunkKey(chunkKey);
        if (chunk === null) return;
        for (let cry = 0; cry < Y_SIZE; ++cry)
        for (let crz = 0; crz < Z_SIZE; ++crz)
        for (let crx = 0; crx < X_SIZE; ++crx) {
            this.blockModuleBuilder.gen(...chunk.blockRXYZ2BlockXYZ(crx, cry, crz), { chunk, crx, cry, crz, });
        }
        chunk.updatedLightMap = false;
        this.needUpdateMeshChunks.add(chunkKey);
    };
    updateTile(blockX, blockY, blockZ) {
        this.needUpdateTile.add([blockX, blockY, blockZ].join(","));
    };
    // 和 buildChunkModule 不同 该函数会同时更新周围方块的信息
    // 而 buildChunkModule 直接重新构建 就不存在更新周围的情况
    updateTiles(blockXYZs = this.needUpdateTile) {
        const { blockModuleBuilder, needUpdateMeshChunks } = this;
        blockXYZs.forEach((str) => {
            const [blockX, blockY, blockZ] = str.split(",").map(s => +s);
            const cChunkKey = blockModuleBuilder.gen(blockX, blockY, blockZ);
            for (const [dx, dy, dz, inverseFace] of [[1,0,0,"x-"], [-1,0,0,"x+"], [0,1,0,"y-"], [0,-1,0,"y+"], [0,0,1,"z-"], [0,0,-1,"z+"]]) {
                const awx = blockX + dx, awy = blockY + dy, awz = blockZ + dz;
                if (blockXYZs.has([awx, awy, awz].join(","))) continue;
                const aChunkKey = blockModuleBuilder.gen(awx, awy, awz, { justUpdateFaces: [[-dx, -dy, -dz, inverseFace]], });
                if (aChunkKey) needUpdateMeshChunks.add(aChunkKey);
            }
            // TODO: 更新斜对角液体顶点
            if (cChunkKey) needUpdateMeshChunks.add(cChunkKey);
        });
        blockXYZs.clear();
    };
    updateLight(chunkKey) {
        const chunk = this.world.getChunkByChunkKey(chunkKey);
        if (!chunk) return;
        this.blockModuleBuilder.updateChunkColor(chunk);
        this.needUpdateColMeshChunks.add(chunkKey);
    };
    updateMeshs() {
        const { meshes, blockModuleBuilder, updateMesh } = this;
        for (let chunkKey in meshes)
            updateMesh(chunkKey, blockModuleBuilder.getMeshArrays(chunkKey));
    };
    updateMesh(chunkKey, meshArrays = null) {
        if (meshArrays == null) return delete this.meshes[chunkKey];
        let mesh = this.meshes[chunkKey];
        if (!mesh) mesh = this.meshes[chunkKey] = {};
        const { renderer } = this;
        for (const group of ["disableCullFace", "fluidSurface", "normal"]) {
            let meshGroup = mesh[group];
            if (!meshGroup) {
                meshGroup = mesh[group] = {};
                for (const type of ["ver", "col", "tex", "ele"])
                    if (type == "ele")
                        meshGroup[type] = renderer.createIbo([]);
                    else meshGroup[type] = renderer.createVbo([]);
            }
            // 如果存在某一group ("disableCullFace|fluidSurface|normal")
            //     则覆盖group中存在的type ("ver|col|tex|ele")
            // 否则 认为该group中没有任何三角形 删除所有的数据 (绑定空数组)
            const maGroup = meshArrays[group];
            if (maGroup) for (const type in maGroup) {
                renderer.bindBoData(meshGroup[type], maGroup[type]);
            }
            else for (const type in meshGroup) {
                renderer.bindBoData(meshGroup[type], []);
            }
        }
    };
    onRender(timestamp, dt) {
        if (this.needUpdateTile.size)
            this.updateTiles(this.needUpdateTile);
        // rebuild light
        Object.values(this.world.chunkMap)
        .filter(chunk => chunk.updatedLightMap)
        .forEach(chunk => {
            chunk.updatedLightMap = false;
            const chunkKey = chunk.chunkKey;
            this.updateLight(chunkKey);
            // 这里无脑重新生成了 可以尝试在更新单个体素光照的时候判断光是否影响到了其他区块的显示
            for (let [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]])
                this.updateLight(Chunk.chunkKeyByChunkXYZ(chunk.x + dx, chunk.y + dy, chunk.z + dz));
        });
        if (this.needUpdateColMeshChunks.size) {
            this.needUpdateColMeshChunks.forEach(chunkKey => {
                if (this.needUpdateMeshChunks.has(chunkKey)) return;
                this.updateMesh(chunkKey, this.blockModuleBuilder.getMeshArrays(chunkKey, true));
            });
            this.needUpdateColMeshChunks.clear();
        }
        if (this.needUpdateMeshChunks.size === 0) return;
        this.needUpdateMeshChunks.forEach(chunkKey => {
            this.updateMesh(chunkKey, this.blockModuleBuilder.getMeshArrays(chunkKey));
        });
        this.needUpdateMeshChunks.clear();
    };
    onTick() {};
    draw() {
        const {renderer} = this, {ctx} = renderer;
        const prg = renderer.getProgram("showBlock");
        prg.use()
        // .setUni("vMatrix", renderer.mainCamera.view)
        // .setUni("pMatrix", renderer.mainCamera.projection)
        .setUni("mvMatrix", renderer.mainCamera.view)
        .setUni("mvpMatrix", renderer.mainCamera.projview)
        .setUni("fogColor", [0.62, 0.81, 1.0, 1.0])
        // 3 ~ 4 chunks
        .setUni("fogNear", 48)
        .setUni("fogFar", 64);
        // 由近到远绘制 为了半透明的水能正常显示【虽然失败了
        const mainPlayer = this.world.mainPlayer;
        let chunk = this.world.getChunkByBlockXYZ(...[...mainPlayer.position].map(n => n < 0? n - 1: n));
        const meshes = Object.entries(this.meshes).map(([chunkKey, mesh]) => {
            const chunkPos = Chunk.getChunkXYZByChunkKey(chunkKey);
            return {
                chunkKey, mesh, chunkPos,
                dis: manhattanDis(chunkPos, [chunk.x, chunk.y, chunk.z]),
            };
        });
        meshes.sort((a, b) => b.dis - a.dis);
        for (const { mesh } of meshes) {
            let bufferObj = mesh.normal;
            if (bufferObj.ele.length) {
                prg.setAtt("position", bufferObj.ver)
                    .setAtt("color", bufferObj.col)
                    .setAtt("textureCoord", bufferObj.tex);
                ctx.bindBuffer(bufferObj.ele.type, bufferObj.ele);
                // ctx.drawElements(ctx.LINES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.drawElements(ctx.TRIANGLES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
            }
            bufferObj = mesh.disableCullFace;
            if (bufferObj.ele.length) {
                prg.setAtt("position", bufferObj.ver)
                    .setAtt("color", bufferObj.col)
                    .setAtt("textureCoord", bufferObj.tex);
                ctx.disable(ctx.CULL_FACE);
                ctx.enable(ctx.POLYGON_OFFSET_FILL);
                ctx.polygonOffset(1.0, 1.0);
                ctx.enable(ctx.BLEND);
                ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
                ctx.bindBuffer(bufferObj.ele.type, bufferObj.ele);
                // ctx.drawElements(ctx.LINES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.drawElements(ctx.TRIANGLES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.blendFunc(ctx.ONE, ctx.ZERO);
                ctx.disable(ctx.BLEND);
                ctx.disable(ctx.POLYGON_OFFSET_FILL);
                ctx.enable(ctx.CULL_FACE);
            }
        }
        for (const { mesh } of meshes) {
            let bufferObj = mesh.fluidSurface;
            if (bufferObj.ele.length) {
                prg.setAtt("position", bufferObj.ver)
                    .setAtt("color", bufferObj.col)
                    .setAtt("textureCoord", bufferObj.tex);
                ctx.depthMask(false);
                if (mainPlayer.eyeInFluid)
                    ctx.disable(ctx.CULL_FACE);
                ctx.disable(ctx.POLYGON_OFFSET_FILL);
                ctx.polygonOffset(1.0, 1.0);
                ctx.enable(ctx.BLEND);
                ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
                ctx.bindBuffer(bufferObj.ele.type, bufferObj.ele);
                // ctx.drawElements(ctx.LINES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.drawElements(ctx.TRIANGLES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
                ctx.blendFunc(ctx.ONE, ctx.ZERO);
                ctx.disable(ctx.BLEND);
                ctx.disable(ctx.POLYGON_OFFSET_FILL);
                if (mainPlayer.eyeInFluid)
                    ctx.enable(ctx.CULL_FACE);
                ctx.depthMask(true);
            }
        }
    };
    dispose() {
        this.setRenderer();
        this.blockModuleBuilder.dispose();
        settings.removeEventListener("changedValue", this.onSettingsChange);
    };
};

export {
    ChunksModule,
    ChunksModule as default,
    genColArr,
    calCol,
};
