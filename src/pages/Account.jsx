import { useEffect, useState } from "react";
import { EventCard, PageHead, SchoolCard, VideoCard } from "../components/Common.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import * as api from "../lib/api.js";
import { DOMAINS, LEVELS } from "../lib/constants.js";
import { isPast, toDate } from "../lib/format.js";
import { EventsManager, PartnersAdmin } from "./AccountManage.jsx";

// Messages d'erreur Supabase traduits en français
function frError(e) {
  const m = (e?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirmez d'abord votre adresse : cliquez sur le lien reçu par e-mail.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cet e-mail. Connectez-vous.";
  if (m.includes("password") && m.includes("characters")) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (m.includes("rate limit")) return "Trop de tentatives. Patientez quelques minutes.";
  if (m.includes("valid email") || m.includes("invalid format")) return "Adresse e-mail invalide.";
  return e?.message || "Une erreur est survenue.";
}

/* ---------- Champs de profil (inscription et modification) ---------- */
function ProfileFields({ p = {}, actor = false }) {
  const ints = new Set(p.interets || []);
  return (
    <>
      <div className="two">
        <label>{actor ? "Votre prénom" : "Prénom ou pseudo"}<input name="prenom" required maxLength={40} defaultValue={p.prenom || ""} placeholder="Ex. : Léa" /></label>
        <label>Ville (facultatif)<input name="ville" maxLength={60} defaultValue={p.ville || ""} placeholder="Pour repérer les événements près de chez vous" /></label>
      </div>
      {actor ? <input type="hidden" name="niveau" value="pro" /> : (
        <label>Je suis…
          <select name="niveau" defaultValue={p.niveau || "lyc"}>{Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
      )}
      <label>{actor ? "Domaines de votre structure" : "Ce qui m'intéresse"}
        <div className="checks">
          {Object.entries(DOMAINS).map(([k, l]) => (
            <label key={k}><input type="checkbox" name="interets" value={k} defaultChecked={ints.has(k)} /> {l}</label>
          ))}
        </div>
      </label>
    </>
  );
}
const readProfile = (fd) => ({
  prenom: String(fd.get("prenom") || "").trim().slice(0, 40),
  ville: String(fd.get("ville") || "").trim().slice(0, 60),
  niveau: fd.get("niveau"),
  interets: fd.getAll("interets"),
});

/* ---------- Champs « acteur » (association, école, entreprise…) à l'inscription ---------- */
function ActorFields() {
  const { actors } = useData();
  const [actorId, setActorId] = useState("");
  return (
    <>
      <label>Votre structure est-elle déjà sur Nova ?
        <select name="actorId" value={actorId} onChange={(e) => setActorId(e.target.value)}>
          <option value="">Non, pas encore</option>
          {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <div className="two">
        <label>Nom de la structure<input name="orgName" required minLength={2} maxLength={120}
          key={actorId} defaultValue={actors.find((a) => a.id === actorId)?.name || ""} placeholder="Association, école, entreprise…" /></label>
        <label>Votre rôle (facultatif)<input name="role" maxLength={80} placeholder="Ex. : chargée de communication" /></label>
      </div>
      <label>Site officiel (facultatif)<input name="website" type="url" placeholder="https://…" /></label>
      <label>Message pour l'équipe (facultatif)<textarea name="message" maxLength={1000} placeholder="Quels événements organisez-vous ? À quelle fréquence ?" /></label>
      <p className="note" style={{ margin: 0 }}>L'équipe Nova vérifie chaque compte acteur avant d'ouvrir la publication d'événements. Vous pouvez utiliser votre compte normalement en attendant.</p>
    </>
  );
}
const readActor = (fd) => ({
  orgName: String(fd.get("orgName") || "").trim().slice(0, 120),
  actorId: fd.get("actorId") || "",
  role: String(fd.get("role") || "").trim().slice(0, 80),
  website: String(fd.get("website") || "").trim(),
  message: String(fd.get("message") || "").trim().slice(0, 1000),
});

/* ---------- Connexion / inscription / mot de passe oublié ---------- */
function AuthForms() {
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useUI();
  const [mode, setMode] = useState("signup");
  const [kind, setKind] = useState("perso"); // type de compte à l'inscription : "perso" ou "acteur"
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const run = async (fn) => {
    setBusy(true); setErr(""); setInfo("");
    try { await fn(); } catch (e) { setErr(frError(e)); } finally { setBusy(false); }
  };

  const onSignup = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    if (fd.get("password") !== fd.get("password2")) return setErr("Les deux mots de passe ne correspondent pas.");
    const actor = kind === "acteur" ? readActor(fd) : null;
    if (actor?.website && !/^https?:\/\//.test(actor.website)) return setErr("Le site doit commencer par https://");
    run(async () => {
      const r = await signUp({ email: String(fd.get("email")).trim(), password: fd.get("password"), ...readProfile(fd), actor });
      const extra = actor ? " Votre demande de compte acteur a été transmise à l'équipe Nova." : "";
      if (r.needsConfirmation) setInfo("Compte créé ! Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien pour activer votre compte, puis connectez-vous." + extra);
      else toast("Bienvenue sur Nova ✦");
    });
  };
  const onLogin = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    run(async () => { await signIn(String(fd.get("email")).trim(), fd.get("password")); toast("Connexion réussie ✦"); });
  };
  const onForgot = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    run(async () => { await resetPassword(String(fd.get("email")).trim()); setInfo("Si un compte existe avec cette adresse, un e-mail pour choisir un nouveau mot de passe vient d'être envoyé."); });
  };

  const switchTo = (m) => { setMode(m); setErr(""); setInfo(""); };
  const feedback = <>{err && <div className="err">{err}</div>}{info && <div className="okbox">{info}</div>}</>;

  return (
    <div className="acc-grid">
      <div className="profile-card">
        <div className="big">✦</div><h2>Bienvenue sur Nova</h2>
        <p className="meta" style={{ marginTop: 10 }}>Avec un compte, vous pouvez :</p>
        <ul style={{ color: "#E1E8FF", paddingLeft: 18, margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.7 }}>
          <li>mettre en favoris des événements, des formations et des vidéos</li>
          <li>recevoir une sélection adaptée à votre niveau</li>
          <li>proposer des événements à l'équipe</li>
          <li>retrouver tout ça sur tous vos appareils</li>
        </ul>
      </div>
      <div className="panel">
        {mode !== "forgot" && (
          <div className="authtabs">
            <button className={mode === "signup" ? "on" : ""} onClick={() => switchTo("signup")}>Créer un compte</button>
            <button className={mode === "login" ? "on" : ""} onClick={() => switchTo("login")}>Se connecter</button>
          </div>
        )}
        {mode === "signup" && (
          <form className="f" onSubmit={onSignup} style={{ background: "none", border: 0, padding: 0 }}>
            <label>Je crée un compte…
              <div className="checks" role="radiogroup">
                <label><input type="radio" name="kind" value="perso" checked={kind === "perso"} onChange={() => setKind("perso")} /> personnel</label>
                <label><input type="radio" name="kind" value="acteur" checked={kind === "acteur"} onChange={() => setKind("acteur")} /> en tant qu'acteur (association, école, entreprise, institution…)</label>
              </div>
            </label>
            <div className="two">
              <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
              <span />
            </div>
            <div className="two">
              <label>Mot de passe (8 caractères min.)<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
              <label>Confirmer le mot de passe<input name="password2" type="password" required minLength={8} autoComplete="new-password" /></label>
            </div>
            <ProfileFields actor={kind === "acteur"} />
            {kind === "acteur" && <ActorFields />}
            <label className="consent"><input type="checkbox" required /> J'accepte que Nova enregistre ces informations pour gérer mon compte et personnaliser mon espace. Je peux les modifier ou supprimer mon compte à tout moment.</label>
            {feedback}
            <button className="btn primary" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "Création…" : "Créer mon compte"}</button>
          </form>
        )}
        {mode === "login" && (
          <form className="f" onSubmit={onLogin} style={{ background: "none", border: 0, padding: 0, maxWidth: 420 }}>
            <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
            <label>Mot de passe<input name="password" type="password" required autoComplete="current-password" /></label>
            {feedback}
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
              <button type="button" className="linkbtn" onClick={() => switchTo("forgot")}>Mot de passe oublié ?</button>
            </div>
          </form>
        )}
        {mode === "forgot" && (
          <form className="f" onSubmit={onForgot} style={{ background: "none", border: 0, padding: 0, maxWidth: 420 }}>
            <h3 style={{ fontSize: 20 }}>Mot de passe oublié</h3>
            <label>E-mail du compte<input name="email" type="email" required autoComplete="email" /></label>
            {feedback}
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="btn primary" type="submit" disabled={busy}>Recevoir le lien</button>
              <button type="button" className="linkbtn" onClick={() => switchTo("login")}>← Retour</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- Nouveau mot de passe (après le lien reçu par e-mail) ---------- */
function NewPassword() {
  const { setNewPassword } = useAuth();
  const { toast } = useUI();
  const [err, setErr] = useState("");
  const submit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    if (fd.get("p1") !== fd.get("p2")) return setErr("Les deux mots de passe ne correspondent pas.");
    try { await setNewPassword(fd.get("p1")); toast("Mot de passe modifié ✦"); } catch (e) { setErr(frError(e)); }
  };
  return (
    <div className="panel" style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 24, marginBottom: 14 }}>Choisir un nouveau mot de passe</h2>
      <form className="f" onSubmit={submit} style={{ background: "none", border: 0, padding: 0 }}>
        <label>Nouveau mot de passe<input name="p1" type="password" required minLength={8} autoComplete="new-password" /></label>
        <label>Confirmer<input name="p2" type="password" required minLength={8} autoComplete="new-password" /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" style={{ justifySelf: "start" }}>Enregistrer</button>
      </form>
    </div>
  );
}

const Section = ({ title, children }) => (<><div className="month-title" style={{ marginTop: 22 }}><h3>{title}</h3></div>{children}</>);

/* ---------- Espace connecté ---------- */
function Dashboard() {
  const { user, profile, isAdmin, partner, favs, saveProfile, signOut, deleteAccount } = useAuth();
  const { events, pending, formations, videos, loadEvents } = useData();
  const { confirm, toast } = useUI();
  const [sub, setSub] = useState("favs");
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const [actorReq, setActorReq] = useState(null); // dernière demande de partenariat (comptes acteurs)
  const isActor = profile?.account_type === "acteur";

  useEffect(() => {
    if (!isActor || partner) { setActorReq(null); return; }
    api.fetchMyPartnerRequests().then((r) => setActorReq(r[0] || null)).catch(() => setActorReq(null));
  }, [isActor, !!partner, user.id]);

  if (!profile) return <div className="loading">Chargement de votre espace…</div>;

  const favE = events.filter((e) => favs.has(`event:${e.id}`));
  const favF = formations.filter((f) => favs.has(`formation:${f.id}`));
  const favV = videos.filter((v) => favs.has(`video:${v.id}`));
  const nFav = favE.length + favF.length + favV.length;
  const mine = pending.filter((e) => e.submittedBy === user.id && e.source === "proposition");
  // À modérer : propositions des inscrites + brouillons des associations en relecture
  // (les brouillons de l'équipe se gèrent dans l'onglet « Événements »)
  const toModerate = pending.filter((e) => e.source !== "equipe");

  const onSave = async (ev) => {
    ev.preventDefault(); setErr("");
    try { await saveProfile(readProfile(new FormData(ev.currentTarget))); setEditing(false); toast("Profil enregistré"); }
    catch (e) { setErr(frError(e)); }
  };
  const onDelete = async () => {
    if (!(await confirm("Supprimer votre compte ?", "Votre compte, votre profil et tous vos favoris seront effacés définitivement. Cette action ne peut pas être annulée.", "Supprimer"))) return;
    try { await deleteAccount(); toast("Compte supprimé"); } catch (e) { toast(frError(e)); }
  };
  const moderate = async (e, approve) => {
    if (!approve && !(await confirm("Refuser cette proposition ?", `« ${e.title} » sera supprimée.`, "Refuser"))) return;
    try { approve ? await api.approveEvent(e) : await api.deleteEvent(e.id); await loadEvents(); toast(approve ? "Événement publié ✦" : "Proposition refusée"); }
    catch (er) { toast(frError(er)); }
  };

  if (editing) return (
    <div className="panel">
      <h2 style={{ fontSize: 24, marginBottom: 16 }}>Modifier mon profil</h2>
      <form className="f" onSubmit={onSave} style={{ maxWidth: 720 }}>
        <ProfileFields p={profile} actor={isActor} />
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <button className="btn primary" type="submit">Enregistrer</button>
          <button className="btn ghost" type="button" onClick={() => setEditing(false)}>Annuler</button>
        </div>
      </form>
    </div>
  );

  // Suggestions personnalisées
  const ints = new Set(profile.interets || []);
  const recoE = events.filter((e) => !isPast(e) && (e.pub.includes(profile.niveau) || e.pub.includes("all")))
    .sort((a, b) => (a.status === "year") - (b.status === "year") || toDate(a.start) - toDate(b.start)).slice(0, 4);
  const recoF = formations.map((f) => ({ f, s: f.dom.filter((k) => ints.has(k)).length + (f.mix ? 0.5 : 0) }))
    .filter((x) => x.s >= 1).sort((a, b) => b.s - a.s).slice(0, 4).map((x) => x.f);

  const tabs = [["favs", "♥ Mes favoris"], ["reco", "✦ Pour moi"], ["mine", `Mes propositions${mine.length ? ` (${mine.length})` : ""}`]];
  if (partner) tabs.push(["asso", `Mon association`]);
  if (isAdmin) tabs.push(
    ["mod", `Modération${toModerate.length ? ` (${toModerate.length})` : ""}`],
    ["events", "Événements"],
    ["partners", "Partenaires"],
  );

  return (
    <div className="acc-grid">
      <div>
      <aside className="profile-card">
        <div className="big">{(profile.prenom || "✦")[0].toUpperCase()}</div>
        <h2>Bonjour {profile.prenom} !</h2>
        <div className="meta">{isActor ? "Compte acteur" : LEVELS[profile.niveau]}{profile.ville ? ` · ${profile.ville}` : ""}{isAdmin ? " · Admin" : ""}</div>
        {partner && <div className="meta" style={{ marginTop: 2 }}>Partenaire : {partner.actorName}</div>}
        <div className="meta" style={{ marginTop: 2 }}>{user.email}</div>
        <div className="tags" style={{ marginTop: 14 }}>{(profile.interets || []).map((k) => DOMAINS[k] && <span key={k} className="tag">{DOMAINS[k]}</span>)}</div>
        <div className="meta" style={{ marginTop: 6 }}>{nFav} favori{nFav > 1 ? "s" : ""}</div>
      </aside>
      <div className="acc-actions">
        <button className="btn ghost small" onClick={() => setEditing(true)}>Modifier mon profil</button>
        <button className="btn ghost small" onClick={signOut}>Se déconnecter</button>
        <button className="btn small delete" onClick={onDelete}>Supprimer mon compte</button>
      </div>
      </div>
      <div>
        {isActor && !partner && (
          <div className={actorReq?.status === "refused" ? "err" : "okbox"} style={{ marginBottom: 16 }}>
            {actorReq?.status === "refused"
              ? <>Votre demande de compte acteur pour « {actorReq.org_name} » n'a pas été acceptée. N'hésitez pas à contacter l'équipe Nova pour en savoir plus.</>
              : actorReq
                ? <>Compte acteur en cours de vérification pour « {actorReq.org_name} ». Dès que l'équipe Nova l'aura validé, l'onglet « Mon association » apparaîtra ici pour publier vos événements.</>
                : <>Compte acteur : votre demande est en cours de traitement par l'équipe Nova.</>}
          </div>
        )}
        <div className="subtabs">{tabs.map(([k, l]) => <button key={k} className={sub === k ? "on" : ""} onClick={() => setSub(k)}>{l}</button>)}</div>

        {sub === "favs" && (nFav ? (
          <>
            {!!favE.length && <Section title="Événements"><div className="grid">{favE.map((e) => <EventCard key={e.id} e={e} />)}</div></Section>}
            {!!favF.length && <Section title="Formations"><div className="fgrid" style={{ marginTop: 0 }}>{favF.map((f) => <SchoolCard key={f.id} f={f} />)}</div></Section>}
            {!!favV.length && <Section title="Vidéos"><div className="vgrid" style={{ marginTop: 0 }}>{favV.map((v) => <VideoCard key={v.id} v={v} />)}</div></Section>}
          </>
        ) : (
          <div className="empty" style={{ marginTop: 0 }}>Pas encore de favoris.<br />Touchez le ♡ sur un événement, une formation ou une vidéo pour l'ajouter ici.<br /><br />
            <a className="btn ghost" href="#agenda">Parcourir l'agenda</a> <a className="btn ghost" href="#formations">Voir les formations</a></div>
        ))}

        {sub === "reco" && (<>
          <Section title={`Événements pour ${LEVELS[profile.niveau].toLowerCase()}s`}>
            {recoE.length ? <div className="grid">{recoE.map((e) => <EventCard key={e.id} e={e} />)}</div> : <p className="note">Aucun événement à venir pour ce profil pour le moment.</p>}
          </Section>
          <Section title="Formations qui correspondent à vos centres d'intérêt">
            {recoF.length ? <div className="fgrid" style={{ marginTop: 0 }}>{recoF.map((f) => <SchoolCard key={f.id} f={f} />)}</div> : <p className="note">Ajoutez des centres d'intérêt à votre profil pour voir des formations suggérées.</p>}
          </Section>
        </>)}

        {sub === "mine" && (mine.length
          ? <div className="grid">{mine.map((e) => <EventCard key={e.id} e={e} noFav />)}</div>
          : <div className="empty" style={{ marginTop: 0 }}>Aucune proposition en attente.<br /><br /><a className="btn ghost" href="#proposer">Proposer un événement</a></div>)}

        {sub === "mod" && isAdmin && (toModerate.length
          ? <div className="grid">{toModerate.map((e) => (
              <EventCard key={e.id} e={e} noFav>
                <div className="mod-row" style={{ marginTop: 10 }}>
                  <button className="btn primary small" onClick={() => moderate(e, true)}>Publier</button>
                  <button className="btn danger small" onClick={() => moderate(e, false)}>Refuser</button>
                </div>
              </EventCard>))}</div>
          : <div className="empty" style={{ marginTop: 0 }}>Aucune proposition à modérer.</div>)}

        {sub === "asso" && partner && <EventsManager mode="partner" />}
        {sub === "events" && isAdmin && <EventsManager mode="admin" />}
        {sub === "partners" && isAdmin && <PartnersAdmin />}
      </div>
    </div>
  );
}

export default function Account() {
  const { ready, user, recovery } = useAuth();
  return (
    <>
      <PageHead title="Mon compte">Votre espace Nova : vos favoris, vos propositions, et une sélection d'événements et de formations adaptés à votre niveau.</PageHead>
      <section style={{ paddingTop: 28 }}>
        <div className="wrap">
          {!ready ? <div className="loading">Connexion…</div> : recovery ? <NewPassword /> : user ? <Dashboard /> : <AuthForms />}
        </div>
      </section>
    </>
  );
}
