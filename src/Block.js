import {asyncLoadResByUrl} from "./loadResources.js";

let defaultBlockTextureImg = null;
asyncLoadResByUrl("texture/terrain-atlas.png").then(img => defaultBlockTextureImg = img);

const BlockRenderType = {
    NORMAL: Symbol("block render type: normal"),
    FLOWER: Symbol("block render type: flower"),
};
const BLOCKS = {};

let blocksCfg = null;
// asyncLoadResByUrl("src/blocks.json").then(cfg => blocksCfg = cfg);
asyncLoadResByUrl("src/blocks.json").then(obj => {
    blocksCfg = obj;
    // index_renderType = [index -> BlockRenderType[render type]]
    let index_renderType = blocksCfg.index_renderType = [];
    Object.entries(blocksCfg.block_renderType_index).forEach(([type, i]) => {
        index_renderType[i] = BlockRenderType[type.toUpperCase()];
    });
    // blocksCfg.blocks.renderType = BlockRenderType[render type]
    Object.entries(blocksCfg.blocks).forEach(([, block]) => {
        if ("renderType" in block)
            block.renderType = index_renderType[block.renderType];
    });
    let brtv = blocksCfg.block_renderType_vertex;
    blocksCfg.vertexs = {
        [BlockRenderType.NORMAL]:
            ("x+:2763,x-:0541,y+:0123,y-:4567,z+:1472,z-:3650")
            .split(",").map(s => s.split(":"))
            .map(([face, vs]) => {
                return ({[face]: [...vs].map(i => brtv.normal[i]).reduce((ac, d) => {ac.push(...d); return ac;},[])});
            })
            .reduce((ac, o) => ({...ac, ...o}), {}),
        [BlockRenderType.FLOWER]:
            ("face:14630572").split(",").map(s => s.split(":"))
            .map(([face, vs]) => {
                return ({[face]: [...vs].map(i => brtv.normal[i]).reduce((ac, d) => {ac.push(...d); return ac;},[])});
            })
            .reduce((ac, o) => ({...ac, ...o}), {}),
    };
});

export default class Block {
    constructor(blockName, {
        opacity = 15,
        luminance = 0,
        renderType = Block.renderType.NORMAL,
        stackable = 64,
        textureImg = defaultBlockTextureImg,
        texture: textureCoord = [[16, 32]]
    } = {}) {
        this.name = blockName;
        this.renderType = renderType;
        this.vertexs = blocksCfg.vertexs[renderType];
        this.elements = Object.entries(this.vertexs).map(([face, vs]) => ({[face]: (len => {
            if (!len) return [];
            let base = [0,1,2, 0,2,3], out = [];
            for(let i=0,j=0; i<len; j=++i*4)
                out.push(...base.map(x => x+j));
            return out;
        })(vs.length/12)})).reduce((ac, o) => ({...ac, ...o}), {});
        this.texture = { img: textureImg, uv: {} };
        this.changeTexUV(textureCoord);
        this.opacity = opacity;
        this.luminance = luminance;
        this.stackable = stackable;
        BLOCKS[blockName] = this;
    };

    get isOpaque() { return this.opacity === 15; };

    changeTexUV(texCoord) {
        for (let texture of texCoord) {
            let [x, y] = texture;
            texture[0] = y-1; texture[1] = x-1;
        }
        this.texture.coordinate = texCoord;
        let {texture: {img: texImg, uv, coordinate}} = this,
            textureSize = [16*texImg.height/256, texImg.width, texImg.height],
            xsize = 1/(textureSize[1]/textureSize[0]),
            ysize = 1/(textureSize[2]/textureSize[0]),
            calculateOffset = (i, j = 1) => {
                for (; ~~i != i; i *= 10) j /= 10;
                return j;
            },
            //x和y的偏移坐标 防止出现边缘黑条或白线 小数最后一位+1
            dx = calculateOffset(xsize),
            dy = calculateOffset(ysize),
            cr2uv = ([x, y]) => [
                x*xsize+dx,     y*ysize+dy,
                x*xsize+dx,     (y+1)*ysize-dy,
                (x+1)*xsize-dx, (y+1)*ysize-dy,
                (x+1)*xsize-dx, y*ysize+dy
            ];
        switch (this.renderType) {
            case BlockRenderType.NORMAL: {
                if (coordinate.length === 1) {
                    let uvw = cr2uv(coordinate[0]);
                    "x+,x-,y+,y-,z+,z-".split(",").map(k => uv[k] = uvw);
                }
                else if (coordinate.length === 3) {
                    uv["y+"] = cr2uv(coordinate[0]);
                    uv["y-"] = cr2uv(coordinate[1]);
                    let uvw = cr2uv(coordinate[2]);
                    "x+,x-,z+,z-".split(",").forEach(k => uv[k] = uvw);
                }
                else if (coordinate.length === 6) {
                    "x+,x-,y+,y-,z+,z-".split(",").forEach((k, i) => uv[k] = cr2uv(coordinate[i]));
                }
                else throw this.name + " texture translate error: array length";
                break;
            }
            case BlockRenderType.FLOWER: {
                if (coordinate.length > 2)
                    throw this.name + " texture translate error: array length";
                let uvw = cr2uv(coordinate[0]);
                uv["face"] = [...uvw, ...uvw];
                break;
            }
        }
    };

    static get renderType() {
        return BlockRenderType;
    };
    static enrollBlock(block) {
        BLOCKS[block.name] = block;
    };
    static getBlockByBlockName(blockName) {
        return BLOCKS[blockName];
    };
    static initBlocksByDefault() {
        Object.entries(blocksCfg.blocks).forEach(([blockName, cfg]) => {
            this.enrollBlock(new this(blockName, cfg));
        });
    };
}
