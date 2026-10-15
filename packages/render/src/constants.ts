/** World geometry (world pixels, before camera zoom). */
export const TILE = 16;
export const FLOOR_H = 48;

/** Vertical layout inside one floor cell, measured from the cell's top edge. */
export const SLAB_H = 4; // concrete slab at the bottom of the cell
export const CABLE_Y = 41; // power cable tray (raised floor) just above the slab
export const CABLE_H = 2;
export const PIPE_SUPPLY_Y = 2; // coolant supply pipe along the ceiling
export const PIPE_RETURN_Y = 5;
export const PIPE_H = 2;
export const FAC_TOP = 10; // facility body top
export const FAC_BOTTOM = 41; // facility body bottom (sits on the raised floor)

/** Discrete zoom steps (integer for crisp nearest-neighbour pixels). */
export const ZOOMS = [1, 2, 3, 4] as const;
export const DEFAULT_ZOOM = 2;

/** Extra world pixels the camera may wander past the lot edges. */
export const MARGIN_X = TILE * 12;
export const MARGIN_TOP = FLOOR_H * 4;
export const MARGIN_BOTTOM = FLOOR_H * 2;

/** Keyboard pan speed in screen pixels per second. */
export const PAN_SPEED = 600;

/** If no new tick arrived for this long (ms), treat the view as settled (alpha → 1). */
export const SETTLE_MS = 250;
