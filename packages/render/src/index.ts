/**
 * @aitower/render — PixiJS v8 renderer for a read-only SimView.
 * Pure helpers (camera, colour, interpolation) are exported for tests and tools.
 */
import type { CreateRenderer } from "@aitower/shared";
import { createPixiRenderer } from "./pixi/renderer";

export const createRenderer: CreateRenderer = (host, content) => createPixiRenderer(host, content);

export * from "./camera";
export { FLOOR_H, TILE, ZOOMS } from "./constants";
export { heatColor, netColor, satisfactionColor, skyColors } from "./color";
export { fitName, planTags, statusWord, type Tag, type TagTone } from "./labelPlan";
