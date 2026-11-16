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

export const ROLES = { ing: "Ingénieure", etu: "Étudiante", cher: "Chercheuse", tech: "Technicienne" };

export const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
export const MSHORT = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
