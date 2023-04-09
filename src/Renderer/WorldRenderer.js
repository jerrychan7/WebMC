import { Render } from "./Render.js";
import { Camera } from "./Camera.js";
import { ChunksModule } from "./WorldChunkModule.js";
import { HighlightSelectedBlock } from "./HighlightSelectedBlock.js";
import { EntitiesPainter } from "./EntitiesPainter.js";
import { settings } from "../settings.js";

class WorldRenderer extends Render {
    constructor(canvas, world = null) {
        super(canvas);
        this.fitScreen();
        new ResizeObserver(async e => {
            await new Promise(s => setTimeout(s, 0));
            this.fitScreen();
            this.draw();
        }).observe(canvas);
        const {ctx} = this;
        ctx.clearColor(0.62, 0.81, 1.0, 1.0);
        ctx.clearDepth(1.0);
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
        ctx.enable(ctx.DEPTH_TEST);
        ctx.depthFunc(ctx.LEQUAL);
        ctx.enable(ctx.CULL_FACE);
        ctx.frontFace(ctx.CCW);
        this.mainCamera = new Camera(this.aspectRatio, { fovy: settings.fov, pitch: -90 * Math.PI / 180, position: [0, 20, 0] });
        this.settingsListenerID = settings.addEventListener("changedValue", (key, value) => {
            if (key !== "fov") return;
            this.mainCamera.setFovy(value);
            this.draw();
        });
        this.addCamera(this.mainCamera);
        if (world !== null) this.setWorld(world);
    };
    setWorld(world = null) {
        if (world === this.world) return; this
        const lastWorld = this.world;
        this.world = world;
        if (lastWorld) {
            lastWorld.setRenderer();
            this.mainCamera.bindEntity();
            this.chunksModule.dispose();
            this.blockHighlight.dispose();
            this.entitiesPainter.dispose();
            this.chunksModule = this.blockHighlight = this.entitiesPainter = null;
        }
        if (!world) return this;
        world.setRenderer(this);
        this.mainCamera.bindEntity(world.mainPlayer);
        this.chunksModule = new ChunksModule(world, this);
        this.blockHighlight = new HighlightSelectedBlock(world, this);
        this.entitiesPainter = new EntitiesPainter(world, this);
        return this;
    };
    onRender(timestamp, dt) {
        this.world?.onRender(timestamp, dt);
        this.chunksModule?.onRender(timestamp, dt);
        this.entitiesPainter?.onRender(timestamp, dt);
        this.draw();
    };
    draw() {
        const {ctx} = this;
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
        this.chunksModule?.draw();
        this.entitiesPainter?.draw();
        this.blockHighlight?.draw();
        ctx.flush();
    };
    dispose() {
        super.dispose();
        this.setWorld();
        settings.removeEventListenerByID(this.settingsListenerID);
    };
};

export {
    WorldRenderer,
    WorldRenderer as dafault
};
