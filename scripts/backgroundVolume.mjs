import Logger from "./common/logger.mjs";
import {createSceneSlider} from "./settings.mjs";
import updateBackgroundVolume from "./volume.mjs";

Hooks.once("init", () => {
    Logger.init("Background Volume", Logger.Medium);
});

Hooks.once("ready", updateBackgroundVolume);
Hooks.on("renderSceneConfig", createSceneSlider);
Hooks.on("canvasReady", updateBackgroundVolume);
Hooks.on("drawPrimaryCanvasGroup", updateBackgroundVolume);
Hooks.on("globalAmbientVolumeChanged", updateBackgroundVolume);

Hooks.on("updateScene", scene => {
    if (scene.id === globalThis.canvas?.scene?.id) updateBackgroundVolume();
});

Hooks.on("updateLevel", level => {
    if (level.parent?.id === globalThis.canvas?.scene?.id) updateBackgroundVolume();
});
