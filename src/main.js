import {mat4} from "./gmath.js";

class Render {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = this.ctx = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!this.gl) return null;
    };

    createShader(type, src) {
        const gl = this.gl,
              s  = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            throw gl.getShaderInfoLog(s);
        return s;
    };

    createProgram(vertex, fragment) {
        const {gl} = this,
              p    = gl.createProgram();
        gl.attachShader(p, vertex);
        gl.attachShader(p, fragment);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS))
            throw gl.getProgramInfoLog(p);
        return p;
    };

    createIbo(data, drawType) {
        if (!(data instanceof Int16Array))
            data = new Int16Array(data);
        const {gl} = this,
              ibo  = gl.createBuffer();
        if (drawType === undefined) drawType = gl.STATIC_DRAW;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, drawType);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        ibo.type = gl.ELEMENT_ARRAY_BUFFER;
        return ibo;
    };

    createVbo(data, drawType) {
        if (!(data instanceof Float32Array))
            data = new Float32Array(data);
        const {gl} = this,
              vbo  = gl.createBuffer();
        if (drawType === undefined) drawType = gl.STATIC_DRAW;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, drawType);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        vbo.type = gl.ARRAY_BUFFER;
        return vbo;
    };

    useProgram(program) {
        let gl = this.gl;
        gl.useProgram(program);
        this.program = this.prg = program;
        let unis = this.getCurrentUniforms();
        let atts = this.getCurrentAttribs();
        program.uniforms = {};
        program.attributes = {};
        // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getActiveUniform
        for (let uniName in unis) {
            let uni = unis[uniName];
            Object.defineProperty(program.uniforms, uniName, {
                get() {
                    return uni.loc;
                },
                set(value) {
                    switch (uni.type) {
                        case gl.FLOAT_MAT4:
                            gl.uniformMatrix4fv(uni.loc, false, value);
                            break;
                        case gl.FLOAT:
                            gl.uniform1f(uni.loc, value);
                            break;
                        case gl.SAMPLER_CUBE:
                        case gl.SAMPLER_2D:
                            gl.uniform1i(uni.loc, value);
                            break;
                        case gl.FLOAT_VEC2:
                            gl.uniform2fv(uni.loc, value);
                            break;
                        case gl.FLOAT_VEC3:
                            gl.uniform3fv(uni.loc, value);
                            break;
                        case gl.FLOAT_VEC4:
                            gl.uniform4fv(uni.loc, value);
                            break;
                        default:
                            console.warn("don't know gl type", uni.type, "for uniform", uni.name);
                    }
                }
            });
        }
        // program.attributes = atts;
        for (let attName in atts) {
            let att = atts[attName];
            Object.defineProperty(program.attributes, attName, {
                get() {
                    return att.loc;
                },
                set(bufferData) {
                    let bufferType = bufferData.type || gl.ARRAY_BUFFER;
                    gl.bindBuffer(bufferType, bufferData);
                    gl.enableVertexAttribArray(att.loc);
                    let attDataType = gl.FLOAT, size;
                    switch (att.type) {
                        case gl.FLOAT:
                            size = 1;
                            break;
                        case gl.FLOAT_VEC2:
                        case gl.FLOAT_MAT2:
                            size = 2;
                            break;
                        case gl.FLOAT_VEC3:
                        case gl.FLOAT_MAT3:
                            size = 3;
                            break;
                        case gl.FLOAT_VEC4:
                        case gl.FLOAT_MAT4:
                            size = 4;
                            break;
                        default:
                            console.warn("don't know gl type", att.type, "for attribute", att.name);
                    }
                    gl.vertexAttribPointer(att.loc, size, gl.FLOAT, false, 0, 0);
                    gl.bindBuffer(bufferType, null);
                }
            });
        }
    };

    // bindVboByAttributeName(valueName, vbo, size) {
    // const {gl} = this,
    // att = gl.getAttribLocation(this.program, valueName);
    // gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    // gl.enableVertexAttribArray(att);
    // gl.vertexAttribPointer(att, size, gl.FLOAT, false, 0, 0);
    // gl.bindBuffer(gl.ARRAY_BUFFER, null);
    // };

    createTexture(img, doYFlip = false) {
        const {gl} = this,
              tex  = gl.createTexture();
        if (doYFlip) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, tex);
//        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.LINEAR);
//        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
//        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
//        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        if (doYFlip) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        return tex;
    };

    getCurrentAttribs() {
        if (!this.program) return {};
        const {gl, program} = this;
        return [...Array(gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES))]
            .map((_, i) => {
                const {size, type, name} = gl.getActiveAttrib(program, i),
                      loc                = gl.getAttribLocation(program, name);
                return {size, type, name: name.split("[")[0], loc};
            }).reduce((ac, el) => {
                ac[el.name] = el;
                return ac;
            }, {});
    };

    getCurrentUniforms() {
        if (!this.program) return {};
        const {gl, program} = this;
        return [...Array(gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS))]
            .map((_, i) => {
                const {size, type, name} = gl.getActiveUniform(program, i),
                      loc                = gl.getUniformLocation(program, name);
                return {size, type, name: name.split("[")[0], loc};
            })
            .reduce((ac, {name, size, type, loc}) => {
                ac[name] = {name, size, type, loc};
                return ac;
            }, {});
    };

    setSize(w, h) {
        const c = this.gl.canvas;
//        c.style.width = w + "px";
//        c.style.height = h + "px";
        c.width = w;
        c.height = h;
        this.gl.viewport(0, 0, w, h);
        return {w, h};
    };

    fitScreen(wp = 1, hp = 1) {
        return this.setSize(
            window.innerWidth * wp,
            window.innerHeight * hp
        );
    };
}

window.onload = function() {

    let render = new Render(document.getElementById("canvas"));
    render.fitScreen();
    render.gl.clearColor(0.1137, 0.1216, 0.1294, 1.0);
    render.gl.clearDepth(1.0);
    render.gl.clear(render.gl.COLOR_BUFFER_BIT | render.gl.DEPTH_BUFFER_BIT);
    //将深度测试设置为有效
    render.gl.enable(render.gl.DEPTH_TEST);
    //指定一般深度测试的评价方法
    render.gl.depthFunc(render.gl.LEQUAL);

    render.gl.enable(render.gl.CULL_FACE);
//    gl.disable(gl.CULL_FACE);
    render.gl.frontFace(render.gl.CCW);

    let prg = render.createProgram(
        render.createShader(render.gl.VERTEX_SHADER, document.getElementById("vs").text),
        render.createShader(render.gl.FRAGMENT_SHADER, document.getElementById("fs").text)
    );
    render.useProgram(prg);

    render.gl.activeTexture(render.gl.TEXTURE0);
    let img = new Image();
    img.onload = _ => {
        render.gl.bindTexture(render.gl.TEXTURE_2D, render.createTexture(img));
    };
    img.src = "texture/all.png";
    let vertexPosition = [
            //前
            -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
            //后
            -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0,
            //左
            -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0,
            //右
            1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
            //上
            1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0,
            //下
            -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0
        ],
        vertexColor    = [
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,

            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,

            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,

            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,

            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,

            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,

            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0
        ],
        index          = [
            //前
            2, 1, 0, 1, 2, 3,
            //后
            4, 5, 6, 7, 6, 5,
            //左
            10, 9, 8, 10, 11, 9,
            //右
            14, 12, 13, 14, 13, 15,
            //上
            18, 19, 17, 18, 17, 16,
            //下
            23, 20, 22, 23, 21, 20
        ],
        textureCoord   = [
            0.0, 0.25, 1.0, 0.25, 0.0, 0.5, 1.0, 0.5,
            0.0, 0.0, 1.0, 0.0, 0.0, 0.25, 1.0, 0.25,
            0.0, 0.5, 1.0, 0.5, 0.0, 0.75, 1.0, 0.75,
            0.0, 0.5, 1.0, 0.5, 0.0, 0.75, 1.0, 0.75,
            0.0, 0.5, 1.0, 0.5, 0.0, 0.75, 1.0, 0.75,
            0.0, 0.5, 1.0, 0.5, 0.0, 0.75, 1.0, 0.75
        ];

    render.program.attributes.position = render.createVbo(vertexPosition);
    render.program.attributes.color = render.createVbo(vertexColor);
    render.program.attributes.textureCoord = render.createVbo(textureCoord);

    let ibo = render.createIbo(index);
    render.gl.bindBuffer(render.gl.ELEMENT_ARRAY_BUFFER, ibo);

    let mM   = mat4.identity(),
        vM   = mat4.lookAt([0.0, 0.0, 3.0], [0, 0, 0], [0, 1, 0]),
        pM   = mat4.perspective(90, render.aspectRatio, 0.1, 100),
        tmpM = mat4.multiply(pM, vM),
        mvpM = mat4.multiply(tmpM, mM);

    render.program.uniforms.mvpMatrix = mvpM;
    render.program.uniforms.texture = 0;

    render.gl.drawElements(render.gl.TRIANGLES, index.length, render.gl.UNSIGNED_SHORT, 0);
    render.gl.flush();

    var count = 0;
    (function() {
        let gl = render.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var xrad = (0.4 * count % 360) * Math.PI / 180,
            yrad = (0.7 * count % 360) * Math.PI / 180;
        ++count;
        mat4.identity(mM);
        mat4.rotate(mM, xrad, [1, 0, 0], mM);
        mat4.rotate(mM, yrad, [0, 1, 0], mM);
        mat4.multiply(tmpM, mM, mvpM);

        render.program.uniforms.mvpMatrix = mvpM;

//        gl.drawElements(gl.LINES,index.length, gl.UNSIGNED_SHORT, 0);
        gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
        gl.flush();

        window.requestAnimationFrame(arguments.callee);
        // setTimeout(arguments.callee, 1000 / 60);
    })();
};
