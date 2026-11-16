// Gestion du contenu depuis « Mon compte » :
//  - EventsManager     : ajout / modification / suppression d'événements (équipe Nova ou association partenaire)
//  - PartnersAdmin     : demandes de partenariat, comptes partenaires, fiches associations (admins)
//  - PartnerRequestPanel : formulaire « Vous êtes une association ? » (page Proposer, si activé)
import { useCallback, useEffect, useMemo, useState } from "react";
import { EventCard, SearchBox } from "../components/Common.jsx";
import EventForm from "../components/EventForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import * as api from "../lib/api.js";
import { FEATURES, PUBS } from "../lib/constants.js";
import { fmtDate, isPast, matches, norm, toDate } from "../lib/format.js";

const migrationHint = (e) =>
  /function|relation|column|schema cache/i.test(e?.message || "")
    ? "La base n'est pas à jour : exécutez supabase/migration-02-formations-partenaires.sql dans Supabase (SQL Editor)."
    : e?.message || "Erreur inconnue";

/* =====================================================================
   Événements : équipe (mode "admin") ou association (mode "partner")
   ===================================================================== */
export function EventsManager({ mode }) {
  const { user, partner } = useAuth();
  const { events, pending, actors, loadEvents } = useData();
  const { confirm, toast } = useUI();
  const [editing, setEditing] = useState(null); // null | "new" | événement
  const [q, setQ] = useState("");
  const [when, setWhen] = useState("up");

  const list = useMemo(() => {
    const all = [...events, ...pending];
    const mine = mode === "partner"
      ? all.filter((e) => e.actorId === partner?.actorId)
      : all.filter((e) => e.published || e.source === "equipe"); // les propositions et brouillons d'associations sont dans « Modération »
    return mine
      .filter((e) => (when === "up" ? !isPast(e) : when === "past" ? isPast(e) : true))
      .filter((e) => matches(q, [e.title, e.org, e.place, e.desc]))
      .sort((a, b) => toDate(a.start) - toDate(b.start));
  }, [events, pending, mode, partner?.actorId, when, q]);

  const canEdit = (e) => mode === "admin" || e.source === "partenaire";

  const save = async (v) => {
    if (mode === "admin") {
      editing === "new" ? await api.createTeamEvent(user.id, v) : await api.updateTeamEvent(editing.id, v);
    } else {
      editing === "new" ? await api.createPartnerEvent(user.id, partner, v) : await api.updatePartnerEvent(editing.id, partner, v);
    }
    await loadEvents();
    setEditing(null);
    const live = mode === "admin" ? v.publish : partner.autoPublish;
    toast(live ? "Événement enregistré et publié ✦" : "Événement enregistré (en attente de publication)");
  };

  const remove = async (e) => {
    if (!(await confirm("Supprimer cet événement ?", `« ${e.title} » sera retiré de l'agenda. Cette action ne peut pas être annulée.`, "Supprimer"))) return;
    try { await api.deleteEvent(e.id); await loadEvents(); toast("Événement supprimé"); }
    catch (er) { toast(migrationHint(er)); }
  };

  if (editing) return (
    <div className="panel">
      <EventForm mode={mode} initial={editing === "new" ? null : editing} actors={actors}
        partnerName={partner?.actorName} onSubmit={save} onCancel={() => setEditing(null)} />
    </div>
  );

  return (
    <>
      {mode === "partner" && (
        <div className="okbox" style={{ marginBottom: 16 }}>
          Vous publiez au nom de <b>{partner.actorName}</b>.{" "}
          {partner.autoPublish
            ? "Vos événements apparaissent immédiatement dans l'agenda."
            : "Vos événements sont relus par l'équipe Nova avant d'apparaître dans l'agenda."}
        </div>
      )}
      <div className="manage-bar">
        <button className="btn primary" onClick={() => setEditing("new")}>＋ Ajouter un événement</button>
        <SearchBox value={q} onChange={setQ} placeholder="Rechercher…" label="Rechercher un événement" />
        <select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Période">
          <option value="up">À venir</option><option value="past">Passés</option><option value="all">Tous</option>
        </select>
        <span className="count">{list.length} événement{list.length > 1 ? "s" : ""}</span>
      </div>
      {list.length ? (
        <div className="grid">
          {list.map((e) => (
            <EventCard key={e.id} e={e} noFav>
              <div className="mod-row" style={{ marginTop: 10, alignItems: "center" }}>
                {!e.published && <span className="status prop">{e.source === "equipe" ? "Brouillon" : "En attente de publication"}</span>}
                {canEdit(e) ? (
                  <>
                    <button className="btn ghost small" onClick={() => setEditing(e)}>Modifier</button>
                    <button className="btn danger small" onClick={() => remove(e)}>Supprimer</button>
                  </>
                ) : <span className="note">Ajouté par l'équipe Nova : écrivez-nous pour le modifier.</span>}
              </div>
            </EventCard>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 0 }}>{when === "up" ? "Aucun événement à venir pour le moment." : when === "past" ? "Aucun événement passé." : "Aucun événement pour le moment."}</div>
      )}
    </>
  );
}

/* =====================================================================
   Partenaires (admins)
   ===================================================================== */
export function PartnersAdmin() {
  const { user } = useAuth();
  const { actors, loadActors, loadEvents } = useData();
  const { confirm, toast } = useUI();
  const [requests, setRequests] = useState(null);
  const [partners, setPartners] = useState(null);
  const [choice, setChoice] = useState({}); // demande → association choisie
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([api.adminListPartnerRequests(), api.adminListPartners()]);
      setRequests(r); setPartners(p); setErr("");
    } catch (e) { setErr(migrationHint(e)); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const guessActor = (r) => r.actor_id || actors.find((a) => norm(a.name) === norm(r.org_name))?.id || "";
  const run = async (fn, okMsg) => {
    try { await fn(); await Promise.all([reload(), loadActors(), loadEvents()]); toast(okMsg); }
    catch (e) { toast(migrationHint(e)); }
  };

  const accept = (r) => {
    const actorId = choice[r.id] ?? guessActor(r);
    if (!actorId) return toast("Choisissez l'association (ou créez sa fiche plus bas)");
    run(() => api.adminAcceptRequest(r.id, actorId), "Partenariat accepté ✦");
  };
  const refuse = async (r) => {
    if (!(await confirm("Refuser la demande ?", `La demande de ${r.email} pour « ${r.org_name} » sera refusée.`, "Refuser"))) return;
    run(() => api.adminRefuseRequest(r.id, user.id), "Demande refusée");
  };
  const removeMember = async (p) => {
    if (!(await confirm("Retirer l'accès ?", `${p.email} ne pourra plus publier pour ${p.actor_name}. Les événements déjà publiés restent dans l'agenda.`, "Retirer"))) return;
    run(() => api.adminRemovePartner(p.user_id), "Accès retiré");
  };
  const addByEmail = (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    run(async () => { await api.adminAddPartnerByEmail(String(fd.get("email")).trim(), fd.get("actorId")); form.reset(); }, "Accès partenaire donné ✦");
  };
  const createActor = (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const url = String(fd.get("url") || "").trim();
    if (url && !/^https?:\/\//.test(url)) return toast("Le site doit commencer par https://");
    run(async () => {
      await api.adminCreateActor({ name: String(fd.get("name")).trim(), url, desc: String(fd.get("desc") || "").trim(), pub: fd.getAll("pub") });
      form.reset();
    }, "Fiche association créée ✦");
  };

  if (err) return <div className="err">{err}</div>;
  if (!requests || !partners) return <div className="loading">Chargement…</div>;

  // Comptes partenaires regroupés par association
  const byActor = partners.reduce((m, p) => ((m[p.actor_id] ||= { name: p.actor_name, auto: p.auto_publish, members: [] }).members.push(p), m), {});
  const actorSelect = (props) => (
    <select {...props}>
      <option value="">— Choisir l'association —</option>
      {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  );

  return (
    <div className="manage">
      <div className="month-title"><h3>Demandes de partenariat</h3></div>
      {!FEATURES.partnerRequests && (
        <p className="note">Le formulaire public de demande est désactivé pour l'instant (<code>FEATURES.partnerRequests</code> dans <code>src/lib/constants.js</code>). Vous pouvez quand même donner un accès ci-dessous.</p>
      )}
      {requests.length ? requests.map((r) => (
        <div className="panel req" key={r.id}>
          <div>
            <b>{r.org_name}</b> — {r.prenom || "?"} ({r.email}){r.role ? `, ${r.role}` : ""}
            <div className="note">Envoyée le {fmtDate(new Date(r.created_at))}{r.website && <> · <a href={r.website} target="_blank" rel="noopener noreferrer">{r.website}</a></>}</div>
            {r.message && <p style={{ margin: "8px 0 0" }}>{r.message}</p>}
          </div>
          <div className="mod-row" style={{ marginTop: 12 }}>
            {actorSelect({ value: choice[r.id] ?? guessActor(r), onChange: (e) => setChoice((c) => ({ ...c, [r.id]: e.target.value })), "aria-label": "Association" })}
            <button className="btn primary small" onClick={() => accept(r)}>Accepter</button>
            <button className="btn danger small" onClick={() => refuse(r)}>Refuser</button>
          </div>
        </div>
      )) : <p className="note">Aucune demande en attente.</p>}

      <div className="month-title" style={{ marginTop: 26 }}><h3>Associations partenaires</h3></div>
      {Object.keys(byActor).length ? Object.entries(byActor).map(([id, a]) => (
        <div className="panel req" key={id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>{a.name}</b>
            <label className="toggle">
              <input type="checkbox" checked={a.auto} onChange={(e) => run(() => api.adminSetAutoPublish(id, e.target.checked), e.target.checked ? "Publication directe activée" : "Relecture par l'équipe activée")} />
              Publication directe (sinon relecture par l'équipe)
            </label>
          </div>
          <ul className="members">
            {a.members.map((m) => (
              <li key={m.user_id}>{m.prenom || "?"} · {m.email}
                <button className="linkbtn" onClick={() => removeMember(m)}>Retirer l'accès</button></li>
            ))}
          </ul>
        </div>
      )) : <p className="note">Aucune association partenaire pour le moment.</p>}

      <div className="two-panels">
        <form className="f" onSubmit={addByEmail}>
          <h3 style={{ fontSize: 18 }}>Donner un accès partenaire</h3>
          <p className="note" style={{ margin: 0 }}>La personne doit d'abord avoir créé son compte Nova.</p>
          <label>E-mail du compte<input name="email" type="email" required /></label>
          <label>Association{actorSelect({ name: "actorId", required: true })}</label>
          <button className="btn primary" type="submit" style={{ justifySelf: "start" }}>Donner l'accès</button>
        </form>
        <form className="f" onSubmit={createActor}>
          <h3 style={{ fontSize: 18 }}>Ajouter une association</h3>
          <p className="note" style={{ margin: 0 }}>Crée sa fiche dans l'onglet « Acteurs ».</p>
          <label>Nom<input name="name" required minLength={2} maxLength={120} /></label>
          <label>Site officiel<input name="url" type="url" placeholder="https://…" /></label>
          <label>Présentation<textarea name="desc" maxLength={400} /></label>
          <label>Public
            <div className="checks">{Object.entries(PUBS).filter(([k]) => k !== "all").map(([k, l]) => <label key={k}><input type="checkbox" name="pub" value={k} /> {l}</label>)}</div>
          </label>
          <button className="btn primary" type="submit" style={{ justifySelf: "start" }}>Créer la fiche</button>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
   Demande de partenariat (page « Proposer », si FEATURES.partnerRequests)
   ===================================================================== */
export function PartnerRequestPanel() {
  const { user, partner } = useAuth();
  const { actors } = useData();
  const { toast } = useUI();
  const [mine, setMine] = useState(null);
  const [actorId, setActorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user || !FEATURES.partnerRequests) return;
    api.fetchMyPartnerRequests().then(setMine).catch(() => setMine([]));
  }, [user?.id]);

  if (!FEATURES.partnerRequests) return null;

  const pendingReq = mine?.find((r) => r.status === "pending");
  const refused = mine?.find((r) => r.status === "refused");

  const submit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const website = String(fd.get("website") || "").trim();
    if (website && !/^https?:\/\//.test(website)) return setErr("Le site doit commencer par https://");
    setBusy(true); setErr("");
    try {
      await api.requestPartnership({
        orgName: String(fd.get("orgName")).trim(), actorId, role: String(fd.get("role") || "").trim(),
        website, message: String(fd.get("message") || "").trim(),
      });
      setMine(await api.fetchMyPartnerRequests());
      toast("Demande envoyée ✦");
    } catch (e) { setErr(migrationHint(e)); } finally { setBusy(false); }
  };

  return (
    <section style={{ paddingTop: 0 }}>
      <div className="wrap propose">
        <div>
          <h2 style={{ fontSize: 28 }}>Vous êtes une association&nbsp;?</h2>
          <p style={{ color: "var(--muted)" }}>Devenez partenaire de Nova : vous publiez et mettez à jour vous-même les événements de votre association, sans passer par la file de propositions.</p>
          <p className="note">L'équipe vérifie chaque demande avant d'ouvrir l'accès.</p>
        </div>
        {!user ? (
          <div className="panel"><p className="note" style={{ marginTop: 0 }}>Connectez-vous avec le compte de la personne qui gérera les événements.</p>
            <a className="btn primary" href="#compte">Se connecter ou créer un compte</a></div>
        ) : partner ? (
          <div className="okbox">Votre compte publie déjà pour <b>{partner.actorName}</b>. Rendez-vous dans <a href="#compte">Mon compte → Mon association</a>.</div>
        ) : pendingReq ? (
          <div className="okbox">Demande envoyée le {fmtDate(new Date(pendingReq.created_at))} pour « {pendingReq.org_name} ». L'équipe Nova vous répond rapidement.</div>
        ) : (
          <form className="f" onSubmit={submit}>
            {refused && <div className="err">Votre précédente demande n'a pas été acceptée. Vous pouvez en envoyer une nouvelle avec plus de détails.</div>}
            <label>Votre association sur Nova
              <select value={actorId} onChange={(e) => setActorId(e.target.value)}>
                <option value="">Elle n'est pas encore sur Nova</option>
                {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <div className="two">
              <label>Nom de l'association<input name="orgName" required minLength={2} maxLength={120}
                key={actorId} defaultValue={actors.find((a) => a.id === actorId)?.name || ""} /></label>
              <label>Votre rôle<input name="role" maxLength={80} placeholder="Ex. : chargée de communication" /></label>
            </div>
            <label>Site officiel<input name="website" type="url" placeholder="https://…" /></label>
            <label>Message (facultatif)<textarea name="message" maxLength={1000} placeholder="Quels événements organisez-vous ? À quelle fréquence ?" /></label>
            {err && <div className="err">{err}</div>}
            <button className="btn primary" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "Envoi…" : "Demander un accès partenaire"}</button>
          </form>
        )}
      </div>
    </section>
  );
}
