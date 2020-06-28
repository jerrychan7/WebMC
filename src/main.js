import {mat4} from "./gmath.js";
import * as glsl from "./glsl.js";
import Render from "./Render.js";

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
    render.gl.frontFace(render.gl.CCW);

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
        vertexColor    = (() => {
            let len = vertexPosition.length / 3, ans = [];
            while (len--) ans.push(1.0, 1.0, 1.0, 1.0);
            return ans;
        })(),
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
        ],
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
            .setUni("mvpMatrix", mvpM),
        ibo = render.createIbo(index),
        img = new Image();
    img.onload = _ => {
        render.gl.activeTexture(render.gl.TEXTURE0);
        render.gl.bindTexture(render.gl.TEXTURE_2D, render.createTexture(img));
        prg.setUni("texture", 0);
        render.play();
    };
    img.src = "texture/all.png";
    render.gl.bindBuffer(render.gl.ELEMENT_ARRAY_BUFFER, ibo);

    render.onRender = function(timestamp) {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let xrad = (0.4 * (timestamp / 10) % 360) * Math.PI / 180,
            yrad = (0.7 * (timestamp / 10) % 360) * Math.PI / 180;
        mat4.identity(mM);
        mat4.rotate(mM, xrad, [1, 0, 0], mM);
        mat4.rotate(mM, yrad, [0, 1, 0], mM);
        mat4.multiply(tmpM, mM, mvpM);
        prg.setUni("mvpMatrix", mvpM);

//        gl.drawElements(gl.LINES,index.length, gl.UNSIGNED_SHORT, 0);
        gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
        gl.flush();
    };
};
