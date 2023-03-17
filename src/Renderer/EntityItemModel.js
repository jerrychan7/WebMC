
import { Block } from "../World/Block.js";
import { genColArr, calCol } from "./WorldChunkModule.js";
import { mat4, degree2radian as d2r } from "../utils/math/index.js";

// Block => textureUV, block render type => { ver, ele, defaultTexUV, defaultColor }
const blockMeshs = new Map();
Block.preloaded.then(() => {
    const blocks = Block.listBlocks();
    for (let block of blocks) {
        const brt = block.renderType, texUV = [];
        const needGenBRTMesh = !blockMeshs.has(brt)? true: null;
        const brtMesh = needGenBRTMesh && {
            ver: [], ele: [], defaultTex: [], defaultCol: [],
        };
        const defBlockTexUV = needGenBRTMesh && Block.getTexUVByTexCoord({ renderType: brt, });
        switch (brt) {
        case Block.renderType.CACTUS:
        case Block.renderType.NORMAL: {
            let totalVer = 0;
            // 这里假设所有相同渲染类型的方块拥有相同的face顺序
            for (let face in block.vertices) {
                const vs = block.vertices[face];
                brtMesh?.ver.push(...vs);
                brtMesh?.ele.push(...block.elements[face].map(e => e + totalVer));
                brtMesh?.defaultTex.push(...defBlockTexUV.uv[face]);
                texUV.push(...block.texture.uv[face]);
                totalVer += vs.length / 3;
            }
            break; }
        }
        brtMesh?.defaultCol.push(...genColArr(brtMesh.ver.length / 3, 15));
        blockMeshs.set(block, texUV);
        if (needGenBRTMesh) blockMeshs.set(brt, brtMesh);
    }
});

// Render => createVBO/IBO(blockMeshs)
const boCache = new WeakMap();

// TODO: 用AVO和instanced drawing来加速大量物体渲染
// instanced drawing: https://webgl2fundamentals.org/webgl/lessons/webgl-instanced-drawing.htmls
class EntityItemModel {
    constructor(entityItem, renderer) {
        this.entity = entityItem;
        entityItem.model = this;
        this.setRenderer(renderer);
        this.lastLight = -1;
        this.col = [];
        this.randomStart = Math.random() * 360 * 36 * 540;
        this.mM = mat4.identity();
    };
    setRenderer(renderer = null) {
        if (this.renderer === renderer) return;
        this.renderer = renderer;
        this.bufferObj = {};
        if (!renderer) return;
        if (!boCache.has(renderer)) {
            let bo = new Map();
            for (let [key, val] of blockMeshs) {
                if (key instanceof Block) {
                    bo.set(key, renderer.createVbo(val));
                }
                else {
                    bo.set(key, {
                        ver: renderer.createVbo(val.ver),
                        ele: renderer.createIbo(val.ele),
                        defaultTex: renderer.createVbo(val.defaultTex),
                        defaultCol: renderer.createVbo(val.defaultCol),
                    });
                }
            }
            boCache.set(renderer, bo);
        }
        const blockMeshsBo = boCache.get(renderer);
        const block = Block.getBlockByBlockLongID(this.entity.longID);
        const brtMeshBo = blockMeshsBo.get(block.renderType);
        this.bufferObj = {
            ver: brtMeshBo.ver,
            ele: brtMeshBo.ele,
            tex: blockMeshsBo.get(block) || brtMeshBo.defaultTex,
            col: renderer.createVbo([], renderer.ctx.DYNAMIC_DRAW),
        };
    };
    update(timestamp, dt) {
        const l = this.entity.world.getLight(...this.entity.position);
        if (this.lastLight != l) {
            this.lastLight = l;
            const verNum = this.bufferObj.ver.length / 3;
            this.col = genColArr(verNum, l, l => Math.min(1, calCol(l) + 0.06));
            this.renderer.bindBoData(this.bufferObj.col, this.col, { drawType: this.renderer.ctx.DYNAMIC_DRAW });
        }
        this.randomStart += dt;
    };
    draw() {
        if (!this.renderer) return;
        const {renderer, bufferObj, mM, entity} = this, {ctx} = renderer;
        const prg = renderer.getProgram("entityItem");
        mat4(mM).E().translate(entity.position)
            .rotate(d2r(this.randomStart / 36), [0, 1, 0])
            .scale([.25, .25, .25])
            .translate([-.5, Math.sin(this.randomStart / 540) * 0.5 + 1.125, -.5]);
        prg.use()
            .setUni("mMatrix", mM)
            .setUni("vMatrix", renderer.mainCamera.view)
            .setUni("pMatrix", renderer.mainCamera.projection)
            .setUni("fogColor", [0.62, 0.81, 1.0, 1.0])
            // 3 ~ 4 chunks
            .setUni("fogNear", 48)
            .setUni("fogFar", 64)
            .setAtt("position", bufferObj.ver)
            .setAtt("color", bufferObj.col)
            .setAtt("textureCoord", bufferObj.tex);
        ctx.bindBuffer(bufferObj.ele.type, bufferObj.ele);
        ctx.drawElements(ctx.TRIANGLES, bufferObj.ele.length, ctx.UNSIGNED_SHORT, 0);
    };
    dispose() {
        this.setRenderer();
    };
};

export {
    EntityItemModel as default,
    EntityItemModel,
};
