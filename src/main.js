import * as glsl from "./glsl.js";
import Render from "./Render.js";
import {preloaded} from "./loadResources.js";
import Block from "./Block.js";
import Camera from "./Camera.js";
import World from "./World.js";

window.onload = async function() {

    await preloaded.loadend();
    Block.initBlocksByDefault();
    let render = new Render(document.getElementById("canvas"));
    window.render = render;
    render.fitScreen();
    window.addEventListener("resize", render.fitScreen.bind(render, 1, 1));
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
    render.createTexture(Block.defaultBlockTextureImg);
    let camera = new Camera(render.aspectRatio, {fovy: 75, pitch: -90 * Math.PI / 180, position: [0, 20, 0]}),
        prg = render.createProgram("showBlock", glsl.showBlock.vert, glsl.showBlock.frag)
            .use().bindTex("texture", render.getTexture(Block.defaultBlockTextureImg.uri));
    render.addCamera(camera);
    camera.bindEntity(world.mainPlayer);
    render.createProgram("selector", glsl.selector.vert, glsl.selector.frag);
    render.onRender = function(timestamp, dt) {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        world.updata(dt);
        prg.use().setUni("mvpMatrix", camera.projview);
        world.draw();
        gl.flush();
    };
    render.play();
};
