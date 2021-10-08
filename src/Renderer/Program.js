
function createShader(ctx, type, src) {
    const s = ctx.createShader(type);
    ctx.shaderSource(s, src);
    ctx.compileShader(s);
    if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS))
        throw "error compile " + (type === ctx.VERTEX_SHADER? "vertex": "fragment") + " shader: "
            + ctx.getShaderInfoLog(s);
    return s;
}

function createProgram(ctx, vertShader, fragShader) {
    const p = ctx.createProgram();
    ctx.attachShader(p, vertShader);
    ctx.attachShader(p, fragShader);
    ctx.linkProgram(p);
    if (!ctx.getProgramParameter(p, ctx.LINK_STATUS))
        throw "error link program: " + ctx.getProgramInfoLog(p);
    return p;
}

class Program {
    constructor(ctx, vertSrc, fragSrc) {
        this.ctx = this.gl = ctx;
        let vs = createShader(ctx, ctx.VERTEX_SHADER, vertSrc),
            fs = createShader(ctx, ctx.FRAGMENT_SHADER, fragSrc);
        this.shaders = { vs, fs };
        let prog = this.prog = this.program = createProgram(ctx, vs, fs);
        const getCurrentVars = (varsType, aou = varsType === ctx.ACTIVE_ATTRIBUTES? "Attrib": "Uniform") =>
            [...Array(ctx.getProgramParameter(prog, varsType))]
            .map((_, i) => {
                const {size, type, name} = ctx["getActive" + aou](prog, i),
                      loc                = ctx[`get${aou}Location`](prog, name);
                return {size, type, name: name.split("[")[0], loc};
            })
            .reduce((ac, {name, size, type, loc}) => {
                ac[name] = {name, size, type, loc};
                return ac;
            }, {});
        this.vars = {
            atts: getCurrentVars(ctx.ACTIVE_ATTRIBUTES),
            unis: getCurrentVars(ctx.ACTIVE_UNIFORMS)
        };
    };
    use() { this.ctx.useProgram(this.prog); return this; };
    getAtt(name) { return this.vars.atts[name].loc; };
    getUni(name) { return this.vars.unis[name].loc; };
    setAtt(name, bufferData, size = undefined, attDataType = this.ctx.FLOAT, normalized = false, stride = 0, offset = 0) {
        const ctx = this.ctx, att = this.vars.atts[name];
        if (!att) throw "Cannot get attribute " + name;
        if (size === undefined) {
            switch (att.type) {
                case ctx.FLOAT:
                    size = 1; break;
                case ctx.FLOAT_VEC2: case ctx.FLOAT_MAT2:
                    size = 2; break;
                case ctx.FLOAT_VEC3: case ctx.FLOAT_MAT3:
                    size = 3; break;
                case ctx.FLOAT_VEC4: case ctx.FLOAT_MAT4:
                    size = 4; break;
                default:
                    console.error("Don't know gl type", att.type, "for attribute", att.name);
                    throw "Don't know attribute type";
            }
        }
        let bufferType = bufferData.type || ctx.ARRAY_BUFFER;
        ctx.bindBuffer(bufferType, bufferData);
        ctx.enableVertexAttribArray(att.loc);
        ctx.vertexAttribPointer(att.loc, size, attDataType, normalized, stride, offset);
        ctx.bindBuffer(bufferType, null);
        return this;
    };
    setUni(name, value) {
        const ctx = this.ctx, uni = this.vars.unis[name];
        switch (uni.type) {
            case ctx.FLOAT_MAT4:
                ctx.uniformMatrix4fv(uni.loc, false, value);
                break;
            case ctx.FLOAT_MAT3:
                ctx.uniformMatrix3fv(uni.loc, false, value);
                break;
            case ctx.FLOAT_MAT2:
                ctx.uniformMatrix2fv(uni.loc, false, value);
                break;
            case ctx.FLOAT:
                ctx.uniform1f(uni.loc, value);
                break;
            case ctx.INT: case ctx.SAMPLER_CUBE: case ctx.SAMPLER_2D:
            case ctx.SAMPLER_2D_ARRAY:
                ctx.uniform1i(uni.loc, value);
                break;
            case ctx.FLOAT_VEC2:
                ctx.uniform2fv(uni.loc, value);
                break;
            case ctx.FLOAT_VEC3:
                ctx.uniform3fv(uni.loc, value);
                break;
            case ctx.FLOAT_VEC4:
                ctx.uniform4fv(uni.loc, value);
                break;
            case ctx.INT_VEC2:
                ctx.uniform2iv(uni.loc, value);
                break;
            case ctx.INT_VEC3:
                ctx.uniform3iv(uni.loc, value);
                break;
            case ctx.INT_VEC4:
                ctx.uniform4iv(uni.loc, value);
                break;
            default:
                console.warn("Don't know gl type", uni.type, "for uniform", uni.name);
                throw "Don't know uniform type";
        }
        return this;
    };
    bindTex(uniName, tex, texType = tex.type || ctx.TEXTURE_2D, unit = 0) {
        const ctx = this.ctx;
        ctx.activeTexture(ctx.TEXTURE0 + unit);
        ctx.bindTexture(texType, tex);
        return this.setUni(uniName, unit);
    };
    dispose() {
        const {ctx} = this;
        ctx.deleteShader(this.shaders.vs);
        ctx.deleteShader(this.shaders.fs);
        ctx.deleteProgram(this.program);
    };
};

export {
    Program,
    Program as default
};
