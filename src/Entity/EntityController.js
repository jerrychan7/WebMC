
import { EventDispatcher } from "../utils/EventDispatcher.js";

class EntityController extends EventDispatcher {
    constructor(entity = null) {
        super();
        this.setEntity(entity);
    };
    setEntity(entity = null) {
        if (entity === this.entity) return this;
        const lastEntity = this.entity;
        this.entity = entity;
        if (lastEntity) lastEntity.setController(this);
        if (entity) entity.setController(this);
        return this;
    };
    dispose() {
        this.setEntity();
    };
};

export {
    EntityController,
    EntityController as default
};
