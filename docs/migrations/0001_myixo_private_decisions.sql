-- Apply ONLY to an approved, dedicated My iXo Supabase project.
-- Do not run against cynthia atom's Projects (fsoaqrfotefiobqyfgiq) or AdLift.
-- This table is accessed exclusively from the My iXo server with an elevated
-- project secret key AFTER verifying the native iXo account with /auth/me.
create table if not exists public.myixo_decisions (
  id uuid primary key,
  owner_id text not null check (length(owner_id) between 1 and 256),
  revision integer not null default 1 check (revision > 0),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists myixo_decisions_owner_updated_idx
  on public.myixo_decisions(owner_id,updated_at desc);
alter table public.myixo_decisions enable row level security;
revoke all on table public.myixo_decisions from anon, authenticated, public;
-- No anonymous or browser-user policies. Elevated server secret only.
-- The server requires /auth/me on every request and strictly filters owner_id.
comment on table public.myixo_decisions is 'Dedicated private My iXo decision continuity records; do not use ATOM shared Mission Control.';
