// Toutes les lectures / écritures dans la base Supabase passent par ce fichier.
// Les colonnes SQL (snake_case) sont converties au format utilisé par l'interface.
import { supabase } from "./supabase.js";

const check = ({ data, error }) => { if (error) throw error; return data; };

// ---------- Conversion base → interface ----------
const toEvent = (r) => ({
  id: r.id, start: r.start_date, end: r.end_date || null, title: r.title, org: r.org, place: r.place,
  cat: r.cat, pub: r.pub || [], status: r.status, desc: r.description, url: r.url,
  published: r.published, submittedBy: r.submitted_by, actorId: r.actor_id || null, source: r.source || "equipe",
});
const toFormation = (r) => ({
  id: r.id, name: r.name, type: r.type, acces: r.acces || [], statut: r.statut, where: r.lieu,
  dom: r.domaines || [], desc: r.description, mix: r.mixite, url: r.url,
  school: r.etablissement || "", region: r.region || "", onisepUrl: r.onisep_url || null, source: r.source || "manuel",
});
const toActor = (r) => ({
  id: r.id, name: r.name, key: r.match_key, ini: r.initials, url: r.url, pub: r.pub || [], desc: r.description,
  partner: !!r.partner, autoPublish: r.auto_publish !== false,
  // Colonnes de la migration 04 (valeurs par défaut si elle n'est pas encore passée)
  kind: r.kind || "asso", scope: r.scope || "france", approaches: r.approaches || [],
  programmes: r.programmes || "", takeaway: r.takeaway || "",
});
const publicUrl = (path) => (path ? supabase.storage.from("videos").getPublicUrl(path).data.publicUrl : null);
const toVideo = (r) => ({
  id: r.id, title: r.title, person: r.person, role: r.role, domain: r.domain, org: r.org, desc: r.description,
  filePath: r.file_path, posterPath: r.poster_path, file: publicUrl(r.file_path), poster: publicUrl(r.poster_path), link: r.link,
});

// ---------- Contenu ----------
export async function fetchEvents() {
  return check(await supabase.from("events").select("*").order("start_date", { ascending: true })).map(toEvent);
}
// Les formations importées depuis l'Onisep se comptent en milliers : Supabase ne renvoie
// que 1000 lignes par requête, on les lit donc par paquets.
const FORMATION_COLS = "id,name,type,acces,statut,lieu,region,etablissement,domaines,description,mixite,url,onisep_url,source,sort";
export async function fetchFormations() {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(await supabase.from("formations").select(FORMATION_COLS)
      .order("sort", { ascending: true }).order("name", { ascending: true }).order("id", { ascending: true })
      .range(from, from + PAGE - 1));
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all.map(toFormation);
}
export async function fetchActors() {
  return check(await supabase.from("actors").select("*").order("sort", { ascending: true })).map(toActor);
}
export async function fetchVideos() {
  return check(await supabase.from("videos").select("*").order("created_at", { ascending: false })).map(toVideo);
}

// ---------- Propositions d'événements ----------
export async function proposeEvent(userId, f) {
  const row = {
    start_date: f.start, end_date: f.end || null, title: f.title, org: f.org, place: f.place || "Lieu à préciser",
    cat: f.cat, pub: [f.pub], status: "prop", description: f.desc || "", url: f.url || null,
    published: false, submitted_by: userId, source: "proposition",
  };
  return toEvent(check(await supabase.from("events").insert(row).select().single()));
}
// Une proposition validée passe en « date confirmée » ; un brouillon d'association garde son statut.
export async function approveEvent(e) {
  const patch = { published: true, ...(e.status === "prop" ? { status: "ok" } : {}) };
  check(await supabase.from("events").update(patch).eq("id", e.id));
}

// ---------- Événements saisis par l'équipe ou par une association partenaire ----------
// f : valeurs du formulaire (voir components/EventForm.jsx)
const eventRow = (f) => ({
  start_date: f.start, end_date: f.end || null, title: f.title, org: f.org || "", place: f.place || "Lieu à préciser",
  cat: f.cat, pub: f.pub, status: f.status, description: f.desc || "", url: f.url || null,
});
// Équipe Nova (admin) : publié directement ou gardé en brouillon
export async function createTeamEvent(userId, f) {
  const row = { ...eventRow(f), actor_id: f.actorId || null, published: !!f.publish, source: "equipe", submitted_by: userId };
  return toEvent(check(await supabase.from("events").insert(row).select().single()));
}
export async function updateTeamEvent(id, f) {
  const row = { ...eventRow(f), actor_id: f.actorId || null, published: !!f.publish };
  return toEvent(check(await supabase.from("events").update(row).eq("id", id).select().single()));
}
// Association partenaire : publié directement si l'association est en « publication directe »,
// sinon en attente de relecture par l'équipe.
export async function createPartnerEvent(userId, partner, f) {
  const row = { ...eventRow(f), actor_id: partner.actorId, published: partner.autoPublish, source: "partenaire", submitted_by: userId };
  return toEvent(check(await supabase.from("events").insert(row).select().single()));
}
export async function updatePartnerEvent(id, partner, f) {
  const row = { ...eventRow(f), published: partner.autoPublish };
  return toEvent(check(await supabase.from("events").update(row).eq("id", id).select().single()));
}
export async function deleteEvent(id) {
  check(await supabase.from("events").delete().eq("id", id));
}

// ---------- Partenariats associations ----------
// Association de la personne connectée (null si elle n'est pas partenaire)
export async function fetchMyPartnership(userId) {
  const rows = check(await supabase.from("partner_members").select("actor_id, actors(name, auto_publish)").eq("user_id", userId));
  const r = rows[0];
  return r ? { actorId: r.actor_id, actorName: r.actors?.name || r.actor_id, autoPublish: r.actors?.auto_publish !== false } : null;
}
export async function fetchMyPartnerRequests() {
  return check(await supabase.from("partner_requests").select("*").order("created_at", { ascending: false }));
}
export async function requestPartnership(f) {
  const row = { org_name: f.orgName, actor_id: f.actorId || null, role: f.role || "", website: f.website || null, message: f.message || "" };
  check(await supabase.from("partner_requests").insert(row));
}
// Admin
export async function adminListPartnerRequests() {
  return check(await supabase.rpc("admin_list_partner_requests"));
}
export async function adminAcceptRequest(requestId, actorId) {
  check(await supabase.rpc("admin_accept_partner_request", { p_request: requestId, p_actor: actorId }));
}
export async function adminRefuseRequest(requestId, adminId) {
  check(await supabase.from("partner_requests")
    .update({ status: "refused", decided_at: new Date().toISOString(), decided_by: adminId }).eq("id", requestId));
}
export async function adminListPartners() {
  return check(await supabase.rpc("admin_list_partners"));
}
export async function adminAddPartnerByEmail(email, actorId) {
  check(await supabase.rpc("admin_add_partner_by_email", { p_email: email, p_actor: actorId }));
}
export async function adminRemovePartner(userId) {
  check(await supabase.from("partner_members").delete().eq("user_id", userId));
}
export async function adminSetAutoPublish(actorId, value) {
  check(await supabase.from("actors").update({ auto_publish: value }).eq("id", actorId));
}
export async function adminCreateActor(f) {
  const base = f.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const initials = f.name.split(/[\s&-]+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 3);
  const row = {
    id: `${base || "asso"}-${Date.now().toString(36).slice(-4)}`, name: f.name, match_key: f.name, initials,
    url: f.url || null, pub: f.pub || [], description: f.desc || "", sort: 500,
  };
  return toActor(check(await supabase.from("actors").insert(row).select().single()));
}

// ---------- Vidéos (admin) ----------
export async function addVideo(userId, f, file, poster) {
  const up = async (blob) => {
    const ext = (blob.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${crypto.randomUUID()}.${ext}`;
    check(await supabase.storage.from("videos").upload(path, blob, { contentType: blob.type, upsert: false }));
    return path;
  };
  const file_path = file ? await up(file) : null;
  const poster_path = poster ? await up(poster) : null;
  const row = {
    title: f.title, person: f.person, role: f.role, domain: f.domain || null, org: f.org || "",
    description: f.desc || "", file_path, poster_path, link: file ? null : f.link, created_by: userId,
  };
  return toVideo(check(await supabase.from("videos").insert(row).select().single()));
}
export async function deleteVideo(v) {
  check(await supabase.from("videos").delete().eq("id", v.id));
  const paths = [v.filePath, v.posterPath].filter(Boolean);
  if (paths.length) await supabase.storage.from("videos").remove(paths);
}

// ---------- Compte ----------
export async function fetchProfile(userId) {
  return check(await supabase.from("profiles").select("*").eq("id", userId).single());
}
export async function updateProfile(userId, f) {
  const row = { prenom: f.prenom, niveau: f.niveau, interets: f.interets, ville: f.ville, updated_at: new Date().toISOString() };
  return check(await supabase.from("profiles").update(row).eq("id", userId).select().single());
}
export async function deleteMyAccount() {
  check(await supabase.rpc("delete_my_account"));
}

// ---------- Favoris ----------
export async function fetchFavorites() {
  return check(await supabase.from("favorites").select("item_type,item_id")).map((r) => `${r.item_type}:${r.item_id}`);
}
export async function addFavorite(userId, type, id) {
  check(await supabase.from("favorites").insert({ user_id: userId, item_type: type, item_id: id }));
}
export async function removeFavorite(userId, type, id) {
  check(await supabase.from("favorites").delete().match({ user_id: userId, item_type: type, item_id: id }));
}
