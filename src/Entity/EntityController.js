
import { EventDispatcher } from "../utils/EventDispatcher.js";

class EntityController extends EventDispatcher {
    constructor(entity) {
        super();
        this.entity = entity;
    };
};

export {
    EntityController,
    EntityController as default
};
