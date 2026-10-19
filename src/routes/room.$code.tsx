import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Board, colorVar } from "@/components/Board";
import { COLORS, FINISH, applyMove, nextTurn, validMoves, type Color } from "@/lib/ludo";
import { sfx } from "@/lib/sound";
import { Coach } from "@/components/Coach";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — YARA LUDO ONDO` },
      { name: "description", content: `Join ludo room ${params.code} and play live with friends.` },
      { property: "og:title", content: `Join my ludo room ${params.code}` },
      { property: "og:description", content: "Tap to join the game on YARA LUDO ONDO." },
    ],
  }),
  component: RoomPage,
});

type Room = { code: string; host_name: string; status: string; current_turn: string; dice_value: number | null; dice_rolled: boolean; turn_started_at: string; winner_id: string | null };
type Player = { id: string; room_code: string; name: string; color: string; pieces: number[]; is_host: boolean };
const TURN_SECONDS = 30;
const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function RoomPage() {
  const { code } = Route.useParams();
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  const prevPlayers = useRef<Player[]>([]);

  const load = useCallback(async () => {
    const [{ data: r }, { data: ps }] = await Promise.all([
      supabase.from("ludo_rooms").select("*").eq("code", code).maybeSingle(),
      supabase.from("ludo_players").select("*").eq("room_code", code).order("created_at"),
    ]);
    setRoom(r as Room | null);
    const list = (ps ?? []) as unknown as Player[];
    // sounds on diff
    const prev = prevPlayers.current;
    if (prev.length) {
      const captured = list.some((p) => { const o = prev.find((x) => x.id === p.id); return o && p.pieces.some((s, i) => s === 0 && (o.pieces[i] ?? 0) > 0); });
      const moved = list.some((p) => { const o = prev.find((x) => x.id === p.id); return o && JSON.stringify(o.pieces) !== JSON.stringify(p.pieces); });
      if (captured) { sfx.capture(); setShake((s) => s + 1); } else if (moved) sfx.move();
    }
    prevPlayers.current = list;
    setPlayers(list);
  }, [code]);

  useEffect(() => {
    setMyId(localStorage.getItem(`yara:player:${code}`));
    load();
    const ch = supabase.channel(`room-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ludo_rooms", filter: `code=eq.${code}` }, (pl) => {
        const r = pl.new as Room;
        if (r?.dice_rolled) { sfx.dice(); setRolling(true); setTimeout(() => setRolling(false), 500); }
        load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ludo_players", filter: `room_code=eq.${code}` }, () => load())
      .subscribe();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [code, load]);

  const me = players.find((p) => p.id === myId);
  const active = useMemo(() => players.map((p) => p.color as Color), [players]);
  const current = players.find((p) => p.color === room?.current_turn);
  const isMyTurn = !!me && room?.status === "playing" && current?.id === me.id;
  const remaining = room ? Math.max(0, TURN_SECONDS - Math.floor((now - new Date(room.turn_started_at).getTime()) / 1000)) : TURN_SECONDS;

  const passTurn = useCallback(async (from: Color) => {
    await supabase.from("ludo_rooms").update({ current_turn: nextTurn(from, active), dice_rolled: false, turn_started_at: new Date().toISOString() }).eq("code", code);
  }, [active, code]);

  const roll = useCallback(async (actor: Player) => {
    if (busy.current || !room || room.dice_rolled) return;
    busy.current = true;
    const value = 1 + Math.floor(Math.random() * 6);
    await supabase.from("ludo_rooms").update({ dice_value: value, dice_rolled: true }).eq("code", code);
    if (validMoves(actor.pieces, value).length === 0) {
      await new Promise((r) => setTimeout(r, 1100));
      await passTurn(actor.color as Color);
    }
    busy.current = false;
  }, [room, code, passTurn]);

  const move = useCallback(async (actor: Player, idx: number) => {
    if (busy.current || !room?.dice_rolled || !room.dice_value) return;
    if (!validMoves(actor.pieces, room.dice_value).includes(idx)) return;
    busy.current = true;
    const others = players.filter((p) => p.id !== actor.id).map((p) => ({ id: p.id, color: p.color as Color, pieces: p.pieces }));
    const res = applyMove({ id: actor.id, color: actor.color as Color, pieces: actor.pieces }, others, idx, room.dice_value);
    await supabase.from("ludo_players").update({ pieces: res.pieces }).eq("id", actor.id);
    await Promise.all(res.captured.map((c) => supabase.from("ludo_players").update({ pieces: c.pieces }).eq("id", c.id)));
    if (res.won) {
      await supabase.rpc("finish_game", { p_room: code, p_winner: actor.id });
    } else if (res.extraTurn) {
      await supabase.from("ludo_rooms").update({ dice_rolled: false, turn_started_at: new Date().toISOString() }).eq("code", code);
    } else {
      await passTurn(actor.color as Color);
    }
    busy.current = false;
  }, [room, players, code, passTurn]);

  // Auto-play on timeout: current player at 30s; host covers for absent players after 40s.
  useEffect(() => {
    if (!room || room.status !== "playing" || !current || !me) return;
    const overdue = TURN_SECONDS - remaining;
    const elapsed = (now - new Date(room.turn_started_at).getTime()) / 1000;
    const shouldAct = (isMyTurn && elapsed >= TURN_SECONDS) || (me.is_host && !isMyTurn && elapsed >= TURN_SECONDS + 10);
    if (!shouldAct || overdue < 0) return;
    if (!room.dice_rolled) roll(current);
    else if (room.dice_value) {
      const vm = validMoves(current.pieces, room.dice_value);
      if (vm.length) move(current, vm[0]!); else passTurn(current.color as Color);
    }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // Win celebration
  const celebrated = useRef(false);
  useEffect(() => {
    if (room?.status === "ended" && !celebrated.current) {
      celebrated.current = true;
      sfx.win();
      const end = Date.now() + 2500;
      const tick = () => { confetti({ particleCount: 6, spread: 80, origin: { y: 0.3, x: Math.random() } }); if (Date.now() < end) requestAnimationFrame(tick); };
      tick();
    }
  }, [room?.status]);

  if (room === undefined) return <Center>Loading room…</Center>;
  if (room === null) return <Center>Room {code} not found. <Link to="/" className="text-primary underline">Go home</Link></Center>;

  if (!me) {
    if (room.status !== "waiting") return <Center>This game has already started. <Link to="/" className="text-primary underline">Go home</Link></Center>;
    return <JoinForm code={code} players={players} onJoined={(id) => { setMyId(id); load(); }} />;
  }

  if (room.status === "waiting") return <Lobby room={room} players={players} me={me} />;
  if (room.status === "ended") return <EndScreen room={room} players={players} me={me} />;

  const movable = new Set<string>();
  if (isMyTurn && room.dice_rolled && room.dice_value) validMoves(me.pieces, room.dice_value).forEach((i) => movable.add(`${me.id}:${i}`));

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-3 pb-40 pt-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-muted-foreground">Room {code}</span>
        <span className="font-display font-extrabold text-primary">YARA LUDO</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {COLORS.map((c) => {
          const p = players.find((x) => x.color === c);
          if (!p) return <div key={c} />;
          const home = p.pieces.filter((s) => s === FINISH).length;
          const on = room.current_turn === c;
          return (
            <div key={c} className={`rounded-xl bg-card p-2 text-center text-xs transition ${on ? "ring-2 ring-primary scale-105" : "opacity-70"}`}>
              <span className="mx-auto mb-1 block h-3 w-3 rounded-full" style={{ background: colorVar[c] }} />
              <div className="truncate font-bold">{p.name}{p.id === me.id ? " (you)" : ""}</div>
              <div className="text-muted-foreground">{home}/4 home</div>
            </div>
          );
        })}
      </div>
      <Board players={players.map((p) => ({ ...p, color: p.color as Color }))} movable={movable} shake={shake} onPick={(_, i) => move(me, i)} />

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <motion.div
            animate={rolling ? { rotate: [0, 180, 360, 540, 720], scale: [1, 1.3, 1] } : { rotate: 0 }}
            transition={{ duration: 0.5 }}
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-board text-6xl leading-none text-primary-foreground shadow-pop"
          >
            {room.dice_value ? FACES[room.dice_value - 1] : "🎲"}
          </motion.div>
          <Coach me={me} players={players} dice={room.dice_value} diceRolled={room.dice_rolled} />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {isMyTurn ? (room.dice_rolled ? (movable.size ? "Tap a glowing piece" : "No moves…") : "Your turn!") : `${current?.name ?? "…"}'s turn`}
              <span className="ml-2 font-mono" style={{ color: remaining <= 5 ? "var(--destructive)" : undefined }}>⏱ {remaining}s</span>
            </p>
            <Button onClick={() => roll(me)} disabled={!isMyTurn || room.dice_rolled} className="mt-1 h-14 w-full text-xl font-extrabold">
              ROLL
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center gap-2 px-6 text-center text-lg">{children}</main>;
}

function JoinForm({ code, players, onJoined }: { code: string; players: Player[]; onJoined: (id: string) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => setName((n) => n || (localStorage.getItem("yara:name") ?? "")), []);
  const free = COLORS.filter((c) => !players.some((p) => p.color === c));
  async function join() {
    if (!name.trim()) return setErr("Enter your name");
    if (!free.length) return setErr("Room is full (4 players)");
    localStorage.setItem("yara:name", name.trim());
    const { data, error } = await supabase.from("ludo_players").insert({ room_code: code, name: name.trim(), color: free[0]! }).select().single();
    if (error || !data) return setErr("Couldn't join — try again.");
    localStorage.setItem(`yara:player:${code}`, data.id);
    onJoined(data.id);
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5">
      <h1 className="font-display text-4xl font-extrabold text-primary">Join room {code}</h1>
      <p className="text-muted-foreground">{players.length}/4 players waiting</p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={16} className="h-12 text-lg" />
      <Button onClick={join} className="h-14 text-lg font-bold">Join game</Button>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </main>
  );
}

function Lobby({ room, players, me }: { room: Room; players: Player[]; me: Player }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : "";
  const start = async () => {
    const first = COLORS.find((c) => players.some((p) => p.color === c))!;
    await supabase.from("ludo_rooms").update({ status: "playing", current_turn: first, dice_rolled: false, dice_value: null, turn_started_at: new Date().toISOString() }).eq("code", room.code);
  };
  const leave = async () => { await supabase.from("ludo_players").delete().eq("id", me.id); localStorage.removeItem(`yara:player:${room.code}`); window.location.href = "/"; };
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-10">
      <div className="rounded-3xl bg-card p-6 text-center shadow-pop">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Room code</p>
        <p className="font-mono text-6xl font-extrabold tracking-[0.2em] text-primary">{room.code}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); }}>{copied ? "Copied!" : "Copy code"}</Button>
          <Button variant="secondary" className="flex-1" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Play ludo with me on YARA LUDO ONDO! Room ${room.code}: ${url}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="font-bold">Players ({players.length}/4)</h2>
        <AnimatePresence>
          {players.map((p) => (
            <motion.div key={p.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
              <span className="h-5 w-5 rounded-full" style={{ background: colorVar[p.color as Color] }} />
              <span className="flex-1 font-semibold">{p.name}{p.id === me.id ? " (you)" : ""}</span>
              {p.is_host && <span className="text-xs text-primary">HOST</span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {me.is_host ? (
        <Button onClick={start} disabled={players.length < 2} className="h-14 text-lg font-extrabold">
          {players.length < 2 ? "Waiting for players…" : "Start game"}
        </Button>
      ) : (
        <p className="text-center text-muted-foreground">Waiting for {room.host_name} to start…</p>
      )}
      {!me.is_host && <Button variant="ghost" onClick={leave}>Leave room</Button>}
    </main>
  );
}

function EndScreen({ room, players, me }: { room: Room; players: Player[]; me: Player }) {
  const ranked = [...players].sort((a, b) => (b.id === room.winner_id ? 1 : 0) - (a.id === room.winner_id ? 1 : 0) || b.pieces.reduce((s, x) => s + x, 0) - a.pieces.reduce((s, x) => s + x, 0));
  const winner = ranked[0];
  const iWon = winner?.id === me.id;
  const msg = iWon ? `I just won at YARA LUDO ONDO! 🏆 Think you can beat me? Room ${room.code}` : `Just played YARA LUDO ONDO — ${winner?.name} won! Come play.`;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-5 py-10 text-center">
      <motion.h1 initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="font-display text-5xl font-extrabold text-primary">
        {iWon ? "You won! 🏆" : `${winner?.name} wins!`}
      </motion.h1>
      <p className="text-lg">{iWon ? "+100 points" : "+10 points for playing"}</p>
      <div className="flex items-end justify-center gap-3">
        {[ranked[1], ranked[0], ranked[2]].map((p, i) => p && (
          <div key={p.id} className="flex w-24 flex-col items-center gap-2">
            <span className="truncate text-sm font-bold">{p.name}</span>
            <div className="flex w-full items-start justify-center rounded-t-xl pt-2 text-2xl font-extrabold"
              style={{ background: colorVar[p.color as Color], height: [90, 140, 60][i] }}>{[2, 1, 3][i]}</div>
          </div>
        ))}
      </div>
      <Button asChild className="h-14 text-lg font-bold">
        <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
      </Button>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" asChild><Link to="/">Play again</Link></Button>
        <Button variant="secondary" className="flex-1" asChild><Link to="/leaderboard">Leaderboard</Link></Button>
      </div>
    </main>
  );
}
