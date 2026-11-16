import { useState } from "react";
import { EventCard, PageHead } from "../components/Common.jsx";
import { useData } from "../context/DataContext.jsx";
import { CATS, MONTHS } from "../lib/constants.js";
import { capitalize, endOf, today, toDate } from "../lib/format.js";

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function Calendar() {
  const { events } = useData();
  const t = today();
  const [month, setMonth] = useState(() => new Date(t.getFullYear(), t.getMonth(), 1));
  const [selected, setSelected] = useState(null);
  const y = month.getFullYear(), m = month.getMonth();
  const shift = (n) => { setMonth(new Date(y, m + n, 1)); setSelected(null); };

  const dated = events.filter((e) => e.status !== "year");
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // lundi en premier
  const days = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(y, m, 1 - offset + i);
    if (i % 7 === 0 && i >= 28 && day.getMonth() !== m) break;
    days.push(day);
  }
  const monthEvents = dated
    .filter((e) => toDate(e.start) <= new Date(y, m + 1, 0) && endOf(e) >= first)
    .sort((a, b) => toDate(a.start) - toDate(b.start));

  return (
    <>
      <PageHead title="Calendrier">Vue mois par mois. Cliquez sur un événement pour voir sa fiche.</PageHead>
      <section style={{ paddingTop: 28 }}>
        <div className="wrap">
          <div className="cal-head">
            <button onClick={() => shift(-1)} aria-label="Mois précédent">←</button>
            <h2>{capitalize(MONTHS[m])} {y}</h2>
            <button onClick={() => shift(1)} aria-label="Mois suivant">→</button>
            <button onClick={() => { setMonth(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(null); }}>Aujourd'hui</button>
          </div>
          <div className="cal">
            {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
            {days.map((day) => {
              const todays = dated.filter((e) => toDate(e.start) <= day && endOf(e) >= day);
              const cls = `day ${day.getMonth() !== m ? "out" : ""} ${day.getTime() === t.getTime() ? "today" : ""}`;
              return (
                <div key={day.toISOString()} className={cls}>
                  <span className="n">{day.getDate()}</span>
                  {todays.slice(0, 3).map((e) => (
                    <button key={e.id} className="ev" style={{ background: CATS[e.cat]?.color }} title={e.title} onClick={() => setSelected(e)}>{e.title}</button>
                  ))}
                  {todays.length > 3 && <span className="note">+{todays.length - 3}</span>}
                </div>
              );
            })}
          </div>
          <div className="cal-detail">
            {selected ? (
              <>
                <div className="month-title"><h3>Fiche</h3></div>
                <div className="grid"><EventCard e={selected} /></div>
                <p><button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setSelected(null)}>← Tous les événements du mois</button></p>
              </>
            ) : monthEvents.length ? (
              <>
                <div className="month-title"><h3>Ce mois-ci · {monthEvents.length} événement{monthEvents.length > 1 ? "s" : ""}</h3></div>
                <div className="grid">{monthEvents.map((e) => <EventCard key={e.id} e={e} />)}</div>
              </>
            ) : (
              <div className="empty">Aucun événement daté ce mois-ci.<br />Les programmes « toute l'année » sont dans l'onglet Agenda.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
