import { describe, it, expect } from "vitest";
import {
  clampToHall,
  computePixelsPerMeter,
  formatMeters,
  snap,
  snapRotation,
} from "./geometry";

describe("geometry", () => {
  it("computes pxPerM so the hall fits inside viewport", () => {
    const px = computePixelsPerMeter(1000, 600, 20, 10);
    // Begränsas av höjden (600-64)/10 = 53.6 eller (1000-64)/20 = 46.8 → min
    expect(px).toBeCloseTo(Math.min((1000 - 64) / 20, (600 - 64) / 10), 2);
  });

  it("snaps values to the nearest step", () => {
    expect(snap(1.23, 0.25)).toBeCloseTo(1.25);
    expect(snap(1.1, 0.25)).toBeCloseTo(1.0);
    expect(snap(1.37, 0.1)).toBeCloseTo(1.4);
  });

  it("snaps rotation", () => {
    expect(snapRotation(47, 15)).toBe(45);
    expect(Object.is(snapRotation(-7, 15), 0) || snapRotation(-7, 15) === 0).toBe(true);
  });

  it("clamps equipment inside the hall", () => {
    const clamped = clampToHall(-1, 50, 2, 2, 20, 10);
    expect(clamped.x).toBeCloseTo(1); // halva bredden in från vänster
    expect(clamped.y).toBeCloseTo(9); // halva höjden in från botten
  });

  it("formats meters compactly", () => {
    expect(formatMeters(1.5)).toBe("1.5 m");
    expect(formatMeters(1)).toBe("1 m");
    expect(formatMeters(0.25)).toBe("0.25 m");
  });
});
