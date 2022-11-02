import Program from "./Program.js";
import { isWebGL2Context } from "../utils/isWebGL2Context.js";

class Render {
    constructor(canvas) {
        let ctx = this.gl = this.ctx =
            canvas.getContext("webgl2") ||
            canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!ctx) throw "Cannot get the WebGL context";
        this.isWebGL2 = "isSupportWebGL2" in window? window.isSupportWebGL2: isWebGL2Context(ctx);
        this.prgCache = {};
        this.texCache = {};
        this.bufferCache = new Set();
        this.camera = [];
        this.frame = this.frame.bind(this);
        this.timer = null;
        this.lastFrameTime = window.performance.now();
        this.dpr = window.devicePixelRatio;
    };
    get aspectRatio() {
        return this.ctx.canvas.width / this.ctx.canvas.height;
    };
    addCamera(camera) {
        this.camera.push(camera);
        return this;
    };
    createProgram(name, vectSrc, fragSrc) {
        return this.prgCache[name] = new Program(this.ctx, vectSrc, fragSrc);
    };
    getProgram(name) { return this.prgCache[name]; };
    delProgram(name) {
        this.prgCache[name]?.dispose();
        delete this.prgCache[name];
    };

    frame(timestamp = this.lastFrameTime) {
        this.timer = window.requestAnimationFrame(this.frame);
        if (this.onRender) this.onRender(timestamp, timestamp - this.lastFrameTime);
        this.lastFrameTime = timestamp;
    };
    play() {
        if (this.timer !== null) return;
        this.lastFrameTime = window.performance.now();
        this.frame();
    };
    stop() {
        if (this.timer === null) return;
        window.cancelAnimationFrame(this.timer);
        this.timer = null;
    };

    setSize(w, h, dpr = this.dpr) {
        const c = this.ctx.canvas;
        this.dpr = dpr;
        w = (w * dpr) | 0; h = (h * dpr) | 0;
        c.width = w; c.height = h;
        this.ctx.viewport(0, 0, w, h);
        this.camera.forEach(camera => camera.setAspectRatio(w / h));
        return {w, h};
    };

    fitScreen(wp = 1, hp = 1) {
        return this.setSize(
            window.innerWidth * wp,
            window.innerHeight * hp
        );
    };

    createIbo(data, drawType = this.ctx.STATIC_DRAW) {
        return this.createBo(data, this.ctx.ELEMENT_ARRAY_BUFFER, drawType);
    };
    createVbo(data, drawType = this.ctx.STATIC_DRAW) {
        return this.createBo(data, this.ctx.ARRAY_BUFFER, drawType);
    };
    createBo(data, boType, drawType = this.ctx.STATIC_DRAW) {
        return this.bindBoData(this.ctx.createBuffer(), data, {boType, drawType});
    };
    bindBoData(bufferObj, data, {
        boType = bufferObj.type,
        drawType = this.ctx.STATIC_DRAW,
    } = {}) {
        const ctx = this.ctx;
        if (!(data.buffer instanceof ArrayBuffer)) {
            if (boType === ctx.ELEMENT_ARRAY_BUFFER)
                data = new Int16Array(data);
            else if (boType === ctx.ARRAY_BUFFER)
                data = new Float32Array(data);
        }
        bufferObj.length = data.length;
        bufferObj.type = boType;
        ctx.bindBuffer(boType, bufferObj);
        ctx.bufferData(boType, data, drawType);
        ctx.bindBuffer(boType, null);
        if (!this.bufferCache.has(bufferObj))
            this.bufferCache.add(bufferObj);
        return bufferObj;
    };
    delBo(bufferObj) {
        if (!this.bufferCache.has(bufferObj)) return false;
        this.ctx.deleteBuffer(bufferObj);
        return this.bufferCache.delete(bufferObj);
    };

    _getImageName(img) {
        let uri = img.outerHTML.match(/src="([^"]*)"/);
        return uri? uri[1]: String(Math.random());
    };
    createTexture(img, name = this._getImageName(img), doYFlip = false) {
        const {ctx} = this,
              tex  = ctx.createTexture();
        if (doYFlip) ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
        ctx.bindTexture(ctx.TEXTURE_2D, tex);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE,
            img.mipmap && img.mipmap[0]? img.mipmap[0]: img);
        if (img.mipmap) {
            ctx.generateMipmap(ctx.TEXTURE_2D);
            ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST_MIPMAP_LINEAR);
            for (let i = 1; i < img.mipmap.length; ++i)
                ctx.texImage2D(ctx.TEXTURE_2D, i, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, img.mipmap[i]);
        }
        ctx.bindTexture(ctx.TEXTURE_2D, null);
        if (doYFlip) ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, false);
        this.texCache[name] = tex;
        tex.name = name;
        tex.type = ctx.TEXTURE_2D;
        return tex;
    };
    createTextureArray(img, {
        singleW = img.texture4array && img.texture4array.singleW,
        singleH = img.texture4array && img.texture4array.singleH,
        altesCount = img.texture4array && img.texture4array.altesCount,
        name = this._getImageName(img),
        doYFlip = false,
        useMips = true,
    } = {}) {
        if (!window.isSupportWebGL2 || !this.isWebGL2) throw "not support webgl2";
        if (img.texture4array) img = img.texture4array;
        const {ctx} = this,
              tex  = ctx.createTexture();
        if (doYFlip) ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
        ctx.bindTexture(ctx.TEXTURE_2D_ARRAY, tex);
        ctx.texParameteri(ctx.TEXTURE_2D_ARRAY, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
        ctx.texParameteri(ctx.TEXTURE_2D_ARRAY, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
        ctx.texParameteri(ctx.TEXTURE_2D_ARRAY, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D_ARRAY, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        if (singleW >= ctx.getParameter(ctx.MAX_TEXTURE_SIZE)) throw "width out of range";
        if (singleH >= ctx.getParameter(ctx.MAX_TEXTURE_SIZE)) throw "height out of range";
        if (altesCount >= ctx.getParameter(ctx.MAX_ARRAY_TEXTURE_LAYERS)) throw "depth out of range";
        if (Array.isArray(img)) {
            ctx.texImage3D(ctx.TEXTURE_2D_ARRAY, 0, ctx.RGBA, singleW, singleH, altesCount, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, null);
            for (let i = 0; i < img.length; ++i)
                ctx.texSubImage3D(ctx.TEXTURE_2D_ARRAY, 0, 0, 0, i, singleW, singleH, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, img[i]);
        }
        else
            ctx.texImage3D(ctx.TEXTURE_2D_ARRAY, 0, ctx.RGBA, singleW, singleH, altesCount, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, img);
        if (useMips) {
            ctx.generateMipmap(ctx.TEXTURE_2D_ARRAY);
            ctx.texParameteri(ctx.TEXTURE_2D_ARRAY, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST_MIPMAP_LINEAR);
        }
        ctx.bindTexture(ctx.TEXTURE_2D_ARRAY, null);
        if (doYFlip) ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, false);
        this.texCache[name] = tex;
        tex.name = name;
        tex.type = ctx.TEXTURE_2D_ARRAY;
        return tex;
    };
    createCubemapsTexture(imgs, name = Math.random(), doYFlip = false) {
        const {ctx} = this, tex = ctx.createTexture();
        if (doYFlip) ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
        ctx.bindTexture(ctx.TEXTURE_CUBE_MAP, tex);
        ctx.texParameteri(ctx.TEXTURE_CUBE_MAP, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
        ctx.texParameteri(ctx.TEXTURE_CUBE_MAP, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
        ctx.texParameteri(ctx.TEXTURE_CUBE_MAP, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_CUBE_MAP, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        for (let i = 0; i < 6; ++i) {
            ctx.texImage2D(ctx.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, imgs[i]);
        }
        ctx.generateMipmap(ctx.TEXTURE_CUBE_MAP);
        ctx.bindTexture(ctx.TEXTURE_CUBE_MAP, null);
        if (doYFlip) ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
        this.texCache[name] = tex;
        tex.name = name;
        tex.type = ctx.TEXTURE_CUBE_MAP;
        return tex;
    };
    getTexture(name) { return this.texCache[name]; };
    getOrCreateTexture(img, name = img instanceof Image && this._getImageName(img), doYFlip = false) {
        let cache = this.getTexture(name);
        if (cache) return cache;
        if (Array.isArray(img)) return this.createCubemapsTexture(img, name, doYFlip);
        if (img.texture4array)
            try { return this.createTextureArray(img, { name, doYFlip }); }
            catch (e) {
                console.warn(e);
                window.isSupportWebGL2 = this.isWebGL2 = false;
            }
        return this.createTexture(img, name, doYFlip);
    };

    dispose() {
        this.stop();
        const {ctx} = this;
        this.bufferCache.forEach(bo => ctx.deleteBuffer(bo));
        this.bufferCache.clear();
        Object.values(this.texCache).forEach(tex => ctx.deleteTexture(tex));
        this.texCache = {};
        Object.values(this.prgCache).forEach(prg => prg.dispose());
    };
};

export {
    Render,
    Render as default
};
