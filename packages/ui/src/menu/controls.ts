export interface ControlGroup {
	title: string;
	rows: { keys: string[]; what: string }[];
}

/** Every key and mouse action, as shown in the menu's Controls section. Keep in step with keyboard.ts and the renderer's input. */
export const CONTROLS: ControlGroup[] = [
	{
		title: "Time",
		rows: [
			{ keys: ["Space"], what: "Pause / resume" },
			{ keys: ["1"], what: "Pause" },
			{ keys: ["2", "3", "4", "5"], what: "Speed 1× · 3× · 10× · 30×" },
		],
	},
	{
		title: "Overlays",
		rows: [
			{ keys: ["N", "H", "P", "C"], what: "Normal · Heat · Power · Coolant" },
			{ keys: ["M"], what: "Mute audio" },
			{ keys: ["R"], what: "Department of Research (pauses while open)" },
			{ keys: ["`"], what: "Show / hide the bottom panel" },
		],
	},
	{
		title: "Tools",
		rows: [
			{ keys: ["Left-click"], what: "Use the armed tool, or select" },
			{ keys: ["Left-drag"], what: "Slab, conduit, lift or demolish a span" },
			{ keys: ["X"], what: "Demolish tool (again to leave)" },
			{ keys: ["Right-click"], what: "Back to Select" },
			{ keys: ["Esc"], what: "Cancel tool, then deselect, then menu" },
		],
	},
	{
		title: "Camera",
		rows: [
			{ keys: ["W", "A", "S", "D"], what: "Pan (or the arrow keys)" },
			{ keys: ["Right-drag", "Middle-drag"], what: "Pan" },
			{ keys: ["Wheel"], what: "Zoom toward the cursor" },
		],
	},
];
