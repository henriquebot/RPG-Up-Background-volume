import assert from "node:assert/strict";
import {beforeEach, test} from "node:test";

// Exercise the module's public entry points against the Foundry v14 interfaces.
// These mocks do not replace an integration test in a running Foundry client.
class VideoElement {
    tagName = "VIDEO";
    volume = 1;
    muted = true;
    paused = true;
    currentTime = 23;
}

globalThis.HTMLVideoElement = VideoElement;
globalThis.foundry = {
    applications: {handlebars: {renderTemplate: async () => ""}}
};

const hooks = new Map();
function registerHook(name, callback) {
    const callbacks = hooks.get(name) ?? [];
    callbacks.push(callback);
    hooks.set(name, callbacks);
    return callbacks.length;
}
globalThis.Hooks = {on: registerHook, once: registerHook};

const {getVolume} = await import("../scripts/settings.mjs");
const {default: updateBackgroundVolume} = await import("../scripts/volume.mjs");
await import("../scripts/backgroundVolume.mjs");

let sceneVolume;
let ambientVolume;
let scene;
let background;
let foreground;
let levelVideo;
let tileVideo;
let tokenVideo;

beforeEach(() => {
    sceneVolume = 0.4;
    ambientVolume = 0.5;
    scene = {
        id: "scene-a",
        name: "Viewed scene",
        getFlag(scope, key) {
            assert.equal(scope, "background-volume", "existing scene flags must remain readable");
            assert.equal(key, "volume");
            return sceneVolume;
        }
    };
    background = new VideoElement();
    foreground = new VideoElement();
    levelVideo = new VideoElement();
    tileVideo = new VideoElement();
    tokenVideo = new VideoElement();
    tileVideo.volume = 0.15;
    tokenVideo.volume = 0;
    globalThis.canvas = {
        ready: true,
        scene,
        primary: {
            backgroundSource: background,
            foregroundSource: foreground,
            levelTextures: [{sourceElement: levelVideo}],
            videoMeshes: new Set([
                {sourceElement: background},
                {sourceElement: foreground},
                {sourceElement: levelVideo},
                {sourceElement: tileVideo},
                {sourceElement: tokenVideo}
            ])
        }
    };
    globalThis.game = {
        scenes: {viewed: scene},
        modules: new Map([["background-volume", {version: "2.0.0"}]]),
        settings: {
            get(scope, key) {
                assert.equal(scope, "core");
                assert.equal(key, "globalAmbientVolume");
                return ambientVolume;
            },
            get settings() {
                throw new Error("The module must use the public volume hook instead of patching core settings");
            }
        }
    };
});

test("reads original scene flags, preserving mute and full-volume values", () => {
    assert.equal(getVolume(scene), 0.4);
    sceneVolume = 0;
    assert.equal(getVolume(scene), 0);
    sceneVolume = 1;
    assert.equal(getVolume(scene), 1);
});

test("normalizes missing, invalid, and out-of-range scene volumes", () => {
    for (const invalid of [undefined, null, "", "invalid", NaN, Infinity, -Infinity]) {
        sceneVolume = invalid;
        assert.equal(getVolume(scene), 1, `invalid flag ${String(invalid)} should use the default`);
    }
    sceneVolume = -0.2;
    assert.equal(getVolume(scene), 0);
    sceneVolume = 1.5;
    assert.equal(getVolume(scene), 1);
});

test("combines scene and client ambient volume for background, foreground, and level videos", () => {
    updateBackgroundVolume();
    for (const video of [background, foreground, levelVideo]) {
        assert.equal(video.volume, 0.2);
        assert.equal(video.muted, true);
        assert.equal(video.paused, true);
        assert.equal(video.currentTime, 23);
    }
    assert.equal(tileVideo.volume, 0.15, "tile audio has its own volume setting");
    assert.equal(tokenVideo.volume, 0, "animated token audio must remain untouched");
});

test("uses canvas.scene when the viewed-scene collection is stale", () => {
    game.scenes.viewed = {id: "scene-old", getFlag: () => 0.9};
    updateBackgroundVolume();
    assert.equal(background.volume, 0.2);
});

test("scene mute and client ambient mute each silence the scene video", () => {
    sceneVolume = 0;
    updateBackgroundVolume();
    assert.equal(background.volume, 0);
    sceneVolume = 0.8;
    ambientVolume = 0;
    updateBackgroundVolume();
    assert.equal(background.volume, 0);
});

test("normalizes the ambient setting before assigning HTML media volume", () => {
    sceneVolume = 1;
    for (const [value, expected] of [[-0.5, 0], [2, 1], [NaN, 1], [undefined, 1]]) {
        ambientVolume = value;
        updateBackgroundVolume();
        assert.equal(background.volume, expected);
    }
});

test("ignores image sources and tolerates empty level textures", () => {
    const image = {tagName: "IMG"};
    canvas.primary.backgroundSource = image;
    canvas.primary.foregroundSource = null;
    canvas.primary.levelTextures = [{sourceElement: image}, {sourceElement: null}, {}];
    assert.doesNotThrow(updateBackgroundVolume);
    assert.equal(Object.hasOwn(image, "volume"), false);
    canvas.primary.levelTextures = [];
    assert.doesNotThrow(updateBackgroundVolume);
});

test("does not fail when the canvas is disabled or no scene is viewed", () => {
    canvas.ready = false;
    assert.doesNotThrow(updateBackgroundVolume);
    canvas.scene = null;
    game.scenes.viewed = null;
    assert.doesNotThrow(updateBackgroundVolume);
    globalThis.canvas = undefined;
    assert.doesNotThrow(updateBackgroundVolume);
});

async function fireHook(name, ...args) {
    for (const callback of hooks.get(name) ?? []) await callback(...args);
    // Permit redraw-triggered callbacks to defer work until the current update finishes.
    await new Promise(resolve => setTimeout(resolve, 10));
}

test("registers public lifecycle hooks and responds only to the current scene", async () => {
    await fireHook("init");
    await fireHook("ready");
    for (const name of [
        "renderSceneConfig", "canvasReady", "drawPrimaryCanvasGroup",
        "globalAmbientVolumeChanged", "updateScene", "updateLevel"
    ]) {
        assert.ok(hooks.has(name), `missing ${name} hook`);
    }

    background.volume = 0.85;
    await fireHook("updateScene", {id: "scene-other"}, {name: "Unrelated edit"}, {}, "user-a");
    assert.equal(background.volume, 0.85);
    await fireHook("updateLevel", {parent: {id: "scene-other"}}, {}, {}, "user-a");
    assert.equal(background.volume, 0.85);

    // Real update payloads do not need to contain changed._id.
    await fireHook("updateScene", scene, {flags: {"background-volume": {volume: 0.4}}}, {}, "user-a");
    assert.equal(background.volume, 0.2);

    background.volume = 0.85;
    await fireHook("updateLevel", {parent: scene}, {background: {src: "new.webm"}}, {}, "user-a");
    assert.equal(background.volume, 0.2);

    for (const [name, args] of [
        ["canvasReady", [canvas]],
        ["drawPrimaryCanvasGroup", [canvas.primary, {}]],
        ["globalAmbientVolumeChanged", [0.5]]
    ]) {
        background.volume = 0.85;
        await fireHook(name, ...args);
        assert.equal(background.volume, 0.2, `${name} should restore the scene multiplier`);
    }
});
