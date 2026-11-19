// Listes de référence utilisées dans tout le site.
// Les clés (jour, col, maths…) sont aussi celles stockées dans la base.

export const CATS = {
  jour:      { label: "Journée mondiale",   color: "#1557FF" },
  rencontre: { label: "Rencontre & atelier", color: "#0E9F9A" },
  prix:      { label: "Prix & concours",     color: "#C2410C" },
  emploi:    { label: "Forum emploi",        color: "#7C3AED" },
  campagne:  { label: "Semaine nationale",   color: "#0B1E4E" },
};

export const PUBS = {
  col: "Collégiennes", lyc: "Lycéennes", etu: "Étudiantes", pro: "Chercheuses & pros", all: "Tout public",
};

export const STATUS = {
  ok:   ["ok",   "Date confirmée"],
  est:  ["est",  "Date estimée"],
  year: ["year", "Toute l'année"],
  prop: ["prop", "Proposé · à vérifier"],
};

// Statuts qu'une association ou l'équipe peut choisir (« prop » est réservé aux propositions)
export const EDIT_STATUS = { ok: "Date confirmée", est: "Date estimée", year: "Toute l'année scolaire" };

// Fonctions activables. Passez partnerRequests à true quand l'équipe est prête à recevoir
// des demandes de partenariat : un formulaire « Vous êtes une association ? » apparaît
// alors sur la page « Proposer un événement ». Même à false, les admins peuvent
// donner l'accès partenaire à un compte depuis « Mon compte → Partenaires ».
export const FEATURES = { partnerRequests: false };

export const DOMAINS = {
  maths: "Maths", info: "Informatique & numérique", phys: "Physique", chim: "Chimie",
  bio: "Biologie & santé", inge: "Ingénierie & industrie", env: "Environnement & énergie",
};

export const FTYPES = {
  ing: "École d'ingénieurs", prepa: "Classe préparatoire", but: "BUT (IUT)",
  licence: "Licence à l'université", bts: "BTS",
};

export const LEVELS = {
  col: "Collégienne", lyc: "Lycéenne", etu: "Étudiante", pro: "Professionnelle / chercheuse",
};

// Familles de solutions (page Acteurs) : clé stockée dans actors.approaches → libellé et objectif
export const APPROACHES = {
  stereo:         { label: "Sensibilisation aux stéréotypes", goal: "Faire évoluer les représentations" },
  roles:          { label: "Rôles modèles",                   goal: "Permettre aux jeunes filles de se projeter" },
  marrainage:     { label: "Marrainage",                      goal: "Créer une relation d'accompagnement dans le temps" },
  tech:           { label: "Apprentissage technique",         goal: "Développer des compétences et la confiance par la pratique" },
  projets:        { label: "Challenges et projets",           goal: "Mettre les participantes en situation d'agir" },
  orientation:    { label: "Orientation",                     goal: "Mieux connaître les études et les métiers" },
  immersion:      { label: "Immersion",                       goal: "Découvrir concrètement un environnement professionnel" },
  reseau:         { label: "Réseau professionnel",            goal: "Développer son réseau et accéder aux premières opportunités" },
  etablissements: { label: "Action sur les établissements",   goal: "Faire évoluer l'environnement" },
  communaute:     { label: "Communauté dans la durée",        goal: "Maintenir l'accompagnement au-delà d'une action ponctuelle" },
};
export const ACTOR_KINDS = { asso: "Association", ecole: "École", entreprise: "Entreprise", institution: "Institution", fondation: "Fondation" };
export const SCOPES = { france: "France", europe: "Europe", international: "International" };

export const ROLES = { ing: "Ingénieure", etu: "Étudiante", cher: "Chercheuse", tech: "Technicienne" };

export const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
export const MSHORT = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
