import { Render } from "./Render.js";
import { Camera } from "./Camera.js";
import { ChunksModule } from "./WorldChunkModule.js";
import { HighlightSelectedBlock } from "./HighlightSelectedBlock.js";
import { EntitiesPainter } from "./EntitiesPainter.js";

class WorldRenderer extends Render {
    constructor(canvas, world = null) {
        super(canvas);
        this.fitScreen();
        new ResizeObserver(async e => {
            await new Promise(s => setTimeout(s, 0));
            this.fitScreen();
        }).observe(canvas);
        const {ctx} = this;
        ctx.clearColor(0.62, 0.81, 1.0, 1.0);
        ctx.clearDepth(1.0);
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
        ctx.enable(ctx.DEPTH_TEST);
        ctx.depthFunc(ctx.LEQUAL);
        ctx.enable(ctx.CULL_FACE);
        ctx.frontFace(ctx.CCW);
        this.mainCamera = new Camera(this.aspectRatio, { fovy: 60, pitch: -90 * Math.PI / 180, position: [0, 20, 0] });
        this.addCamera(this.mainCamera);
        if (world !== null) this.setWorld(world);
    };
    setWorld(world) {
        if ((!world) || world === this.world) return;
        world.setRenderer(this);
        this.world = world;
        this.mainCamera.bindEntity(world.mainPlayer);
        this.chunksModule = new ChunksModule(world, this);
        this.blockHighlight = new HighlightSelectedBlock(world, this);
        this.entitiesPainter = new EntitiesPainter(world, this);
    };
    onRender(timestamp, dt) {
        this.world.update(dt);
        this.chunksModule.update();
        this.entitiesPainter.update(timestamp, dt);
        const {ctx} = this;
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
        this.chunksModule.draw();
        this.entitiesPainter.draw();
        this.blockHighlight.draw();
        ctx.flush();
    };
    dispose() {
        super.dispose();
        if (!this.world) return;
        this.chunksModule.dispose();
        this.blockHighlight.dispose();
    };
};

export {
    WorldRenderer,
    WorldRenderer as dafault
};
