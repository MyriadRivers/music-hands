export class Vector {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly mag: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.mag = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2));
    }

    /**
     * Converts the vector to be in the coordinate space of a different Vector.
     * @param u Vector that serves as the origin of the new coordinate space.
     * @returns Original vector converted to be in the new coordinate space.
     */
    toSpace(u: Vector): Vector {
        return new Vector(this.x - u.x, this.y - u.y, this.z - u.z);
    }
}

function dot(u: Vector, v: Vector): number {
    return u.x * v.x + u.y * v.y + u.z * v.z;
}

export function getAngle(t: Vector, u: Vector, v: Vector): number {
    let lineUt = t.toSpace(u);
    let lineUv = v.toSpace(u);
    return Math.acos(dot(lineUt, lineUv) / (lineUt.mag * lineUv.mag));
}

/**
 * Converts an angle from radians to degrees. 
 * @param angle Angle to convert.
 * @returns Angle converted to degrees.
 */
export function radToDeg(angle: number): number {
    return angle * (180 / Math.PI);
}