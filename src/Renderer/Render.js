import Program from "./Program.js";

class Render {
    constructor(canvas) {
        let ctx = this.gl = this.ctx =
            canvas.getContext("webgl2") ||
            canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!ctx) throw "Cannot get the WebGL context";
        this.prgCache = {};
        this.texCache = {};
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
    }

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
        return bufferObj;
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
        return tex;
    };
    createCubemapsTexture(img, name = this._getImageName(img), doYFlip = false) {
        
    };
    getTexture(name) { return this.texCache[name]; };
    getOrCreateTexture(img, name = this._getImageName(img), doYFlip = false) {
        return this.getTexture(name) || this.createTexture(img, name, doYFlip);
    };
};

export {
    Render,
    Render as default
};
