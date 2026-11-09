import Logger from "./common/logger.mjs";
import Templates from "./templates.mjs";

const MODULE_NAME = "background-volume";
const VOLUME_FLAG = "volume";

/** Return a safe HTML media volume, retaining the original default of full volume. */
export function normalizeVolume(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return 1;
    return Math.min(1, Math.max(0, value));
}

/** Read the original flag so scenes configured with the upstream module keep their volume. */
export function getVolume(scene) {
    return normalizeVolume(scene.getFlag(MODULE_NAME, VOLUME_FLAG));
}

/** Update a scene volume programmatically. The scene sheet saves through its native form. */
export async function setVolume(scene, volume) {
    const normalized = normalizeVolume(volume);
    if (normalized === scene.getFlag(MODULE_NAME, VOLUME_FLAG)) return;
    await scene.setFlag(MODULE_NAME, VOLUME_FLAG, normalized);
}

/** Add the field to the Foundry v14 ApplicationV2 scene configuration. */
export async function createSceneSlider(sceneConfig, element) {
    const section = element.querySelector('[data-application-part="environment"]')
        ?? element.querySelector('[data-tab="environment"]');
    if (!section) return;

    const sliderHTML = await foundry.applications.handlebars.renderTemplate(Templates.SceneSlider, {
        label: game.i18n.localize(`${MODULE_NAME}.slider-title`),
        hint: game.i18n.localize(`${MODULE_NAME}.slider-hint`),
        id: `${sceneConfig.id}-background-volume`,
        name: `flags.${MODULE_NAME}.${VOLUME_FLAG}`,
        value: getVolume(sceneConfig.document)
    });

    // ApplicationV2 may render only selected parts. Replace an existing field on re-render.
    if (!section.isConnected) return;
    section.querySelector('[data-background-volume]')?.remove();
    const template = element.ownerDocument.createElement("template");
    template.innerHTML = sliderHTML.trim();
    const slider = template.content.firstElementChild;
    if (!slider) {
        Logger.log(Logger.Medium, "Unable to render the scene volume control.");
        return;
    }
    section.prepend(slider);
    const input = slider.querySelector("input");
    input.addEventListener("input", () => {
        slider.querySelector(".range-value").textContent = input.value;
    });
    if (!sceneConfig.isEditable) input.disabled = true;
}
