
// source: https://get.webgl.org/webgl2/
function isWebGL2Context(ctx = null) {
    // check if it really supports WebGL2. Issues, Some browers claim to support WebGL2
    // but in reality pass less than 20% of the conformance tests. Add a few simple
    // tests to fail so as not to mislead users.
    if (ctx) for (let param of [
        { pname: "MAX_TEXTURE_SIZE", min: 0, },
        { pname: "MAX_3D_TEXTURE_SIZE", min: 256, },
        // Since the texture atlas is 32*16, there are 512 textures.
        // TODO: Use multiple texture arrays instead of a single texture array
        // { pname: "MAX_ARRAY_TEXTURE_LAYERS", min: 256, },
        { pname: "MAX_ARRAY_TEXTURE_LAYERS", min: 512, },
        { pname: "MAX_DRAW_BUFFERS", min: 4, },
        { pname: "MAX_COLOR_ATTACHMENTS", min: 4, },
        { pname: "MAX_VERTEX_UNIFORM_BLOCKS", min: 12, },
        { pname: "MAX_VERTEX_TEXTURE_IMAGE_UNITS", min: 16, },
        { pname: "MAX_FRAGMENT_INPUT_COMPONENTS", min: 60, },
        { pname: "MAX_UNIFORM_BUFFER_BINDINGS", min: 24, },
        { pname: "MAX_COMBINED_UNIFORM_BLOCKS", min: 24, },
    ]) {
        let value = ctx.getParameter(ctx[param.pname]);
        if (typeof value !== "number" || Number.isNaN(value) || value < param.min) {
            ctx = null;
            break;
        }
    }
    return !!ctx;
};

export {
    isWebGL2Context,
    isWebGL2Context as default,
};
