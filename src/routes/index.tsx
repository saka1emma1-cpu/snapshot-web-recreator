import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { makeCode } from "@/lib/ludo";
import PaidPaymentScreen from "@/components/PaidPaymentScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "YARA LUDO ONDO — Free Multiplayer Ludo" },
      { name: "description", content: "Play classic ludo live with friends on any phone. Create a room, share the code, earn points and climb the leaderboard." },
      { property: "og:title", content: "YARA LUDO ONDO — Free Multiplayer Ludo" },
      { property: "og:description", content: "Create a room, share the code, play live and climb the leaderboard." },
    ],
  }),
  component: Home,
});

function Home() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showPaid, setShowPaid] = useState(false);
  const [isPaidMode, setIsPaidMode] = useState(false);

  useEffect(() => setName((n) => n || (localStorage.getItem("yara:name") ?? "")), []);

  async function createRoom(paid = false) {
    if (!name.trim()) return setErr("Enter your name first");
    if (paid && localStorage.getItem("yara_paid_status") !== "confirmed") {
      setIsPaidMode(true);
      setShowPaid(true);
      return;
    }
    setBusy(true); setErr("");
    localStorage.setItem("yara:name", name.trim());
    if (paid) {
      localStorage.setItem("yara_paid_status", "confirmed");
      localStorage.setItem("yara_paid_room", "true");
    } else {
      localStorage.setItem("yara_paid_status", "free");
      localStorage.removeItem("yara_paid_room");
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const c = makeCode();
      const { error } = await supabase.from("ludo_rooms").insert({ code: c, host_name: name.trim() });
      if (error) continue;
      const { data: p, error: e2 } = await supabase.from("ludo_players")
        .insert({ room_code: c, name: name.trim(), color: "red", is_host: true }).select().single();
      if (e2 || !p) break;
      localStorage.setItem(`yara:player:${c}`, p.id);
      return nav({ to: "/room/$code", params: { code: c } });
    }
    setBusy(false); setErr("Couldn't create a room. Try again.");
  }

  function join() {
    if (!name.trim()) return setErr("Enter your name first");
    if (code.trim().length !== 4) return setErr("Room codes have 4 characters");
    localStorage.setItem("yara:name", name.trim());
    nav({ to: "/room/$code", params: { code: code.trim().toUpperCase() } });
  }

  if (showPaid) {
    return (
      <PaidPaymentScreen onPaid={() => {
        setShowPaid(false);
        createRoom(true);
      }} />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-5 py-10">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center">
        <div className="mb-4 flex justify-center gap-2">
          {["bg-ludo-red", "bg-ludo-green", "bg-ludo-blue", "bg-ludo-yellow"].map((c, i) => (
            <motion.span key={c} className={`h-6 w-6 rounded-full ${c} shadow-pop`} animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }} />
          ))}
        </div>
        <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight text-primary">YARA LUDO<br />ONDO</h1>
        <p className="mt-3 text-muted-foreground">Play. Win. Brag. Live with friends on any phone.</p>
      </motion.header>

      <section className="space-y-4 rounded-3xl bg-card p-5 shadow-pop">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={16} className="h-12 text-lg" />
        
        <Button onClick={() => createRoom(false)} disabled={busy} className="h-14 w-full text-lg font-bold bg-green-600">🎮 Create FREE Room</Button>
        
        <Button onClick={() => createRoom(true)} disabled={busy} className="h-14 w-full text-lg font-bold bg-yellow-500 text-black">💰 Create PAID Room - N500</Button>
        <p className="text-xs text-center">Paid: Pot N2000 | Winner N1600 | You N400 to 8066316416</p>
        
        <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground"><span className="h-px flex-1 bg-border" />or join<span className="h-px flex-1 bg-border" /></div>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" maxLength={4} className="h-12 text-center font-mono text-xl tracking-[0.4em]" />
          <Button onClick={join} variant="secondary" className="h-12 px-6 font-bold">Join</Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </section>

      <div className="flex flex-col gap-2 text-center">
        <Link to="/leaderboard" className="font-semibold text-primary underline-offset-4 hover:underline">🏆 View leaderboard</Link>
        <Link to="/admin" className="text-xs text-muted-foreground">🔐 Admin - Check Winners</Link>
      </div>
      <p className="text-center text-xs text-muted-foreground">Free to play. Win = 100 points, every finished game = 10 points.</p>
    </main>
  );
}
