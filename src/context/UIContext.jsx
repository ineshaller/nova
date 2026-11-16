// Navigation par onglets (#agenda, #compte…), notifications et fenêtres de confirmation.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export const TABS = ["accueil", "agenda", "calendrier", "formations", "decouverte", "acteurs", "a-propos", "proposer", "compte"];
const UI = createContext(null);
export const useUI = () => useContext(UI);

const currentTab = () => {
  const h = window.location.hash.slice(1);
  return TABS.includes(h) ? h : "accueil";
};

export function UIProvider({ children }) {
  const [tab, setTab] = useState(currentTab);
  const [toastMsg, setToastMsg] = useState("");
  const [dialog, setDialog] = useState(null);
  // Filtres de l'agenda, partagés pour que l'accueil et les acteurs puissent les préremplir
  const [agendaFilter, setAgendaFilter] = useState({ when: "up", cats: [], pub: "", q: "", org: "" });
  const toastTimer = useRef(null);

  useEffect(() => {
    const onHash = () => { setTab(currentTab()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((t) => { window.location.hash = t; }, []);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }, []);

  const confirm = useCallback((title, text, okLabel = "OK") =>
    new Promise((resolve) => setDialog({ title, text, okLabel, resolve })), []);

  const close = (v) => { dialog?.resolve(v); setDialog(null); };

  return (
    <UI.Provider value={{ tab, go, toast, confirm, agendaFilter, setAgendaFilter }}>
      {children}
      <div className={`toast ${toastMsg ? "show" : ""}`} role="status">{toastMsg}</div>
      <div className={`modal ${dialog ? "on" : ""}`} onClick={(e) => e.target === e.currentTarget && close(false)}>
        {dialog && (
          <div className="box" role="dialog" aria-modal="true">
            <h3>{dialog.title}</h3>
            <p>{dialog.text}</p>
            <div className="row">
              <button className="btn ghost" onClick={() => close(false)}>Annuler</button>
              <button className="btn primary" onClick={() => close(true)}>{dialog.okLabel}</button>
            </div>
          </div>
        )}
      </div>
    </UI.Provider>
  );
}
