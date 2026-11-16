import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import * as api from "../lib/api.js";
import { CATS, PUBS } from "../lib/constants.js";
import { PartnerRequestPanel } from "./AccountManage.jsx";

export default function Propose() {
  const { user } = useAuth();
  const { loadEvents } = useData();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = Object.fromEntries(new FormData(form));
    setErr("");
    if (fd.end && fd.end < fd.start) return setErr("La date de fin doit être après la date de début.");
    if (fd.url && !/^https?:\/\//.test(fd.url)) return setErr("Le lien doit commencer par https://");
    setBusy(true);
    try {
      await api.proposeEvent(user.id, {
        title: fd.title.trim(), start: fd.start, end: fd.end, org: fd.org.trim(), place: fd.place.trim(),
        cat: fd.cat, pub: fd.pub, url: fd.url.trim(), desc: fd.desc.trim(),
      });
      form.reset(); setDone(true); toast("Proposition envoyée ✦"); loadEvents();
    } catch (e) {
      setErr("L'envoi a échoué : " + (e.message || "erreur inconnue"));
    } finally { setBusy(false); }
  };

  return (
    <>
    <section>
      <div className="wrap propose">
        <div>
          <h2 style={{ fontSize: 34 }}>Proposer un événement</h2>
          <p style={{ color: "var(--muted)" }}>Vous organisez ou connaissez un événement autour des femmes en sciences&nbsp;? Envoyez-le : l'équipe Nova le vérifie, puis il apparaît dans l'agenda.</p>
          <p className="note">Vous retrouvez vos propositions et leur statut dans « Mon compte ».</p>
        </div>
        {!user ? (
          <div className="panel">
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Connectez-vous pour proposer un événement</h3>
            <p className="note" style={{ marginTop: 0 }}>Un compte permet à l'équipe de vous recontacter si besoin et d'éviter les envois indésirables.</p>
            <a className="btn primary" href="#compte">Se connecter ou créer un compte</a>
          </div>
        ) : (
          <form className="f" onSubmit={submit}>
            <label>Nom de l'événement<input name="title" required minLength={3} maxLength={160} placeholder="Ex. : Journée Filles & Robotique" /></label>
            <div className="two">
              <label>Date de début<input name="start" type="date" required /></label>
              <label>Date de fin (facultatif)<input name="end" type="date" /></label>
            </div>
            <div className="two">
              <label>Organisateur<input name="org" required maxLength={160} placeholder="Association, école…" /></label>
              <label>Lieu<input name="place" maxLength={160} placeholder="Ville ou « En ligne »" /></label>
            </div>
            <div className="two">
              <label>Type<select name="cat">{Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label>
              <label>Public<select name="pub">{Object.entries(PUBS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <label>Lien officiel<input name="url" type="url" placeholder="https://…" /></label>
            <label>Description<textarea name="desc" maxLength={600} placeholder="En deux phrases : à qui ça s'adresse, ce qu'on y fait." /></label>
            {err && <div className="err">{err}</div>}
            {done && <div className="okbox">Merci ! Votre proposition a été envoyée. Elle sera visible dans l'agenda après validation.</div>}
            <button className="btn primary" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "Envoi…" : "Envoyer la proposition"}</button>
          </form>
        )}
      </div>
    </section>
    <PartnerRequestPanel />
    </>
  );
}
