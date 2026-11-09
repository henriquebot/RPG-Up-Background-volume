import {getVolume, normalizeVolume} from "./settings.mjs";

/** Apply the scene and local ambience volumes without changing playback or tile audio. */
export default function updateBackgroundVolume() {
    const activeCanvas = globalThis.canvas;
    if (!activeCanvas?.ready || !activeCanvas.scene || !activeCanvas.primary) return;

    const ambient = normalizeVolume(game.settings.get("core", "globalAmbientVolume"));
    const volume = ambient * getVolume(activeCanvas.scene);
    const primary = activeCanvas.primary;
    const sources = new Set([
        primary.backgroundSource,
        primary.foregroundSource,
        ...(primary.levelTextures ?? []).map(mesh => mesh.sourceElement)
    ]);

    // videoMeshes also contains tile and token videos, whose own volume must be preserved.
    for (const source of sources) {
        if (source instanceof HTMLVideoElement) source.volume = volume;
    }
}
