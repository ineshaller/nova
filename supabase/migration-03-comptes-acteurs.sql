-- =====================================================================
--  NOVA — Migration 03 : création de compte « acteur »
--
--  À exécuter APRÈS migration-02-formations-partenaires.sql.
--  Supabase : SQL Editor → New query → coller ce fichier → Run.
--  Réexécutable sans risque : rien n'est supprimé.
--
--  Ce fichier ajoute :
--   1. une colonne profiles.account_type : 'perso' (personne) ou 'acteur'
--      (association, école, entreprise, institution…) ;
--   2. une nouvelle version de handle_new_user() : si le compte est créé en
--      tant qu'acteur, une demande de partenariat est enregistrée
--      automatiquement. Les admins la valident dans « Mon compte → Partenaires ».
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILS : type de compte
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists account_type text not null default 'perso';

do $$ begin
  alter table public.profiles add constraint profiles_account_type_check check (account_type in ('perso','acteur'));
exception when duplicate_object then null; end $$;

-- account_type n'est pas dans la liste des colonnes modifiables par la personne
-- (voir schema.sql) : il est fixé à l'inscription, puis seulement par un admin.

-- ---------------------------------------------------------------------
-- 2. INSCRIPTION : profil + demande de partenariat pour les acteurs
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  lvl   text  := coalesce(nullif(meta->>'niveau', ''), 'lyc');
  kind  text  := coalesce(nullif(meta->>'account_type', ''), 'perso');
  org   text  := left(trim(coalesce(meta->>'org_name', '')), 120);
  act   text  := nullif(meta->>'actor_id', '');
  site  text  := nullif(trim(coalesce(meta->>'website', '')), '');
begin
  if lvl  not in ('col','lyc','etu','pro') then lvl := 'lyc'; end if;
  if kind not in ('perso','acteur')        then kind := 'perso'; end if;

  insert into public.profiles (id, prenom, niveau, interets, ville, account_type)
  values (
    new.id,
    left(coalesce(meta->>'prenom', ''), 40),
    lvl,
    coalesce(array(
      select jsonb_array_elements_text(
        case when jsonb_typeof(meta->'interets') = 'array' then meta->'interets' else '[]'::jsonb end)
    ), '{}'),
    left(coalesce(meta->>'ville', ''), 60),
    kind
  );

  -- Compte acteur : on enregistre la demande (valeurs nettoyées pour ne
  -- jamais bloquer l'inscription sur une contrainte de la table).
  if kind = 'acteur' and char_length(org) >= 2 then
    if act is not null and not exists (select 1 from public.actors where id = act) then act := null; end if;
    if site is not null and site !~* '^https?://' then site := null; end if;
    insert into public.partner_requests (user_id, org_name, actor_id, role, website, message)
    values (
      new.id, org, act,
      left(trim(coalesce(meta->>'role', '')), 80),
      left(site, 500),
      left(trim(coalesce(meta->>'message', '')), 1000)
    );
  end if;

  return new;
end;
$$;

-- Le déclencheur on_auth_user_created (schema.sql) appelle déjà cette fonction :
-- rien d'autre à faire.
