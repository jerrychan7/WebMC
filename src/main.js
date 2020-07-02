import {mat4, vec3} from "./gmath.js";
import * as glsl from "./glsl.js";
import Render from "./Render.js";
import {preloaded} from "./loadResources.js";
import Block from "./Block.js";
import Camera from "./Camera.js";

window.onload = async function() {

    await preloaded.loadend();
    Block.initBlocksByDefault();
    let render = new Render(document.getElementById("canvas"));
    window.render = render;
    render.fitScreen();
    render.gl.clearColor(0.1137, 0.1216, 0.1294, 1.0);
    render.gl.clearDepth(1.0);
    render.gl.clear(render.gl.COLOR_BUFFER_BIT | render.gl.DEPTH_BUFFER_BIT);
    //将深度测试设置为有效
    render.gl.enable(render.gl.DEPTH_TEST);
    //指定一般深度测试的评价方法
    render.gl.depthFunc(render.gl.LEQUAL);

    render.gl.enable(render.gl.CULL_FACE);
    render.gl.frontFace(render.gl.CCW);

    let block = Block.getBlockByBlockName("grass");
    render.createTexture(block.texture.img);
    let faces = Object.keys(block.vertexs),
        flatObj = (obj, add = 0) => faces.map(f => obj[f]).reduce((ans, i, j) => {ans.push(...i.map(v => v + j * add)); return ans;}, []),
        vertexPosition = flatObj(block.vertexs),
        index          = flatObj(block.elements, block.vertexs[faces[0]].length / 3),
        textureCoord   = flatObj(block.texture.uv),
        vertexColor    = (() => {
            let len = vertexPosition.length / 3, ans = [];
            while (len--) ans.push(1.0, 1.0, 1.0, 1.0);
            return ans;
        })(),
        ibo = render.createIbo(index),
        camera = new Camera(render.aspectRatio),
        mM   = mat4.identity(),
        prg = render.createProgram("showBlock", glsl.showBlock.vert, glsl.showBlock.frag)
            .use()
            .setAtt("position", render.createVbo(vertexPosition))
            .setAtt("color", render.createVbo(vertexColor))
            .setAtt("textureCoord", render.createVbo(textureCoord))
            .setUni("mvpMatrix", camera.projview)
            .bindTex("texture", render.getTexture(block.texture.img.uri));
    render.gl.bindBuffer(render.gl.ELEMENT_ARRAY_BUFFER, ibo);
    render.addCamera(camera);
    window.addEventListener("resize", (e) => render.fitScreen());

    render.onRender = function(timestamp) {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let radians = (deg) => deg * Math.PI / 180,
            d = timestamp / 10, rd = radians(d),
            xrad = radians(0.4 * d),
            yrad = radians(0.7 * d);
        mat4.identity(mM);
        mat4.rotate(mM, xrad, [1, 0, 0], mM);
        mat4.rotate(mM, yrad, [0, 1, 0], mM);
        mat4.translate(mM, [-0.5, -0.5, -0.5], mM);
        camera.setPos([Math.cos(rd), Math.sin(rd), camera.position[2]]);
        camera.setPitch(Math.cos(rd) * Math.sin(rd));
        mat4.multiply(camera.projview, mM, mM);
        prg.setUni("mvpMatrix", mM);

//        gl.drawElements(gl.LINES,index.length, gl.UNSIGNED_SHORT, 0);
        gl.drawElements(gl.TRIANGLES, ibo.length, gl.UNSIGNED_SHORT, 0);
        gl.flush();
    };
    render.play();
};
