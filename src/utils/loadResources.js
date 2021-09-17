
const ajaxByUrlAndType = (url, type) => new Promise((s, f) => {
    const ajax = new XMLHttpRequest();
    ajax.onreadystatechange = function() {
        if (this.readyState !== 4) return;
        if (this.status === 200) s(this.response);
        else f(new Error(this.statusText));
    };
    ajax.responseType = type;
    ajax.open("GET", url);
    ajax.send();
});
const getJSON = url => ajaxByUrlAndType(url, "json");
const getText = url => ajaxByUrlAndType(url, "text");
const getImg = url => new Promise((s, f) => {
    const img = new Image();
    img.onload = function() { this.uri = url; s(this); };
    img.onerror = f;
    img.src = url;
});
const getFilename = url => {
    let [filename, filenameNoExt, fileExtension] = url.match(/([^\\\/<>|:"*?]+)\.(\w+$)/);
    return [filename || "", filenameNoExt || "", fileExtension || ""];
};

const RESOURCES = {};

import { edm } from "./EventDispatcher.js";

const RESLoadEventDispatcher = edm.getOrNewEventDispatcher("mc.load");

const awaitResCallbacks = {};
const newAwaitRes = url => {
    let promise = new Promise((resolve, reject) => {
        if (url in RESOURCES) resolve(RESOURCES[url]);
        else if (url in awaitResCallbacks)
            awaitResCallbacks[url].push({resolve, reject});
        else awaitResCallbacks[url] = [{resolve, reject}];
    });
    RESLoadEventDispatcher.dispatchEvent("newAwaitRes", url, promise);
    return promise;
};
const notifyAllAwaitRes = (url, val, {
    status = "resolve",
    type = ""
} = {}) => {
    if (status === "resolve") RESOURCES[url] = val;
    if (url in awaitResCallbacks) {
        awaitResCallbacks[url].forEach(o => o[status](val, status, url, type));
        if (status === "resolve") delete awaitResCallbacks[url];
    }
};
const setResource = (key, val) => notifyAllAwaitRes(key, val);
const waitResource = key => newAwaitRes(key);

const asyncLoadResByUrl = (url, {
    type = {
        png: "img",
        json: "json",
    }[getFilename(url)[2].toLowerCase()] || "text",
} = {}) => {
    // console.log(url);
    if (url in RESOURCES) return Promise.resolve(RESOURCES[url]);
    let handles = [
        res => notifyAllAwaitRes(url, res, { type }),
        err => notifyAllAwaitRes(url, err, { type, status: "reject" })
    ];
    if (url in awaitResCallbacks)
        return newAwaitRes(url);
    else if (type === "img" || type === "png")
        getImg(url).then(...handles);
    else if (type === "json")
        getJSON(url).then(...handles);
    else if (type === "text")
        getText(url).then(...handles);
    return newAwaitRes(url);
};

export {
    asyncLoadResByUrl as default,
    asyncLoadResByUrl,
    RESOURCES,
    setResource, waitResource,
};
