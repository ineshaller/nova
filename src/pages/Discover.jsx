import { useState } from "react";
import { PageHead, VideoCard } from "../components/Common.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import * as api from "../lib/api.js";
import { DOMAINS, ROLES } from "../lib/constants.js";

const MAX_MB = 50; // limite définie dans schema.sql (bucket "videos")

function UploadForm({ onDone }) {
  const { user } = useAuth();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file"), poster = fd.get("poster"), link = String(fd.get("link") || "").trim();
    const hasFile = file && file.size > 0;
    setErr("");
    if (!hasFile && !/^https?:\/\//.test(link)) return setErr("Ajoutez un fichier vidéo ou un lien qui commence par https://");
    if (hasFile && file.size > MAX_MB * 1024 * 1024) return setErr(`Le fichier dépasse ${MAX_MB} Mo. Compressez la vidéo ou utilisez un lien YouTube / Vimeo.`);
    setBusy(true);
    try {
      await api.addVideo(user.id, {
        title: String(fd.get("title")).trim(), person: String(fd.get("person")).trim(), role: fd.get("role"),
        domain: fd.get("domain"), org: String(fd.get("org") || "").trim(), desc: String(fd.get("desc") || "").trim(), link,
      }, hasFile ? file : null, poster && poster.size > 0 ? poster : null);
      form.reset(); toast("Vidéo publiée ✦"); onDone();
    } catch (e) {
      setErr("La publication a échoué : " + (e.message || "erreur inconnue"));
    } finally { setBusy(false); }
  };

  return (
    <div className="upload panel">
      <h2 style={{ fontSize: 24, marginBottom: 6 }}>Ajouter une vidéo <span className="tag" style={{ verticalAlign: "middle" }}>Admin</span></h2>
      <p className="note" style={{ margin: "0 0 16px" }}>Visible uniquement par les comptes administrateurs. Fichier vidéo (MP4 conseillé, {MAX_MB} Mo maximum) ou lien YouTube / Vimeo.</p>
      <form className="f" onSubmit={submit} style={{ background: "none", border: 0, padding: 0 }}>
        <div className="two">
          <label>Titre de la vidéo<input name="title" required maxLength={120} placeholder="Ex. : Mon quotidien d'ingénieure en aéronautique" /></label>
          <label>Prénom (et nom) de la personne<input name="person" required maxLength={80} placeholder="Ex. : Sarah" /></label>
        </div>
        <div className="two">
          <label>Rôle<select name="role">{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Domaine<select name="domain">{Object.entries(DOMAINS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <label>École, entreprise ou laboratoire<input name="org" maxLength={100} placeholder="Ex. : INSA Lyon, Airbus…" /></label>
        <label>Description<textarea name="desc" maxLength={400} placeholder="En une ou deux phrases : de quoi parle la vidéo ?" /></label>
        <div className="two">
          <label>Fichier vidéo<input name="file" type="file" accept="video/*" /></label>
          <label>… ou lien externe<input name="link" type="url" placeholder="https://www.youtube.com/…" /></label>
        </div>
        <label>Image d'aperçu (facultatif)<input name="poster" type="file" accept="image/*" /></label>
        {busy && <div className="progress" style={{ display: "block" }}><i /></div>}
        {err && <div className="err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "Envoi…" : "Publier la vidéo"}</button>
      </form>
    </div>
  );
}

export default function Discover() {
  const { videos, loadVideos } = useData();
  const { isAdmin } = useAuth();
  const { confirm, toast } = useUI();
  const [role, setRole] = useState("");
  const [dom, setDom] = useState("");
  const items = videos.filter((v) => (!role || v.role === role) && (!dom || v.domain === dom));

  const remove = async (v) => {
    if (!(await confirm("Supprimer cette vidéo ?", `« ${v.title} » sera retirée de la page Découverte pour tout le monde.`, "Supprimer"))) return;
    try { await api.deleteVideo(v); await loadVideos(); toast("Vidéo supprimée"); } catch { toast("Suppression impossible"); }
  };

  return (
    <>
      <PageHead title="Découverte">Des ingénieures, des étudiantes et des chercheuses racontent leur parcours, leur métier et ce qui les a fait choisir les sciences.</PageHead>
      <section style={{ paddingTop: 28 }}>
        <div className="wrap">
          <div className="row">
            <div className="chips">
              <button className={`chip ${!role ? "on" : ""}`} onClick={() => setRole("")}>Tous les profils</button>
              {Object.entries(ROLES).map(([k, v]) => <button key={k} className={`chip ${role === k ? "on" : ""}`} onClick={() => setRole(k)}>{v}s</button>)}
            </div>
            <select value={dom} onChange={(e) => setDom(e.target.value)} aria-label="Domaine">
              <option value="">Tous les domaines</option>
              {Object.entries(DOMAINS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {!!videos.length && <span className="count">{items.length} vidéo{items.length > 1 ? "s" : ""}</span>}
          </div>

          {!videos.length ? (
            <div className="vempty">
              <b>Les premières vidéos arrivent bientôt</b>
              L'équipe Nova prépare des témoignages filmés de femmes qui ont choisi les sciences.
              <div className="vroles">{Object.values(ROLES).map((r) => <span key={r}>🎬 {r}s</span>)}</div>
            </div>
          ) : items.length ? (
            <div className="vgrid">{items.map((v) => <VideoCard key={v.id} v={v} onDelete={isAdmin ? remove : null} />)}</div>
          ) : <div className="empty">Aucune vidéo pour ces filtres.</div>}

          {isAdmin && <UploadForm onDone={loadVideos} />}
        </div>
      </section>
    </>
  );
}
