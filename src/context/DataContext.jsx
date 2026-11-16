// Contenu du site chargé depuis la base : événements, formations, acteurs, vidéos.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const Data = createContext(null);
export const useData = () => useContext(Data);

export function DataProvider({ children }) {
  const { user, isAdmin, partner } = useAuth();
  const [events, setEvents] = useState([]);
  const [formations, setFormations] = useState([]);
  const [actors, setActors] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = useCallback(async () => setEvents(await api.fetchEvents()), []);
  const loadVideos = useCallback(async () => setVideos(await api.fetchVideos()), []);
  const loadActors = useCallback(async () => setActors(await api.fetchActors()), []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.fetchFormations(), api.fetchActors()])
      .then(([f, a]) => { if (alive) { setFormations(f); setActors(a); } })
      .catch((e) => alive && setError(e.message || "Erreur de chargement"));
    loadVideos().catch(() => {});
    return () => { alive = false; };
  }, [loadVideos]);

  // Les événements visibles dépendent du compte (propositions perso, modération admin)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.fetchEvents()
      .then((e) => { if (alive) { setEvents(e); setError(""); } })
      .catch((e) => alive && setError(e.message || "Erreur de chargement"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user?.id, isAdmin, partner?.actorId]);

  // L'agenda public ne montre que les événements publiés
  const published = events.filter((e) => e.published);
  const pending = events.filter((e) => !e.published);

  return (
    <Data.Provider value={{ events: published, pending, formations, actors, videos, loading, error, loadEvents, loadVideos, loadActors }}>
      {children}
    </Data.Provider>
  );
}
