
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
    toImage(onload = function() {}, onerror = function() {}) {
        let img = new Image(this.canvas.width, this.canvas.height);
        img.onload = onload;
        img.onerror = onerror;
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

    /**single tile:
     *                  +----+
     * +--+             |1212|
     * |12| =>          |3434|
     * |34| =>          |1212|
     * +--+             |3434|
     *                  +----+
     */
    // pad = 2;
    // if (pad > 1) {
    //     w *= pad * 2;
    //     h *= pad * 2;
    // }
    // for (let i = pad > 1? 0: 1; w > wTileCount && h > hTileCount; ++i) {
    //     w = (w >>> 1) || w;
    //     h = (h >>> 1) || h;
    //     canvas.setSize(w, h);
    //     let sw = w / wTileCount / pad, sh = h / hTileCount / pad;
    //     console.log(w, h, sw, sh)
    //     for (let x = 0; x < wTileCount; ++x)
    //     for (let y = 0; y < hTileCount; ++y) {
    //         for (let dx = 0; dx < pad; ++dx)
    //         for (let dy = 0; dy < pad; ++dy) {
    //             canvas.drawImage(img, x * singleW, y * singleH, singleW, singleH, (x * pad + dx) * sw, (y * pad + dy) * sh, sw, sh);
    //         }
    //     }
    //     let mipimg = new Image(w, h);
    //     // mipimg.onload = () => {
    //     //     console.log(i);
    //     // };
    //     mipimg.src = canvas.toDataURL();
    //     mipmap[i] = mipimg;
    // }
    // mipmap.pad = pad;
}

import { asyncLoadResByUrl, setResource } from "./loadResources.js";
function setBorderOrBgStyle(img, canvas, sx, sy, sw, sh, styleDOM, classSelector, {
    originalImgW = 256, originalImgH = originalImgW,
    zoomW = 1, zoomH = zoomW,
    sizeW = sw * zoomW, sizeH = sh * zoomH,
    cssVarName = classSelector.replace(/[:\[\]]/g, c => c === ']'? '': '-'),
    border = false,
        slice, // array
        keepCenter = true,
        color = "transparent",
        style = "solid",
        repeat = "stretch",
    background = false,
        bgImg = "",
        size = "cover",
        bgRepeat = "no-repeat",
        clip
} = {}) {
    const {width, height} = img;
    const cr = (w, h) => [w / originalImgW * width, h / originalImgH * height];
    const imgWidth = sizeW, imgHeight = sizeH;
    canvas.setSize(imgWidth, imgHeight);
    canvas.drawImage(img, ...cr(sx, sy), ...cr(sw, sh), 0, 0, imgWidth, imgHeight);
    if (border) {
        if (slice === undefined) return canvas.toImage();
        if (slice.length === 1) slice = [slice[0], slice[0], slice[0], slice[0]];
        if (slice.length === 2) slice = [slice[0], slice[1], slice[0], slice[1]];
        if (slice.length === 3) slice = [slice[0], slice[1], slice[2], slice[1]];
    }
    let url = canvas.toDataURL();
    styleDOM.innerHTML += `:root { --${cssVarName}-img-width: ${imgWidth}; --${cssVarName}-img-height: ${imgHeight}; ${
                border? `--${cssVarName}-border-img-top: ${slice[0]}; --${cssVarName}-border-img-right: ${slice[1]}; --${cssVarName}-border-img-bottom: ${slice[2]}; --${cssVarName}-border-img-left: ${slice[3]};`
                : ""
            }}\n`
        + `.${classSelector} {\n`
        + `    --img-width: var(--${cssVarName}-img-width);\n`
        + `    --img-height: var(--${cssVarName}-img-height);\n`
        + (background?
              `    background-image: ${bgImg + (bgImg? ",": "")} url(${url});\n`
            + `    background-size: ${size};\n`
            + (clip? `    background-clip: ${clip};\n`: "")
            + (bgRepeat? `    background-repeat: ${bgRepeat};\n`: ""): "")
        + (border? 
              `    border: ${color} ${style};\n`
            + `    border-image: url(${url}) ${slice.join(" ")} ${keepCenter? "fill": ""} ${repeat};\n`: "")
        + `}\n`;
    return canvas.toImage();
}
asyncLoadResByUrl("texture/gui.png")
.then(img => {
    const canvas = new Canvas2D(), style = document.createElement("style");
    setBorderOrBgStyle(img, canvas, 0, 0, 182, 22, style, "mc-hotbar-background", {background: true});
    style.innerHTML += ":root { --mc-hotbar-item-cell-width: 20; --mc-hotbar-item-cell-height: 20; }\n";
    setBorderOrBgStyle(img, canvas, 0, 22, 24, 24, style, "mc-hotbar-selector-background", {background: true});
    setBorderOrBgStyle(img, canvas, 200, 46, 16, 16, style, "mc-inventory-item-background", {background: true});
    setBorderOrBgStyle(img, canvas, 0, 66, 200, 20, style, "mc-button", {border: true, slice: [3]});
    setBorderOrBgStyle(img, canvas, 0, 86, 200, 20, style, "mc-button:hover", {border: true, slice: [3]});
    setBorderOrBgStyle(img, canvas, 0, 46, 200, 20, style, "mc-button:active", {border: true, slice: [3]});
    setBorderOrBgStyle(img, canvas, 0, 46, 200, 20, style, "mc-button[disabled]", {border: true, slice: [3]});
    const darkenBtn = (selector) => {
        canvas.globalCompositeOperation = "source-atop";
        canvas.fillStyle = "rgba(0, 0, 0, .5)";
        canvas.fillRect(0, 0, canvas.width, canvas.height);
        style.innerHTML += `${selector} { background-image: url(${canvas.toDataURL()}); }`;
        canvas.globalCompositeOperation = "source-over";
    };
    setBorderOrBgStyle(img, canvas, 0, 107, 26, 26, style, "mc-move-btn-up", {background: true});
    darkenBtn(".mc-move-btn-up:active, .mc-move-btn-up[active]");
    setBorderOrBgStyle(img, canvas, 26, 107, 26, 26, style, "mc-move-btn-left", {background: true});
    darkenBtn(".mc-move-btn-left:active, .mc-move-btn-left[active]");
    setBorderOrBgStyle(img, canvas, 52, 107, 26, 26, style, "mc-move-btn-down", {background: true});
    darkenBtn(".mc-move-btn-down:active, .mc-move-btn-down[active]");
    setBorderOrBgStyle(img, canvas, 78, 107, 26, 26, style, "mc-move-btn-right", {background: true});
    darkenBtn(".mc-move-btn-right:active, .mc-move-btn-right[active]");
    setBorderOrBgStyle(img, canvas, 104, 107, 26, 26, style, "mc-move-btn-jump", {background: true});
    darkenBtn(".mc-move-btn-jump:active, .mc-move-btn-jump[active]");
    setBorderOrBgStyle(img, canvas, 0, 133, 26, 26, style, "mc-move-btn-upleft", {background: true});
    darkenBtn(".mc-move-btn-upleft:active, .mc-move-btn-upleft[active]");
    setBorderOrBgStyle(img, canvas, 26, 133, 26, 26, style, "mc-move-btn-upright", {background: true});
    darkenBtn(".mc-move-btn-upright:active, .mc-move-btn-upright[active]");
    setBorderOrBgStyle(img, canvas, 52, 133, 26, 26, style, "mc-move-btn-flyup", {background: true});
    darkenBtn(".mc-move-btn-flyup:active, .mc-move-btn-flyup[active]");
    setBorderOrBgStyle(img, canvas, 78, 133, 26, 26, style, "mc-move-btn-flydown", {background: true});
    darkenBtn(".mc-move-btn-flydown:active, .mc-move-btn-flydown[active]");
    setBorderOrBgStyle(img, canvas, 104, 133, 26, 26, style, "mc-move-btn-fly", {background: true});
    darkenBtn(".mc-move-btn-fly:active, .mc-move-btn-fly[active]");
    setBorderOrBgStyle(img, canvas, 218, 82, 18, 18, style, "mc-move-btn-sneak", {background: true});
    setBorderOrBgStyle(img, canvas, 218, 64, 18, 18, style, "mc-move-btn-sneak[active]", {background: true});
    setBorderOrBgStyle(img, canvas, 228, 248, 28, 8, style, "mc-hotbar-inventory-btn", {background: true});
    document.head.prepend(style);
});
asyncLoadResByUrl("texture/spritesheet.png")
.then(img => {
    const canvas = new Canvas2D(), style = document.createElement("style");
    setBorderOrBgStyle(img, canvas, 60, 0, 18, 18, style, "mc-close-btn", {background: true});
    setBorderOrBgStyle(img, canvas, 78, 0, 18, 18, style, "mc-close-btn:active", {background: true});
    setBorderOrBgStyle(img, canvas, 34, 43, 14, 14, style, "mc-inventory-items", {border: true, slice: [3]});
    setBorderOrBgStyle(img, canvas, 49, 43, 13, 14, style, "mc-inventory-tab-background-left", {border: true, slice: [3]});
    setBorderOrBgStyle(img, canvas, 65, 55, 14, 14, style, "mc-inventory-tab-background-right", {border: true, slice: [3]});
    setBorderOrBgStyle(img, canvas, 8, 32, 8, 8, style, "mc-hotbar-inventory-btn-bg", {border: true, slice: [1]});
    setBorderOrBgStyle(img, canvas, 0, 32, 8, 8, style, "mc-hotbar-inventory-btn-bg[active]", {border: true, slice: [1]});
    document.head.prepend(style);
});
asyncLoadResByUrl("texture/background.png")
.then(img => {
    const canvas = new Canvas2D(), style = document.createElement("style");
    setBorderOrBgStyle(img, canvas, 0, 0, 16, 16, style, "mc-background", {
        originalImgW: 16,
        sizeW: 128, sizeH: 128,
        background: true,
        bgRepeat: "repeat", size: "auto",
    });
    setBorderOrBgStyle(img, canvas, 0, 0, 16, 16, style, "mc-background[darken]", {
        originalImgW: 16,
        sizeW: 128, sizeH: 128,
        background: true,
        bgRepeat: "repeat", size: "auto",
        bgImg: "linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))",
    });
    document.head.prepend(style);
});
asyncLoadResByUrl("texture/panorama.png")
.then(img => {
    const exponent = i => { for (var j = 1; i; i >>= 1) j <<= 1; return j; };
    const {width, height} = img;
    const canvas = new Canvas2D(exponent(width), height);
    canvas.drawImage(img, 0, 0);
    canvas.toImage(function() {
        setResource("start_game_page/texture", this);
    });
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
        if (block.renderType === Block.renderType.NORMAL || block.renderType === Block.renderType.CACTUS) {
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
