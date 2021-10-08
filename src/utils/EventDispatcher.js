
class EventDispatcher {
    constructor() {
        this._listeners = {};
        this._IDcount = 0n;
        this._IDmap = new Map();
    };
    hasEventListener(type, listener) {
        return !!(this._listeners[type] && this._listeners[type].find(o => o.listener === listener));
    };
    addEventListener(type, listener, {
        once = false,
    } = {}) {
        if (typeof listener !== "function") return console.warn("Cannot bind a non-function as an event listener!");
        const listeners = this._listeners[type] || [];
        this._listeners[type] = listeners;
        let i = listeners.findIndex(o => o.listener === listener);
        if (i !== -1) return this._IDmap[listeners[i].id];
        let t = { listener, once, type, id: this._IDcount++ };
        this._IDmap.set(t.id, t);
        listeners.push(t);
        return t.id;
    };
    removeEventListenerByID(id) {
        if (typeof id !== "bigint" || !this._IDmap.has(id)) return false;
        let t = this._IDmap.get(id);
        this._IDmap.delete(id);
        let arr = this._listeners[t.type];
        arr.splice(arr.indexOf(t), 1);
        return true;
    };
    removeEventListener(typeOrID, listener) {
        if (this.removeEventListenerByID(typeOrID)) return true;
        const type = typeOrID;
        if (!(type in this._listeners)) return false;
        let arr = this._listeners[type],
            i = arr.findIndex(o => o.listener === listener);
        if (i !== -1) {
            this._IDmap.delete(arr[i].id);
            arr.splice(i, 1);
        }
        return true;
    };
    dispatchEvent(type, ...datas) {
        if (!(type in this._listeners)) return;
        return this._listeners[type].slice(0).map(o => {
            o.listener(...datas);
            if (o.once) this.removeEventListenerByID(o.id);
        });
    };
};

class EventDispatcherManager {
    constructor() {
        this._eventDispatchers = {};
    };
    hasEventDispatcher(name) {
        return !!this._eventDispatchers[name];
    };
    addEventDispatcher(name, eventDispatcher = new EventDispatcher()) {
        return this._eventDispatchers[name] = eventDispatcher;
    };
    getOrNewEventDispatcher(name) {
        if (!(name in this._eventDispatchers))
            this.addEventDispatcher(name);
        return this._eventDispatchers[name];
    };
    removeEventDispatcher(name) {
        delete this._eventDispatchers[name];
    };
};

const eventDispatcherManager = new EventDispatcherManager();

export {
    EventDispatcher,
    eventDispatcherManager,
    eventDispatcherManager as edm,
};
