
import { EventDispatcher } from "../utils/EventDispatcher.js";

class EntityController extends EventDispatcher {
    constructor(entity = null) {
        super();
        this.setEntity(entity);
    };
    setEntity(entity = null) {
        if (entity === this.entity) return;
        if (this.entity) this.entity.setController(this);
        this.entity = entity;
        if (entity) entity.setController(this);
    };
    dispose() {
        this.setEntity();
    };
};

export {
    EntityController,
    EntityController as default
};
