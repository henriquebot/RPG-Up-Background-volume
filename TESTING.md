# Validation — 2026-11-09

## Automated tests

`npm test`: **9 passed, 0 failed**. Native Node.js tests exercise flag compatibility, volume normalization, scene/client volume multiplication, mute, foreground and level sources, independent tile/token volumes, playback-state preservation, missing/disabled canvas and v14 lifecycle hooks.

## Foundry VTT integration

Executed in **Foundry 14.370**, Node.js 24.19.0, Chromium, with a new isolated world and a minimal test system. Existing user worlds were not used or migrated. Only this module was enabled. Test videos contained generated video and audio tracks.

- Module recognized and activated under its original `background-volume` identifier.
- SceneConfig Environment tab renders the slider with English and pt-BR labels.
- Scene value `0.4` loaded from the original flag; submitting the form saved `0.25` as a number. The value persisted when the sheet and client were reopened.
- Scene value `0.25` × ambient `0.60` produced `0.15` in the real HTMLVideoElement for both background and foreground.
- Tile configured at `0.70` retained the Foundry-computed `0.42` volume while scene videos were at `0.15`.
- Scene mute (`0`) set background and foreground to zero while the tile stayed at `0.42`.
- Switching to an additional v14 Level applied scene `0.50` × ambient `0.60` = `0.30` to its background video.
- Changing the form slider updates its numeric display without saving the flag. Re-rendering the Environment part leaves exactly one module field.
- No console errors or warnings during the final module UI checks.

The browser must receive its normal first user gesture before Foundry unlocks audio and video playback. Volume assertions inspect actual media-element state; this validation does not measure acoustic loudness or cover every game system and third-party module combination.
