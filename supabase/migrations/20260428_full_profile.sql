-- Full profile: 5 domains × (teaser, full, citations) + unlock tracking.
alter table leads
  add column if not exists domain_teasers jsonb,
  add column if not exists domain_full   jsonb,
  add column if not exists citations     jsonb,
  add column if not exists unlocked_at   timestamptz,
  add column if not exists unlocked_via  text,
  add column if not exists prompt_version int default 1;

-- Replace public_card view to include teasers (always public for SEO + tease).
drop view if exists public_card;
create view public_card as
  select slug, name, archetype, domain_teasers,
         status, error, created_at, referrer_slug
  from leads
  where deleted_at is null;
grant select on public_card to anon;

-- New view: only rows with unlocked_at IS NOT NULL expose domain_full.
drop view if exists unlocked_card;
create view unlocked_card as
  select slug, name, archetype, domain_teasers, domain_full, citations,
         status, created_at
  from leads
  where deleted_at is null and unlocked_at is not null;
grant select on unlocked_card to anon;
