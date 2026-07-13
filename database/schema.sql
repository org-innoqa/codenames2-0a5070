CREATE TABLE IF NOT EXISTS rooms (
    code text PRIMARY KEY,
    status text NOT NULL DEFAULT 'lobby', -- 'lobby', 'playing', 'ended'
    turn text NOT NULL DEFAULT 'red', -- 'red', 'blue'
    winner text,
    clue_word text,
    clue_count integer,
    guesses_left integer,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code text NOT NULL,
    nickname text NOT NULL,
    team text NOT NULL, -- 'red', 'blue'
    role text NOT NULL, -- 'spymaster', 'operative'
    last_active timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code text NOT NULL,
    word text NOT NULL,
    color text NOT NULL, -- 'red', 'blue', 'neutral', 'assassin'
    revealed boolean DEFAULT false,
    card_index integer NOT NULL
);

CREATE TABLE IF NOT EXISTS game_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code text NOT NULL,
    message text NOT NULL,
    created_at timestamptz DEFAULT now()
);