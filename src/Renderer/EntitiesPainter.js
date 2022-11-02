// 负责实体模型的绘制

import { EntityItemModel } from "./EntityItemModel.js";
import * as glsl from "./glsl.js";
import { Block } from "../World/Block.js";

class EntitiesPainter {
    constructor(world, renderer) {
        this.models = new Set();
        this.setRenderer(renderer);
        this.setWorld(world);
    };
    onAddEntity = (entity) => {
        if (!entity.isItem) return;
        this.models.add(new EntityItemModel(entity, this.renderer));
    };
    setWorld(world = null) {
        if (this.world === world) return;
        if (this.world) {
            for (let model of this.models)
                model.dispose();
            this.world.removeEventListener("onAddEntity", this.onAddEntity);
        }
        this.world = world;
        this.models.clear();
        if (!world) return;
        for (let entity of world.entities) {
            if (!entity.isItem) continue;
            this.models.add(new EntityItemModel(entity, this.renderer));
        }
        world.addEventListener("onAddEntity", this.onAddEntity);
    };
    setRenderer(renderer = null) {
        if (this.renderer === renderer) return;
        if (this.renderer) {
            for (let model of this.models)
                model.setRenderer();
        }
        this.renderer = renderer;
        if (!renderer) return;
        if (renderer.isWebGL2) {
            renderer.createProgram("entityItem", glsl.entityItem_webgl2.vert, glsl.entityItem_webgl2.frag)
                .use().bindTex("blockTex", renderer.createTextureArray(Block.defaultBlockTextureImg));
        }
        else {}
        for (let model of this.models)
            model.setRenderer(renderer);
    };
    update(timestamp, dt) {
        for (let model of this.models) {
            model.update(timestamp, dt);
        }
    };
    draw() {
        for (let model of this.models) {
            model.draw();
        }
    };
    dispose() {
        this.setWorld();
    };
};

export {
    EntitiesPainter as default,
    EntitiesPainter,
};
