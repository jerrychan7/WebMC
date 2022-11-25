import { Block } from "../World/Block.js";
import { mat4 } from "../utils/math/index.js";
import * as glsl from "./glsl.js";
import { calCol } from "./WorldChunkModule.js";

class HighlightSelectedBlock {
    constructor(world, renderer = world.renderer) {
        this.world = world;
        this.mvp = mat4.identity();
        this.setRenderer(renderer);
    };
    #calcMesh() {
        const {renderer} = this, {ctx} = this.renderer;
        this.meshs = new Map();
        for (let renderType of Object.values(Block.renderType)) {
            let isFluid = renderType === Block.renderType.FLUID;
            if (isFluid) renderType = Block.renderType.NORMAL;
            let blockEles = Block.getElementsByRenderType(renderType);
            let lineVer = [], vers = Block.getVerticesByRenderType(renderType), surfaceMesh = {};
            for (let f in vers) {
                if (renderType !== Block.renderType.CACTUS || (f != "y+" && f != "y-"))
                    lineVer.push(...vers[f]);
                surfaceMesh[f] = {
                    ver: renderer.createVbo(vers[f]),
                    ele: renderer.createIbo(blockEles[f]),
                    col: renderer.createVbo([], ctx.DYNAMIC_DRAW),
                };
            }
            let lineEle = (len => {
                if (!len) return [];
                let base = [0,1, 1,2, 2,3, 3,0], out = [];
                for(let i = 0, j = 0; i < len; j = ++i*4)
                    out.push(...base.map(x => x + j));
                return out;
            })(lineVer.length / 12);
            let defaultCol = [...Array(lineVer.length / 3 * 4)].map((_, i) => i % 4 === 3? 0.5: 1.0);
            if (isFluid) renderType = Block.renderType.FLUID;
            this.meshs.set(renderType, {
                line: {
                    ver: renderer.createVbo(lineVer),
                    ele: renderer.createIbo(lineEle),
                    defaultCol: renderer.createVbo(defaultCol),
                    col: renderer.createVbo([], ctx.DYNAMIC_DRAW),
                },
                surface: surfaceMesh,
            });
        }
    };
    setRenderer(renderer = null) {
        if (!renderer) return;
        // to free buffer
        if (this.renderer) this.dispose();
        this.renderer = renderer;
        renderer.createProgram("selector", glsl.selector.vert, glsl.selector.frag);
        this.#calcMesh();
    };
    draw() {
        const {world} = this, {mainPlayer} = world;
        if (mainPlayer.camera === null) return;
        const hit = mainPlayer.controller.getHitting?.() ?? null;
        if (hit === null) return;

        const {renderer} = this, {ctx} = renderer;
        let [bx, by, bz] = hit.blockPos,
            block = world.getBlock(bx, by, bz),
            selector = renderer.getProgram("selector").use(),
            linecol = [], surfaceCol = [];
        mat4(this.mvp).E().translate(hit.blockPos).postMul(mainPlayer.camera.projview);
        selector.setUni("mvp", this.mvp);
        let mesh = this.meshs.get(block.renderType), lineMesh = mesh.line, surfaceMeshs = mesh.surface;
        switch (block.renderType) {
        case Block.renderType.FLUID:
        case Block.renderType.CACTUS:
        case Block.renderType.NORMAL: {
            if (!hit.axis) break;
            let [dx, dy, dz] = ({"x+":[1,0,0], "x-":[-1,0,0], "y+":[0,1,0], "y-":[0,-1,0], "z+":[0,0,1], "z-":[0,0,-1]})[hit.axis];
            let l = world.getLight(bx + dx, by + dy, bz + dz), col = Math.min(1, calCol(l) + 0.1);
            linecol = [...Array(lineMesh.ver.length / 3 * 4)]
                .map((_, i) => i % 4 === 3? 0.4: col);
            surfaceCol = [...Array(surfaceMeshs[hit.axis].ver.length / 3 * 4)]
                .map((_, i) => i % 4 === 3? 0.1: col);
            break; }
        case Block.renderType.FLOWER: {
            let l = world.getLight(bx, by, bz), col = Math.min(1, calCol(l) + 0.1);
            linecol = [...Array(lineMesh.ver.length / 3 * 4)]
                .map((_, i) => i % 4 === 3? 0.4: col);
            surfaceCol = [...Array(surfaceMeshs.face.ver.length / 3 * 4)]
                .map((_, i) => i % 4 === 3? 0.1: col);
            break; }
        }
        let lineColBO = lineMesh.defaultCol;
        if (linecol.length) {
            lineColBO = lineMesh.col;
            renderer.bindBoData(lineColBO, linecol, {drawType: ctx.DYNAMIC_DRAW});
        }
        // draw line
        ctx.enable(ctx.BLEND);
        ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
        ctx.bindBuffer(lineMesh.ele.type, lineMesh.ele);
        selector.setAtt("pos", lineMesh.ver).setAtt("col", lineColBO);
        ctx.drawElements(ctx.LINES, lineMesh.ele.length, ctx.UNSIGNED_SHORT, 0);
        ctx.disable(ctx.BLEND);
        
        if (!hit.axis) return;
        let surfaceMesh = block.renderType === Block.renderType.FLOWER
                ? surfaceMeshs.face
                : surfaceMeshs[hit.axis],
            surfaceColBO = surfaceMesh.col;
        renderer.bindBoData(surfaceColBO, surfaceCol, {drawType: ctx.DYNAMIC_DRAW});
        // draw surface
        ctx.disable(ctx.CULL_FACE);
        ctx.enable(ctx.BLEND);
        ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
        ctx.enable(ctx.POLYGON_OFFSET_FILL);
        ctx.polygonOffset(-1.0, -1.0);
        ctx.depthMask(false);
        ctx.bindBuffer(surfaceMesh.ele.type, surfaceMesh.ele);
        selector.setAtt("pos", surfaceMesh.ver).setAtt("col", surfaceColBO);
        ctx.drawElements(ctx.TRIANGLES, surfaceMesh.ele.length, ctx.UNSIGNED_SHORT, 0);
        ctx.depthMask(true);
        ctx.disable(ctx.POLYGON_OFFSET_FILL);
        ctx.disable(ctx.BLEND);
        ctx.enable(ctx.CULL_FACE);
    };
    dispose() {
        const {ctx} = this.renderer;
        for (let [, mesh] of this.meshs) {
            for (let k of ["ver", "ele", "col"]) {
                ctx.deleteBuffer(mesh.line[k]);
                Object.values(mesh.surface).forEach(surfaceMesh => ctx.deleteBuffer(surfaceMesh[k]));
            }
            ctx.deleteBuffer(mesh.line.defaultCol);
        }
    };
};

export {
    HighlightSelectedBlock as default,
    HighlightSelectedBlock,
};
