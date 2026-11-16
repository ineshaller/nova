import { useEffect, useState } from "react";
import { EventCard } from "../components/Common.jsx";
import { useData } from "../context/DataContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { CATS } from "../lib/constants.js";
import { fmtRange, isPast, toDate, today } from "../lib/format.js";

const Spark = (props) => (
  <svg className="spark" viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M12 0c.8 6.6 4.6 10.6 12 12-7.4 1.4-11.2 5.4-12 12-.8-6.6-4.6-10.6-12-12C7.4 10.6 11.2 6.6 12 0z" /></svg>
);

function NextEvent({ e }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  if (!e) return <aside className="next"><span className="label">Prochain rendez-vous</span><h3>Bientôt de nouveaux événements</h3></aside>;
  const ms = toDate(e.start) - now;
  const days = Math.max(0, Math.floor(ms / 864e5)), hrs = Math.max(0, Math.floor(ms / 36e5) % 24);
  return (
    <aside className="next" aria-live="polite">
      <span className="label">✦ Prochain rendez-vous</span>
      <h3>{e.title}</h3>
      <div className="meta">{fmtRange(e)} · {e.place}</div>
      <div className="countdown"><div><b>{days}</b><span>jours</span></div><div><b>{hrs}</b><span>heures</span></div></div>
      <div className="meta" style={{ marginBottom: 14 }}>{e.org}</div>
      {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer">Voir le site officiel ↗</a>}
    </aside>
  );
}

export default function Home() {
  const { events } = useData();
  const { setAgendaFilter } = useUI();
  const up = events.filter((e) => !isPast(e));
  const dated = up.filter((e) => e.status !== "year").sort((a, b) => toDate(a.start) - toDate(b.start));
  const next = dated.find((e) => toDate(e.start) >= today());
  const orgs = new Set(events.flatMap((e) => e.org.split(" · ")));

  return (
    <>
      <div className="hero">
        <Spark style={{ left: "6%", top: 24, width: 22, height: 22 }} />
        <Spark style={{ left: "46%", bottom: 30, width: 14, height: 14, opacity: 0.35 }} />
        <div className="wrap">
          <div>
            <span className="eyebrow">✦ Agenda Nova</span>
            <h1>Tous les rendez-vous pour <em>oser les sciences</em>, au même endroit.</h1>
            <p className="lead">Journées mondiales, rencontres avec des chercheuses, prix, concours et forums emploi : Nova recense les événements qui font avancer la place des filles et des femmes dans les sciences et l'ingénierie.</p>
            <div className="hero-actions">
              <a className="btn primary" href="#agenda">Voir l'agenda →</a>
              <a className="btn ghost" href="#proposer">Signaler un événement</a>
            </div>
            <div className="stats">
              <div><b>{up.length}</b><span>événements à venir</span></div>
              <div><b>{orgs.size}</b><span>organisatrices et organismes</span></div>
              <div><b>5</b><span>publics, du collège à la recherche</span></div>
            </div>
          </div>
          <NextEvent e={next} />
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head"><div><h2>Explorer par type</h2><p>Cinq familles d'événements, du collège jusqu'à la recherche.</p></div></div>
          <div className="quick">
            {Object.entries(CATS).map(([k, c]) => (
              <a key={k} href="#agenda" onClick={() => setAgendaFilter({ when: "up", cats: [k], pub: "", q: "", org: "" })}>
                <i style={{ background: c.color }} /><b>{up.filter((e) => e.cat === k).length}</b><span>{c.label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head"><div><h2>Bientôt</h2><p>Les trois prochains rendez-vous de l'agenda.</p></div><a className="link-more" href="#agenda">Tout l'agenda →</a></div>
          <div className="grid">{dated.slice(0, 3).map((e) => <EventCard key={e.id} e={e} />)}</div>
        </div>
      </section>
    </>
  );
}
