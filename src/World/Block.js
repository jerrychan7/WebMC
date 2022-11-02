import { asyncLoadResByUrl } from "../utils/loadResources.js";
import { textureMipmapByTile, prepareTextureAarray, blockInventoryTexture } from "../processingPictures.js";

class LongID extends Number {
    constructor(id = 0, bd = 0) {
        super(bd << 16 | id);
    };
    get id() { return this & 0xFFFF; };
    get bd() { return this >>> 16 };
};

let defaultBlockTextureImg = null, blocksCfg = null;

const BlockRenderType = {
    NORMAL: Symbol("block render type: normal"),
    FLOWER: Symbol("block render type: flower"),
    CACTUS: Symbol("block render type: cactus"),
    FLUID: Symbol("block render type: fluid"),
};
// BLOCKS: block name -> block      blockIDs: block id -> [db] -> block
const BLOCKS = {}, blockIDs = new Map();

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
        isFluid = renderType == Block.renderType.FLUID,
        maxLevel = 8,
        ...others
    } = {}) {
        this.name = blockName;
        this.isFluid = isFluid;
        if (isFluid) this.maxLevel = maxLevel - 1;
        // if (renderType == Block.renderType.FLUID)
        //     renderType = Block.renderType.NORMAL;
        this.renderType = renderType;
        this.vertices = Block.getVerticesByRenderType(renderType);
        this.elements = Block.getElementsByRenderType(renderType);
        this.texture = Block.getTexUVByTexCoord({
            renderType, name: blockName,
            coordinate: textureCoord,
            texImg: textureImg,
        });
        this.opacity = opacity;
        this.luminance = luminance;
        this.stackable = stackable;
        this.friction = friction;
        this.id = id;
        this.bd = bd;
        this.longID = new LongID(id, bd);
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

    static getTexUVByTexCoord({
        renderType, name = "Block",
        coordinate = [[16, 32]],
        texImg = defaultBlockTextureImg,
    } = {}) {
        for (let texCoord of coordinate) {
            let [x, y] = texCoord;
            texCoord[0] = y - 1; texCoord[1] = x - 1;
        }
        const uv = {}, ans = { img: texImg, uv, coordinate, };
        let xsize = 1 / 32, ysize = 1 / 16,
            calculateOffset = i => texImg.mipmap? i / 4: 0,
            dx = texImg.texture4array? texImg.texture4array.tileCount[0]: calculateOffset(xsize),
            dy = texImg.texture4array? texImg.texture4array.tileCount[1]: calculateOffset(ysize),
            cr2uv = texImg.texture4array? ([x, y]) => [
                0, 0, (x + y * dx),
                0, 1, (x + y * dx),
                1, 1, (x + y * dx),
                1, 0, (x + y * dx),
            ]: ([x, y]) => [
                x*xsize+dx,     y*ysize+dy, 0,
                x*xsize+dx,     (y+1)*ysize-dy, 0,
                (x+1)*xsize-dx, (y+1)*ysize-dy, 0,
                (x+1)*xsize-dx, y*ysize+dy, 0,
            ];
        switch (renderType) {
        case BlockRenderType.CACTUS:
        case BlockRenderType.NORMAL: {
            switch (coordinate.length) {
            case 1: {
                let uvw = cr2uv(coordinate[0]);
                "x+,x-,y+,y-,z+,z-".split(",").map(k => uv[k] = uvw);
                break; }
            case 2: {
                uv["y+"] = uv["y-"] = cr2uv(coordinate[0]);
                let uvw = cr2uv(coordinate[1]);
                "x+,x-,z+,z-".split(",").forEach(k => uv[k] = uvw);
                break; }
            case 3: {
                uv["y+"] = cr2uv(coordinate[0]);
                uv["y-"] = cr2uv(coordinate[1]);
                let uvw = cr2uv(coordinate[2]);
                "x+,x-,z+,z-".split(",").forEach(k => uv[k] = uvw);
                break; }
            case 4: {
                uv["y+"] = cr2uv(coordinate[0]);
                uv["y-"] = cr2uv(coordinate[1]);
                uv["x+"] = uv["x-"] = cr2uv(coordinate[2]);
                uv["z+"] = uv["z-"] = cr2uv(coordinate[3]);
                break; }
            case 6: {
                "x+,x-,y+,y-,z+,z-".split(",").forEach((k, i) => uv[k] = cr2uv(coordinate[i]));
                break; }
            default: throw name + " texture translate error: array length";
            }
            break; }
        case BlockRenderType.FLOWER: {
            if (coordinate.length > 2) throw name + " texture translate error: array length";
            let uvw = cr2uv(coordinate[0]);
            uv["face"] = [...uvw, ...uvw];
            break; }
        case BlockRenderType.FLUID: {
            if (coordinate.length > 2) throw name + " texture translate error: array length";
            let uvw = cr2uv(coordinate[0]);
            "x+,x-,y+,y-,z+,z-".split(",").forEach(k => uv[k] = uvw);
            break; }
        }
        return ans;
    };
    static get renderType() {
        return BlockRenderType;
    };
    static getVerticesByRenderType(renderType) {
        return blocksCfg.vertices[renderType] || {};
    };
    static getElementsByRenderType(renderType) {
        return Object.entries(this.getVerticesByRenderType(renderType)).map(([face, vs]) => ({[face]: (len => {
            if (!len) return [];
            let base = [0,1,2, 0,2,3], out = [];
            for(let i=0,j=0; i<len; j=++i*4)
                out.push(...base.map(x => x+j));
            return out;
        })(vs.length/12)})).reduce((ac, o) => ({...ac, ...o}), {});
    };
    static getBlockByBlockName(blockName) {
        return BLOCKS[blockName] || null;
    };
    static getBlockByBlockIDandData(id, bd = 0) {
        let blocks = blockIDs.get(id);
        return blocks
            ? blocks[bd] || blocks[0]
            : null;
    };
    static getBlockByBlockLongID(longID) {
        longID = longID instanceof LongID? longID: new LongID(longID);
        return this.getBlockByBlockIDandData(longID.id, longID.bd);
    };
    static listBlocks() {
        return Object.values(BLOCKS);
    };
    static get defaultBlockTextureImg() {
        return defaultBlockTextureImg;
    };
};

Block.preloaded = Promise.all([
asyncLoadResByUrl("texture/terrain-atlas.png").then(img => {
    defaultBlockTextureImg = img;
    if (isSupportWebGL2)
        prepareTextureAarray(img);
    else textureMipmapByTile(img);
}),
asyncLoadResByUrl("src/World/blocks.json").then(obj => {
    // index_renderType = [index -> BlockRenderType[render type]]
    let index_renderType = obj.index_renderType = [];
    Object.entries(obj.block_renderType_index).forEach(([type, i]) => {
        index_renderType[i] = BlockRenderType[type.toUpperCase()];
    });
    // blocksCfg.blocks.renderType = BlockRenderType[render type]
    Object.entries(obj.blocks).forEach(([, block]) => {
        if ("renderType" in block)
            block.renderType = index_renderType[block.renderType];
    });
    let brtv = obj.block_renderType_vertex;
    obj.vertices = {
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
        [BlockRenderType.FLUID]:
            ("x+:2763,x-:0541,y+:0123,y-:4567,z+:1472,z-:3650")
            .split(",").map(s => s.split(":"))
            .map(([face, vs]) => {
                return ({[face]: [...vs].map(i => brtv.fluid[i]).reduce((ac, d) => ac.concat(d), [])});
            })
            .reduce((ac, o) => ({...ac, ...o}), {}),
    };
    blocksCfg = obj;
}),
]).then(() => {
    Object.entries(blocksCfg.blocks).forEach(([blockName, cfg]) => {
        new Block(blockName, cfg);
    });
});


export {
    Block,
    Block as default,
    LongID,
};
