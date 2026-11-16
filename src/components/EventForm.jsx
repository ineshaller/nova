// Formulaire d'ajout / de modification d'un événement, utilisé par :
//  - l'équipe Nova (mode "admin") : choix de l'association, publication directe ou brouillon ;
//  - une association partenaire (mode "partner") : l'événement est rattaché à son association.
// (Les propositions des personnes inscrites gardent leur formulaire simple, pages/Propose.jsx.)
import { useState } from "react";
import { CATS, EDIT_STATUS, PUBS } from "../lib/constants.js";

export default function EventForm({ mode, initial, actors = [], partnerName = "", onSubmit, onCancel }) {
  const e = initial || {};
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pubs = new Set(e.pub?.length ? e.pub : ["all"]);

  const submit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const v = {
      title: String(fd.get("title") || "").trim(),
      start: fd.get("start"),
      end: fd.get("end") || "",
      org: String(fd.get("org") || "").trim(),
      place: String(fd.get("place") || "").trim(),
      cat: fd.get("cat"),
      pub: fd.getAll("pub"),
      status: fd.get("status"),
      url: String(fd.get("url") || "").trim(),
      desc: String(fd.get("desc") || "").trim(),
      actorId: mode === "admin" ? fd.get("actorId") || "" : undefined,
      publish: mode === "admin" ? fd.get("publish") === "on" : undefined,
    };
    setErr("");
    if (v.end && v.end < v.start) return setErr("La date de fin doit être après la date de début.");
    if (v.url && !/^https?:\/\//.test(v.url)) return setErr("Le lien doit commencer par https://");
    if (!v.pub.length) return setErr("Choisissez au moins un public.");
    if (mode === "admin" && !v.org && !v.actorId) return setErr("Indiquez l'organisateur ou choisissez une association.");
    setBusy(true);
    try { await onSubmit(v); } catch (er) { setErr("Enregistrement impossible : " + (er.message || "erreur inconnue")); setBusy(false); }
  };

  return (
    <form className="f" onSubmit={submit}>
      <h3 style={{ fontSize: 20 }}>{initial ? "Modifier l'événement" : "Nouvel événement"}</h3>
      <label>Nom de l'événement<input name="title" required minLength={3} maxLength={160} defaultValue={e.title || ""} /></label>
      <div className="two">
        <label>Date de début<input name="start" type="date" required defaultValue={e.start || ""} /></label>
        <label>Date de fin (facultatif)<input name="end" type="date" defaultValue={e.end || ""} /></label>
      </div>

      {mode === "admin" ? (
        <div className="two">
          <label>Association (facultatif)
            <select name="actorId" defaultValue={e.actorId || ""}>
              <option value="">— Aucune / autre organisateur —</option>
              {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label>Organisateur affiché<input name="org" maxLength={160} defaultValue={e.org || ""} placeholder="Vide = nom de l'association" /></label>
        </div>
      ) : (
        <label>Organisateur affiché
          <input name="org" maxLength={160} defaultValue={e.org || partnerName} placeholder={partnerName} />
          <span className="note">Ajoutez les co-organisateurs si besoin, séparés par « · ».</span>
        </label>
      )}

      <div className="two">
        <label>Lieu<input name="place" maxLength={160} defaultValue={e.place || ""} placeholder="Ville, établissement ou « En ligne »" /></label>
        <label>Type<select name="cat" defaultValue={e.cat || "rencontre"}>{Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label>
      </div>
      <label>Date
        <select name="status" defaultValue={EDIT_STATUS[e.status] ? e.status : "ok"}>
          {Object.entries(EDIT_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label>Public
        <div className="checks">
          {Object.entries(PUBS).map(([k, l]) => (
            <label key={k}><input type="checkbox" name="pub" value={k} defaultChecked={pubs.has(k)} /> {l}</label>
          ))}
        </div>
      </label>
      <label>Lien officiel<input name="url" type="url" defaultValue={e.url || ""} placeholder="https://…" /></label>
      <label>Description<textarea name="desc" maxLength={600} defaultValue={e.desc || ""} placeholder="En deux phrases : à qui ça s'adresse, ce qu'on y fait." /></label>
      {mode === "admin" && (
        <label className="consent"><input type="checkbox" name="publish" defaultChecked={initial ? !!e.published : true} /> Publier dans l'agenda (décochez pour garder un brouillon)</label>
      )}
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ justifyContent: "flex-start" }}>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
