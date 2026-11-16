import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
// Supabase appelle cette clé « anon » (ancien nom) ou « publishable » (nouveau nom) : les deux sont acceptés.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// null tant que le fichier .env n'est pas rempli : l'application affiche alors
// un écran d'aide au lieu de planter.
export const supabase = url && key ? createClient(url, key) : null;