
class Canvas2D {
    constructor(width = 0, height = 0) {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        if (width > 0 && height > 0)
            this.setSize(width, height);
        return this.wrapper = new Proxy(this, {
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
            },
            set(tar, key, value) {
                if (key in tar) tar[key] = value;
                if (key in tar.canvas) tar.canvas[key] = value;
                if (key in tar.ctx) tar.ctx[key] = value;
                return true;
            }
        });
    };
    setSize(w, h, smoothing = false, smoothingQuality = 2) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.setImgSmoothingEnabled(smoothing);
        if (smoothing)
            this.setImgSmoothingQuality(smoothingQuality);
        return this.wrapper;
    };
    setImgSmoothingEnabled(tf) {
        this.ctx.mozImageSmoothingEnabled    = tf;
        this.ctx.webkitImageSmoothingEnabled = tf;
        this.ctx.msImageSmoothingEnabled     = tf;
        this.ctx.imageSmoothingEnabled       = tf;
        this.ctx.oImageSmoothingEnabled      = tf;
        return this.wrapper;
    };
    setImgSmoothingQuality(level = 2) {
        this.ctx.imageSmoothingQuality = (["low", "medium", "high"])[level];
        return this.wrapper;
    };
    toImage(onload = function() {}, onerror = function() {}) {
        let img = new Image(this.canvas.width, this.canvas.height);
        img.onload = onload;
        img.onerror = onerror;
        img.src = this.canvas.toDataURL();
        return img;
    };
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return this.wrapper;
    };
    cropAndZoom(img, sx, sy, sw, sh, coordZoomFactor = 1, {
        finalZoom = 1,
        canvasW = sw * coordZoomFactor * finalZoom,
        canvasH = sh * coordZoomFactor * finalZoom,
    } = {}) {
        sx *= coordZoomFactor; sy *= coordZoomFactor;
        sw *= coordZoomFactor; sh *= coordZoomFactor;
        this.setSize(canvasW, canvasH);
        this.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
        return this.wrapper;
    };
    darken(ratio = 0.5) {
        const {canvas: {width, height}, ctx} = this;
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = `rgba(0, 0, 0, ${ratio})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
        return this.wrapper;
    };
}

// if mipLevel == 0  gen all mip level
function textureMipmapByTile(img, mipLevel = 1, tileCount = [32, 16]) {
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
        canvas.setSize(w, h, true);
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

function prepareTextureAarray(img, tileCount = [32, 16]) {
    let w = img.width, h = img.height,
        [wTileCount, hTileCount] = tileCount,
        singleW = w / wTileCount, singleH = h / hTileCount,
        canvas = new Canvas2D(singleW, singleH);
    img.texture4array = [];
    for (let y = 0; y < hTileCount; ++y)
    for (let x = 0; x < wTileCount; ++x) {
        canvas.cropAndZoom(img, x * singleW, y * singleH, singleW, singleH);
        img.texture4array.push(canvas.toImage());
    }
    img.texture4array.tileCount = tileCount;
    img.texture4array.singleW = singleW;
    img.texture4array.singleH = singleH;
    img.texture4array.altesCount = wTileCount * hTileCount;
    return img.texture4array;
}

import { asyncLoadResByUrl, setResource } from "./utils/loadResources.js";

const rootStyle = document.createElement("style");
rootStyle.id = "mc-root-style";
document.head.prepend(rootStyle);

function setBorderOrBgStyle(name, img, {
    slice = [],
    isBorder = slice.length !== 0,
    url = img.src,
    width = img.width, height = img.height,
} = {}) {
    if (slice.length === 1) slice = [slice[0], slice[0], slice[0], slice[0]];
    if (slice.length === 2) slice = [slice[0], slice[1], slice[0], slice[1]];
    if (slice.length === 3) slice = [slice[0], slice[1], slice[2], slice[1]];
    rootStyle.sheet.insertRule(`:root {
        --mc-ui-${name}-img: url("${url}");
        --mc-ui-${name}-img-width: ${width};
        --mc-ui-${name}-img-height: ${height};`
    + (!isBorder? "": `
        --mc-ui-${name}-img-border-top: ${slice[0]};
        --mc-ui-${name}-img-border-right: ${slice[1]};
        --mc-ui-${name}-img-border-bottom: ${slice[2]};
        --mc-ui-${name}-img-border-left: ${slice[3]};`)
    + `
    }`, 0);
    setResource(`mc-ui-${name}-img`, img);
    return img;
}

const genDrawAndSet = (img, canvas, coordZoomFactor) => (sx, sy, sw, sh, name, styleOption, drawOption) =>
    setBorderOrBgStyle(name, canvas.cropAndZoom(img, sx, sy, sw, sh, coordZoomFactor, drawOption).toImage(), styleOption);

asyncLoadResByUrl("texture/gui.png")
.then(img => {
    const coordZoomFactor = img.width / 256;
    const canvas = new Canvas2D();
    const drawAndSet = genDrawAndSet(img, canvas, coordZoomFactor);

    drawAndSet(0, 66, 200, 20, "button", {slice: [3]});
    setBorderOrBgStyle("slider-thumb", canvas.toImage(), {slice: [3, 4]});
    drawAndSet(0, 86, 200, 20, "button-hover", {slice: [3]});
    setBorderOrBgStyle("slider-thumb-hover", canvas.toImage(), {slice: [3, 4]});
    drawAndSet(0, 46, 200, 20, "button-active", {slice: [3]});
    setBorderOrBgStyle("button-disabled", canvas.toImage(), {slice: [3]});

    drawAndSet(0, 0, 182, 22, "hotbar-background");
    rootStyle.sheet.insertRule(":root { --mc-ui-hotbar-item-cell-width: 20; --mc-ui-hotbar-item-cell-height: 20; }", 0);
    drawAndSet(0, 22, 24, 24, "hotbar-selector-background");

    drawAndSet(200, 46, 16, 16, "inventory-item-background");
    drawAndSet(228, 248, 28, 8, "hotbar-inventory-btn-foreground");

    // move buttons
    for (let [name, coord] of Object.entries({
        up: [0, 107, 26, 26],
        left: [26, 107, 26, 26],
        down: [52, 107, 26, 26],
        right: [78, 107, 26, 26],
        jump: [104, 107, 26, 26],
        upleft: [0, 133, 26, 26],
        upright: [26, 133, 26, 26],
        flyup: [52, 133, 26, 26],
        flydown: [78, 133, 26, 26],
        fly: [104, 133, 26, 26],
        sneak: [218, 82, 18, 18],
    })) {
        drawAndSet(...coord, "move-btn-" + name);
        setBorderOrBgStyle(`move-btn-${name}-active`, canvas.darken().toImage());
    }
});
asyncLoadResByUrl("texture/spritesheet.png")
.then(img => {
    const coordZoomFactor = img.width / 256;
    const canvas = new Canvas2D();
    const drawAndSet = genDrawAndSet(img, canvas, coordZoomFactor);
    drawAndSet(60, 0, 18, 18, "close-btn");
    drawAndSet(78, 0, 18, 18, "close-btn-active");
    drawAndSet(34, 43, 14, 14, "inventory-items", {slice: [3]});
    drawAndSet(49, 43, 13, 14, "inventory-tab-background-left", {slice: [3]});
    drawAndSet(65, 55, 14, 14, "inventory-tab-background-right", {slice: [3]});
    drawAndSet(8, 32, 8, 8, "hotbar-inventory-btn-bg", {slice: [1]});
    drawAndSet(0, 32, 8, 8, "hotbar-inventory-btn-bg-active", {slice: [1]});
});
asyncLoadResByUrl("texture/background.png")
.then(img => {
    const coordZoomFactor = img.width / 16;
    const canvas = new Canvas2D();
    canvas.cropAndZoom(img, 0, 0, 16, 16, coordZoomFactor, { canvasW: 128, canvasH: 128, });
    setBorderOrBgStyle("background", canvas.toImage());
    setBorderOrBgStyle("background-darken", canvas.darken().toImage());
});
asyncLoadResByUrl("texture/panorama.png")
.then(img => {
    const {width, height} = img;
    const canvas = new Canvas2D(height, height);
    let ans = [];
    for (let i = 0; i < 6; ++i) {
        let face = "pz,px,nz,nx,py,ny".split(",")[i];
        canvas.cropAndZoom(img, i * height, 0, height, height);
        ans[face] = canvas.toImage();
        setResource("welcomePage/texture_" + face, ans[face]);
    }
    for (let face of "px,nx,py,ny,pz,nz".split(","))
        ans.push(ans[face]);
    setResource("welcomePage/textures", ans);
});
asyncLoadResByUrl("texture/title.png");

import { Render } from "./Renderer/Render.js";
import { Camera } from "./Renderer/Camera.js";
import * as glsl from "./Renderer/glsl.js";
import { mat4, vec3 } from "./utils/math/index.js";
import { Block } from "./World/Block.js";
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
        this.prg = this.isWebGL2
            ? this.createProgram("blockInventoryTexure", glsl.blockInventoryTexure_webgl2.vert, glsl.blockInventoryTexure_webgl2.frag)
            : this.createProgram("blockInventoryTexure", glsl.blockInventoryTexure.vert, glsl.blockInventoryTexure.frag);
        this.bo = {
            ver: this.createVbo([], ctx.DYNAMIC_DRAW),
            nor: this.createVbo([], ctx.DYNAMIC_DRAW),
            col: this.createVbo([], ctx.DYNAMIC_DRAW),
            tex: this.createVbo([], ctx.DYNAMIC_DRAW),
            ele: this.createIbo([], ctx.DYNAMIC_DRAW),
        };
        this.mM = mat4().E().translate([-0.5, -0.5, -0.5]).res;
        this.mvpM = mat4.mul(mainCamera.projview, this.mM);
        this.itmM = mat4().set(this.mM).inv().T().res;
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
        if (block.renderType === Block.renderType.NORMAL || block.renderType === Block.renderType.CACTUS) {
            let normal = [], color = [], ver = [], tex = [], ele = [], totalVer = 0;
            for (let face in block.vertices) {
                let vs = block.vertices[face],
                    pa = [vs[0], vs[1], vs[2]],
                    pb = [vs[3], vs[4], vs[5]],
                    pc = [vs[6], vs[7], vs[8]],
                    // n = (pb - pa) x (pc - pa) 法向量
                    n = vec3(pb).sub(pa).cross(vec3.sub(pc, pa, pc)).res,
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
            prg.use().bindTex("blockTex", blockTex)
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
        if (img.texture4array) {
            const t = img.texture4array, {singleW, singleH} = t;
            if (Array.isArray(t))
                ctx2d.drawImage(t[uv[2]], 0, 0, singleW, singleH, 0, 0, this.canvas.width, this.canvas.height);
            else
                ctx2d.drawImage(t, 0, singleH * uv[2], singleW, singleH, 0, 0, this.canvas.width, this.canvas.height);
        }
        else
            ctx2d.drawImage(img, w * uv[0], h * uv[1], w * (uv[6] - uv[0]), h * (uv[4] - uv[1]), 0, 0, this.canvas.width, this.canvas.height);
        return ctx2d.toImage();
    };
    setSize(w, h, dpr = 1) {
        super.setSize(w, h, dpr);
        this.ctx2d.setSize(w, h);
    };
}
const blockInventoryTexRender = new BlockInventoryTexRender();
function blockInventoryTexture(block) {
    return blockInventoryTexRender.gen(block);
}


export {
    textureMipmapByTile,
    prepareTextureAarray,
    blockInventoryTexture,
};
