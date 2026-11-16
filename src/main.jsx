import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { DataProvider } from "./context/DataContext.jsx";
import { UIProvider } from "./context/UIContext.jsx";
import { supabase } from "./lib/supabase.js";
import "./styles.css";

function MissingConfig() {
  return (
    <div className="config">
      <img src="./logo-nova.png" alt="Nova" style={{ height: 40, marginBottom: 20 }} />
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Base de données non configurée</h1>
      <p>Copiez le fichier <code>.env.example</code> en <code>.env</code>, collez-y l'URL et la clé « anon » de votre projet Supabase,
        puis relancez <code>npm run dev</code>. Toutes les étapes sont dans le <code>README.md</code>.</p>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {supabase ? (
      <UIProvider>
        <AuthProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </AuthProvider>
      </UIProvider>
    ) : <MissingConfig />}
  </StrictMode>
);
