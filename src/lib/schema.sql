-- ==========================================
-- 1. Create Profiles Table (Syncs with Auth)
-- ==========================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null,
  avatar text not null default 'miner',
  balance numeric(15, 2) not null default 0.00,
  vip_points numeric(15, 2) not null default 0.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view their own profile." 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update their own profile." 
  on public.profiles for update 
  using (auth.uid() = id);

create policy "Users can insert their own profile." 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Trigger to automatically create a profile on new auth user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar, balance, vip_points)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'Miner_' || substring(new.id::text from 1 for 6)),
    coalesce(new.raw_user_meta_data->>'avatar', 'miner'),
    0.00,
    0.00
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ==========================================
-- 2. Create Game Results Table
-- ==========================================
create table public.game_results (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null default auth.uid(),
  game_type text not null,
  bet numeric(15, 2) not null,
  payout numeric(15, 2) not null,
  multiplier numeric(15, 2) not null,
  won boolean not null,
  secret_number text,
  matched_guess text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.game_results enable row level security;

-- Policies
create policy "Users can view their own game history." 
  on public.game_results for select 
  using (auth.uid() = user_id);

create policy "Users can log their own game results." 
  on public.game_results for insert 
  with check (auth.uid() = user_id);


-- ==========================================
-- 3. Create Ledger (Transactions History) Table
-- ==========================================
create table public.ledger (
  id text primary key, -- payment hash or simulated UUID
  user_id uuid references public.profiles(id) on delete cascade not null default auth.uid(),
  type text not null, -- 'deposit' | 'withdrawal' | 'rakeback'
  amount numeric(15, 2) not null,
  fee numeric(15, 2) not null default 0.00,
  crypto_currency text not null default 'USD',
  crypto_amount numeric(24, 8) not null default 0.00000000,
  status text not null default 'completed',
  label text not null,
  txid text,
  address text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.ledger enable row level security;

-- Policies
create policy "Users can view their own ledger history." 
  on public.ledger for select 
  using (auth.uid() = user_id);

create policy "Users can log their own ledger transactions." 
  on public.ledger for insert 
  with check (true);


-- ==========================================
-- 4. Create Payment Sessions Table (Self-Hosted Zero-KYC Payments)
-- ==========================================
create table public.payment_sessions (
  id text primary key,                                                 -- Unique session ID
  user_id uuid references public.profiles(id) on delete cascade not null, -- References player profile
  order_id text not null,                                              -- Casino transaction/order ID
  usd_amount numeric(15, 2) not null,                                  -- Payout USD target value
  crypto_amount numeric(24, 8) not null unique,                        -- Unique amount to track on-chain (e.g. 50.00014829)
  crypto_currency text not null,                                       -- Currency ticker (POL, USDT, BTC, ETH)
  network text not null,                                               -- Blockchain network (Polygon, Solana, native)
  status text not null default 'pending',                              -- 'pending' | 'completed' | 'expired' | 'failed'
  payout_address text not null,                                        -- Owner's outcome wallet where funds were sent
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.payment_sessions enable row level security;

-- Policies
create policy "Users can view their own payment sessions." 
  on public.payment_sessions for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own payment sessions." 
  on public.payment_sessions for insert 
  with check (true);

create policy "Users can update their own payment sessions." 
  on public.payment_sessions for update 
  using (auth.uid() = user_id);


-- ==========================================
-- 5. Create Chat Messages Table
-- ==========================================
create table public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  username text not null,
  avatar_emoji text not null default '💬',
  message text not null,
  bet_shared jsonb,
  is_bot boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.chat_messages enable row level security;

-- Policies
create policy "Anyone can read chat messages."
  on public.chat_messages for select
  using (true);

create policy "Users can insert their own messages."
  on public.chat_messages for insert
  with check (auth.uid() = user_id OR is_bot = true);


-- ==========================================
-- 6. Atomic Balance Update Function (Duping exploit patch)
-- ==========================================
create or replace function public.increment_profile_balance(user_id uuid, amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  current_balance numeric;
  new_balance numeric;
begin
  -- Get current balance and lock the row to prevent concurrent race conditions
  select balance into current_balance
  from public.profiles
  where id = user_id
  for update;

  -- Ensure they have enough funds for subtraction
  if current_balance + amount < 0 then
    raise exception 'Insufficient balance';
  end if;

  -- Perform the atomic update
  update public.profiles
  set balance = balance + amount
  where id = user_id
  returning balance into new_balance;

  return new_balance;
end;
$$;


-- ==========================================
-- 7. Create Promo Codes & Redemptions Tables
-- ==========================================
create table public.promo_codes (
  code text primary key,
  bonus_pct numeric default 10,  -- percentage bonus
  max_bonus numeric default 50,  -- cap in USD
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.promo_codes enable row level security;

-- Policies for promo_codes
create policy "Anyone can read active promo codes."
  on public.promo_codes for select
  using (true);

create policy "Only admin can manage promo codes."
  on public.promo_codes for all
  using (auth.jwt() ->> 'email' = 'patrik12130@gmail.com');

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  code text references public.promo_codes(code) on delete cascade not null,
  deposit_amount numeric(15, 2) not null,
  bonus_amount numeric(15, 2) not null,
  redeemed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, code)
);

-- Enable RLS
alter table public.promo_redemptions enable row level security;

-- Policies for promo_redemptions
create policy "Users can view their own redemptions."
  on public.promo_redemptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own redemptions."
  on public.promo_redemptions for insert
  with check (auth.uid() = user_id);

create policy "Admin can view all redemptions."
  on public.promo_redemptions for select
  using (auth.jwt() ->> 'email' = 'patrik12130@gmail.com');

-- Atomic Balance Increment helper function (accepts p_user_id and p_amount parameters)
create or replace function public.increment_balance(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  new_balance numeric;
begin
  update public.profiles
  set balance = balance + p_amount
  where id = p_user_id
  returning balance into new_balance;

  return new_balance;
end;
$$;

-- Insert default promo codes
insert into public.promo_codes (code, bonus_pct, max_bonus)
values 
  ('WELCOME10', 10, 50),
  ('KP', 5, 10)
on conflict (code) do nothing;

