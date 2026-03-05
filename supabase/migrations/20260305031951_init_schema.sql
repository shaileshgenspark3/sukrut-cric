CREATE TYPE public.app_role AS ENUM ('core_admin', 'admin', 'captain');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tournament_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_name text NOT NULL DEFAULT 'Sukrut Premier League',
  start_date date,
  end_date date,
  auction_date timestamptz,
  global_purse integer NOT NULL DEFAULT 30000,
  max_male_players integer NOT NULL DEFAULT 7,
  max_female_players integer NOT NULL DEFAULT 2,
  total_teams integer NOT NULL DEFAULT 24,
  is_auction_live boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;

-- Insert default row
INSERT INTO public.tournament_settings (tournament_name) VALUES ('Sukrut Premier League');

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL,
  captain_name text NOT NULL,
  phone_number text,
  team_logo_url text,
  captain_image_url text,
  captain_user_id uuid,
  captain_email text,
  captain_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  category text NOT NULL DEFAULT 'B',
  base_price integer NOT NULL DEFAULT 100,
  playing_role text NOT NULL DEFAULT 'Batsman',
  gender text NOT NULL DEFAULT 'Male',
  is_sold boolean NOT NULL DEFAULT false,
  sold_to_team_id uuid REFERENCES public.teams(id),
  sold_price integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- auction_rules (per-team purse tracking)
CREATE TABLE public.auction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) UNIQUE,
  captain_deduction integer NOT NULL DEFAULT 0,
  starting_purse integer NOT NULL DEFAULT 30000
);
ALTER TABLE public.auction_rules ENABLE ROW LEVEL SECURITY;

-- auction_state (single row, current auction status)
CREATE TABLE public.auction_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_player_id uuid REFERENCES public.players(id),
  current_bid integer NOT NULL DEFAULT 0,
  current_bidder_team_id uuid REFERENCES public.teams(id),
  bid_increment integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'waiting',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auction_state ENABLE ROW LEVEL SECURITY;

-- Insert default row
INSERT INTO public.auction_state (status) VALUES ('waiting');

CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  bid_amount integer NOT NULL,
  is_winning_bid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Security Definer Function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tournament_settings_updated_at BEFORE UPDATE ON public.tournament_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
-- user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Core admin can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'core_admin'));
 
-- tournament_settings
CREATE POLICY "Anyone can read tournament settings" ON public.tournament_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update tournament settings" ON public.tournament_settings FOR UPDATE USING (has_role(auth.uid(), 'core_admin') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert tournament settings" ON public.tournament_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'core_admin') OR has_role(auth.uid(), 'admin'));
 
-- teams
CREATE POLICY "Anyone can read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL USING (has_role(auth.uid(), 'core_admin') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Captains can update own team" ON public.teams FOR UPDATE USING (auth.uid() = captain_user_id);
 
-- players
CREATE POLICY "Anyone can read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Admins can manage players" ON public.players FOR ALL USING (has_role(auth.uid(), 'core_admin') OR has_role(auth.uid(), 'admin'));
 
-- auction_rules
CREATE POLICY "Anyone can read auction rules" ON public.auction_rules FOR SELECT USING (true);
CREATE POLICY "Admins can manage auction rules" ON public.auction_rules FOR ALL USING (has_role(auth.uid(), 'core_admin') OR has_role(auth.uid(), 'admin'));
 
-- auction_state
CREATE POLICY "Anyone can read auction state" ON public.auction_state FOR SELECT USING (true);
CREATE POLICY "Admins can manage auction state" ON public.auction_state FOR ALL USING (has_role(auth.uid(), 'core_admin') OR has_role(auth.uid(), 'admin'));
 
-- bids
CREATE POLICY "Anyone can read bids" ON public.bids FOR SELECT USING (true);
CREATE POLICY "Admins can manage bids" ON public.bids FOR ALL USING (has_role(auth.uid(), 'core_admin') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Captains can place bids" ON public.bids FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM teams WHERE teams.id = bids.team_id AND teams.captain_user_id = auth.uid()));

-- Enable Supabase Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_settings;
