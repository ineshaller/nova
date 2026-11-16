# Import des formations depuis l'open data de l'Onisep

La page **Formations** de Nova n'est plus remplie uniquement à la main : un script récupère la liste officielle
des formations de l'enseignement supérieur publiée par l'**Onisep** (organisme public d'information sur
l'orientation), garde les formations scientifiques et les enregistre dans la table `formations` de Supabase.

---

## 1. D'où viennent les données ?

| | |
|---|---|
| **Jeu de données** | « Idéo-Actions de formation initiale – Univers enseignement supérieur » |
| **Producteur** | Onisep |
| **Où le trouver** | [data.gouv.fr](https://www.data.gouv.fr/datasets/ideo-actions-de-formation-initiale-univers-enseignement-superieur) |
| **Format utilisé** | CSV (séparateur `;`), environ 25 Mo, environ 30 colonnes |
| **Mises à jour** | une dizaine de fois par an, au rythme du calendrier de l'orientation |
| **Licence** | ODbL (Open Database License) |

Une ligne du fichier correspond à une **action de formation (AF)**, c'est-à-dire une formation donnée dans
un établissement précis. Exemple : « BUT informatique » à l'IUT de Lannion. La même formation donnée à
Saint-Brieuc est une autre ligne.

Le script télécharge le fichier par le **lien permanent data.gouv.fr**, qui pointe toujours vers la dernière
version. Si ce lien ne répond pas, il essaie le serveur de l'Onisep.

> **Pourquoi l'Onisep plutôt que Parcoursup ?** Parcoursup ne contient que les formations accessibles
> **après le bac** : les écoles d'ingénieurs recrutées après une prépa (Centrale, Mines, ENSEA…) en sont
> absentes. L'Onisep recense toutes les formations, avec en plus l'établissement, la région et les domaines.

### Obligations de la licence ODbL
- **Citer la source** : le site affiche « Source : Onisep (ODbL) » sur chaque formation importée, dans le
  pied de page et sous la liste des formations. Ne retirez pas ces mentions.
- **Partager à l'identique** : si vous rediffusez la base des formations (par exemple en export), elle doit
  rester sous licence ODbL.

---

## 2. Ce que fait le script (`scripts/import-formations.mjs`)

1. **Téléchargement** du CSV, ou lecture d'un fichier local avec `--file=`.
2. **Lecture des colonnes.** Le script retrouve les colonnes par leur intitulé (sans tenir compte des accents
   ni des majuscules). Si l'Onisep renomme une colonne, le script s'arrête, affiche les colonnes présentes et
   indique quoi corriger (voir « En cas de problème »).
3. **Tri.** Il ne garde que :
   - les **5 types** du site, reconnus à partir des colonnes « FOR type » et « Formation (FOR) libellé » :

     | Type Nova | Reconnu quand… |
     |---|---|
     | `ing` École d'ingénieurs | le type contient « ingénieur », ou l'intitulé commence par « diplôme d'ingénieur » |
     | `prepa` Prépa | classe préparatoire **scientifique** (MPSI, MP2I, PCSI, PTSI, BCPST, TSI…) ; les prépas littéraires et économiques sont exclues |
     | `but` BUT | l'intitulé commence par « BUT » |
     | `licence` Licence | l'intitulé commence par « licence » (hors licences professionnelles) |
     | `bts` BTS | l'intitulé commence par « BTS » |

   - les formations **scientifiques**, c'est-à-dire celles pour lesquelles au moins un des 7 domaines du site
     est reconnu dans l'indexation Onisep (« FOR indexation domaine web Onisep ») ou dans l'intitulé :

     | Domaine Nova | Mots-clés recherchés (sans accents) |
     |---|---|
     | `maths` | mathemat, statisti, actuari |
     | `info` | informati, numerique, internet, reseau, programm, logiciel, donnees, data, cyber… |
     | `phys` | physique, optique, acoustique, nucleaire, astro |
     | `chim` | chimi, materiaux, plasturgie, pharmac |
     | `bio` | biolog, biotech, genetique, sante, medic, agroalim, agronom… |
     | `inge` | ingenier, industri, mecaniq, electroni, automati, robotiq, aeronaut, btp, genie civil… |
     | `env` | environnement, energie, ecolog, climat, developpement durable, agricult, geologi… |

     Exemples : « BTS négociation et digitalisation de la relation client » est écarté (aucun domaine
     scientifique) ; « BTS bioanalyses et contrôles » est gardé (domaine `bio`).

4. **Conversion** de chaque ligne vers les colonnes de la table `formations` :

   | Colonne Nova | Remplie avec |
   |---|---|
   | `id` | `onisep-<numéro AF>-<code UAI de l'établissement>` (stable d'un import à l'autre) |
   | `name` | intitulé officiel de la formation |
   | `type`, `domaines` | voir les tableaux ci-dessus |
   | `acces` | `postbac` ; pour les écoles d'ingénieurs : cursus de 4 ans ou plus → `postbac`, 3 ans ou moins → `postprepa`, durée inconnue → les deux |
   | `statut` | statut de l'établissement (public, privé sous contrat…) |
   | `etablissement` | nom de l'établissement |
   | `lieu`, `region` | commune (département), région |
   | `description` | **phrase construite uniquement à partir des données officielles** : type, durée, niveau, établissement, nature du diplôme et, si la colonne existe, les éléments d'enseignement |
   | `url` | page de la formation sur le site de l'établissement, sinon site de l'établissement, sinon fiche Onisep |
   | `onisep_url` | fiche détaillée sur onisep.fr |
   | `source`, `source_id`, `last_seen` | `onisep`, identifiant Onisep, date de l'import |
   | `sort` | 1000 : les formations saisies à la main (sort 10 à 220) restent en tête de liste |

5. **Aperçu** : le résultat est écrit dans `scripts/out/formations-apercu.json`, ce qui permet de vérifier
   avant d'écrire dans la base.
6. **Envoi dans Supabase** par lots de 500 (*upsert* : une formation existante est mise à jour, une
   nouvelle est ajoutée).
7. **Nettoyage (option `--prune`)** : supprime les formations Onisep qui ont disparu du fichier (formation
   fermée, par exemple).

### Ce que le script ne touche jamais
- Les **formations saisies à la main** (`source = 'manuel'`), c'est-à-dire les 22 fiches de `seed.sql`.
- La colonne **`mixite`** (badge rose « Action pour les filles »). Elle n'existe dans aucune base publique et
  reste à remplir par l'équipe. Vous pouvez la remplir sur une formation importée (Supabase → Table Editor →
  `formations`) : elle sera conservée aux imports suivants.

---

## 3. Mode d'emploi

### Une seule fois : préparer la base et la clé
1. Exécutez `supabase/migration-02-formations-partenaires.sql` dans Supabase (SQL Editor → New query → Run).
   Ce fichier ajoute les colonnes `etablissement`, `region`, `onisep_url`, `source`, `source_id` et `last_seen`.
2. Copiez `scripts/.env.import.example` en `scripts/.env.import`, puis remplissez :
   - `SUPABASE_URL` : Supabase → Project Settings → API → *Project URL* ;
   - `SUPABASE_SERVICE_ROLE_KEY` : même page, clé **service_role**.

> ⚠ **La clé `service_role` donne tous les droits sur la base.** Elle ne doit être que dans
> `scripts/.env.import` (ignoré par Git) ou dans les secrets GitHub, **jamais** dans le `.env` du site, dans
> une variable `VITE_…`, ni dans le code.

### Les commandes
Depuis le dossier du projet, après `npm install` :

```bash
# 1. Voir les colonnes du fichier Onisep (utile si l'import signale une colonne introuvable)
npm run formations:colonnes

# 2. Aperçu sans rien écrire dans la base → scripts/out/formations-apercu.json
npm run formations:apercu

# 3. Import réel dans Supabase
npm run formations:import

# Options, à ajouter après « -- » :
npm run formations:import -- --types=ing           # seulement les écoles d'ingénieurs
npm run formations:import -- --types=ing,prepa,but # plusieurs types
npm run formations:apercu -- --limit=50            # 50 formations, pour tester
npm run formations:import -- --prune               # supprime les formations disparues du fichier
npm run formations:import -- --file=./onisep.csv   # fichier déjà téléchargé
```

Rechargez ensuite le site : la page Formations affiche les nouvelles fiches, avec un filtre par région et un
bouton « Afficher plus ».

### Combien de formations ?
Le fichier complet compte environ 28 000 lignes, toutes disciplines confondues. Après le tri, il reste
plusieurs milliers de formations scientifiques, surtout des BTS, BUT et licences. Pour une démo, vous pouvez
commencer par `--types=ing` (écoles d'ingénieurs uniquement). Le site les charge par paquets de 1 000 et en
affiche 30 à la fois.

### Mise à jour automatique (facultatif)
Le fichier `.github/workflows/import-formations.yml` relance l'import (avec `--prune`) **le 1er de chaque
mois** si le projet est sur GitHub. À configurer une fois : GitHub → *Settings → Secrets and variables →
Actions* → ajoutez `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. Vous pouvez aussi le lancer à la main
(onglet *Actions* → *Import des formations (Onisep)* → *Run workflow*).

---

## 4. En cas de problème

| Message | Que faire |
|---|---|
| `Colonnes introuvables : …` | L'Onisep a renommé une colonne. Lancez `npm run formations:colonnes`, repérez le nouvel intitulé et ajoutez-le dans la liste `COLUMNS`, en haut de `scripts/import-formations.mjs`. |
| `Impossible de télécharger le fichier Onisep` | Téléchargez le CSV à la main depuis la page data.gouv.fr du jeu de données, puis lancez `npm run formations:import -- --file=chemin/vers/le.csv`. |
| `SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquent` | Le fichier `scripts/.env.import` n'existe pas ou est incomplet (étape 2 ci-dessus). |
| `column "etablissement" … does not exist` | La migration 02 n'a pas été exécutée. |
| Une formation est mal classée | Ajustez les mots-clés `DOMAIN_RULES`, ou la fonction `detectType`, dans le script, puis relancez l'aperçu. |
| Trop de formations | Limitez les types avec `--types=…`. Pour retirer celles déjà importées : `delete from formations where source = 'onisep' and type = 'bts';` dans le SQL Editor. |

---

## 5. Pistes pour aller plus loin
- **Descriptions plus riches** : l'Onisep publie aussi « Idéo-Fiches formations » (fichier XML), avec des
  textes rédigés par ses équipes. Le lien avec nos lignes se ferait par l'identifiant `FOR.xxxx`, présent dans
  `onisep_url`.
- **Statistiques Parcoursup** (taux d'accès, part de filles admises) : le jeu « Parcoursup – vœux de poursuite
  d'études » de data.enseignementsup-recherche.gouv.fr permettrait d'afficher la part de filles dans chaque
  formation, un indicateur parlant pour Nova.
