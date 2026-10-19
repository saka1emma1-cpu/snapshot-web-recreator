// Pure ludo rules. Piece value: 0 = in base, 1..51 = main track step,
// 52..56 = home stretch, 57 = finished.
export type Color = "red" | "green" | "blue" | "yellow";
export const COLORS: Color[] = ["red", "green", "blue", "yellow"];
export const START: Record<Color, number> = { red: 0, green: 13, blue: 26, yellow: 39 };
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const FINISH = 57;

export const PATH: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

export const STRETCH: Record<Color, [number, number][]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

const BASE_ORIGIN: Record<Color, [number, number]> = {
  red: [0, 0], green: [0, 9], blue: [9, 9], yellow: [9, 0],
};
const CENTER: Record<Color, [number, number]> = {
  red: [7, 6.2], green: [6.2, 7], blue: [7, 7.8], yellow: [7.8, 7],
};

export function absIndex(color: Color, step: number): number | null {
  if (step < 1 || step > 51) return null;
  return (START[color] + step - 1) % 52;
}

/** Grid coordinate [row, col] (can be fractional) for rendering a piece. */
export function piecePos(color: Color, step: number, idx: number): [number, number] {
  if (step === 0) {
    const [r, c] = BASE_ORIGIN[color];
    return [r + 1.5 + (idx >> 1) * 2, c + 1.5 + (idx & 1) * 2];
  }
  if (step >= FINISH) return CENTER[color];
  if (step >= 52) return STRETCH[color][step - 52]!;
  return PATH[absIndex(color, step)!]!;
}

export function canMove(step: number, dice: number): boolean {
  if (step >= FINISH) return false;
  if (step === 0) return dice === 6;
  return step + dice <= FINISH;
}

export function validMoves(pieces: number[], dice: number): number[] {
  return pieces.map((s, i) => (canMove(s, dice) ? i : -1)).filter((i) => i >= 0);
}

export interface PlayerState { id: string; color: Color; pieces: number[] }

export interface MoveResult {
  pieces: number[];
  captured: { id: string; pieces: number[] }[];
  extraTurn: boolean;
  won: boolean;
}

export function applyMove(me: PlayerState, others: PlayerState[], pieceIdx: number, dice: number): MoveResult {
  const pieces = [...me.pieces];
  const cur = pieces[pieceIdx]!;
  const next = cur === 0 ? 1 : cur + dice;
  pieces[pieceIdx] = next;
  const captured: MoveResult["captured"] = [];
  const abs = absIndex(me.color, next);
  if (abs !== null && !SAFE.has(abs)) {
    for (const o of others) {
      let hit = false;
      const op = o.pieces.map((s) => {
        if (absIndex(o.color, s) === abs) { hit = true; return 0; }
        return s;
      });
      if (hit) captured.push({ id: o.id, pieces: op });
    }
  }
  const won = pieces.every((s) => s === FINISH);
  const extraTurn = !won && (dice === 6 || captured.length > 0 || next === FINISH);
  return { pieces, captured, extraTurn, won };
}

export function nextTurn(current: Color, active: Color[]): Color {
  const order = COLORS.filter((c) => active.includes(c));
  const i = order.indexOf(current);
  return order[(i + 1) % order.length]!;
}

export function makeCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
