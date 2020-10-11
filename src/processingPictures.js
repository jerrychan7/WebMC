
class Canvas2D {
    constructor(width = 0, height = 0) {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        if (width > 0 && height > 0)
            this.setSize(width, height);
        return new Proxy(this, {
            get(tar, key) {
                if (key in tar) return tar[key];
                if (key in tar.canvas)
                    return typeof tar.canvas[key] === "function"
                        ? tar.canvas[key].bind(tar.canvas)
                        : tar.canvas[key];
                if (key in tar.ctx)
                    return typeof tar.ctx[key] === "function"
                        ? tar.ctx[key].bind(tar.ctx)
                        : tar.ctx[key];
            }
        });
    };
    setSize(w, h, smoothing = false, smoothingQuality = 2) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.setImgSmoothingEnabled(smoothing);
        if (smoothing)
            this.setImgSmoothingQuality(smoothingQuality);
    };
    setImgSmoothingEnabled(tf) {
        this.ctx.mozImageSmoothingEnabled    = tf;
        this.ctx.webkitImageSmoothingEnabled = tf;
        this.ctx.msImageSmoothingEnabled     = tf;
        this.ctx.imageSmoothingEnabled       = tf;
        this.ctx.oImageSmoothingEnabled      = tf;
    };
    setImgSmoothingQuality(level = 2) {
        this.ctx.imageSmoothingQuality = (["low", "medium", "high"])[level];
    };
    toImage() {
        let img = new Image(this.canvas.width, this.canvas.height);
        img.src = this.canvas.toDataURL();
        return img;
    };
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    };
}

// if mipLevel == 0  gen all mip level
export function textureMipmapByTile(img, mipLevel = 1, tileCount = [32, 16]) {
    let canvas = new Canvas2D(),
        w = img.width, h = img.height, mipmap = [],
        [wTileCount, hTileCount] = tileCount,
        singleW = w / wTileCount, singleH = h / hTileCount,
        hSingleW = singleW / 2, hSingleH = singleH / 2;
    /**single tile:
     *                  +----+
     * +--+             |4343|
     * |12| =>          |2121|
     * |34| =>          |4343|
     * +--+             |2121|
     *                  +----+
     */
    w *= 4; h *= 4;
    for (let i = 0; w > wTileCount && h > hTileCount && (mipLevel? i < mipLevel: true) ; ++i) {
        w = (w >>> 1) || w;
        h = (h >>> 1) || h;
        canvas.setSize(w, h);
        let sw = w / wTileCount / 2, sh = h / hTileCount / 2,
            hsw = sw / 2, hsh = sh / 2;
        for (let x = 0; x < wTileCount; ++x)
        for (let y = 0; y < hTileCount; ++y) {
            canvas.drawImage(img, x * singleW + hSingleW, y * singleH + hSingleH, hSingleW, hSingleH,
                x * 2 * sw,           y * 2 * sh, hsw, hsh);
            canvas.drawImage(img, x * singleW,            y * singleH + hSingleH,  singleW, hSingleH,
                x * 2 * sw + hsw,     y * 2 * sh,  sw, hsh);
            canvas.drawImage(img, x * singleW,            y * singleH + hSingleH, hSingleW, hSingleH,
                x * 2 * sw + hsw * 3, y * 2 * sh, hsw, hsh);

            canvas.drawImage(img, x * singleW + hSingleW, y * singleH, hSingleW, singleH,
                x * 2 * sw,           y * 2 * sh + hsh, hsw, sh);
            canvas.drawImage(img, x * singleW,            y * singleH,  singleW, singleH,
                x * 2 * sw + hsw,     y * 2 * sw + hsh,  sw, sh);
            canvas.drawImage(img, x * singleW,            y * singleH, hSingleW, singleH,
                x * 2 * sw + hsw * 3, y * 2 * sh + hsh, hsw, sh);

            canvas.drawImage(img, x * singleW + hSingleW, y * singleH, hSingleW, hSingleH,
                x * 2 * sw,           y * 2 * sh + hsh * 3, hsw, hsh);
            canvas.drawImage(img, x * singleW,            y * singleH,  singleW, hSingleH,
                x * 2 * sw + hsw,     y * 2 * sh + hsh * 3,  sw, hsh);
            canvas.drawImage(img, x * singleW,            y * singleH, hSingleW, hSingleH,
                x * 2 * sw + hsw * 3, y * 2 * sh + hsh * 3, hsw, hsh);
        }
        mipmap[i] = canvas.toImage();
    }
    return img.mipmap = mipmap;
}

import { asyncLoadResByUrl, setResource } from "./loadResources.js";
asyncLoadResByUrl("texture/gui.png")
.then(img => {
    const {width, height} = img,
          style = document.createElement("style"),
          canvas = new Canvas2D(182, 22);
    const cr = (w, h) => [w / 256 * width, h / 256 * height];
    canvas.drawImage(img, 0, 0, ...cr(182, 22), 0, 0, canvas.width, canvas.height);
    setResource("hotbar_background", canvas.toImage());
    style.innerHTML += ".mc-hotbar-background {\n" +
                       `    background-image: url(${canvas.toDataURL()});\n` +
                       "    background-size: 100% 100%;\n" +
                       "    background-repeat: no-repeat;\n" +
                       "}\n";
    canvas.setSize(24, 24);
    canvas.drawImage(img, ...cr(0, 22), ...cr(24, 24), 0, 0, canvas.width, canvas.height);
    setResource("hotbar_selector", canvas.toImage());
    style.innerHTML += ".mc-hotbar-selector-background {\n" +
                       `    background-image: url(${canvas.toDataURL()});\n` +
                       "    background-size: 100% 100%;\n" +
                       "    background-repeat: no-repeat;\n" +
                       "}\n";
    canvas.setSize(16, 16);
    canvas.drawImage(img, ...cr(200, 46), ...cr(16, 16), 0, 0, canvas.width, canvas.height);
    setResource("inventory_item_background", canvas.toImage());
    style.innerHTML += ".mc-inventory-item-background {\n" +
                       `    background-image: url(${canvas.toDataURL()});\n` +
                       "    background-size: 100% 100%;\n" +
                       "}\n";
    document.head.appendChild(style);
});
asyncLoadResByUrl("texture/spritesheet.png")
.then(img => {
    const {width, height} = img,
          style = document.createElement("style"),
          canvas = new Canvas2D(18, 18);
    const cr = (w, h) => [w / 256 * width, h / 256 * height];
    canvas.drawImage(img, ...cr(60, 0), ...cr(18, 18), 0, 0, canvas.width, canvas.height);
    setResource("close_btn", canvas.toImage());
    style.innerHTML += ".mc-close-btn {\n" +
                       `    background-image: url(${canvas.toDataURL()});\n` +
                       "    background-size: 100% 100%;\n" +
                       "    background-repeat: no-repeat;\n" +
                       "}\n";
    canvas.clear();
    canvas.drawImage(img, ...cr(78, 0), ...cr(18, 18), 0, 0, canvas.width, canvas.height);
    setResource("close_btn_active", canvas.toImage());
    style.innerHTML += ".mc-close-btn:active {\n" +
                       `    background-image: url(${canvas.toDataURL()});\n` +
                       "    background-size: 100% 100%;\n" +
                       "    background-repeat: no-repeat;\n" +
                       "}\n";
    canvas.setSize(16, 16);
    canvas.drawImage(img, 0, 0, ...cr(16, 16), 0, 0, canvas.width, canvas.height);
    setResource("inventory_border", canvas.toImage());
    style.innerHTML += ".mc-inventory-border {\n" +
                       "    border: 16px solid transparent;\n" +
                       `    border-image: url(${canvas.toDataURL()}) 6 stretch;\n` +
                       "}\n";
    canvas.setSize(14, 14);
    canvas.drawImage(img, ...cr(34, 43), ...cr(14, 14), 0, 0, canvas.width, canvas.height);
    setResource("inventory_tab_back", canvas.toImage());
    style.innerHTML += ".mc-inventory-tab-back {\n" +
                       `    background-image: url(${canvas.toDataURL()});\n` +
                       "    background-size: 100% 100%;\n" +
                       "    background-repeat: no-repeat;\n" +
                       "}\n";
    canvas.setSize(13, 14);
    canvas.drawImage(img, ...cr(49, 43), ...cr(13, 14), 0, 0, canvas.width, canvas.height);
    setResource("inventory_tab_back_left", canvas.toImage());
    style.innerHTML += ".mc-inventory-tab-front-left {\n" +
                       `    background-image: url(${canvas.toDataURL()});\n` +
                       "    background-size: 100% 100%;\n" +
                       "    background-repeat: no-repeat;\n" +
                       "}\n";
    canvas.setSize(14, 14);
    canvas.drawImage(img, ...cr(65, 55), ...cr(14, 14), 0, 0, canvas.width, canvas.height);
    setResource("inventory_tab_back_right", canvas.toImage());
    style.innerHTML += ".mc-inventory-tab-front-right {\n" +
                       `    background-image: url(${canvas.toDataURL()});\n` +
                       "    background-size: 100% 100%;\n" +
                       "    background-repeat: no-repeat;\n" +
                       "}\n";
    document.head.appendChild(style);
});

import { Render } from "./Render.js";
import { Camera } from "./Camera.js";
import * as glsl from "./glsl.js";
import { mat4, vec3 } from "./gmath.js";
import { Block } from "./Block.js";
class BlockInventoryTexRender extends Render {
    constructor() {
        let canvas = document.createElement("canvas");
        super(canvas);
        this.canvas = canvas;
        this.ctx2d = new Canvas2D();
        this.setSize(512, 512);
        const {ctx} = this;
        ctx.enable(ctx.DEPTH_TEST);
        const {SQRT2} = Math;
        const wsize = 0.425 + SQRT2/4;
        let mainCamera = new Camera(this.aspectRatio, {
            projectionType: Camera.projectionType.ortho,
            viewType: Camera.viewType.lookAt,
            left: -wsize, right: wsize, bottom: -wsize, top: wsize, near: -1, far: 5,
            position: [1, 12 / 16, 1],
        });
        this.mainCamera = mainCamera;
        this.addCamera(mainCamera);
        this.prg = this.createProgram("blockInventoryTexure", glsl.blockInventoryTexure.vert, glsl.blockInventoryTexure.frag);
        this.bo = {
            ver: this.createVbo([], ctx.DYNAMIC_DRAW),
            nor: this.createVbo([], ctx.DYNAMIC_DRAW),
            col: this.createVbo([], ctx.DYNAMIC_DRAW),
            tex: this.createVbo([], ctx.DYNAMIC_DRAW),
            ele: this.createIbo([], ctx.DYNAMIC_DRAW),
        };
        let mM = mat4.identity();
        mat4.translate(mM, [-0.5, -0.5, -0.5], mM);
        this.mM = mM;
        this.mvpM = mat4.multiply(mainCamera.projview, mM);
        let imM = mat4.inverse(mM);
        this.itmM = mat4.transpose(imM, imM);
    };
    toImage() {
        let img = new Image(this.canvas.width, this.canvas.height);
        img.src = this.canvas.toDataURL();
        return img;
    };
    gen(block) {
        if (block.name === "air") {
            this.ctx2d.clear();
            return this.ctx2d.toImage();
        }
        if (block.renderType === Block.renderType.NORMAL) {
            let normal = [], color = [], ver = [], tex = [], ele = [], totalVer = 0;
            for (let face in block.vertexs) {
                let vs = block.vertexs[face],
                    pa = vec3.create(vs[0], vs[1], vs[2]),
                    pb = vec3.create(vs[3], vs[4], vs[5]),
                    pc = vec3.create(vs[6], vs[7], vs[8]),
                    ab = vec3.subtract(pb, pa),
                    ac = vec3.subtract(pc, pa),
                    n = vec3.cross(ab, ac),
                    verNum = vs.length / 3;
                for (let i = 0; i < verNum; ++i) {
                    normal.push(...n);
                    color.push(1.0, 1.0, 1.0, 1.0);
                }
                ver.push(...vs);
                tex.push(...block.texture.uv[face]);
                ele.push(...block.elements[face].map(v => v + totalVer));
                totalVer += verNum;
            }
            const blockTex = this.getOrCreateTexture(block.texture.img);
            const {ctx, prg} = this;
            this.bindBoData(this.bo.ver, ver, {drawType: ctx.DYNAMIC_DRAW});
            this.bindBoData(this.bo.nor, normal, {drawType: ctx.DYNAMIC_DRAW});
            this.bindBoData(this.bo.col, color, {drawType: ctx.DYNAMIC_DRAW});
            this.bindBoData(this.bo.tex, tex, {drawType: ctx.DYNAMIC_DRAW});
            this.bindBoData(this.bo.ele, ele, {drawType: ctx.DYNAMIC_DRAW});
            prg.use().bindTex("texture", blockTex)
            .setUni("diffuseLightColor", block.luminance? [0, 0, 0]: [1.0, 1.0, 1.0])
            .setUni("ambientLightColor", block.luminance? [1, 1, 1]: [0.2, 0.2, 0.2])
            .setUni("diffuseLightDirection", vec3.normalize([0.5, 3.0, 4.0]))
            .setUni("diffuseLightDirection", vec3.normalize([0.4, 1, 0.7]))
            .setUni("mvpMatrix", this.mvpM)
            .setUni("normalMatrix", this.itmM)
            .setAtt("position", this.bo.ver)
            .setAtt("normal", this.bo.nor, 3)
            .setAtt("color", this.bo.col)
            .setAtt("textureCoord", this.bo.tex);
            ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
            ctx.bindBuffer(this.bo.ele.type, this.bo.ele);
            ctx.drawElements(ctx.TRIANGLES, this.bo.ele.length, ctx.UNSIGNED_SHORT, 0);
            ctx.flush();
            return this.toImage();
        }
        const {ctx2d} = this;
        ctx2d.clear();
        const img = block.texture.img.mipmap? block.texture.img.mipmap[0]: block.texture.img;
        const w = img.width, h = img.height, uv = Object.values(block.texture.uv)[0];
        ctx2d.drawImage(img, w * uv[0], h * uv[1], w * (uv[4] - uv[0]), h * (uv[3] - uv[1]), 0, 0, this.canvas.width, this.canvas.height);
        return ctx2d.toImage();
    };
    setSize(w, h) {
        super.setSize(w, h);
        this.ctx2d.setSize(w, h);
    };
}
const blockInventoryTexRender = new BlockInventoryTexRender();
export function blockInventoryTexture(block) {
    return blockInventoryTexRender.gen(block);
}
