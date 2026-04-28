-- Async pipeline: leads now begin as 'pending' and a background worker
-- updates them to 'ready' or 'failed'.

create type lead_status as enum ('pending', 'processing', 'ready', 'failed');

alter table leads
  add column status lead_status not null default 'ready',
  add column error text,
  alter column archetype drop not null,
  alter column chart_json drop not null;

-- For polling: index status + slug
create index leads_status_idx on leads (status, created_at desc);

-- Backfill existing rows (we have one test lead) as 'ready'
update leads set status = 'ready' where status is null;

-- Update the public_card view: only expose ready cards
drop view if exists public_card;
create view public_card as
  select slug, name, archetype, status, error, created_at, referrer_slug
  from leads
  where deleted_at is null;
grant select on public_card to anon;
