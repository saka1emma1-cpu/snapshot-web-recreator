import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — YARA LUDO ONDO" },
      { name: "description", content: "Top YARA LUDO ONDO players ranked by points and wins." },
      { property: "og:title", content: "Leaderboard — YARA LUDO ONDO" },
      { property: "og:description", content: "Who rules the ludo board? See the top players." },
    ],
  }),
  component: Leaderboard,
});

type Row = { name: string; points: number; wins: number; games: number };

function Leaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    supabase.from("leaderboard").select("name, points, wins, games").order("points", { ascending: false }).limit(50)
      .then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
      <h1 className="mt-4 font-display text-4xl font-extrabold text-primary">🏆 Leaderboard</h1>
      <div className="mt-6 overflow-hidden rounded-3xl bg-card shadow-pop">
        {rows === null && <p className="p-6 text-muted-foreground">Loading…</p>}
        {rows?.length === 0 && <p className="p-6 text-muted-foreground">No games finished yet. Be the first!</p>}
        {rows?.map((r, i) => (
          <div key={r.name} className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-0">
            <span className="w-8 text-xl font-extrabold text-primary">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
            <span className="flex-1 font-semibold">{r.name}</span>
            <span className="text-right text-sm text-muted-foreground">{r.wins}W / {r.games}G</span>
            <span className="w-16 text-right font-bold">{r.points}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
