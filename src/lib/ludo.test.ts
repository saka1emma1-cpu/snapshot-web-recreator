import { describe, it, expect } from "vitest";
import { applyMove, canMove, nextTurn, absIndex } from "./ludo";

describe("ludo rules", () => {
  it("needs a 6 to leave base", () => {
    expect(canMove(0, 5)).toBe(false);
    expect(canMove(0, 6)).toBe(true);
  });
  it("cannot overshoot the finish (57)", () => {
    expect(canMove(55, 3)).toBe(false);
    expect(canMove(55, 2)).toBe(true);
  });
  it("starts at red 0, green 13, blue 26, yellow 39", () => {
    expect(absIndex("red", 1)).toBe(0);
    expect(absIndex("green", 1)).toBe(13);
    expect(absIndex("blue", 1)).toBe(26);
    expect(absIndex("yellow", 1)).toBe(39);
  });
  it("capture sends opponent home and grants extra turn", () => {
    // red step 3 -> abs 2; green at abs 2 = step 42
    const r = applyMove({ id: "r", color: "red", pieces: [1, 0, 0, 0] }, [{ id: "g", color: "green", pieces: [42, 0, 0, 0] }], 0, 2);
    expect(r.captured[0].pieces[0]).toBe(0);
    expect(r.extraTurn).toBe(true);
  });
  it("no capture on safe star", () => {
    // red step 9 -> abs 8 (safe); green abs 8 = step 48
    const r = applyMove({ id: "r", color: "red", pieces: [5, 0, 0, 0] }, [{ id: "g", color: "green", pieces: [48, 0, 0, 0] }], 0, 4);
    expect(r.captured).toHaveLength(0);
  });
  it("6 gives extra turn, others pass", () => {
    expect(applyMove({ id: "r", color: "red", pieces: [10, 0, 0, 0] }, [], 0, 6).extraTurn).toBe(true);
    expect(applyMove({ id: "r", color: "red", pieces: [10, 0, 0, 0] }, [], 0, 3).extraTurn).toBe(false);
    expect(nextTurn("blue", ["red", "blue"])).toBe("red");
  });
});
