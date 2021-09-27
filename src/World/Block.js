import { asyncLoadResByUrl } from "../utils/loadResources.js";
import { textureMipmapByTile, blockInventoryTexture } from "../processingPictures.js";

let defaultBlockTextureImg = null;
asyncLoadResByUrl("texture/terrain-atlas.png").then(img => {
    defaultBlockTextureImg = img;
    textureMipmapByTile(img);
});

const BlockRenderType = {
    NORMAL: Symbol("block render type: normal"),
    FLOWER: Symbol("block render type: flower"),
    CACTUS: Symbol("block render type: cactus"),
};
// BLOCKS: block name -> block      blockIDs: block id -> [db] -> block
const BLOCKS = {}, blockIDs = new Map();

let blocksCfg = null;
asyncLoadResByUrl("src/World/blocks.json").then(obj => {
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
                return ({[face]: [...vs].map(i => brtv.flower[i]).reduce((ac, d) => {ac.push(...d); return ac;},[])});
            })
            .reduce((ac, o) => ({...ac, ...o}), {}),
        [BlockRenderType.CACTUS]:
            ("x+:12 13 14 15,x-:20 21 22 23,y+:0 1 2 3,y-:4 5 6 7,z+:8 9 10 11,z-:16 17 18 19")
            .split(",").map(s => s.split(":"))
            .map(([face, vs]) => {
                return ({[face]: vs.split(" ").map(i => brtv.cactus[i]).reduce((ac, d) => {ac.push(...d); return ac;},[])});
            })
            .reduce((ac, o) => ({...ac, ...o}), {}),
    };
});

class Block {
    constructor(blockName, {
        opacity = 15,
        luminance = 0,
        renderType = Block.renderType.NORMAL,
        stackable = 64,
        textureImg = defaultBlockTextureImg,
        texture: textureCoord = [[16, 32]],
        friction = 1,
        id = blockIDs.size,
        bd = 0,
        showName = blockName.toLowerCase().replace(/_/g, " ").replace(/^\w|\s\w/g, w => w.toUpperCase()),
        isLeaves = blockName.endsWith("leaves"),
        isGlass = blockName.endsWith("glass"),
        ...others
    } = {}) {
        this.name = blockName;
        this.renderType = renderType;
        this.vertexs = Block.getVertexsByRenderType(renderType);
        this.elements = Block.getElementsByRenderType(renderType);
        this.texture = { img: textureImg, uv: {} };
        this.initTexUV(textureCoord);
        this.opacity = opacity;
        this.luminance = luminance;
        this.stackable = stackable;
        this.friction = friction;
        this.id = id;
        this.bd = bd;
        this.longID = bd << 16 | id;
        if (blockIDs.has(id)) blockIDs.get(id)[bd] = this;
        else {
            let t = []; t[bd] = this;
            blockIDs.set(id, t);
        }
        BLOCKS[blockName] = this;
        this.texture.inventory = blockInventoryTexture(this);
        this.showName = showName;
        this.isLeaves = isLeaves; this.isGlass = isGlass;
        for (let k in others) this[k] = others[k];
    };

    get isOpaque() { return this.opacity === 15; };
    get idAndBd() { let t = [this.id, this.bd]; t.id = t[0]; t.bd = t[1]; return t; };

    initTexUV(texCoord = this.texture.textureCoord) {
        for (let texture of texCoord) {
            let [x, y] = texture;
            texture[0] = y-1; texture[1] = x-1;
        }
        this.texture.coordinate = texCoord;
        let {texture: {img: texImg, uv, coordinate}} = this;
        let xsize = 1 / 32, ysize = 1 / 16,
            calculateOffset = i => texImg.mipmap? i / 4: 0,
            dx = calculateOffset(xsize),
            dy = calculateOffset(ysize),
            cr2uv = ([x, y]) => [
                x*xsize+dx,     y*ysize+dy,
                x*xsize+dx,     (y+1)*ysize-dy,
                (x+1)*xsize-dx, (y+1)*ysize-dy,
                (x+1)*xsize-dx, y*ysize+dy
            ];
        switch (this.renderType) {
            case BlockRenderType.CACTUS:
            case BlockRenderType.NORMAL: {
                if (coordinate.length === 1) {
                    let uvw = cr2uv(coordinate[0]);
                    "x+,x-,y+,y-,z+,z-".split(",").map(k => uv[k] = uvw);
                }
                else if (coordinate.length === 2) {
                    uv["y+"] = uv["y-"] = cr2uv(coordinate[0]);
                    let uvw = cr2uv(coordinate[1]);
                    "x+,x-,z+,z-".split(",").forEach(k => uv[k] = uvw);
                }
                else if (coordinate.length === 3) {
                    uv["y+"] = cr2uv(coordinate[0]);
                    uv["y-"] = cr2uv(coordinate[1]);
                    let uvw = cr2uv(coordinate[2]);
                    "x+,x-,z+,z-".split(",").forEach(k => uv[k] = uvw);
                }
                else if (coordinate.length === 4) {
                    uv["y+"] = cr2uv(coordinate[0]);
                    uv["y-"] = cr2uv(coordinate[1]);
                    uv["x+"] = uv["x-"] = cr2uv(coordinate[2]);
                    uv["z+"] = uv["z-"] = cr2uv(coordinate[3]);
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
    static getVertexsByRenderType(renderType) {
        return blocksCfg.vertexs[renderType];
    };
    static getElementsByRenderType(renderType) {
        return Object.entries(this.getVertexsByRenderType(renderType)).map(([face, vs]) => ({[face]: (len => {
            if (!len) return [];
            let base = [0,1,2, 0,2,3], out = [];
            for(let i=0,j=0; i<len; j=++i*4)
                out.push(...base.map(x => x+j));
            return out;
        })(vs.length/12)})).reduce((ac, o) => ({...ac, ...o}), {});
    };
    static getBlockByBlockName(blockName) {
        return BLOCKS[blockName];
    };
    static getBlockByBlockIDandData(id, bd = 0) {
        return blockIDs.has(id)? blockIDs.get(id)[bd]: undefined;
    };
    static getBlockByBlockLongID(longID) {
        return this.getBlockByBlockIDandData(longID & 0xFFFF, longID >>> 16);
    };
    static listBlocks() {
        return Object.values(BLOCKS);
    };
    static initBlocksByDefault() {
        Object.entries(blocksCfg.blocks).forEach(([blockName, cfg]) => {
            new this(blockName, cfg);
        });
        console.log(BLOCKS)
    };
    static get defaultBlockTextureImg() {
        return defaultBlockTextureImg;
    }
}

export {
    Block,
    Block as default
};
