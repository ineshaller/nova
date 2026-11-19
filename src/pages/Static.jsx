// Pages simples : Acteurs et À propos
import { useRef, useState } from "react";
import { PageHead } from "../components/Common.jsx";
import { useData } from "../context/DataContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { ACTOR_KINDS, APPROACHES, PUBS, SCOPES } from "../lib/constants.js";
import { isPast, norm } from "../lib/format.js";

export function Actors() {
  const { actors, events } = useData();
  const { setAgendaFilter } = useUI();
  const [appr, setAppr] = useState("");
  const [pub, setPub] = useState("");
  const top = useRef(null);

  const items = actors.filter((a) => (!appr || a.approaches.includes(appr)) && (!pub || a.pub.includes(pub) || a.pub.includes("all")));
  const byAppr = (k) => actors.filter((a) => a.approaches.includes(k));
  const pick = (k) => { setAppr(k); setPub(""); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return (
    <>
      <PageHead title="Les acteurs">Les associations, écoles, entreprises et institutions qui agissent pour la place des filles et des femmes dans les sciences, le numérique et l'ingénierie.</PageHead>
      <section style={{ paddingTop: 28 }}>
        <div className="wrap">
          <div className="actors-intro">
            <h2>Les solutions qui existent déjà</h2>
            <p>De nombreuses initiatives cherchent déjà à améliorer la place des filles et des femmes dans les sciences. Elles ne fonctionnent pas toutes de la même manière : certaines interviennent très tôt contre les stéréotypes, d'autres proposent des rôles modèles ou du mentorat, certaines font pratiquer les sciences et le numérique, d'autres accompagnent les étudiantes vers le monde professionnel.</p>
            <p>Pour chacune, nous indiquons ce qu'elle propose et ce que nous en retenons pour Nova.</p>
          </div>

          <div className="row" ref={top} style={{ marginTop: 24, scrollMarginTop: 90 }}>
            <div className="chips">
              <button className={`chip ${!appr ? "on" : ""}`} onClick={() => setAppr("")}>Toutes les approches</button>
              {Object.entries(APPROACHES).map(([k, v]) => byAppr(k).length > 0 && (
                <button key={k} className={`chip ${appr === k ? "on" : ""}`} onClick={() => setAppr(k)}>{v.label}</button>
              ))}
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <select value={pub} onChange={(e) => setPub(e.target.value)} aria-label="Public">
              <option value="">Tous les publics</option>
              {Object.entries(PUBS).filter(([k]) => k !== "all").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="count">{items.length} acteur{items.length > 1 ? "s" : ""}</span>
          </div>
          {appr && <p className="note" style={{ margin: "10px 0 0" }}><b>{APPROACHES[appr].label}</b> — objectif : {APPROACHES[appr].goal.toLowerCase()}.</p>}

          <div className="actors">
            {items.map((a) => {
              const n = events.filter((e) => (e.actorId === a.id || norm(e.org).includes(norm(a.key))) && !isPast(e)).length;
              return (
                <article className="actor" key={a.id}>
                  <div className="actor-head">
                    <div className="ini">{a.ini}</div>
                    <div>
                      <h3>{a.name}</h3>
                      <div className="actor-kind">{ACTOR_KINDS[a.kind] || "Association"}{a.scope !== "france" ? ` · ${SCOPES[a.scope]}` : ""}</div>
                    </div>
                  </div>
                  {a.partner && <span className="tag partner-tag" style={{ alignSelf: "flex-start" }}>✓ Partenaire Nova</span>}
                  {!!a.approaches.length && (
                    <div className="appr-tags">{a.approaches.map((k) => APPROACHES[k] && (
                      <button key={k} className={appr === k ? "on" : ""} onClick={() => pick(k)}>{APPROACHES[k].label}</button>
                    ))}</div>
                  )}
                  <p>{a.desc}</p>
                  {a.programmes && <p className="actor-prog"><b>Programmes :</b> {a.programmes}</p>}
                  {a.takeaway && <div className="takeaway"><b>Ce que nous en retenons</b>{a.takeaway}</div>}
                  <div className="tags" style={{ marginBottom: 0 }}>{a.pub.map((p) => <span key={p} className="tag">{PUBS[p]}</span>)}</div>
                  <div className="actions">
                    {a.url && <a className="go" href={a.url} target="_blank" rel="noopener noreferrer">Site officiel ↗</a>}
                    {n > 0 && <a href="#agenda" onClick={() => setAgendaFilter({ when: "up", cats: [], pub: "", q: "", org: a.key })}>{n} événement{n > 1 ? "s" : ""} à venir</a>}
                  </div>
                </article>
              );
            })}
          </div>
          {!items.length && <div className="empty">Aucun acteur ne correspond à ces filtres.</div>}
        </div>
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
