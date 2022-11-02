
export let showBlock_webgl2 = {
    vert: `#version 300 es
        precision highp int;
        precision highp float;
        in vec3 position;
        in vec4 color;
        in vec3 textureCoord;
        // uniform mat4 mMatrix;
        // uniform mat4 vMatrix;
        // uniform mat4 pMatrix;
        uniform mat4 mvMatrix;
        uniform mat4 mvpMatrix;
        out vec4 vColor;
        out vec3 vTextureCoord;
        out vec3 vPos;
        void main(void) {
            vColor = color;
            vTextureCoord  = textureCoord;
            vec4 pos = vec4(position, 1.0);
            vPos = (mvMatrix * pos).xyz;
            gl_Position = mvpMatrix * pos;
        }`,
    frag: `#version 300 es
        precision highp int;
        precision highp float;
        precision highp sampler2DArray;
        uniform sampler2DArray blockTex;
        uniform vec4 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        in vec4 vColor;
        in vec3 vTextureCoord;
        in vec3 vPos;
        out vec4 fragmentColor;
        void main(void){
            vec4 smpColor = texture(blockTex, vTextureCoord);
            if (smpColor.a <= 0.3) discard;
            float fogDistance = length(vPos);
            float fogAmount = smoothstep(fogNear, fogFar, fogDistance);
            fragmentColor  = mix(vColor * smpColor, fogColor, fogAmount);
        }`
};

export let showBlock = {
    // normal保存顶点的法线信息    invMatrix接受模型变换矩阵的逆矩阵    lightDirection接受光的方向
    // vec3  invLight = normalize(invMatrix * vec4(lightDirection, 0.0)).xyz;
    // float diffuse  = clamp(dot(normal, invLight), 0.1, 1.0);
    // vColor         = color * vec4(vec3(diffuse), 1.0);
    // 用来计算光系数
    // normalize是内置函数 作用是将向量标准化【即化为长度为1的向量
    vert: `
        attribute vec3 position;
        attribute vec4 color;
        attribute vec3 textureCoord;
        // uniform mat4 mMatrix;
        // uniform mat4 vMatrix;
        // uniform mat4 pMatrix;
        uniform mat4 mvMatrix;
        uniform mat4 mvpMatrix;
        varying vec4 vColor;
        varying vec3 vTextureCoord;
        varying vec3 vPos;
        void main(void) {
            vColor = color;
            vTextureCoord  = textureCoord;
            vec4 pos = vec4(position, 1.0);
            vPos = (mvMatrix * pos).xyz;
            gl_Position = mvpMatrix * pos;
        }`,
    // fs中的vColor是vs中传进来的
    // precision指定精确度 此为精密度中的float
    frag: `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        uniform sampler2D blockTex;
        uniform vec4 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        varying vec4 vColor;
        varying vec3 vTextureCoord;
        varying vec3 vPos;
        void main(void){
            vec4 smpColor = texture2D(blockTex, vTextureCoord.xy);
            if (smpColor.a <= 0.3) discard;
            float fogDistance = length(vPos);
            float fogAmount = smoothstep(fogNear, fogFar, fogDistance);
            gl_FragColor  = mix(vColor * smpColor, fogColor, fogAmount);
        }`
};

export let entityItem_webgl2 = {
    vert: `#version 300 es
        precision highp int;
        precision highp float;
        in vec3 position;
        in vec4 color;
        in vec3 textureCoord;
        uniform mat4 mMatrix;
        uniform mat4 vMatrix;
        uniform mat4 pMatrix;
        out vec4 vColor;
        out vec3 vTextureCoord;
        out vec3 vPos;
        void main(void) {
            vColor = color;
            mat4 mvMatrix = vMatrix * mMatrix;
            vTextureCoord  = textureCoord;
            vec4 pos = vec4(position, 1.0);
            vPos = (mvMatrix * pos).xyz;
            gl_Position = pMatrix * mvMatrix * pos;
        }`,
    frag: `#version 300 es
        precision highp int;
        precision highp float;
        precision highp sampler2DArray;
        uniform sampler2DArray blockTex;
        uniform vec4 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        in vec4 vColor;
        in vec3 vTextureCoord;
        in vec3 vPos;
        out vec4 fragmentColor;
        void main(void){
            vec4 smpColor = texture(blockTex, vTextureCoord);
            if (smpColor.a <= 0.3) discard;
            float fogDistance = length(vPos);
            float fogAmount = smoothstep(fogNear, fogFar, fogDistance);
            fragmentColor  = mix(vColor * smpColor, fogColor, fogAmount);
        }`
};

export let selector = {
    vert: `
        attribute vec3 pos;
        attribute vec4 col;
        uniform   mat4 mvp;
        varying   vec4 vCol;
        void main(void) {
            vCol = col;
            gl_Position = mvp * vec4(pos, 1.0);
        }`,
    frag: `
        precision mediump float;
        varying vec4 vCol;
        void main(void) {
            gl_FragColor = vCol;
        }`
};

export let blockInventoryTexure_webgl2 = {
    vert: `#version 300 es
        precision highp int;
        precision highp float;
        in vec3 position;
        in vec4 normal;
        in vec4 color;
        in vec3 textureCoord;
        uniform mat4 mvpMatrix;
        uniform mat4 normalMatrix;
        uniform vec3 diffuseLightDirection;     // need normalize
        uniform vec3 diffuseLightColor;
        uniform vec3 ambientLightColor;
        out   vec4 vColor;
        out   vec3 vTextureCoord;
        void main(void) {
            gl_Position    = mvpMatrix * vec4(position, 1.0);
            vTextureCoord  = textureCoord;
            vec4 nor = normalMatrix * normal;
            vec3 nor2 = normalize(nor.xyz);
            // normal dot light direction
            float nDotL = max(dot(diffuseLightDirection, nor2), 0.0);
            vec3 diffuse = diffuseLightColor * color.rgb * nDotL;
            vec3 ambient = ambientLightColor * color.rgb;
            vColor = vec4(diffuse + ambient, color.a);
        }`,
    frag: `#version 300 es
        precision highp int;
        precision highp float;
        precision highp sampler2DArray;
        uniform sampler2DArray blockTex;
        in vec4      vColor;
        in vec3      vTextureCoord;
        out vec4 fragmentColor;

        void main(void){
            vec4 smpColor = texture(blockTex, vTextureCoord);
            if (smpColor.a == 0.0) discard;
            fragmentColor  = vColor * smpColor;
        }`
};
export let blockInventoryTexure = {
    vert: `
        attribute vec3 position;
        attribute vec4 normal;
        attribute vec4 color;
        attribute vec3 textureCoord;
        uniform mat4 mvpMatrix;
        uniform mat4 normalMatrix;
        uniform vec3 diffuseLightDirection;     // need normalize
        uniform vec3 diffuseLightColor;
        uniform vec3 ambientLightColor;
        varying   vec4 vColor;
        varying   vec3 vTextureCoord;
        void main(void) {
            gl_Position    = mvpMatrix * vec4(position, 1.0);
            vTextureCoord  = textureCoord;
            vec4 nor = normalMatrix * normal;
            vec3 nor2 = normalize(nor.xyz);
            // normal dot light direction
            float nDotL = max(dot(diffuseLightDirection, nor2), 0.0);
            vec3 diffuse = diffuseLightColor * color.rgb * nDotL;
            vec3 ambient = ambientLightColor * color.rgb;
            vColor = vec4(diffuse + ambient, color.a);
        }`,
    frag: `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        uniform sampler2D blockTex;
        varying vec4      vColor;
        varying vec3      vTextureCoord;

        void main(void){
            vec4 smpColor = texture2D(blockTex, vTextureCoord.xy);
            if (smpColor.a == 0.0) discard;
            gl_FragColor  = vColor * smpColor;
        }`
};

export let welcomePage = {
    vert: `
        attribute vec3 aPosition;
        uniform   mat4 uMvpMatrix;
        varying   vec3 vNoraml;
        void main(void){
            vNoraml = normalize(aPosition);
            gl_Position = uMvpMatrix * vec4(aPosition, 1.0);
        }`,
    frag: `
        precision lowp float;
        uniform samplerCube uTexture;
        varying vec3 vNoraml;
        void main(void){
            gl_FragColor = textureCube(uTexture, vNoraml);
        }`
};
