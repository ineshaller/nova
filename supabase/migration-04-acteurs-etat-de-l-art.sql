-- =====================================================================
--  NOVA — Migration 04 : page « Acteurs » enrichie (état de l'art)
--
--  À exécuter APRÈS schema.sql et seed.sql (et la migration 02).
--  Supabase : SQL Editor → New query → coller ce fichier → Run.
--  Réexécutable sans risque : les fiches sont mises à jour, rien n'est supprimé.
--
--  Ce fichier ajoute :
--   1. de nouvelles colonnes aux acteurs :
--        kind       : type de structure (association, entreprise, institution…)
--        scope      : échelle (france / europe / international)
--        approaches : familles de solutions (clés de APPROACHES dans src/lib/constants.js)
--        programmes : principaux programmes ou dispositifs
--        takeaway   : « Ce que nous en retenons »
--   2. les acteurs étudiés dans l'état de l'art (nouveaux ou mis à jour).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------
alter table public.actors
  add column if not exists kind       text   not null default 'asso',
  add column if not exists scope      text   not null default 'france',
  add column if not exists approaches text[] not null default '{}',
  add column if not exists programmes text   not null default '',
  add column if not exists takeaway   text   not null default '';

do $$ begin
  alter table public.actors add constraint actors_kind_check
    check (kind in ('asso','ecole','entreprise','institution','fondation'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.actors add constraint actors_scope_check
    check (scope in ('france','europe','international'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Fiches
--    Les colonnes match_key / initials des fiches existantes sont conservées
--    (elles servent à compter les événements de l'agenda).
-- ---------------------------------------------------------------------
insert into public.actors (id, name, match_key, initials, url, pub, description, sort, kind, scope, approaches, programmes, takeaway) values

('eb-0', 'Elles bougent', 'Elles bougent', 'EB', 'https://www.ellesbougent.com',
 array['col','lyc','etu']::text[],
 'Association qui fait découvrir les métiers d''ingénieure et de technicienne tout au long du parcours scolaire, de l''école primaire aux études supérieures, grâce à un réseau de marraines dans les entreprises et écoles partenaires.',
 10, 'asso', 'france', array['roles','immersion','projets']::text[],
 'Elles bougent en primaire (marraine en classe, visite, restitution) · J''Explore (collège) · Premiers Stages (stage de 3e) · Challenge Innovatech (lycéennes, étudiantes et marraines)',
 'L''intérêt de combiner rôles modèles, découverte des métiers, immersion et mise en pratique : avec Innovatech, les participantes ne font pas qu''écouter, elles conçoivent elles-mêmes une solution innovante.'),

('htg', 'HelloTechGirls', 'HelloTechGirls', 'HTG', 'https://www.ece.fr/en/student-life/hello-tech-girls/',
 array['col']::text[],
 'Programme de marrainage destiné aux collégiennes de 4e, accompagnées pendant toute l''année par des étudiantes de l''ECE : rencontres avec leurs marraines, découverte d''une école d''ingénieurs, ateliers et visites d''entreprises.',
 20, 'asso', 'france', array['marrainage']::text[],
 'Marrainage collégiennes de 4e – étudiantes de l''ECE',
 'La proximité du rôle modèle : une étudiante parle d''une expérience récente du lycée et de l''orientation, un parcours plus accessible pour une collégienne. Et l''intérêt d''un accompagnement dans le temps plutôt que d''une intervention ponctuelle.'),

('ellestime', 'ElleStime', 'ElleStime', 'ES', null,
 array['col']::text[],
 'Intervient auprès des jeunes pour lutter contre les stéréotypes associés aux sciences, aux mathématiques et au numérique. Les jeunes filles rencontrent des étudiantes et des professionnelles scientifiques, et les garçons comme les équipes éducatives travaillent aussi sur les stéréotypes de genre.',
 30, 'asso', 'france', array['stereo','roles']::text[],
 'Rencontres avec des scientifiques · ateliers sur les stéréotypes pour les filles, les garçons et les équipes éducatives',
 'Intervenir suffisamment tôt, et travailler aussi sur l''environnement dans lequel les stéréotypes se construisent : le problème ne vient pas uniquement des jeunes filles.'),

('fm-1', 'femmes & mathématiques', 'femmes & mathématiques', 'f&m', 'https://femmes-et-maths.fr',
 array['col','lyc','etu','pro']::text[],
 'Association qui agit pour la place des femmes en mathématiques : Journées « Filles, maths et informatique », marrainage d''élèves, ressources sur les stéréotypes.',
 40, 'asso', 'france', array['stereo','roles']::text[],
 'Journées « Filles, maths et informatique : une équation lumineuse »', ''),

('an-2', 'Animath', 'Animath', 'An', 'https://www.animath.fr',
 array['col','lyc']::text[],
 'Association qui développe le goût des maths chez les jeunes ; co-organise les RJMI et les Journées Filles, maths et informatique.',
 50, 'asso', 'france', array['projets']::text[],
 'Rendez-vous des jeunes mathématiciennes et informaticiennes (RJMI)', ''),

('sf', 'Science Factor', 'Science Factor', 'SF', 'https://www.sciencefactor.fr',
 array['col','lyc']::text[],
 'Concours pour les élèves de la sixième à la terminale : en équipe, ils imaginent un projet scientifique ou technique innovant à impact positif. Chaque équipe doit être pilotée par une fille.',
 60, 'asso', 'france', array['projets']::text[],
 'Concours Science Factor (6e à terminale)',
 'Donner aux filles une vraie responsabilité de cheffe de projet : la confiance se construit aussi en étant placée en situation de décider, de diriger un projet et de présenter ses idées.'),

('wifilles', 'WI-FIlles', 'WI-FIlles', 'WiF', 'https://www.fondationface.org',
 array['col','lyc']::text[],
 'Programme national de la Fondation FACE consacré à la découverte des métiers techniques de l''informatique : ateliers pratiques autour du numérique, travail sur l''orientation, et encouragement à devenir ambassadrice du numérique.',
 70, 'fondation', 'france', array['tech']::text[],
 'Parcours d''ateliers numériques pour collégiennes et lycéennes (selon les antennes locales FACE)',
 'Faire pratiquer plutôt que seulement informer, et permettre à une participante de passer du statut de personne accompagnée à celui de personne qui en inspire d''autres.'),

('becomtech', 'BECOMTECH', 'BECOMTECH', 'BT', 'https://www.becomtech.fr',
 array['lyc','etu']::text[],
 'Association centrée sur la pratique : initiation intensive au numérique pendant les vacances (programmation, sites web, vidéo, métiers du numérique), rencontres avec des professionnelles, puis une communauté d''ambassadrices pour continuer l''accompagnement.',
 80, 'asso', 'france', array['tech','communaute']::text[],
 'JUMP IN TECH (filles de 14 à 17 ans, sans prérequis) · TOGETHER IN TECH (étudiantes du supérieur, contre le décrochage en informatique)',
 'Combiner sensibilisation, apprentissage technique et accompagnement dans le temps, et permettre aux participantes de constater directement qu''elles sont capables de créer quelque chose de technique.'),

('fs-3', 'Femmes & Sciences', 'Femmes & Sciences', 'F&S', 'https://www.femmesetsciences.fr',
 array['col','lyc','etu','pro']::text[],
 'Association qui améliore la visibilité des femmes scientifiques et promeut les carrières scientifiques auprès des jeunes : des scientifiques interviennent dans les établissements pour présenter leurs métiers, leurs recherches et leurs parcours.',
 90, 'asso', 'france', array['roles','stereo']::text[],
 'Interventions en classe · « Sciences, un métier de femmes ! » · ressources contre les stéréotypes · mentorat d''étudiantes',
 'Répondre au manque de visibilité des femmes scientifiques : faire rencontrer aux jeunes des personnes qu''ils n''auraient pas l''occasion de croiser dans leur environnement quotidien.'),

('capfilles', 'Capital Filles', 'Capital Filles', 'CF', 'https://www.capitalfilles.fr',
 array['lyc','etu']::text[],
 'Association qui intervient autour de l''orientation et de l''égalité des chances, avec un marrainage entre des jeunes femmes et des professionnelles pour construire leur projet d''études et leur projet professionnel.',
 100, 'asso', 'france', array['marrainage','orientation']::text[],
 'Marrainage jeunes femmes – professionnelles',
 'Agir au moment où les décisions deviennent concrètes : après avoir découvert que les métiers scientifiques existent, il faut encore savoir quelle formation choisir, comment y accéder et comment construire son parcours.'),

('deviens-inge', 'Deviens Ingé', 'Deviens Ingé', 'DI', 'https://www.deviens-inge.fr',
 array['col','lyc']::text[],
 'Plateforme d''orientation lancée par la CDEFI pour découvrir les formations, les écoles, les métiers et les débouchés de l''ingénierie. Elle s''adresse aux jeunes, mais aussi aux parents et aux enseignants.',
 110, 'institution', 'france', array['orientation']::text[],
 'Portail www.deviens-inge.fr',
 'Des outils d''information sur les études d''ingénieurs existent déjà : si le seul problème était le manque d''informations, il faudrait se demander ce que Nova apporte de plus.'),

('cd-4', 'CDEFI — Ingénieuses', 'CDEFI', 'CD', 'https://www.ingenieuses.fr',
 array['etu','pro']::text[],
 'L''opération Ingénieuses, portée par la Conférence des directeurs des écoles françaises d''ingénieurs, agit au niveau des écoles : lutte contre les stéréotypes, égalité femmes-hommes, valorisation des initiatives des établissements et mise en avant d''étudiantes et d''ingénieures.',
 120, 'institution', 'france', array['etablissements','roles']::text[],
 'Concours Ingénieuses · label Cap Ingénieuses',
 'Une approche différente des programmes destinés aux collégiennes : elle fait évoluer les établissements, leur visibilité et la culture des écoles d''ingénieurs.'),

('wcap', 'Women@Capgemini', 'Capgemini', 'W@C', 'https://www.capgemini.com/fr-fr/actualites/evenements/programme-marrainage-capgemini/',
 array['etu']::text[],
 'Programme de marrainage du réseau Women@Capgemini : plus de 850 étudiantes accompagnées en France en dix ans par une marraine de Capgemini, avec des ateliers RH (CV, LinkedIn, posture professionnelle), des découvertes de métiers et des événements.',
 130, 'entreprise', 'france', array['marrainage','immersion','reseau']::text[],
 'Programme de marrainage · Vis Mon Job (une demi-journée ou plus en immersion dans le métier d''une professionnelle)',
 'Le mentorat reste utile après le choix d''une formation scientifique : il ne s''agit plus de découvrir que les métiers existent, mais de comprendre le monde professionnel, de construire son réseau et de préciser son projet.'),

('entract', 'Entract', 'Entract', 'En', null,
 array['etu','pro']::text[],
 'Intervient auprès des étudiantes et jeunes ingénieures et scientifiques : événements pour rencontrer des femmes ingénieures et des entreprises, échanger sur les secteurs, découvrir des stages, projets de fin d''études et emplois, et accompagnement des futures diplômées.',
 140, 'asso', 'france', array['reseau','communaute']::text[],
 'Soirées réseau et tables rondes · accompagnement des futures diplômées',
 'L''importance du réseau et des rencontres directes avec les personnes qui exercent réellement les métiers visés, au moment où il faut choisir un secteur et décrocher ses premières opportunités.'),

('fl-5', 'L''Oréal-UNESCO — For Girls / For Women in Science', 'Fondation L''Oréal', 'FL', 'https://www.forwomeninscience.com',
 array['lyc','etu','pro']::text[],
 'Avec For Girls in Science, des femmes scientifiques présentent leurs parcours et leurs métiers pour lutter contre les stéréotypes et susciter des vocations. Avec For Women in Science, le partenariat accompagne aussi des chercheuses à différentes étapes de leur carrière (prix internationaux, dotations Jeunes Talents).',
 150, 'fondation', 'international', array['roles']::text[],
 'For Girls in Science · For Women in Science · Jeunes Talents France',
 'L''importance de proposer plusieurs types de profils : une chercheuse reconnue inspire, mais une étudiante ou une jeune ingénieure permet parfois une identification plus directe. Et la question continue bien après le choix des études.'),

('plan-fm', 'Plan Filles et maths', 'Filles et maths', 'PFM', 'https://www.education.gouv.fr/plan-filles-et-maths-pour-que-les-jeunes-filles-prennent-toute-leur-place-dans-les-metiers-de-l-450509',
 array['col','lyc']::text[],
 'Plan lancé en 2025 par le ministère de l''Éducation nationale, à partir d''un constat : seulement 25 % des étudiants qui intègrent les formations menant aux métiers d''ingénieur et du numérique sont des filles. Il agit sur les stéréotypes, la formation des équipes éducatives et la visibilité des parcours scientifiques.',
 160, 'institution', 'france', array['stereo','etablissements']::text[],
 'Formation et sensibilisation des équipes éducatives · plans académiques',
 'La responsabilité ne doit pas reposer uniquement sur les jeunes filles : le fonctionnement de l''école, les représentations des enseignants et les familles jouent aussi un rôle.'),

('me-6', 'Ministère de l''Enseignement supérieur et de la Recherche', 'Ministère de l''Enseignement supérieur', 'ME', 'https://www.enseignementsup-recherche.gouv.fr',
 array['all','pro']::text[],
 'Organise le Prix Irène Joliot-Curie, qui valorise des carrières de femmes scientifiques, et la Fête de la science.',
 170, 'institution', 'france', array['roles']::text[],
 'Prix Irène Joliot-Curie · Fête de la science', ''),

('ggs', 'Girls Go STEM', 'Girls Go STEM', 'GGS', null,
 array['lyc']::text[],
 'Programme de l''Institut européen d''innovation et de technologie (EIT) pour les filles de 14 à 19 ans : plateforme gratuite de formations aux compétences numériques, scientifiques, environnementales et entrepreneuriales, disponible en 27 langues. Plus de 78 000 filles accompagnées en Europe depuis 2020.',
 180, 'institution', 'europe', array['tech','projets','communaute']::text[],
 'Plateforme de cours en ligne · Student Challenge (en 2026 : les débris spatiaux) · ambassadrices et ambassadeurs enseignants',
 'Une initiative particulièrement complète : contenus numériques, pratique, projets, communauté, rôles modèles et accompagnement des enseignants.'),

('un-7', 'Nations unies & UIT', 'Nations unies', 'UN', 'https://www.un.org/fr/observances/women-and-girls-in-science-day',
 array['all']::text[],
 'Instaurent les journées mondiales : femmes et filles de science (11 février), droits des femmes (8 mars), Girls in ICT Day (avril).',
 190, 'institution', 'international', array['stereo']::text[],
 'Journée internationale des femmes et des filles de science · Girls in ICT Day', '')

on conflict (id) do update set
  name = excluded.name, url = excluded.url, pub = excluded.pub, description = excluded.description,
  sort = excluded.sort, kind = excluded.kind, scope = excluded.scope, approaches = excluded.approaches,
  programmes = excluded.programmes, takeaway = excluded.takeaway;
