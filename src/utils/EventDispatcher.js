
class EventDispatcher {
    constructor() {
        this._listeners = {};
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
        if (!listeners.find(o => o.listener === listener))
            listeners.push({ listener, once, });
    };
    removeEventListener(type, listener) {
        if (!(type in this._listeners)) return;
        let arr = this._listeners[type],
            i = arr.findIndex(o => o.listener === listener);
        if (i !== -1) arr.splice(i, 1);
    };
    dispatchEvent(type, ...datas) {
        if (!(type in this._listeners)) return;
        return this._listeners[type].slice(0).map(o => {
            o.listener(...datas);
            if (o.once) this.removeEventListener(type, o.listener);
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
