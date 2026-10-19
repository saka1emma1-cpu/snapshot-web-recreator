import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getTacticalAdvice } from "@/lib/coach.functions";
import { absIndex, SAFE, type Color } from "@/lib/ludo";

type P = { name: string; color: string; pieces: number[] };

function describe(s: number, color: Color) {
  if (s === 0) return "in base";
  if (s >= 57) return "finished";
  if (s >= 52) return `home stretch step ${s}`;
  const a = absIndex(color, s)!;
  return `step ${s} (board square ${a}${SAFE.has(a) ? ", safe" : ""})`;
}

export function buildPosition(me: P, players: P[], dice: number | null, diceRolled: boolean) {
  const lines = players.map((p) =>
    `${p.color.toUpperCase()}${p.name === me.name && p.color === me.color ? " (ME)" : ""}: ${p.pieces.map((s, i) => `piece ${i + 1} ${describe(s, p.color as Color)}`).join("; ")}`,
  );
  return `I am ${me.color}. ${diceRolled && dice ? `I just rolled a ${dice}.` : "I haven't rolled yet."}\nBoard squares 0-51 run clockwise; red starts at 0, green 13, blue 26, yellow 39.\n${lines.join("\n")}`;
}

export function Coach({ me, players, dice, diceRolled }: { me: P; players: P[]; dice: number | null; diceRolled: boolean }) {
  const ask = useServerFn(getTacticalAdvice);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState("");
  const [question, setQuestion] = useState("");
  const [advice, setAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true); setError(null); setAdvice(null);
    try {
      const r = await ask({ data: { position, question } });
      if (r.error) setError(r.error); else setAdvice(r.advice);
    } catch { setError("Couldn't reach the coach. Check your connection."); }
    setLoading(false);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) { setPosition(buildPosition(me, players, dice, diceRolled)); setAdvice(null); setError(null); } }}>
      <SheetTrigger asChild>
        <Button variant="secondary" className="h-14 shrink-0 px-3 font-bold" aria-label="Ask the AI coach">🧠 Coach</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader><SheetTitle className="font-display text-2xl text-primary">AI Ludo Coach</SheetTitle></SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          <label className="text-sm text-muted-foreground">Your board position (filled in for you — edit if you like)</label>
          <Textarea value={position} onChange={(e) => setPosition(e.target.value)} rows={6} maxLength={2000} className="font-mono text-xs" />
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Ask something (optional), e.g. Should I chase blue?" />
          <Button onClick={submit} disabled={loading || position.length < 10} className="h-12 w-full font-bold">
            {loading ? "Thinking…" : "Get tactical tips"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {advice && <div className="whitespace-pre-wrap rounded-2xl bg-muted p-4 text-sm leading-relaxed">{advice}</div>}
          <p className="text-xs text-muted-foreground">Tips are AI-powered suggestions — the choice is yours.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
