
import "./globalVeriable.js";

window.addEventListener("contextmenu", e => { if (e.cancelable) e.preventDefault(); }, true);

const updatePixelRatio = () => {
    let dpr = window.devicePixelRatio;
    document.documentElement.style.setProperty("--device-pixel-ratio", dpr);
    window.dispatchEvent(new Event("dprchange"));
    matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", updatePixelRatio, { once: true });
};
updatePixelRatio();


import "./UI/index.js";
import "./processingPictures.js";

localStorage.setItem("mcStorageVer", "v0.0.0");
/*
mcStorageVer v0.0.0:
localStorage: {
    mcStorageVer: 储存格式的版本,
    worlds: {
        [storageID 一般情况下等于数字型的种子]: {
            chunks: {
                [chunkID]: {
                    存放的是和生成出来的原始地形有差异的方块ID
                    [linearBlockIndex]: longID, ...
                }, ...
            }，
            entities: [{
                实体的信息
            }, ...],
            mainPlayer: 实体的uid,
            name: 世界的名称,
            seed: 世界的种子,
            type: 世界的类型,
            createAt: 创建世界时的时间戳,
            modityAt: 最后一次修改世界时的时间戳,
        }, ...
    },
}
*/
