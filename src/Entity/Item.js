
import { Entity } from "./Entity.js";

const FOREVER_EXIST = -32768;
const CANNOT_PICKUP = 32767;

class Item extends Entity {
    get isItem() { return true; };
    constructor({
        hitboxes = {
            min: [-0.125, 0, -0.125],
            max: [0.125, 0.25, 0.125],
        },
        age = FOREVER_EXIST,
        health = 5,
        pickupDelay = CANNOT_PICKUP,
        owner = null,
        thrower = null,
        count = 64,
        longID = 1,
        ...entityInitArgs
    } = {}) {
        super(hitboxes, entityInitArgs);
        this.age = age;
        this.health = health;
        this.pickupDelay = pickupDelay;
        this.owner = owner;
        this.thrower = thrower;
        this.count = count;
        this.longID = longID;
    };
    update(dt) {
        super.update(dt);
        if (this.health == 0) this.dispose();
        if (this.age != FOREVER_EXIST) {
            if (this.age < 6000) ++this.age;
            else this.dispose();
        }
        if (this.pickupDelay != CANNOT_PICKUP) {
            if (this.pickupDelay > 0) --this.pickupDelay;
            else {}
        }
    };
    dispose() {
        if (!this.world) return;
        // 从世界中移除该实体
    };
};

export {
    Item as default,
    Item,
    FOREVER_EXIST,
    CANNOT_PICKUP,
};
