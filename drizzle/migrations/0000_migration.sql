CREATE TABLE public.ludo_rooms (
  code text PRIMARY KEY,
  host_name text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  current_turn text NOT NULL DEFAULT 'red',
  dice_value int,
  dice_rolled boolean NOT NULL DEFAULT false,
  turn_started_at timestamptz NOT NULL DEFAULT now(),
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ludo_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES public.ludo_rooms(code) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  pieces jsonb NOT NULL DEFAULT '[0,0,0,0]',
  is_host boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_code, color)
);
CREATE TABLE public.leaderboard (
  name text PRIMARY KEY,
  points int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  games int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ludo_rooms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ludo_players TO anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
GRANT ALL ON public.ludo_rooms, public.ludo_players, public.leaderboard TO service_role;
ALTER TABLE public.ludo_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms read" ON public.ludo_rooms FOR SELECT USING (true);
CREATE POLICY "rooms create" ON public.ludo_rooms FOR INSERT WITH CHECK (status = 'waiting');
CREATE POLICY "rooms update" ON public.ludo_rooms FOR UPDATE USING (status <> 'ended') WITH CHECK (status <> 'ended');
CREATE POLICY "players read" ON public.ludo_players FOR SELECT USING (true);
CREATE POLICY "players join" ON public.ludo_players FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ludo_rooms r WHERE r.code = room_code AND r.status = 'waiting'));
CREATE POLICY "players update" ON public.ludo_players FOR UPDATE USING (true);
CREATE POLICY "players leave" ON public.ludo_players FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.ludo_rooms r WHERE r.code = room_code AND r.status = 'waiting'));
CREATE POLICY "leaderboard read" ON public.leaderboard FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.finish_game(p_room text, p_winner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record; done boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ludo_players WHERE id = p_winner AND room_code = p_room
     AND pieces = '[57,57,57,57]'::jsonb) THEN RETURN false; END IF;
  UPDATE ludo_rooms SET status = 'ended', winner_id = p_winner
    WHERE code = p_room AND status = 'playing' RETURNING true INTO done;
  IF done IS NULL THEN RETURN false; END IF;
  FOR pl IN SELECT * FROM ludo_players WHERE room_code = p_room LOOP
    INSERT INTO leaderboard(name, points, wins, games)
    VALUES (pl.name, CASE WHEN pl.id = p_winner THEN 100 ELSE 10 END,
            CASE WHEN pl.id = p_winner THEN 1 ELSE 0 END, 1)
    ON CONFLICT (name) DO UPDATE SET
      points = leaderboard.points + EXCLUDED.points,
      wins = leaderboard.wins + EXCLUDED.wins,
      games = leaderboard.games + 1, updated_at = now();
  END LOOP;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.finish_game(text, uuid) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ludo_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ludo_players;