
import { Page, pm } from "./Page.js";

import { edm } from "../../utils/EventDispatcher.js";
import { RESOURCES } from "../../utils/loadResources.js";

let preloadIsDone = false,
    numOfResLoaded = 0,
    totalNumOfResNeedBeLoaded = 0;
const resCount = {};

const sleep = ms => new Promise(s => setTimeout(s, ms));
edm.getOrNewEventDispatcher("mc.load")
.addEventListener("newAwaitRes", function onNewAwaitRes(url, promise) {
    let page = document.getElementsByTagName("mcpage-preload")[0],
        loadingList = page.querySelector("[slot=loading]"),
        loadedList = page.querySelector("[slot=loaded]"),
        li;
    if (!(url in resCount)) {
        ++totalNumOfResNeedBeLoaded;
        page.setProgress(numOfResLoaded, totalNumOfResNeedBeLoaded);
        li = document.createElement("li");
        loadingList.appendChild(li);
    }
    else li = [...loadingList.childNodes].find(l => l.innerHTML.startsWith(url));
    resCount[url] = (resCount[url] || 0) + 1;
    li.innerHTML = url + " (" + resCount[url] + ")";
    promise.then(async _ => {
        // console.log(url, promise);
        await sleep(600);
        li.innerHTML = url + " (" + --resCount[url] + ")";
        if (resCount[url] == 0) {
            ++numOfResLoaded;
            page.setProgress(numOfResLoaded, totalNumOfResNeedBeLoaded);
            loadedList.appendChild(li);
        }
        if (preloadIsDone) return;
        for (let url in resCount) if (resCount[url]) return;
        preloadIsDone = true;
        edm.getOrNewEventDispatcher("mc.preload").dispatchEvent("done", RESOURCES);
        edm.getOrNewEventDispatcher("mc.load").removeEventListener("newAwaitRes", onNewAwaitRes);
    }, err => {
        console.error("preload failed: " + url, err);
    });
});

edm.getOrNewEventDispatcher("mc.preload")
.addEventListener("done", async () => {
    await sleep(777);
    pm.openPageByID("welcome");
    const preloadPage = document.querySelector("mcpage-preload");
    preloadPage.style.opacity = 0;
    await sleep(1100);
    pm.closePage("preload");
}, { once: true, });

// To display preload page as soon as possible,
// this page is a special case of moving elements to template after display.
const template = document.createElement("template");
let firstTimeOpen = true;
class PreloadPage extends Page {
    get template() { return firstTimeOpen? null: template; };
    onConnected() {
        if (!firstTimeOpen) return;
        firstTimeOpen = false;
        let style = document.getElementById(this.pageID);
        let reg = new RegExp(this.pageID, "g");
        style.innerHTML = style.innerHTML.replace(reg, ":host");
        style.removeAttribute("id");
        style.parentElement.removeChild(style);
        template.content.appendChild(style);
        [...this.querySelectorAll("mcpage-preload > :not([slot])")]
            .forEach(dom => template.content.appendChild(dom));
        template.id = this.pageID;
        this.appendTemplate(document.head.appendChild(template));
    };
    async setProgress(value, max) {
        const root = firstTimeOpen? this: this.shadowRoot;
        let progress = root.querySelector("progress");
        progress.value = value;
        progress.max = max;
        root.querySelector(".loadingCount").innerHTML = value;
        root.querySelector(".loadedCount").innerHTML = max;
    };
}

PreloadPage.define();


export {
    PreloadPage,
};
