-- Rashify v1 schema
create extension if not exists "pgcrypto";

create table leads (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  phone_e164    text not null,
  dob_date      date not null,
  dob_time      time not null,
  birth_place   text not null,
  lat           numeric(9,6) not null,
  lon           numeric(9,6) not null,
  tz_offset     int not null,
  chart_json    jsonb not null,
  archetype     jsonb not null,
  referrer_slug text,
  utm           jsonb,
  ip_hash       text,
  consent_at    timestamptz not null,
  deleted_at    timestamptz,
  created_at    timestamptz default now()
);
create index leads_slug_idx     on leads (slug);
create index leads_phone_idx    on leads (phone_e164);
create index leads_referrer_idx on leads (referrer_slug);
create index leads_created_idx  on leads (created_at desc);

create table geocode_cache (
  query_norm  text primary key,
  lat         numeric(9,6) not null,
  lon         numeric(9,6) not null,
  tz_offset   int not null,
  hit_count   int default 1,
  updated_at  timestamptz default now()
);

create table wa_log (
  id          bigserial primary key,
  lead_id     uuid references leads(id) on delete cascade,
  template    text not null,
  status      text not null,
  payload     jsonb,
  error       text,
  created_at  timestamptz default now()
);

-- RLS: lock all
alter table leads enable row level security;
alter table geocode_cache enable row level security;
alter table wa_log enable row level security;

-- Public view: only safe columns, server queries this for /u/[slug]
create view public_card as
  select slug, name, archetype, created_at, referrer_slug
  from leads
  where deleted_at is null;
grant select on public_card to anon;
