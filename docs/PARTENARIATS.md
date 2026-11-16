# Événements : saisie par l'équipe, puis associations partenaires

Il y a trois façons pour un événement d'arriver dans l'agenda. Chaque événement garde son origine dans la
colonne `events.source`.

| Origine (`source`) | Qui l'ajoute | Publication | Où ça se gère |
|---|---|---|---|
| `equipe` | l'équipe Nova (comptes admin) | directe, ou brouillon | Mon compte → **Événements** |
| `proposition` | toute personne inscrite | après validation de l'équipe | page **Proposer**, puis Mon compte → **Modération** |
| `partenaire` | une association partenaire | directe (par défaut), ou après relecture | Mon compte → **Mon association** |

**Aujourd'hui** : c'est l'équipe qui saisit les événements (première ligne).
**Plus tard** : vous ouvrez des accès partenaires aux associations. Tout est déjà en place : il suffit de
donner un accès, ou d'activer le formulaire de demande (section 3).

---

## 1. Ajouter les événements à la main (équipe)

Prérequis : la migration `supabase/migration-02-formations-partenaires.sql` a été exécutée, et votre compte
est admin (voir le README, étape 7).

1. Connectez-vous, puis ouvrez **Mon compte → Événements**.
2. Cliquez sur **＋ Ajouter un événement** et remplissez le formulaire :
   - **Association** : choisissez-la dans la liste si elle existe dans l'onglet Acteurs. L'événement lui est
     alors rattaché (colonne `actor_id`) et compte dans « N événements à venir » sur sa fiche. Si vous laissez
     « Organisateur affiché » vide, le nom de l'association est repris automatiquement.
   - **Date** : *confirmée* si l'organisateur l'a publiée, *estimée* si vous la déduisez de l'édition
     précédente, *toute l'année* pour un programme avec plusieurs sessions.
   - **Publier dans l'agenda** : décochez pour garder un brouillon, visible seulement des admins.
3. Depuis la liste, **Modifier** ou **Supprimer** un événement. Le filtre « À venir / Passés / Tous » et la
   recherche aident à le retrouver.

Bonnes pratiques :
- Mettez toujours le **lien officiel** : c'est la preuve de l'information.
- Repassez en début de mois sur les dates *estimées* pour les confirmer dès que l'organisateur publie.
- Le **Table Editor** de Supabase reste possible pour les corrections en masse.

---

## 2. Associations partenaires : comment ça marche

Un **compte partenaire** est un compte Nova ordinaire, relié à **une** association de l'onglet Acteurs
(table `partner_members`). Ce compte voit un onglet **Mon association** dans « Mon compte » où il peut :
- ajouter un événement : il est automatiquement rattaché à son association (`source = 'partenaire'`) ;
- modifier ou supprimer les événements que **son association** a ajoutés ;
- voir, sans pouvoir les modifier, les événements que l'équipe a ajoutés pour son association.

Dans l'agenda, ces événements portent l'étiquette **« ✓ Publié par l'association »**, et la fiche de
l'association, dans l'onglet Acteurs, le badge **« ✓ Partenaire Nova »**.

### Publication directe ou relecture
Chaque association a un réglage `auto_publish` (Mon compte → Partenaires → « Publication directe ») :
- **activé** (par défaut) : les événements apparaissent tout de suite dans l'agenda ;
- **désactivé** : ils arrivent dans **Modération**, comme les propositions, et l'équipe les publie ou les
  refuse. Une modification d'un événement déjà publié le renvoie aussi en relecture.

Conseil : désactivez la publication directe pour une nouvelle association pendant les premières semaines,
puis activez-la une fois la confiance établie.

### Ce qu'un partenaire ne peut PAS faire (garanti par la base, pas seulement par le site)
Ces règles sont écrites en *Row Level Security* dans la migration 02 et ont été testées :
- publier pour une autre association ;
- modifier ou supprimer un événement ajouté par l'équipe ou par une autre association ;
- se publier directement si sa publication directe est désactivée ;
- voir les comptes partenaires, ou appeler les fonctions réservées aux admins.

---

## 3. Ouvrir un partenariat

### Option A : vous donnez l'accès directement (recommandé au début)
1. L'association crée un compte Nova normal, avec l'adresse de la personne qui gérera les événements.
2. Si l'association n'a pas encore de fiche : **Mon compte → Partenaires → Ajouter une association**.
3. **Mon compte → Partenaires → Donner un accès partenaire** : e-mail du compte, puis association → *Donner
   l'accès*.
4. À sa prochaine connexion, la personne voit l'onglet **Mon association**.

Pour retirer l'accès : **Partenaires → Associations partenaires → Retirer l'accès**. Les événements déjà
publiés restent dans l'agenda (vous pouvez les supprimer depuis l'onglet Événements).

### Option B : les associations font une demande depuis le site
1. Dans `src/lib/constants.js`, passez `FEATURES.partnerRequests` à `true`, puis redéployez le site.
2. Un encadré **« Vous êtes une association ? »** apparaît sous le formulaire de la page **Proposer**. La
   personne connectée indique son association, son rôle, le site officiel et un message.
3. La demande arrive dans **Mon compte → Partenaires → Demandes de partenariat**. Choisissez l'association
   (elle est présélectionnée si le nom correspond), puis **Accepter** ou **Refuser**.
4. Une seule demande en attente par compte. Après un refus, la personne peut en refaire une.

> Avant d'accepter, vérifiez que la personne représente bien l'association, par exemple avec une adresse
> e-mail du domaine de l'association ou un échange avec elle.

### Côté partenariat « humain » (à prévoir hors du site)
- Une courte **charte** : types d'événements acceptés (en lien avec les femmes et les sciences), lien officiel
  obligatoire, mise à jour en cas d'annulation.
- Un **contact référent** de chaque côté.
- Pour la soutenance : présenter les associations déjà sollicitées (Elles bougent, femmes & mathématiques,
  Animath, Femmes & Sciences…) et leur intérêt (visibilité gratuite auprès des collégiennes, lycéennes et
  étudiantes).

---

## 4. Référence technique

| Élément | Rôle |
|---|---|
| `events.actor_id` | association à laquelle l'événement est rattaché |
| `events.source` | `equipe`, `proposition` ou `partenaire` |
| `events.updated_at` | mis à jour automatiquement (trigger `events_before_write`) |
| `actors.partner` | badge « Partenaire Nova » (passe à `true` au premier accès donné) |
| `actors.auto_publish` | publication directe (`true`) ou relecture par l'équipe (`false`) |
| `partner_members` | lien compte → association (un compte = une association) |
| `partner_requests` | demandes de partenariat (`pending`, `accepted`, `refused`) |
| `my_actor_id()`, `partner_can_publish()` | utilisées par les règles de sécurité |
| `admin_add_partner_by_email`, `admin_accept_partner_request`, `admin_list_partners`, `admin_list_partner_requests` | fonctions appelées depuis l'onglet Partenaires, qui refusent tout appel d'un compte non admin |

Côté code : `src/pages/AccountManage.jsx` (gestion des événements, onglet Partenaires, formulaire de demande),
`src/components/EventForm.jsx` (formulaire d'événement) et `src/lib/api.js` (requêtes).
