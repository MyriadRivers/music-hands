import { NormalizedLandmark } from "@mediapipe/tasks-vision";
/**
 * Converts a Landmark to be in the coordinate space of a different Landmark.
 * @param u landmark to be converted
 * @params v landmark that serves as the origin of the new coordinate space.
 * @returns Original landmark converted to be in the new coordinate space.
 */
function toSpace(u: NormalizedLandmark, v: NormalizedLandmark): NormalizedLandmark {
    return { x: u.x - v.x, y: u.y - v.y, z: u.z - v.z };
}

function dot(u: NormalizedLandmark, v: NormalizedLandmark): number {
    return u.x * v.x + u.y * v.y + u.z * v.z;
}

function mag(u: NormalizedLandmark): number {
    return Math.sqrt(Math.pow(u.x, 2) + Math.pow(u.y, 2) + Math.pow(u.z, 2))
}

export function getAngle(t: NormalizedLandmark, u: NormalizedLandmark, v: NormalizedLandmark): number {
    let lineUt = toSpace(t, u);
    let lineUv = toSpace(v, u);
    return Math.acos(dot(lineUt, lineUv) / (mag(lineUt) * mag(lineUv)));
}

export function clamp(n: number, min: number, max: number): number {
    return Math.max(Math.min(n, max), min);
}

export function scale(n: number, min: number, max: number, clamped: boolean): number {
    let num = (n - min) / (max - min);
    return clamped ? clamp(num, 0, 1) : num;
}

/**
 * Converts an angle from radians to degrees. 
 * @param angle Angle to convert.
 * @returns Angle converted to degrees.
 */
export function radToDeg(angle: number): number {
    return angle * (180 / Math.PI);
}