// Pages simples : Acteurs et À propos
import { PageHead } from "../components/Common.jsx";
import { useData } from "../context/DataContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { PUBS } from "../lib/constants.js";
import { isPast, norm } from "../lib/format.js";

export function Actors() {
  const { actors, events } = useData();
  const { setAgendaFilter } = useUI();
  return (
    <>
      <PageHead title="Les acteurs">Les associations, écoles et institutions qui organisent ces événements toute l'année. Pour aller plus loin que l'agenda : mentorat, marraines, ressources.</PageHead>
      <section style={{ paddingTop: 8 }}>
        <div className="wrap"><div className="actors">
          {actors.map((a) => {
            const n = events.filter((e) => (e.actorId === a.id || norm(e.org).includes(norm(a.key))) && !isPast(e)).length;
            return (
              <article className="actor" key={a.id}>
                <div className="ini">{a.ini}</div>
                <h3>{a.name}</h3>
                {a.partner && <span className="tag partner-tag" style={{ alignSelf: "flex-start" }}>✓ Partenaire Nova</span>}
                <p>{a.desc}</p>
                <div className="tags">{a.pub.map((p) => <span key={p} className="tag">{PUBS[p]}</span>)}</div>
                <div className="actions">
                  {a.url && <a className="go" href={a.url} target="_blank" rel="noopener noreferrer">Site officiel ↗</a>}
                  {n > 0 && <a href="#agenda" onClick={() => setAgendaFilter({ when: "up", cats: [], pub: "", q: "", org: a.key })}>{n} événement{n > 1 ? "s" : ""} à venir</a>}
                </div>
              </article>
            );
          })}
        </div></div>
      </section>
    </>
  );
}

export function About() {
  return (
    <>
      <PageHead title="À propos">Le projet Nova, sa mission et la façon dont l'agenda est construit.</PageHead>
      <section style={{ paddingTop: 28 }}>
        <div className="wrap">
          <div className="about">
            <div>
              <h2>Pourquoi Nova&nbsp;?</h2>
              <p>Les initiatives pour encourager les filles et les femmes vers les sciences sont nombreuses, mais dispersées entre associations, écoles, ministères et fondations. Nova les rassemble pour qu'une collégienne, une étudiante ou une chercheuse trouve en quelques secondes le rendez-vous fait pour elle.</p>
              <p>Projet de fin d'études — équipe HTG.</p>
            </div>
            <div className="pillars">
              <div className="pillar"><h4>✦ Recenser</h4><p>Un agenda unique, mis à jour par l'équipe et par les associations partenaires, avec le lien vers chaque source officielle.</p></div>
              <div className="pillar"><h4>✦ Orienter</h4><p>Des écoles et formations, des filtres par public et un espace personnel avec favoris.</p></div>
              <div className="pillar"><h4>✦ Inspirer</h4><p>Des témoignages vidéo de femmes ingénieures, étudiantes et chercheuses.</p></div>
            </div>
          </div>
          <div className="sec-head" style={{ marginTop: 48 }}><div><h2>Comment l'agenda est construit</h2></div></div>
          <div className="actors" style={{ marginTop: 0 }}>
            <div className="actor"><h3><span className="status ok">Date confirmée</span></h3><p>La date est publiée par l'organisateur, ou fixe chaque année (11 février, 8 mars…).</p></div>
            <div className="actor"><h3><span className="status est">Date estimée</span></h3><p>L'édition n'est pas encore annoncée : la date est déduite de l'année précédente. À vérifier sur le site officiel.</p></div>
            <div className="actor"><h3><span className="status year">Toute l'année</span></h3><p>Programmes avec des sessions dans plusieurs villes au fil de l'année scolaire.</p></div>
            <div className="actor"><h3><span className="status prop">Proposé · à vérifier</span></h3><p>Événement proposé par une personne inscrite. Il apparaît dans l'agenda une fois validé par l'équipe.</p></div>
            <div className="actor"><h3><span className="tag partner-tag">✓ Publié par l'association</span></h3><p>Événement ajouté directement par une association partenaire de Nova, qui le tient à jour elle-même.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
