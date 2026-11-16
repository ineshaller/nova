#!/usr/bin/env node
// =====================================================================
//  NOVA — Import des formations depuis l'open data officiel de l'Onisep
// =====================================================================
//
//  Source : « Idéo-Actions de formation initiale - Univers enseignement
//  supérieur » (Onisep, licence ODbL), publié sur data.gouv.fr.
//  Une « action de formation » (AF) = une formation donnée dans un
//  établissement précis (ex. : BUT Informatique à l'IUT de Lannion).
//
//  Ce que fait le script :
//    1. télécharge le fichier CSV officiel (ou lit un fichier local) ;
//    2. garde uniquement les formations scientifiques qui correspondent
//       aux 5 types du site (école d'ingénieurs, prépa, BUT, licence, BTS) ;
//    3. convertit chaque ligne au format de la table « formations » ;
//    4. écrit un aperçu JSON dans scripts/out/ ;
//    5. envoie le tout dans Supabase (sauf en mode --dry-run).
//
//  Utilisation (voir aussi docs/IMPORT-FORMATIONS.md) :
//    npm run formations:apercu          → aperçu sans toucher à la base
//    npm run formations:import          → import dans Supabase
//    npm run formations:colonnes        → affiche les colonnes du fichier
//
//  Options :
//    --dry-run          n'écrit rien dans la base (aperçu seulement)
//    --inspect          affiche les colonnes du fichier puis s'arrête
//    --file=chemin.csv  utilise un fichier déjà téléchargé
//    --types=ing,but    types à importer (défaut : ing,prepa,but,licence,bts)
//    --limit=200        n'importe que les N premières formations (tests)
//    --prune            supprime les formations Onisep absentes du fichier
//
//  Ce que le script ne touche JAMAIS :
//    - les formations saisies à la main (colonne source = 'manuel') ;
//    - la colonne « mixite » (badge rose) : elle reste à remplir par l'équipe,
//      même sur une formation importée, et n'est pas écrasée au prochain import.
// =====================================================================

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------
// 1. Réglages
// ---------------------------------------------------------------------

// Lien permanent data.gouv.fr vers la dernière version du CSV (redirige
// toujours vers le fichier le plus récent). Le second lien est le serveur
// de l'Onisep, utilisé si le premier ne répond pas.
const SOURCES = [
  process.env.ONISEP_CSV_URL,
  "https://www.data.gouv.fr/api/1/datasets/r/05e33f1d-7943-4df5-9308-907e2510cb9d",
  "https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv",
].filter(Boolean);

const ALL_TYPES = ["ing", "prepa", "but", "licence", "bts"];
const BATCH = 500;          // lignes envoyées à Supabase par requête
const SORT_IMPORTED = 1000; // les formations saisies à la main (sort 10…220) restent en tête

// Colonnes attendues dans le fichier Onisep. Pour chaque champ, plusieurs
// intitulés possibles : l'Onisep renomme parfois ses colonnes. Si le script
// signale une colonne introuvable, lancez « npm run formations:colonnes »
// et ajoutez le nouvel intitulé dans la liste correspondante.
const COLUMNS = {
  afId:        ["Action de Formation (AF) identifiant Onisep", "AF identifiant Onisep", "action_de_formation_af_identifiant_onisep"],
  name:        ["Formation (FOR) libellé", "FOR libellé", "formation_for_libelle"],
  onisepUrl:   ["FOR URL et ID Onisep", "for_url_et_id_onisep"],
  domains:     ["FOR indexation domaine web Onisep", "for_indexation_domaine_web_onisep"],
  forType:     ["FOR type", "for_type"],
  certificate: ["FOR nature du certificat", "for_nature_du_certificat"],
  level:       ["FOR niveau de sortie", "for_niveau_de_sortie"],
  school:      ["Lieu d'enseignement (ENS) libellé", "ENS libellé", "ens_libelle"],
  uai:         ["ENS code UAI", "ens_code_uai"],
  status:      ["ENS statut", "ens_statut"],
  city:        ["ENS commune", "ens_commune"],
  department:  ["ENS département", "ens_departement"],
  region:      ["ENS région", "ens_region"],
  schoolSite:  ["ENS site web", "ens_site_web"],
  duration:    ["AF durée cycle standard", "af_duree_cycle_standard"],
  content:     ["AF éléments d'enseignement", "AF éléments enseignement", "af_elements_d_enseignement"], // facultatif
  pageUrl:     ["AF page web", "af_page_web"],
};
const REQUIRED = ["afId", "name", "domains", "forType", "school", "city"];

// Domaines du site (src/lib/constants.js → DOMAINS), reconnus par mots-clés
// dans l'indexation Onisep (ex. « sciences/mathématiques| informatique, internet/informatique »)
// et dans l'intitulé de la formation. Les textes sont comparés sans accents ni majuscules.
const DOMAIN_RULES = {
  maths: /mathemat|statisti|actuari/,
  info:  /informati|numerique|internet|reseau|programm|logiciel|donnees|data|cyber|intelligence artificielle|telecom/,
  phys:  /physique|optique|acoustique|nucleaire|astro/,
  chim:  /chimi|materiaux|plasturgie|pharmac/,
  bio:   /biolog|biotech|biochim|genetique|sante|medic|vivant|agroalim|agronom|bioanalyse/,
  inge:  /ingenier|industri|mecaniq|electroni|electrotech|electricite|automati|robotiq|genie |genie$|aeronaut|aerospat|production|maintenance|batiment|btp|travaux publics|genie civil/,
  env:   /environnement|energie|ecolog|eau\b|climat|developpement durable|agricult|foret|mer\b|ocean|geologi|geoscience/,
};

// ---------------------------------------------------------------------
// 2. Petits utilitaires
// ---------------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").toLowerCase().trim();
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const isUrl = (s) => /^https?:\/\//i.test(s || "");
const log = (...m) => console.log("·", ...m);

// Lecture d'un CSV (séparateur « ; » ou « , », guillemets, retours à la ligne dans
// les cellules). Pas de dépendance à installer.
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.indexOf("\n"));
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift().map(clean);
  return { header, rows: rows.filter((r) => r.length > 1 || (r[0] || "").trim()) };
}

// Le fichier est normalement en UTF-8 ; s'il contient des caractères illisibles,
// on le relit en Latin-1 (ancien format de certains exports).
function decode(buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const broken = (utf8.match(/�/g) || []).length;
  return broken > 20 ? new TextDecoder("latin1").decode(buffer) : utf8;
}

async function loadCsvText() {
  if (args.file) {
    log(`Lecture du fichier local ${args.file}`);
    return decode(await readFile(args.file));
  }
  for (const url of SOURCES) {
    try {
      log(`Téléchargement : ${url}`);
      const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Nova-PFE-import/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      log(`${(buf.length / 1e6).toFixed(1)} Mo reçus`);
      return decode(buf);
    } catch (e) {
      console.warn(`  ⚠ échec (${e.message}), essai de la source suivante…`);
    }
  }
  throw new Error("Impossible de télécharger le fichier Onisep. Téléchargez le CSV à la main sur data.gouv.fr puis relancez avec --file=chemin.csv");
}

// Retrouve l'index de chaque colonne, en tolérant accents / majuscules / espaces.
function mapColumns(header) {
  const idx = {};
  const normHeader = header.map(norm);
  for (const [key, names] of Object.entries(COLUMNS)) {
    const i = names.map(norm).map((n) => normHeader.indexOf(n)).find((x) => x >= 0);
    idx[key] = i ?? -1;
  }
  const missing = REQUIRED.filter((k) => idx[k] < 0);
  if (missing.length) {
    console.error("\n✖ Colonnes introuvables :", missing.map((k) => `${k} (${COLUMNS[k][0]})`).join(", "));
    console.error("  Colonnes présentes dans le fichier :\n   - " + header.join("\n   - "));
    console.error("  → Ajoutez le bon intitulé dans COLUMNS en haut de scripts/import-formations.mjs");
    process.exit(1);
  }
  return idx;
}

// ---------------------------------------------------------------------
// 3. Conversion d'une ligne Onisep → ligne de la table « formations »
// ---------------------------------------------------------------------
const SCIENCE_PREPA = /\b(mpsi|mp2i|pcsi|ptsi|bcpst|tsi|tpc|tb|mp|mpi|pc|psi|pt|ats)\b|scientifique|technologie et sciences|biologie/;

function detectType(name, forType) {
  const n = norm(name), t = norm(forType);
  if (/ingenieur/.test(t) || /^diplome d'ingenieur/.test(n)) return "ing";
  if (/^bts\b|brevet de technicien superieur/.test(n) || /^bts\b/.test(t)) return "bts";
  if (/^but\b|bachelor universitaire de technologie/.test(n) || /^but\b/.test(t)) return "but";
  if (/^(classe preparatoire|cpge)/.test(n) || /^prepa|classe preparatoire/.test(t)) {
    return SCIENCE_PREPA.test(`${n} ${t}`) && !/litteraire|economique|commerciale/.test(t) ? "prepa" : null;
  }
  if (/^licence\b/.test(n) && !/professionnelle/.test(n) && /licence/.test(t)) return "licence";
  return null;
}

function detectDomains(domainsText, name) {
  const hay = norm(`${domainsText} | ${name}`);
  return Object.entries(DOMAIN_RULES).filter(([, re]) => re.test(hay)).map(([k]) => k);
}

// « 5 ans », « 3 an(s) », « 36 mois » → nombre d'années
function years(duration) {
  const m = norm(duration).match(/(\d+(?:[.,]\d+)?)\s*(an|mois)/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return m[2] === "mois" ? v / 12 : v;
}

function detectAccess(type, duration) {
  if (type !== "ing") return ["postbac"];
  const y = years(duration);
  if (y === null) return ["postbac", "postprepa"]; // inconnu : on n'exclut personne
  return y >= 4 ? ["postbac"] : ["postprepa"];
}

const TYPE_TEXT = {
  ing: "Formation d'ingénieur", prepa: "Classe préparatoire scientifique", but: "Bachelor universitaire de technologie",
  licence: "Licence universitaire", bts: "Brevet de technicien supérieur",
};

// Description courte, construite uniquement à partir des données officielles.
function buildDescription(type, r) {
  const parts = [];
  const meta = [r.duration && `en ${r.duration.replace(/\(s\)/g, "s")}`, r.level && `niveau ${r.level}`].filter(Boolean).join(", ");
  const offered = ["but", "bts"].includes(type) ? "proposé" : "proposée";
  parts.push(`${TYPE_TEXT[type]}${meta ? ` ${meta}` : ""}, ${offered} par ${r.school}.`);
  if (r.certificate) parts.push(`${cap(r.certificate)}.`);
  if (r.content) parts.push(`Au programme : ${cut(r.content.replace(/\s*\|\s*/g, ", "), 260)}.`);
  return parts.join(" ").replace(/\.\./g, ".");
}

function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toFormation(cells, idx, runAt) {
  const get = (k) => (idx[k] >= 0 ? clean(cells[idx[k]]) : "");
  const r = {
    afId: get("afId"), name: get("name"), onisepUrl: get("onisepUrl"), domains: get("domains"), forType: get("forType"),
    certificate: get("certificate"), level: get("level"), school: get("school"), uai: get("uai"), status: get("status"),
    city: get("city"), department: get("department"), region: get("region"), schoolSite: get("schoolSite"),
    duration: get("duration"), content: get("content"), pageUrl: get("pageUrl"),
  };
  if (!r.afId || !r.name) return null;

  const type = detectType(r.name, r.forType);
  if (!type) return null;
  const domaines = detectDomains(r.domains, r.name);
  if (!domaines.length) return null; // pas scientifique (ex. licence de droit, BTS commerce)

  // Une même AF peut exister dans plusieurs lieux : l'identifiant combine AF + établissement.
  const place = r.uai || slug(r.school).slice(0, 30);
  const sourceId = `${r.afId}|${place}`;
  return {
    id: `onisep-${slug(r.afId.replace(/^AF\./i, ""))}-${slug(place)}`,
    name: cut(cap(r.name), 200),
    type,
    acces: detectAccess(type, r.duration),
    statut: cap(r.status),
    lieu: [r.city, r.department && r.department !== r.city ? `(${r.department})` : ""].filter(Boolean).join(" "),
    region: r.region || null,
    etablissement: r.school,
    domaines,
    description: buildDescription(type, r),
    url: [r.pageUrl, r.schoolSite, r.onisepUrl].find(isUrl) || null,
    onisep_url: isUrl(r.onisepUrl) ? r.onisepUrl : null,
    sort: SORT_IMPORTED,
    source: "onisep",
    source_id: sourceId,
    last_seen: runAt,
    // « mixite » est volontairement absente : elle n'est jamais écrasée.
  };
}

// ---------------------------------------------------------------------
// 4. Envoi dans Supabase
// ---------------------------------------------------------------------
async function connect() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("\n✖ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquent.");
    console.error("  Copiez scripts/.env.import.example en scripts/.env.import et remplissez-le,");
    console.error("  ou lancez d'abord un aperçu sans base : npm run formations:apercu");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upload(db, rows, runAt) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const part = rows.slice(i, i + BATCH);
    const { error } = await db.from("formations").upsert(part, { onConflict: "id" });
    if (error) throw new Error(`Envoi du lot ${i / BATCH + 1} : ${error.message}`);
    log(`${Math.min(i + BATCH, rows.length)} / ${rows.length} formations envoyées`);
  }
  if (args.prune) {
    const { error, count } = await db.from("formations").delete({ count: "exact" })
      .eq("source", "onisep").lt("last_seen", runAt);
    if (error) throw new Error(`Nettoyage : ${error.message}`);
    log(`${count ?? 0} formation(s) Onisep supprimée(s) car absentes du nouveau fichier`);
  }
}

// ---------------------------------------------------------------------
// 5. Programme principal
// ---------------------------------------------------------------------
async function main() {
  const runAt = new Date().toISOString();
  const types = args.types ? String(args.types).split(",").map((s) => s.trim()) : ALL_TYPES;
  const bad = types.filter((t) => !ALL_TYPES.includes(t));
  if (bad.length) throw new Error(`Type(s) inconnu(s) : ${bad.join(", ")}. Valeurs possibles : ${ALL_TYPES.join(", ")}`);

  const { header, rows } = parseCsv(await loadCsvText());
  log(`${rows.length} lignes, ${header.length} colonnes`);

  if (args.inspect) {
    console.log("\nColonnes du fichier :");
    header.forEach((h, i) => console.log(`  ${String(i).padStart(2)}. ${h}  →  ${clean(rows[0]?.[i]).slice(0, 70)}`));
    return;
  }

  const idx = mapColumns(header);
  const byId = new Map();
  const stats = Object.fromEntries(ALL_TYPES.map((t) => [t, 0]));
  for (const cells of rows) {
    const f = toFormation(cells, idx, runAt);
    if (!f || !types.includes(f.type) || byId.has(f.id)) continue;
    byId.set(f.id, f);
    stats[f.type]++;
  }
  let result = [...byId.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, "fr"));
  if (args.limit) result = result.slice(0, Number(args.limit));

  log(`${result.length} formations scientifiques retenues :`, Object.entries(stats).filter(([t]) => types.includes(t)).map(([t, n]) => `${t} ${n}`).join(" · "));

  const outDir = join(HERE, "out");
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, "formations-apercu.json");
  await writeFile(outFile, JSON.stringify(result, null, 2));
  log(`Aperçu écrit dans ${outFile}`);

  if (args["dry-run"]) { log("Mode --dry-run : rien n'a été envoyé dans la base."); return; }
  if (!result.length) throw new Error("Aucune formation retenue : import annulé pour ne rien effacer par erreur.");

  const db = await connect();
  await upload(db, result, runAt);
  log("Import terminé ✦  Données : Onisep, licence ODbL.");
}

main().catch((e) => { console.error("\n✖", e.message); process.exit(1); });
