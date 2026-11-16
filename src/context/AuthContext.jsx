// Compte : session Supabase, profil et favoris de la personne connectée.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import * as api from "../lib/api.js";

const Auth = createContext(null);
export const useAuth = () => useContext(Auth);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [favs, setFavs] = useState(() => new Set());
  const [partner, setPartner] = useState(null); // { actorId, actorName, autoPublish } si le compte représente une association
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false); // retour depuis l'e-mail « mot de passe oublié »
  const user = session?.user ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") { setRecovery(true); window.location.hash = "compte"; }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Chargement du profil et des favoris à chaque changement de compte
  useEffect(() => {
    let alive = true;
    if (!user) { setProfile(null); setFavs(new Set()); setPartner(null); return; }
    Promise.all([api.fetchProfile(user.id), api.fetchFavorites()])
      .then(([p, f]) => { if (alive) { setProfile(p); setFavs(new Set(f)); } })
      .catch(() => { if (alive) setProfile(null); });
    // Partenariat : si la migration 02 n'est pas encore passée, on ignore simplement l'erreur
    api.fetchMyPartnership(user.id).then((p) => alive && setPartner(p)).catch(() => alive && setPartner(null));
    return () => { alive = false; };
  }, [user?.id]);

  const reloadPartner = useCallback(async () => {
    if (user) setPartner(await api.fetchMyPartnership(user.id).catch(() => null));
  }, [user?.id]);

  // actor (facultatif) : { orgName, actorId, role, website, message } pour un compte acteur.
  // La demande de partenariat est créée par la base (migration 03), même si
  // l'e-mail doit d'abord être confirmé.
  const signUp = async ({ email, password, prenom, niveau, interets, ville, actor }) => {
    const data0 = { prenom, niveau, interets, ville, account_type: actor ? "acteur" : "perso" };
    if (actor) Object.assign(data0, {
      org_name: actor.orgName, actor_id: actor.actorId || null, role: actor.role || "",
      website: actor.website || null, message: actor.message || "",
    });
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: data0,
        emailRedirectTo: window.location.origin + window.location.pathname + "#compte",
      },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + "#compte",
    });
    if (error) throw error;
  };

  const setNewPassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovery(false);
  };

  const saveProfile = async (f) => { setProfile(await api.updateProfile(user.id, f)); };

  const deleteAccount = async () => {
    await api.deleteMyAccount();
    await supabase.auth.signOut();
  };

  // Ajout / retrait d'un favori, avec mise à jour immédiate de l'affichage
  const toggleFav = useCallback(async (type, id) => {
    const key = `${type}:${id}`;
    const had = favs.has(key);
    setFavs((s) => { const n = new Set(s); had ? n.delete(key) : n.add(key); return n; });
    try {
      had ? await api.removeFavorite(user.id, type, id) : await api.addFavorite(user.id, type, id);
      return !had;
    } catch (e) {
      setFavs((s) => { const n = new Set(s); had ? n.add(key) : n.delete(key); return n; });
      throw e;
    }
  }, [favs, user?.id]);

  const isFav = (type, id) => favs.has(`${type}:${id}`);

  return (
    <Auth.Provider value={{
      ready, session, user, profile, isAdmin: !!profile?.is_admin, partner, reloadPartner, recovery, favs,
      signUp, signIn, signOut, resetPassword, setNewPassword, saveProfile, deleteAccount, toggleFav, isFav,
    }}>
      {children}
    </Auth.Provider>
  );
}
