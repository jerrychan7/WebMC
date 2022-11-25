
import { mat4, degree2radian as d2r } from "../utils/math/index.js";
import Render from "./Render.js";
import Camera from "./Camera.js";
import * as glsl from "./glsl.js";
import { waitResource } from "../utils/loadResources.js";

let texImgs = null;
waitResource("welcomePage/textures").then(imgs => texImgs = imgs);

class WelcomeRenderer extends Render {
    constructor(canvas) {
        super(canvas);
        this.fitScreen();
        new ResizeObserver(async e => {
            await new Promise(s => setTimeout(s, 0));
            this.fitScreen();
        }).observe(canvas);
        let vertexPosition = [
                -1, 1,-1, -1,-1,-1, -1,-1, 1, -1, 1, 1,
                -1, 1, 1, -1,-1, 1,  1,-1, 1,  1, 1, 1,
                 1, 1, 1,  1,-1, 1,  1,-1,-1,  1, 1,-1,
                 1, 1,-1,  1,-1,-1, -1,-1,-1, -1, 1,-1,
                 1, 1,-1, -1, 1,-1, -1, 1, 1,  1, 1, 1,
                -1,-1,-1,  1,-1,-1,  1,-1, 1, -1,-1, 1,
            ],
            element = (len => {
                let base = [0,1,2, 0,2,3], out = [];
                for (let i = 0, j = 0; i <= len; j = i++ * 4)
                    out.push(...base.map(x => x + j));
                return out;
            })(vertexPosition.length / 12);
        this.bos = {
            ver: this.createVbo(vertexPosition),
            ele: this.createIbo(element),
        };
        this.prg = this.createProgram("welcomePage", glsl.welcomePage.vert, glsl.welcomePage.frag)
                    .use().bindTex("uTexture", this.createCubemapsTexture(texImgs, "welcomePage/textures"))
                    .setAtt("aPosition", this.bos.ver);
        const {ctx} = this;
        ctx.texParameteri(ctx.TEXTURE_CUBE_MAP, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
        ctx.texParameteri(ctx.TEXTURE_CUBE_MAP, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
        let mainCamera = this.mainCamera = new Camera(this.aspectRatio, {
            viewType: Camera.viewType.lookAt,
            fovy: 120, position: [0, 0, 0],
            lookAt: [-1, 0, 0], up: [0, 1, 0],
            far: 10,
        });
        this.addCamera(mainCamera);
        this.mM = mat4.identity();
        this.mvpM = mat4.identity();
    };
    get vpM() { return this.mainCamera.projview; };
    onRender() {
        const {ctx, prg, mM, vpM, mvpM, bos} = this;
        mat4.rotate(mM, d2r(1 / 70), [0, 1, 0], mM);
        mat4.multiply(vpM, mM, mvpM);
        prg.use().setUni("uMvpMatrix", mvpM);
        ctx.clear(ctx.COLOR_BUFFER_BIT);
        ctx.bindBuffer(bos.ele.type, bos.ele);
        ctx.drawElements(ctx.TRIANGLES, bos.ele.length, ctx.UNSIGNED_SHORT, 0);
        ctx.flush();
    };
};

export {
    WelcomeRenderer as default,
    WelcomeRenderer,
};
