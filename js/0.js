
function init(){
    
    var canvas = document.getElementById("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    
    gl.clearColor(0.1137, 0.1216, 0.1294, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    var prg = create_program(create_shader("vs"), create_shader("fs")),
        attLocation = [
            gl.getAttribLocation(prg, "position"),
            gl.getAttribLocation(prg, "color"),
            gl.getAttribLocation(prg, "textureCoord")
        ],
        attStride = [3, 4, 2], vertexPosition = [
            //前
             -1.0, 1.0, 1.0,   1.0, 1.0, 1.0,  -1.0,-1.0, 1.0,  1.0,-1.0, 1.0,
            //后
             -1.0, 1.0,-1.0,   1.0, 1.0,-1.0,  -1.0,-1.0,-1.0,  1.0,-1.0,-1.0,
            //左
            -1.0, 1.0, 1.0,  -1.0,-1.0, 1.0, -1.0, 1.0,-1.0,  -1.0,-1.0,-1.0,
            //右
            1.0, 1.0, 1.0,  1.0,-1.0, 1.0,  1.0, 1.0,-1.0,  1.0,-1.0,-1.0,
            //上
            1.0, 1.0, 1.0,  -1.0, 1.0, 1.0, 1.0, 1.0,-1.0,  -1.0, 1.0,-1.0,
            //下
            -1.0,-1.0, 1.0,  1.0,-1.0, 1.0, -1.0,-1.0,-1.0,  1.0,-1.0,-1.0
        ],
        vertexColor = [
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
        index = [
            //前
            2,1,0, 1,2,3,
            //后
            4,5,6, 7,6,5,
            //左
            10,9,8, 10,11,9,
            //右
            14,12,13, 14,13,15,
            //上
            18,19,17, 18,17,16,
            //下
            23,20,22, 23,21,20
        ],
        textureCoord = [
            0.0, 0.25,  1.0, 0.25,  0.0, 0.5,   1.0, 0.5,
            0.0, 0.0,   1.0, 0.0,   0.0, 0.25,  1.0, 0.25,
            0.0, 0.5,   1.0, 0.5,   0.0, 0.75,  1.0, 0.75,
            0.0, 0.5,   1.0, 0.5,   0.0, 0.75,  1.0, 0.75,
            0.0, 0.5,   1.0, 0.5,   0.0, 0.75,  1.0, 0.75,
            0.0, 0.5,   1.0, 0.5,   0.0, 0.75,  1.0, 0.75
        ];
    
    var pos_vbo = create_vbo(vertexPosition),
        col_vbo = create_vbo(vertexColor),
        tex_vbo = create_vbo(textureCoord);
    
    set_attribute([pos_vbo, col_vbo, tex_vbo], attLocation, attStride);
    
    var ibo = create_ibo(index);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    
    //将深度测试设置为有效
    gl.enable(gl.DEPTH_TEST); 
    //指定一般深度测试的评价方法
    gl.depthFunc(gl.LEQUAL);
    
    gl.enable(gl.CULL_FACE);
//    gl.disable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);
    
    gl.activeTexture(gl.TEXTURE0);
    var texture = null;
    create_texture("texture/all.png");
    
    var m = new matIV();
    
    var mM = m.identity(m.create()),
        vM = m.identity(m.create()),
        pM = m.identity(m.create()),
        tmpM = m.identity(m.create()),
        mvpM = m.identity(m.create());
    
    m.lookAt([0.0, 0.0, 3.0], [0, 0, 0], [0, 1, 0], vM);
    m.perspective(90, canvas.width / canvas.height, 0.1, 100, pM);
    m.multiply(pM, vM, tmpM);
    
    m.multiply(tmpM, mM, mvpM);
    
    var uniLocation = [
        gl.getUniformLocation(prg, "mvpMatrix"),
        gl.getUniformLocation(prg, "texture")
    ];
    gl.uniformMatrix4fv(uniLocation[0], false, mvpM);
//    gl.uniform1i(uniLocation[1], 0);
    
    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
    gl.flush();
    
    var count = 0;
    (function() {
        gl.clearColor(0.1137, 0.1216, 0.1294, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        var xrad = (0.4 * count % 360) * Math.PI / 180,
            yrad = (0.7 * count % 360) * Math.PI / 180;
        ++count;
        m.identity(mM);
        m.rotate(mM, xrad, [1, 0, 0], mM);
        m.rotate(mM, yrad, [0, 1, 0], mM);
        
        m.multiply(tmpM, mM, mvpM);
        
        //gl.bindTexture(gl.TEXTURE_2D, texture);
//        gl.uniform1i(uniLocation[1], 0);
        gl.uniformMatrix4fv(uniLocation[0], false, mvpM);
        
//        gl.drawElements(gl.LINES,index.length, gl.UNSIGNED_SHORT, 0);
        gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
        gl.flush();
        
        window.requestAnimationFrame(arguments.callee);
        // setTimeout(arguments.callee, 1000 / 60);
    })();
    
    function create_shader(id) {
        var shader,
            scriptElement = document.getElementById(id);
        if (!scriptElement) return;
        switch(scriptElement.type) {
            case "x-shader/x-vertex":
                shader = gl.createShader(gl.VERTEX_SHADER);
                break;
            case "x-shader/x-fragment":
                shader = gl.createShader(gl.FRAGMENT_SHADER);
                break;
            default: return;
        }
        gl.shaderSource(shader, scriptElement.text);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
            return shader;
        }
        else{ // 编译失败，弹出错误消息
            alert(gl.getShaderInfoLog(shader));
        }
    }
    
    function create_program(vs, fs) {
        var program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            // 成功的话，将程序对象设置为有效
            gl.useProgram(program);
            return program;
        }
        else { // 如果失败，弹出错误信息
            alert(gl.getProgramInfoLog(program));
        }
    }
    
    function create_vbo(data){
        var vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        return vbo;
    }
    
    function set_attribute(vbo,attL,attS) {
        for (var i in vbo) {
            gl.bindBuffer(gl.ARRAY_BUFFER,vbo[i]);
            gl.enableVertexAttribArray(attL[i]);
            gl.vertexAttribPointer(attL[i], attS[i], gl.FLOAT, false, 0, 0);
        }
    }
    
    function create_ibo(data) {
        var ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        return ibo;
    }
    
    function create_texture(source) {
        // イメージオブジェクトの生成
        var img = new Image();
        
        // データのオンロードをトリガーにする
        img.onload = function() {
            // テクスチャオブジェクトの生成
            var tex = gl.createTexture();
            
            // テクスチャをバインドする
            gl.bindTexture(gl.TEXTURE_2D, tex);
            
            //放大时采用最近邻过滤【纹理不过滤 像素化
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
            
            // テクスチャへイメージを適用
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            
            // ミップマップを生成
            gl.generateMipmap(gl.TEXTURE_2D);
            
            // テクスチャのバインドを無効化
            //gl.bindTexture(gl.TEXTURE_2D, null);
            
            // 生成したテクスチャをグローバル変数に代入
            texture = tex;
        };
        
        // イメージオブジェクトのソースを指定
        img.src = source;
    }
};
