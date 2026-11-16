import { Footer, Header } from "./components/Common.jsx";
import { useData } from "./context/DataContext.jsx";
import { useUI } from "./context/UIContext.jsx";
import Account from "./pages/Account.jsx";
import Agenda from "./pages/Agenda.jsx";
import Calendar from "./pages/Calendar.jsx";
import Discover from "./pages/Discover.jsx";
import Formations from "./pages/Formations.jsx";
import Home from "./pages/Home.jsx";
import Propose from "./pages/Propose.jsx";
import { About, Actors } from "./pages/Static.jsx";

const PAGES = {
  accueil: Home, agenda: Agenda, calendrier: Calendar, formations: Formations, decouverte: Discover,
  acteurs: Actors, "a-propos": About, proposer: Propose, compte: Account,
};

export default function App() {
  const { tab } = useUI();
  const { error } = useData();
  const Page = PAGES[tab] || Home;
  return (
    <>
      <Header />
      <main>
        {error && tab === "accueil" && (
          <div className="wrap"><div className="err" style={{ marginTop: 20 }}>Connexion à la base impossible : {error}. Vérifiez le fichier .env et que schema.sql a bien été exécuté.</div></div>
        )}
        <div className="view on" key={tab}><Page /></div>
      </main>
      <Footer />
    </>
  );
}
