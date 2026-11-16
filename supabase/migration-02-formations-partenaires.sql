-- =====================================================================
--  NOVA — Migration 02 : formations open data + événements + partenaires
--
--  À exécuter APRÈS schema.sql (et avant ou après seed.sql, peu importe).
--  Supabase : SQL Editor → New query → coller ce fichier → Run.
--  Réexécutable sans risque : rien n'est supprimé.
--
--  Ce fichier ajoute :
--   1. des colonnes aux formations pour l'import Onisep (source, établissement…) ;
--   2. aux événements : le lien vers une association (actor_id) et l'origine
--      de l'événement (équipe, proposition d'une inscrite, association partenaire) ;
--   3. les partenariats : une personne inscrite peut être reliée à UNE association,
--      et publier / modifier / supprimer les événements de cette association ;
--   4. les demandes de partenariat, validées par les admins ;
--   5. des fonctions réservées aux admins pour gérer tout ça depuis le site.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FORMATIONS : colonnes pour l'open data
-- ---------------------------------------------------------------------
alter table public.formations
  add column if not exists etablissement text,                       -- ex. « IUT de Lannion »
  add column if not exists region        text,                       -- ex. « Bretagne » (filtre du site)
  add column if not exists onisep_url    text,                       -- fiche détaillée sur onisep.fr
  add column if not exists source        text not null default 'manuel', -- 'manuel' ou 'onisep'
  add column if not exists source_id     text,                       -- identifiant chez la source (AF Onisep + UAI)
  add column if not exists last_seen     timestamptz;                -- dernière présence dans le fichier Onisep

do $$ begin
  alter table public.formations add constraint formations_source_check check (source in ('manuel','onisep'));
exception when duplicate_object then null; end $$;

create index if not exists formations_order_idx  on public.formations (sort, name);
create index if not exists formations_source_idx on public.formations (source, last_seen);

-- ---------------------------------------------------------------------
-- 2. ACTEURS : partenariat
-- ---------------------------------------------------------------------
alter table public.actors
  add column if not exists partner      boolean not null default false, -- badge « Partenaire Nova »
  add column if not exists auto_publish boolean not null default true;  -- false = événements relus par l'équipe avant publication

-- ---------------------------------------------------------------------
-- 3. ÉVÉNEMENTS : association liée et origine
-- ---------------------------------------------------------------------
alter table public.events
  add column if not exists actor_id   text references public.actors(id) on delete set null,
  add column if not exists source     text not null default 'equipe',
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.events add constraint events_source_check check (source in ('equipe','proposition','partenaire'));
exception when duplicate_object then null; end $$;

create index if not exists events_actor_idx on public.events (actor_id);

-- Les propositions déjà envoyées gardent leur origine
update public.events set source = 'proposition' where status = 'prop' and source = 'equipe';

-- Avant chaque écriture : date de modification, et nom de l'association
-- comme organisateur si le champ est vide.
create or replace function public.events_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.actor_id is not null and coalesce(trim(new.org), '') = '' then
    select a.name into new.org from public.actors a where a.id = new.actor_id;
  end if;
  return new;
end;
$$;

drop trigger if exists events_before_write on public.events;
create trigger events_before_write
  before insert or update on public.events
  for each row execute function public.events_before_write();

-- ---------------------------------------------------------------------
-- 4. MEMBRES PARTENAIRES (un compte ↔ une association)
-- ---------------------------------------------------------------------
create table if not exists public.partner_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  actor_id   text not null references public.actors(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.partner_members enable row level security;

drop policy if exists "partenaires : lecture" on public.partner_members;
create policy "partenaires : lecture" on public.partner_members
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "partenaires : admin" on public.partner_members;
create policy "partenaires : admin" on public.partner_members
  for all using (public.is_admin()) with check (public.is_admin());

-- Association de la personne connectée (null si elle n'est pas partenaire)
create or replace function public.my_actor_id() returns text
language sql stable security definer set search_path = public as $$
  select actor_id from public.partner_members where user_id = auth.uid();
$$;

-- L'association de la personne connectée publie-t-elle sans relecture ?
create or replace function public.partner_can_publish() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select a.auto_publish from public.partner_members m
    join public.actors a on a.id = m.actor_id
    where m.user_id = auth.uid()
  ), false);
$$;

-- ---------------------------------------------------------------------
-- 5. RÈGLES DE SÉCURITÉ DES ÉVÉNEMENTS (remplacent celles de schema.sql)
-- ---------------------------------------------------------------------
-- Lecture : publiés pour tout le monde ; ses propres propositions ;
-- tout pour les admins ; les brouillons de son association pour les partenaires.
drop policy if exists "événements : lecture" on public.events;
create policy "événements : lecture" on public.events
  for select using (
    published
    or submitted_by = auth.uid()
    or public.is_admin()
    or (actor_id is not null and actor_id = public.my_actor_id())
  );

-- Proposition par une personne inscrite : toujours invisible jusqu'à validation
drop policy if exists "événements : proposer" on public.events;
create policy "événements : proposer" on public.events
  for insert to authenticated
  with check (
    published = false and status = 'prop' and source = 'proposition'
    and actor_id is null and submitted_by = auth.uid()
  );

-- Ajout par l'équipe (admins) depuis le site
drop policy if exists "événements : admin ajoute" on public.events;
create policy "événements : admin ajoute" on public.events
  for insert to authenticated with check (public.is_admin());

-- Les politiques « admin modifie » et « admin supprime » de schema.sql restent valables.

-- Association partenaire : ajoute, modifie et supprime SES événements uniquement
drop policy if exists "événements : association ajoute" on public.events;
create policy "événements : association ajoute" on public.events
  for insert to authenticated
  with check (
    actor_id = public.my_actor_id()
    and source = 'partenaire'
    and submitted_by = auth.uid()
    and status in ('ok','est','year')
    and (published = false or public.partner_can_publish())
  );

drop policy if exists "événements : association modifie" on public.events;
create policy "événements : association modifie" on public.events
  for update to authenticated
  using (source = 'partenaire' and actor_id = public.my_actor_id())
  with check (
    source = 'partenaire'
    and actor_id = public.my_actor_id()
    and status in ('ok','est','year')
    and (published = false or public.partner_can_publish())
  );

drop policy if exists "événements : association supprime" on public.events;
create policy "événements : association supprime" on public.events
  for delete to authenticated
  using (source = 'partenaire' and actor_id = public.my_actor_id());

-- ---------------------------------------------------------------------
-- 6. DEMANDES DE PARTENARIAT
-- ---------------------------------------------------------------------
create table if not exists public.partner_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  org_name    text not null check (char_length(org_name) between 2 and 120),
  actor_id    text references public.actors(id) on delete set null, -- association déjà sur Nova, si connue
  role        text not null default '' check (char_length(role) <= 80), -- fonction dans l'association
  website     text check (website is null or website ~* '^https?://'),
  message     text not null default '' check (char_length(message) <= 1000),
  status      text not null default 'pending' check (status in ('pending','accepted','refused')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references auth.users(id) on delete set null
);

-- Une seule demande en attente par compte
create unique index if not exists partner_requests_one_pending
  on public.partner_requests (user_id) where status = 'pending';

alter table public.partner_requests enable row level security;

drop policy if exists "demandes : lecture" on public.partner_requests;
create policy "demandes : lecture" on public.partner_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "demandes : envoi" on public.partner_requests;
create policy "demandes : envoi" on public.partner_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and decided_at is null and decided_by is null);

drop policy if exists "demandes : admin" on public.partner_requests;
create policy "demandes : admin" on public.partner_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. FONCTIONS RÉSERVÉES AUX ADMINS (appelées depuis « Mon compte → Partenaires »)
-- ---------------------------------------------------------------------
-- Relie un compte à une association (remplace l'ancien lien s'il existe)
create or replace function public.admin_link_partner(p_user uuid, p_actor text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administratrices'; end if;
  if not exists (select 1 from public.actors where id = p_actor) then raise exception 'Association inconnue'; end if;
  insert into public.partner_members (user_id, actor_id, created_by)
  values (p_user, p_actor, auth.uid())
  on conflict (user_id) do update set actor_id = excluded.actor_id, created_by = excluded.created_by, created_at = now();
  update public.actors set partner = true where id = p_actor;
end;
$$;

-- Donne l'accès partenaire à un compte existant, à partir de son e-mail
create or replace function public.admin_add_partner_by_email(p_email text, p_actor text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Réservé aux administratrices'; end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Aucun compte Nova avec cet e-mail : la personne doit d''abord créer son compte sur le site';
  end if;
  perform public.admin_link_partner(uid, p_actor);
end;
$$;

-- Accepte une demande et relie le compte à l'association choisie
create or replace function public.admin_accept_partner_request(p_request uuid, p_actor text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Réservé aux administratrices'; end if;
  select r.user_id into uid from public.partner_requests r where r.id = p_request and r.status = 'pending';
  if uid is null then raise exception 'Demande introuvable ou déjà traitée'; end if;
  perform public.admin_link_partner(uid, p_actor);
  update public.partner_requests
     set status = 'accepted', actor_id = p_actor, decided_at = now(), decided_by = auth.uid()
   where id = p_request;
end;
$$;

-- Liste des comptes partenaires, avec leur e-mail (visible des admins seulement)
create or replace function public.admin_list_partners()
returns table (user_id uuid, email text, prenom text, actor_id text, actor_name text, auto_publish boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, p.prenom, m.actor_id, a.name, a.auto_publish, m.created_at
  from public.partner_members m
  join auth.users u on u.id = m.user_id
  join public.actors a on a.id = m.actor_id
  left join public.profiles p on p.id = m.user_id
  where public.is_admin()
  order by a.name, u.email;
$$;

-- Demandes en attente, avec l'e-mail de la personne (admins seulement)
create or replace function public.admin_list_partner_requests()
returns table (id uuid, user_id uuid, email text, prenom text, org_name text, actor_id text, role text,
               website text, message text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.user_id, u.email::text, p.prenom, r.org_name, r.actor_id, r.role, r.website, r.message, r.created_at
  from public.partner_requests r
  join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  where public.is_admin() and r.status = 'pending'
  order by r.created_at;
$$;

revoke execute on function public.admin_link_partner(uuid, text)            from public, anon;
revoke execute on function public.admin_add_partner_by_email(text, text)    from public, anon;
revoke execute on function public.admin_accept_partner_request(uuid, text)  from public, anon;
revoke execute on function public.admin_list_partners()                     from public, anon;
revoke execute on function public.admin_list_partner_requests()             from public, anon;
grant  execute on function public.admin_link_partner(uuid, text)            to authenticated;
grant  execute on function public.admin_add_partner_by_email(text, text)    to authenticated;
grant  execute on function public.admin_accept_partner_request(uuid, text)  to authenticated;
grant  execute on function public.admin_list_partners()                     to authenticated;
grant  execute on function public.admin_list_partner_requests()             to authenticated;
