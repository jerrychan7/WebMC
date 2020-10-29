import {preloaded} from "./loadResources.js";
import Block from "./Block.js";
import spa from "./spa.js";
// load resources
import "./processingPictures.js";
spa.addPageByDefault();

spa.addPage("about", "");
spa.addEventListener("about", "load", (lastID) => {
    alert("Dev by qinshou2017.");
    spa.openPage(lastID);
});

preloaded.onloadend(async _ => {
    Block.initBlocksByDefault();
    // Page-driven
    spa.openPage("start_game_page");
});
