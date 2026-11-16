import { useEffect, useMemo, useState } from "react";
import { PageHead, SchoolCard, SearchBox } from "../components/Common.jsx";
import { useData } from "../context/DataContext.jsx";
import { DOMAINS, FTYPES } from "../lib/constants.js";
import { matches } from "../lib/format.js";

// Avec l'import Onisep, la liste compte plusieurs milliers de formations :
// on en affiche PAGE à la fois, avec un bouton « Afficher plus ».
const PAGE = 30;

export default function Formations() {
  const { formations } = useData();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [acces, setAcces] = useState("");
  const [region, setRegion] = useState("");
  const [doms, setDoms] = useState([]);
  const [mix, setMix] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const toggleDom = (k) => setDoms((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));

  // Régions présentes dans les données (remplies par l'import Onisep)
  const regions = useMemo(
    () => [...new Set(formations.map((f) => f.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [formations]
  );

  const items = useMemo(() => formations.filter((f) =>
    (!type || f.type === type) &&
    (!acces || f.acces.includes(acces)) &&
    (!region || f.region === region) &&
    (!mix || f.mix) &&
    (!doms.length || f.dom.some((k) => doms.includes(k))) &&
    matches(q, [f.name, f.school, f.where, f.region, f.desc, f.statut, FTYPES[f.type], f.mix || "", ...f.dom.map((k) => DOMAINS[k])])
  ), [formations, type, acces, region, mix, doms, q]);

  // Nouveau filtre → on repart du début de la liste
  useEffect(() => setShown(PAGE), [type, acces, region, mix, doms, q]);

  const hasOnisep = formations.some((f) => f.source === "onisep");

  return (
    <>
      <PageHead title="Écoles & formations">
        Écoles d'ingénieurs et autres formations scientifiques après le bac. Le badge rose signale une école qui mène une action concrète pour attirer ou accompagner les filles.
      </PageHead>
      <section style={{ paddingTop: 28 }}>
        <div className="wrap">
          <div className="toolbar" style={{ position: "static" }}>
            <div className="row">
              <SearchBox value={q} onChange={setQ} placeholder="Rechercher : Lyon, informatique, INSA…" label="Rechercher une formation" />
              <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type de formation">
                <option value="">Tous les types</option>
                {Object.entries(FTYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={acces} onChange={(e) => setAcces(e.target.value)} aria-label="Accès">
                <option value="">Tous les accès</option>
                <option value="postbac">Après le bac</option>
                <option value="postprepa">Après une prépa / bac+2</option>
              </select>
              {regions.length > 0 && (
                <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Région">
                  <option value="">Toutes les régions</option>
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
            </div>
            <div className="row">
              <div className="chips">
                {Object.entries(DOMAINS).map(([k, l]) => (
                  <button key={k} className={`chip ${doms.includes(k) ? "on" : ""}`} onClick={() => toggleDom(k)}>{l}</button>
                ))}
              </div>
              <label className="toggle"><input type="checkbox" checked={mix} onChange={(e) => setMix(e.target.checked)} /> ♀ Action pour les filles</label>
              <span className="count">{items.length.toLocaleString("fr-FR")} formation{items.length > 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="fgrid">
            {items.length ? items.slice(0, shown).map((f) => <SchoolCard key={f.id} f={f} />)
              : <div className="empty" style={{ gridColumn: "1/-1" }}>Aucune formation ne correspond à ces filtres.</div>}
          </div>
          {items.length > shown && (
            <div className="more">
              <button className="btn ghost" onClick={() => setShown((n) => n + PAGE)}>
                Afficher plus ({(items.length - shown).toLocaleString("fr-FR")} restantes)
              </button>
            </div>
          )}
          <div className="infobar">
            ℹ️ Les candidatures après le bac se font sur <a href="https://www.parcoursup.fr" target="_blank" rel="noopener noreferrer">Parcoursup</a>.
            Pour les fiches détaillées des formations : <a href="https://www.onisep.fr" target="_blank" rel="noopener noreferrer">Onisep</a>.
            {hasOnisep && <> Liste des formations issue de l'open data de l'Onisep (licence ODbL), mise à jour régulièrement.</>}
          </div>
        </div>
      </section>
    </>
  );
}
