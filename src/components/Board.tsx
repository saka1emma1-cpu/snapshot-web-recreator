import { motion } from "framer-motion";
import { PATH, STRETCH, SAFE, START, piecePos, type Color } from "@/lib/ludo";

export interface BoardPlayer { id: string; color: Color; pieces: number[]; name: string }

const colorVar: Record<Color, string> = {
  red: "var(--ludo-red)", green: "var(--ludo-green)", blue: "var(--ludo-blue)", yellow: "var(--ludo-yellow)",
};
const bases: [Color, number, number][] = [["red", 0, 0], ["green", 0, 9], ["blue", 9, 9], ["yellow", 9, 0]];
const pct = (n: number) => `${(n / 15) * 100}%`;

export function Board({ players, movable, onPick, shake }: {
  players: BoardPlayer[]; movable: Set<string>; onPick: (playerId: string, idx: number) => void; shake: number;
}) {
  const startCells = new Map(Object.entries(START).map(([c, i]) => [i, c as Color]));
  // stack offsets for tokens sharing a cell
  const counts = new Map<string, number>();
  const tokens = players.flatMap((p) =>
    p.pieces.map((s, i) => {
      const [r, c] = piecePos(p.color, s, i);
      const key = `${r},${c}`;
      const n = counts.get(key) ?? 0;
      counts.set(key, n + 1);
      return { p, i, r, c, n, s };
    }),
  );

  return (
    <motion.div
      key={shake}
      animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : {}}
      transition={{ duration: 0.4 }}
      className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-2xl border-4 border-primary bg-board shadow-pop"
    >
      {bases.map(([color, r, c]) => (
        <div key={color} className="absolute p-[2.2%]" style={{ top: pct(r), left: pct(c), width: pct(6), height: pct(6), background: colorVar[color] }}>
          <div className="h-full w-full rounded-xl bg-board" />
        </div>
      ))}
      {PATH.map(([r, c], i) => {
        const sc = startCells.get(i);
        return (
          <div key={i} className="absolute flex items-center justify-center border border-board-line text-[0.6rem] text-muted-foreground"
            style={{ top: pct(r), left: pct(c), width: pct(1), height: pct(1), background: sc ? colorVar[sc] : undefined }}>
            {SAFE.has(i) && !sc ? "★" : null}
          </div>
        );
      })}
      {(Object.keys(STRETCH) as Color[]).flatMap((color) =>
        STRETCH[color].map(([r, c], i) => (
          <div key={color + i} className="absolute border border-board-line"
            style={{ top: pct(r), left: pct(c), width: pct(1), height: pct(1), background: colorVar[color] }} />
        )),
      )}
      <div className="absolute" style={{ top: pct(6), left: pct(6), width: pct(3), height: pct(3),
        background: `conic-gradient(from 45deg, ${colorVar.green} 0 25%, ${colorVar.blue} 0 50%, ${colorVar.yellow} 0 75%, ${colorVar.red} 0)` }} />
      {tokens.map(({ p, i, r, c, n, s }) => {
        const can = movable.has(`${p.id}:${i}`);
        const off = n * 0.18;
        return (
          <motion.button
            key={`${p.id}-${i}`}
            type="button"
            aria-label={`${p.color} piece ${i + 1}`}
            disabled={!can}
            onClick={() => onPick(p.id, i)}
            initial={false}
            animate={{ top: pct(r + off * 0.5), left: pct(c + off), scale: can ? [1, 1.18, 1] : s === 57 ? 0.6 : 1 }}
            transition={{ top: { type: "spring", stiffness: 260, damping: 20 }, left: { type: "spring", stiffness: 260, damping: 20 },
              scale: can ? { repeat: Infinity, duration: 0.8 } : { duration: 0.2 } }}
            className={`absolute z-10 flex items-center justify-center rounded-full border-2 border-foreground/80 ${can ? "ring-4 ring-primary cursor-pointer" : ""}`}
            style={{ width: pct(0.82), height: pct(0.82), margin: pct(0.09), background: colorVar[p.color],
              boxShadow: "inset 0 -3px 0 oklch(0 0 0 / 25%), 0 2px 4px oklch(0 0 0 / 40%)" }}
          >
            <span className="h-1/3 w-1/3 rounded-full bg-board/80" />
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export { colorVar };
