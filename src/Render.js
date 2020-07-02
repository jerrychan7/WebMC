import Program from "./Program.js";

class Render {
    constructor(canvas) {
        let ctx = this.gl = this.ctx =
            canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!ctx) throw "Cannot get the WebGL context";
        this.prgCache = {};
        this.texCache = {};
        this.camera = [];
        this.frame = this.frame.bind(this);
        this.timer = null;
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

    frame(timestamp) {
        if (this.onRender) this.onRender(timestamp);
        this.timer = window.requestAnimationFrame(this.frame);
    };
    play() {
        if (this.timer === null) this.frame();
    };
    stop() {
        window.cancelAnimationFrame(this.timer);
        this.timer = null;
    };

    setSize(w, h) {
        const c = this.ctx.canvas;
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
        if (!(data.buffer instanceof ArrayBuffer))
            data = new Int16Array(data);
        const {ctx} = this,
              ibo  = ctx.createBuffer();
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, ibo);
        ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, data, drawType);
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, null);
        ibo.type = ctx.ELEMENT_ARRAY_BUFFER;
        ibo.length = data.length;
        return ibo;
    };

    createVbo(data, drawType = this.ctx.STATIC_DRAW) {
        if (!(data.buffer instanceof ArrayBuffer))
            data = new Float32Array(data);
        const {ctx} = this,
              vbo  = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, vbo);
        ctx.bufferData(ctx.ARRAY_BUFFER, data, drawType);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        vbo.type = ctx.ARRAY_BUFFER;
        return vbo;
    };

    createTexture(img, name = img.outerHTML.match(/src="([^"]*)"/)[1], doYFlip = false) {
        const {ctx} = this,
              tex  = ctx.createTexture();
        if (doYFlip) ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
        ctx.bindTexture(ctx.TEXTURE_2D, tex);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, img);
        ctx.generateMipmap(ctx.TEXTURE_2D);
        ctx.bindTexture(ctx.TEXTURE_2D, null);
        if (doYFlip) ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, false);
        this.texCache[name] = tex;
        return tex;
    };
    getTexture(name) { return this.texCache[name]; };
};

export {
    Render,
    Render as default
};
