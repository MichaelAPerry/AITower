// @aitower/ui — React HUD, telemetry panels and the pure tool controller.
export { Hud, type HudProps } from "./Hud";
export { createToolController, type ToolController, type ToolControllerOptions } from "./tools/controller";
export { pickAt } from "./tools/pick";
export { lPath, liftSpan, slabSpan } from "./tools/geometry";
export { describeEvent } from "./events";
export { keyAction } from "./keyboard";
export { createMenuController, type MenuController } from "./menu/menuController";
export { escapeStep, type EscapeStep } from "./menu/escape";
export { HEAT_RAMP_COLORBLIND, HEAT_RAMP_TEMPS, heatRamp, hudScale, settingsToCssVars, settingsToClasses } from "./settings";
export { pushNotice, onNotice, type Notice, type Severity } from "./notices";
export * from "./format";
export { nodeState, effectText, unlocksFor, techGate, cheapestAvailable, type TechState } from "./research/tech";
export { clerkVerdict, type ClerkVerdict } from "./clerk/clerk";
export { ledgerNet, loanInfo, takePresets, repayPresets } from "./finance/finance";
