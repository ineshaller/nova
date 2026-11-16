-- =====================================================================
--  NOVA — Schéma de la base de données (Supabase / PostgreSQL)
--  À exécuter UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Ensuite, exécuter seed.sql pour remplir le contenu de départ.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PROFILS (un par compte, créé automatiquement à l'inscription)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  prenom      text not null default '' check (char_length(prenom) <= 40),
  niveau      text not null default 'lyc' check (niveau in ('col','lyc','etu','pro')),
  interets    text[] not null default '{}',
  ville       text not null default '' check (char_length(ville) <= 60),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Est-ce que la personne connectée est administratrice de Nova ?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Création automatique du profil à l'inscription (données envoyées par le formulaire)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lvl text := coalesce(nullif(new.raw_user_meta_data->>'niveau', ''), 'lyc');
begin
  if lvl not in ('col','lyc','etu','pro') then lvl := 'lyc'; end if;
  insert into public.profiles (id, prenom, niveau, interets, ville)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'prenom', ''), 40),
    lvl,
    coalesce(array(
      select jsonb_array_elements_text(
        case when jsonb_typeof(new.raw_user_meta_data->'interets') = 'array'
             then new.raw_user_meta_data->'interets' else '[]'::jsonb end)
    ), '{}'),
    left(coalesce(new.raw_user_meta_data->>'ville', ''), 60)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profil : lecture de son profil" on public.profiles;
create policy "profil : lecture de son profil" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profil : modification de son profil" on public.profiles;
create policy "profil : modification de son profil" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Une personne ne peut modifier QUE ces colonnes (jamais is_admin)
revoke update on public.profiles from anon, authenticated;
grant  update (prenom, niveau, interets, ville, updated_at) on public.profiles to authenticated;

-- Suppression de son propre compte (profil + favoris supprimés en cascade)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 2. ÉVÉNEMENTS (agenda + propositions à valider)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id            text primary key default gen_random_uuid()::text,
  start_date    date not null,
  end_date      date,
  title         text not null check (char_length(title) between 3 and 160),
  org           text not null default '',
  place         text not null default '',
  cat           text not null check (cat in ('jour','rencontre','prix','emploi','campagne')),
  pub           text[] not null default '{all}',
  status        text not null default 'ok' check (status in ('ok','est','year','prop')),
  description   text not null default '',
  url           text,
  published     boolean not null default true,
  submitted_by  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

alter table public.events enable row level security;

drop policy if exists "événements : lecture" on public.events;
create policy "événements : lecture" on public.events
  for select using (published or submitted_by = auth.uid() or public.is_admin());

-- Toute personne connectée peut proposer ; la proposition reste invisible jusqu'à validation
drop policy if exists "événements : proposer" on public.events;
create policy "événements : proposer" on public.events
  for insert to authenticated
  with check (published = false and status = 'prop' and submitted_by = auth.uid());

drop policy if exists "événements : admin modifie" on public.events;
create policy "événements : admin modifie" on public.events
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "événements : admin supprime" on public.events;
create policy "événements : admin supprime" on public.events
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. FORMATIONS et ACTEURS (lecture publique, écriture admin)
-- ---------------------------------------------------------------------
create table if not exists public.formations (
  id          text primary key,
  name        text not null,
  type        text not null check (type in ('ing','prepa','but','licence','bts')),
  acces       text[] not null default '{postbac}',
  statut      text not null default '',
  lieu        text not null default '',
  domaines    text[] not null default '{}',
  description text not null default '',
  mixite      text,            -- action pour les filles (badge rose). <b>gras</b> autorisé
  url         text,
  sort        int not null default 100
);

create table if not exists public.actors (
  id          text primary key,
  name        text not null,
  match_key   text not null,  -- texte cherché dans events.org pour compter les événements
  initials    text not null default '',
  url         text,
  pub         text[] not null default '{}',
  description text not null default '',
  sort        int not null default 100
);

alter table public.formations enable row level security;
alter table public.actors     enable row level security;

drop policy if exists "formations : lecture" on public.formations;
create policy "formations : lecture" on public.formations for select using (true);
drop policy if exists "formations : admin" on public.formations;
create policy "formations : admin" on public.formations for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "acteurs : lecture" on public.actors;
create policy "acteurs : lecture" on public.actors for select using (true);
drop policy if exists "acteurs : admin" on public.actors;
create policy "acteurs : admin" on public.actors for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. VIDÉOS (onglet Découverte) + stockage des fichiers
-- ---------------------------------------------------------------------
create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 2 and 120),
  person      text not null check (char_length(person) between 1 and 80),
  role        text not null check (role in ('ing','etu','cher','tech')),
  domain      text,
  org         text not null default '',
  description text not null default '',
  file_path   text,            -- chemin dans le bucket "videos"
  poster_path text,            -- image d'aperçu (facultatif)
  link        text,            -- OU lien YouTube / Vimeo
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (file_path is not null or link is not null)
);

alter table public.videos enable row level security;

drop policy if exists "vidéos : lecture" on public.videos;
create policy "vidéos : lecture" on public.videos for select using (true);
drop policy if exists "vidéos : admin" on public.videos;
create policy "vidéos : admin" on public.videos for all
  using (public.is_admin()) with check (public.is_admin());

-- Bucket de stockage public (lecture pour tous), 50 Mo max par fichier
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800,
        array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vidéos fichiers : lecture" on storage.objects;
create policy "vidéos fichiers : lecture" on storage.objects
  for select using (bucket_id = 'videos');

drop policy if exists "vidéos fichiers : admin ajoute" on storage.objects;
create policy "vidéos fichiers : admin ajoute" on storage.objects
  for insert to authenticated with check (bucket_id = 'videos' and public.is_admin());

drop policy if exists "vidéos fichiers : admin supprime" on storage.objects;
create policy "vidéos fichiers : admin supprime" on storage.objects
  for delete to authenticated using (bucket_id = 'videos' and public.is_admin());

-- ---------------------------------------------------------------------
-- 5. FAVORIS (chaque personne ne voit et ne modifie que les siens)
-- ---------------------------------------------------------------------
create table if not exists public.favorites (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_type   text not null check (item_type in ('event','formation','video')),
  item_id     text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favoris : lecture" on public.favorites;
create policy "favoris : lecture" on public.favorites
  for select using (user_id = auth.uid());
drop policy if exists "favoris : ajout" on public.favorites;
create policy "favoris : ajout" on public.favorites
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "favoris : suppression" on public.favorites;
create policy "favoris : suppression" on public.favorites
  for delete using (user_id = auth.uid());
