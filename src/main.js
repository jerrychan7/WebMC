import {mat4, vec3} from "./gmath.js";
import * as glsl from "./glsl.js";
import Render from "./Render.js";
import {preloaded} from "./loadResources.js";
import Block from "./Block.js";
import Camera from "./Camera.js";
import World from "./World.js";;

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

    let world = new World();
    world.setRenderer(render);
    render.createTexture(Block.getBlockByBlockName("stone").texture.img);
    let camera = new Camera(render.aspectRatio, {pitch: -90 * Math.PI / 180, position: [0, 20, 0]}),
        prg = render.createProgram("showBlock", glsl.showBlock.vert, glsl.showBlock.frag)
            .use().bindTex("texture", render.getTexture(Block.getBlockByBlockName("stone").texture.img.uri));
    render.addCamera(camera);
    render.onRender = function(timestamp) {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        let radians = (deg) => deg * Math.PI / 180,
            d = timestamp / 10, rd = radians(d),
            xrad = radians(0.4 * d),
            yrad = radians(0.7 * d);
        camera.setPos([32 * Math.cos(yrad) + 8.5, camera.position[1], 32 * Math.sin(xrad) + 8.5]);
        prg.setUni("mvpMatrix", camera.projview);
        world.draw();
        gl.flush();
    };
    render.play();
};
