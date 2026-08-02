# Coachly 💪

**Coach personnel d'Ilane** — nutrition, sport et transformation physique.
Application web autonome, **100 % locale** : aucune donnée n'est envoyée sur Internet (tout est stocké dans le navigateur via `localStorage`).

Objectif : un physique **sec et athlétique** (type Tom Holland) — perdre du gras tout en développant progressivement le muscle, avec un **suivi quotidien** et une **adaptation continue**.

---

## Lancer l'application

Aucune installation, aucune dépendance, aucun build.

- **Le plus simple :** ouvrir `index.html` dans un navigateur.
- **Recommandé** (pour que le stockage local fonctionne partout) : servir le dossier —
  ```bash
  python3 -m http.server 8000
  # puis ouvrir http://localhost:8000
  ```
- **En ligne :** déployable tel quel sur GitHub Pages (dossier racine).

---

## Déployer sur Vercel

Coachly est un site **statique** (aucun build). Vercel sert les fichiers tels quels.

1. [vercel.com](https://vercel.com) → *Add New* → *Project* → importe le dépôt `coachly`.
2. Framework Preset : **Other**. Build Command : *(vide)*. Output Directory : `.` (racine).
3. **Production Branch = `main`** (Vercel déploie `main` par défaut).
4. *Deploy* → URL type `https://coachly-xxxx.vercel.app`.

> Chaque push sur `main` redéploie automatiquement.

## Installer sur téléphone (PWA)

Coachly est une **app installable** :

1. Ouvre l'URL dans le navigateur du téléphone (Safari sur iPhone, Chrome sur Android).
2. **iPhone :** bouton *Partager* → *Sur l'écran d'accueil*. **Android :** menu *⋮* → *Installer l'application*.
3. Coachly apparaît comme une vraie app (icône, plein écran, fonctionne hors-ligne).

## Notifications

- **Rappel local** (onglet *Suivi quotidien* → *Rappel quotidien*) : notification de check-in à l'heure choisie, quand l'app est installée et ouverte / en arrière-plan.
- **Rappel fiable même app fermée** : géré par une **Routine Claude** (planification intégrée à Claude, sans l'API) qui envoie chaque jour une notification (email et/ou app Claude) avec le message du coach. Aucun serveur à héberger.

## Fonctionnalités

| Onglet | Contenu |
|---|---|
| 📊 **Tableau de bord** | Verdict du coach, graphique de poids (moyenne mobile 7 j + tendance + ligne cible), perte totale, vitesse hebdo, momentum, IMC, projection de l'objectif, tour de taille, activité. |
| ⚖️ **Poids & Mesures** | Ajouter une pesée / un tour de taille, éditer l'objectif, historique avec variations. |
| 🏋️ **Programme sport** | Programme progressif poids du corps (3 séances : Poussée / Tirage / Jambes+Taille), planning hebdo, progression automatique par semaine, cap vers les haltères. |
| 🍽️ **Nutrition** | Planning hebdo **varié** (change chaque semaine), guide restaurants (quoi commander), stratégies Shabbat / fêtes / jeûnes, rattrapage « j'ai craqué ». |
| 📋 **Suivi quotidien** | Check-in : poids, pas, sport, repas, faim, fatigue, sommeil, humeur, hydratation. |
| 🩸 **Analyses & Photos** | Suivi LDL / fonction rénale / fer, guide photos hebdo, export / import / reset des données. |

---

## Structure

```
coachly/
├── index.html          Point d'entrée
├── COACH.md            Contexte & personnalité du coach (mémoire de référence)
├── css/styles.css      Thème athlétique sombre
└── js/
    ├── data.js         Profil + données initiales (poids, taille, activité, aliments)
    ├── store.js        Persistance localStorage (fusion seed + saisies)
    ├── coach.js        Moteur d'analyse (tendance, projection, verdict)
    ├── program.js      Générateur de programme sport progressif
    ├── nutrition.js    Planning repas, restaurants, calendrier juif
    └── app.js          Interface (onglets, graphique SVG, formulaires)
```

## Tes données

Tout reste dans **ton** navigateur. Pense à **exporter** régulièrement (onglet *Analyses & Photos* → *Exporter (JSON)*) pour ne rien perdre, et à réimporter sur un autre appareil.

---

> ⚠️ Outil de suivi personnel, **pas un avis médical**. Pour le LDL, la fonction rénale et le fer, suis ton médecin.
