import {mat4} from "./gmath.js";
import * as glsl from "./glsl.js";
import Render from "./Render.js";
import {preloaded} from "./loadResources.js";
import Block from "./Block.js";

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
        mM   = mat4.identity(),
        vM   = mat4.lookAt([0.0, 0.0, 3.0], [0, 0, 0], [0, 1, 0]),
        pM   = mat4.perspective(90, render.aspectRatio, 0.1, 100),
        tmpM = mat4.multiply(pM, vM),
        mvpM = mat4.multiply(tmpM, mM),
        prg = render.createProgram("showBlock", glsl.showBlock.vert, glsl.showBlock.frag)
            .use()
            .setAtt("position", render.createVbo(vertexPosition))
            .setAtt("color", render.createVbo(vertexColor))
            .setAtt("textureCoord", render.createVbo(textureCoord))
            .setUni("mvpMatrix", mvpM)
            .bindTex("texture", render.getTexture(block.texture.img.uri));
    render.gl.bindBuffer(render.gl.ELEMENT_ARRAY_BUFFER, ibo);

    render.onRender = function(timestamp) {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let xrad = (0.4 * (timestamp / 10) % 360) * Math.PI / 180,
            yrad = (0.7 * (timestamp / 10) % 360) * Math.PI / 180;
        mat4.identity(mM);
        mat4.rotate(mM, xrad, [1, 0, 0], mM);
        mat4.rotate(mM, yrad, [0, 1, 0], mM);
        mat4.translate(mM, [-0.5, -0.5, -0.5], mM);
        mat4.multiply(tmpM, mM, mvpM);
        prg.setUni("mvpMatrix", mvpM);

//        gl.drawElements(gl.LINES,index.length, gl.UNSIGNED_SHORT, 0);
        gl.drawElements(gl.TRIANGLES, ibo.length, gl.UNSIGNED_SHORT, 0);
        gl.flush();
    };
    render.play();
};
