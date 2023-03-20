
import { MCComponent } from "./Component.js";

class MCCrosshairs extends MCComponent {
    get template() {
        return MCComponent.genTemplate(`
            <style>
                :host {
                    background-image: url(texture/icons.png);
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                    pointer-events: none;
                    display: block;
                    width: 32px; height: 32px;
                    margin: auto auto;
                    position: absolute;
                    left: 0; top: 0;
                    bottom: 0; right: 0;
                }
            </style>
        `);
    };
};

MCCrosshairs.define();

export {
    MCCrosshairs,
};

