import { EventCard, PageHead, SearchBox } from "../components/Common.jsx";
import { useData } from "../context/DataContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { CATS, MONTHS, MSHORT, PUBS } from "../lib/constants.js";
import { capitalize, isPast, matches, norm, today, toDate } from "../lib/format.js";

export default function Agenda() {
  const { events, loading, error } = useData();
  const { agendaFilter: f, setAgendaFilter } = useUI();
  const set = (patch) => setAgendaFilter({ ...f, ...patch });
  const toggleCat = (k) => set({ cats: f.cats.includes(k) ? f.cats.filter((c) => c !== k) : [...f.cats, k] });

  const items = events.filter((e) => {
    if (f.when === "up" && isPast(e)) return false;
    if (f.when === "past" && !isPast(e)) return false;
    if (f.cats.length && !f.cats.includes(e.cat)) return false;
    if (f.pub && !e.pub.includes(f.pub) && !e.pub.includes("all")) return false;
    if (f.org && !norm(e.org).includes(norm(f.org))) return false;
    return matches(f.q, [e.title, e.org, e.place, e.desc, CATS[e.cat]?.label, ...e.pub.map((p) => PUBS[p])]);
  });
  const key = (e) => (e.status === "year" ? (f.when === "past" ? -Infinity : -1) : toDate(e.start).getTime());
  items.sort((a, b) => (f.when === "past" ? key(b) - key(a) : key(a) - key(b)));

  // Regroupement par mois
  const groups = new Map();
  for (const e of items) {
    const k = e.status === "year" ? "year" : e.start.slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }

  // Bandeau des 12 mois
  const t = today();
  const start = f.when === "past" ? new Date(2026, 0, 1) : new Date(t.getFullYear(), t.getMonth(), 1);
  const counts = {};
  items.forEach((e) => { if (e.status !== "year") counts[e.start.slice(0, 7)] = (counts[e.start.slice(0, 7)] || 0) + 1; });
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const k = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    return { k, m, n: counts[k] || 0 };
  });
  const jump = (k) => {
    const el = document.getElementById("m-" + k);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (window.innerWidth > 900 ? 240 : 90), behavior: "smooth" });
  };

  return (
    <>
      <PageHead title="L'agenda" action={<a className="btn ghost" href="#proposer">+ Proposer un événement</a>}>
        Filtrez par type d'événement et par public. Les dates « estimées » sont déduites de l'édition précédente : vérifiez toujours sur le site officiel.
      </PageHead>
      <section style={{ paddingTop: 28 }}>
        <div className="wrap">
          <div className="toolbar">
            <div className="row">
              <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="Rechercher : maths, Lyon, prix, lycéennes…" label="Rechercher un événement" />
              <div className="seg" role="tablist" aria-label="Période">
                {[["up", "À venir"], ["past", "Passés"], ["all", "Tout"]].map(([w, l]) => (
                  <button key={w} className={f.when === w ? "on" : ""} onClick={() => set({ when: w })}>{l}</button>
                ))}
              </div>
              <select value={f.pub} onChange={(e) => set({ pub: e.target.value })} aria-label="Public">
                <option value="">Tous les publics</option>
                {Object.entries(PUBS).filter(([k]) => k !== "all").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="row">
              <div className="chips">
                {Object.entries(CATS).map(([k, c]) => (
                  <button key={k} className={`chip ${f.cats.includes(k) ? "on" : ""}`} onClick={() => toggleCat(k)}>
                    <span className="dot" style={{ background: c.color }} />{c.label}
                  </button>
                ))}
              </div>
              <span className="count">
                {f.org && <button className="chip on" onClick={() => set({ org: "" })}>{f.org} ✕</button>}{" "}
                {items.length} événement{items.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="months">
            {months.map(({ k, m, n }) => (
              <button key={k} className={n ? "has" : ""} disabled={!n} onClick={() => jump(k)} title={`${MONTHS[m.getMonth()]} ${m.getFullYear()}`}>
                <b>{n || "·"}</b>{MSHORT[m.getMonth()]} {String(m.getFullYear()).slice(2)}
              </button>
            ))}
          </div>
          <div className="legend">
            <span><span className="status ok">Date confirmée</span></span>
            <span><span className="status est">Date estimée</span> d'après l'édition précédente</span>
            <span><span className="status year">Toute l'année</span> sessions dans plusieurs villes</span>
          </div>

          {error && <div className="err" style={{ marginTop: 20 }}>Impossible de charger l'agenda : {error}</div>}
          {loading && !events.length ? <div className="loading">Chargement de l'agenda…</div>
            : !items.length ? <div className="empty">Aucun événement ne correspond à ces filtres.<br />Essayez « Tout » ou un autre public.</div>
            : [...groups].map(([k, evs]) => {
                const title = k === "year" ? "Toute l'année" : capitalize(MONTHS[Number(k.slice(5)) - 1]) + " " + k.slice(0, 4);
                return (
                  <div className="month-group" id={`m-${k}`} key={k}>
                    <div className="month-title"><h3>{title}</h3></div>
                    <div className="grid">{evs.map((e) => <EventCard key={e.id} e={e} />)}</div>
                  </div>
                );
              })}
        </div>
      </section>
    </>
  );
}
