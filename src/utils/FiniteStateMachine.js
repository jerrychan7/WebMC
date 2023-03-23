
import { EventDispatcher } from "./EventDispatcher.js";

class FiniteStateMachine extends EventDispatcher {
    constructor({
        id = "",
        initial = "",
        transitions = [],
    } = {}) {
        super();
        this.id = id;
        this.initial = initial;
        this.currentState = initial;
        this.graph = {};
        this.addTransitions(transitions);
    };
    addTransitions(transitions) { transitions.forEach(transition => this.addTransition(transition)); };
    addTransition({
        from, to,
        eventName = from + "=>" + to,
    } = {}) {
        this.graph[from] = this.graph[from] || {};
        this.graph[to] = this.graph[to] || {};
        this.graph[from][to] = eventName;
    };
    transition(to, ...data) {
        const from = this.currentState;
        // console.log(from, "=>", to, this.graph[from]?.[to], data);
        if (!(from in this.graph)) return console.error(`FSM: cannot find state "${from}"`);
        if (!(to in this.graph)) return console.error(`FSM: cannot find state "${to}"`);
        if (!(to in this.graph[from])) return console.error(`FSM: cannot find transition "${from}" => "${to}"`);
        const eventName = this.graph[from][to];
        this.currentState = to;
        this.dispatchEvent(eventName, ...data);
        this.dispatchEvent("transitioned", from, to, eventName, ...data);
    };
};

export {
    FiniteStateMachine,
    FiniteStateMachine as FSM,
};
