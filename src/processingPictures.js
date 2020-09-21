
class Canvas2D {
    constructor(width = 0, height = 0) {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        if (width > 0 && height > 0)
            this.setSize(width, height);
        return new Proxy(this, {
            get(tar, key) {
                if (key in tar) return tar[key];
                if (key in tar.canvas) return tar.canvas[key].bind(tar.canvas);
                if (key in tar.ctx) return tar.ctx[key].bind(tar.ctx);
            }
        });
    };
    setSize(w, h, smoothing = false, smoothingQuality = 2) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.setImgSmoothingEnabled(smoothing);
        if (smoothing)
            this.setImgSmoothingQuality(smoothingQuality);
    };
    setImgSmoothingEnabled(tf) {
        this.ctx.mozImageSmoothingEnabled    = tf;
        this.ctx.webkitImageSmoothingEnabled = tf;
        this.ctx.msImageSmoothingEnabled     = tf;
        this.ctx.imageSmoothingEnabled       = tf;
        this.ctx.oImageSmoothingEnabled      = tf;
    };
    setImgSmoothingQuality(level = 2) {
        this.ctx.imageSmoothingQuality = (["low", "medium", "high"])[level];
    };
}

// if mipLevel == 0  gen all mip level
export function textureMipmapByTile(img, mipLevel = 1, tileCount = [32, 16]) {
    let canvas = new Canvas2D(),
        w = img.width, h = img.height, mipmap = [],
        [wTileCount, hTileCount] = tileCount,
        singleW = w / wTileCount, singleH = h / hTileCount,
        hSingleW = singleW / 2, hSingleH = singleH / 2;
    /**single tile:
     *                  +----+
     * +--+             |4343|
     * |12| =>          |2121|
     * |34| =>          |4343|
     * +--+             |2121|
     *                  +----+
     */
    w *= 4; h *= 4;
    for (let i = 0; w > wTileCount && h > hTileCount && (mipLevel? i < mipLevel: true) ; ++i) {
        w = (w >>> 1) || w;
        h = (h >>> 1) || h;
        canvas.setSize(w, h);
        let sw = w / wTileCount / 2, sh = h / hTileCount / 2,
            hsw = sw / 2, hsh = sh / 2;
        for (let x = 0; x < wTileCount; ++x)
        for (let y = 0; y < hTileCount; ++y) {
            canvas.drawImage(img, x * singleW + hSingleW, y * singleH + hSingleH, hSingleW, hSingleH,
                x * 2 * sw,           y * 2 * sh, hsw, hsh);
            canvas.drawImage(img, x * singleW,            y * singleH + hSingleH,  singleW, hSingleH,
                x * 2 * sw + hsw,     y * 2 * sh,  sw, hsh);
            canvas.drawImage(img, x * singleW,            y * singleH + hSingleH, hSingleW, hSingleH,
                x * 2 * sw + hsw * 3, y * 2 * sh, hsw, hsh);

            canvas.drawImage(img, x * singleW + hSingleW, y * singleH, hSingleW, singleH,
                x * 2 * sw,           y * 2 * sh + hsh, hsw, sh);
            canvas.drawImage(img, x * singleW,            y * singleH,  singleW, singleH,
                x * 2 * sw + hsw,     y * 2 * sw + hsh,  sw, sh);
            canvas.drawImage(img, x * singleW,            y * singleH, hSingleW, singleH,
                x * 2 * sw + hsw * 3, y * 2 * sh + hsh, hsw, sh);

            canvas.drawImage(img, x * singleW + hSingleW, y * singleH, hSingleW, hSingleH,
                x * 2 * sw,           y * 2 * sh + hsh * 3, hsw, hsh);
            canvas.drawImage(img, x * singleW,            y * singleH,  singleW, hSingleH,
                x * 2 * sw + hsw,     y * 2 * sh + hsh * 3,  sw, hsh);
            canvas.drawImage(img, x * singleW,            y * singleH, hSingleW, hSingleH,
                x * 2 * sw + hsw * 3, y * 2 * sh + hsh * 3, hsw, hsh);
        }
        let mipimg = new Image(w, h);
        mipimg.src = canvas.toDataURL();
        mipmap[i] = mipimg;
    }
    return img.mipmap = mipmap;
}
