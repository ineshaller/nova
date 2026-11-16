// Petits composants réutilisés partout : en-tête, pied de page, favoris, cartes.
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { CATS, DOMAINS, FTYPES, MSHORT, PUBS, ROLES, STATUS } from "../lib/constants.js";
import { fmtRange, isPast, safeBold, toDate } from "../lib/format.js";

/* ---------------- En-tête ---------------- */
const NAV = [
  ["accueil", "Accueil"], ["agenda", "Agenda"], ["calendrier", "Calendrier"], ["formations", "Formations"],
  ["decouverte", "Découverte"], ["acteurs", "Acteurs"], ["a-propos", "À propos"],
];

export function Header() {
  const { tab } = useUI();
  const { profile } = useAuth();
  return (
    <header className="top">
      <div className="wrap">
        <a className="brand" href="#accueil" aria-label="Nova, accueil"><img src="./logo-nova.png" alt="Nova" /></a>
        <nav className="main" aria-label="Onglets">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={tab === id ? "active" : ""}>{label}</a>
          ))}
          <a href="#compte" className={`cta acc ${tab === "compte" ? "active" : ""}`}>
            {profile ? (<><span className="av">{(profile.prenom || "✦")[0].toUpperCase()}</span><span>{profile.prenom || "Mon compte"}</span></>) : "Mon compte"}
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <img src="./logo-nova.png" alt="Nova" />
        <a href="#proposer" style={{ fontWeight: 600, textDecoration: "none" }}>Proposer un événement</a>
        <span>Événements : sites officiels des organisateurs et associations partenaires. Les dates estimées sont indicatives.
          Formations : <a href="https://www.data.gouv.fr/datasets/ideo-actions-de-formation-initiale-univers-enseignement-superieur" target="_blank" rel="noopener noreferrer">Onisep</a>, licence ODbL.</span>
      </div>
    </footer>
  );
}

export function PageHead({ title, children, action }) {
  return (
    <div className="page-head"><div className="wrap">
      <div className="sec-head" style={{ margin: 0 }}><h1>{title}</h1>{action}</div>
      {children && <p>{children}</p>}
    </div></div>
  );
}

export function SearchBox({ value, onChange, placeholder, label }) {
  return (
    <div className="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

/* ---------------- Bouton favori ---------------- */
export function FavButton({ type, id, style }) {
  const { user, isFav, toggleFav } = useAuth();
  const { confirm, go, toast } = useUI();
  const on = user && isFav(type, id);
  const click = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) {
      if (await confirm("Gardez vos favoris ✦", "Créez votre compte Nova pour enregistrer vos événements, formations et vidéos préférés et les retrouver sur tous vos appareils.", "Créer mon compte")) go("compte");
      return;
    }
    try { toast((await toggleFav(type, id)) ? "Ajouté aux favoris ♥" : "Retiré des favoris"); }
    catch { toast("Enregistrement impossible, réessayez"); }
  };
  const label = on ? "Retirer des favoris" : "Ajouter aux favoris";
  return (
    <button className={`fav ${on ? "on" : ""}`} onClick={click} aria-pressed={!!on} aria-label={label} title={label} style={style}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" /></svg>
    </button>
  );
}

/* ---------------- Carte événement ---------------- */
export function EventCard({ e, noFav, children }) {
  const { toast } = useUI();
  const c = CATS[e.cat] || CATS.rencontre;
  const a = toDate(e.start);
  const st = STATUS[e.status] || STATUS.ok;
  const copy = async () => {
    const txt = `${e.title}\n${fmtRange(e)} — ${e.place}\n${e.org}\n${e.desc}${e.url ? "\n" + e.url : ""}\n(via Nova)`;
    try { await navigator.clipboard.writeText(txt); toast("Infos copiées ✦"); } catch { toast("Copie impossible dans ce navigateur"); }
  };
  return (
    <article className={`card ${isPast(e) ? "past" : ""}`}>
      {!noFav && <FavButton type="event" id={e.id} />}
      {e.status === "year"
        ? <div className="dateb year"><b>✦</b><span>{String(a.getFullYear()).slice(2)}–{String(a.getFullYear() + 1).slice(2)}</span></div>
        : <div className="dateb"><b>{a.getDate()}</b><span>{MSHORT[a.getMonth()]}</span></div>}
      <div className="cbody">
        <div className="cat" style={{ color: c.color }}><span className="dot" style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />{c.label}</div>
        <h4>{e.title}</h4>
        <div className="org">{fmtRange(e)} · {e.place}</div>
        <div className="org">{e.org}</div>
        <p className="desc">{e.desc}</p>
        <div className="tags">
          <span className={`status ${st[0]}`}>{st[1]}</span>
          {e.source === "partenaire" && <span className="tag partner-tag" title="Événement publié directement par l'association partenaire">✓ Publié par l'association</span>}
          {e.pub.map((p) => <span key={p} className="tag">{PUBS[p] || p}</span>)}
        </div>
        <div className="actions">
          {e.url && <a className="go" href={e.url} target="_blank" rel="noopener noreferrer">Site officiel ↗</a>}
          <button onClick={copy}>Copier l'info</button>
        </div>
        {children}
      </div>
    </article>
  );
}

/* ---------------- Carte formation ---------------- */
export function SchoolCard({ f }) {
  return (
    <article className="school">
      <FavButton type="formation" id={f.id} />
      <div className="kind">{[FTYPES[f.type], f.acces.map((a) => (a === "postbac" ? "Après le bac" : "Après prépa / bac+2")).join(" ou ")].filter(Boolean).join(" · ")}</div>
      <h4>{f.name}</h4>
      {f.school && <div className="where">🏫 {f.school}</div>}
      <div className="where">📍 {[f.where, f.statut].filter(Boolean).join(" · ")}</div>
      <p>{f.desc}</p>
      {f.mix && <div className="mix">♀ <span dangerouslySetInnerHTML={{ __html: safeBold(f.mix) }} /></div>}
      <div className="tags">{f.dom.map((k) => <span key={k} className="tag">{DOMAINS[k] || k}</span>)}</div>
      <div className="actions">
        {f.url && <a className="go" href={f.url} target="_blank" rel="noopener noreferrer">{f.url.includes("onisep") ? "Fiche Onisep ↗" : "Site officiel ↗"}</a>}
        {f.onisepUrl && f.onisepUrl !== f.url && <a href={f.onisepUrl} target="_blank" rel="noopener noreferrer">Fiche Onisep ↗</a>}
      </div>
      {f.source === "onisep" && <div className="src">Source : Onisep (ODbL)</div>}
    </article>
  );
}

/* ---------------- Carte vidéo ---------------- */
export function VideoCard({ v, onDelete }) {
  return (
    <article className="vcard">
      {v.file
        ? <video controls preload="metadata" playsInline poster={v.poster || undefined} src={v.file} />
        : <a className="linkthumb" href={v.link} target="_blank" rel="noopener noreferrer"><span className="play">▶</span>Regarder la vidéo ↗</a>}
      <div className="vb">
        <div className="role">{ROLES[v.role] || "Témoignage"}{v.domain && DOMAINS[v.domain] ? ` · ${DOMAINS[v.domain]}` : ""}</div>
        <h4>{v.title}</h4>
        <div className="who">{v.person}{v.org ? ` · ${v.org}` : ""}</div>
        {v.desc && <p>{v.desc}</p>}
        {onDelete && <div className="actions"><button className="del" onClick={() => onDelete(v)}>Supprimer</button></div>}
      </div>
      <FavButton type="video" id={v.id} />
    </article>
  );
}

export const Empty = ({ children }) => <div className="empty">{children}</div>;
