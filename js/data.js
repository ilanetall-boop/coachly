/* =========================================================================
   Coachly — Données de référence et profil
   Toutes les dates sont au format ISO (AAAA-MM-JJ).
   Ce fichier ne contient que les données INITIALES (seed).
   Les nouvelles saisies de l'utilisateur sont stockées dans localStorage
   et fusionnées par-dessus ces valeurs (voir store.js).
   ========================================================================= */

const PROFILE = {
  nom: "Ilane",
  age: 44,
  taille_cm: 165,
  lieu: "Israël",
  debut_suivi: "2026-06-27",
  // Objectif : physique type Tom Holland (sec, épaules larges, taille fine).
  // Le poids-cible est une ESTIMATION éditable : la vraie cible est la
  // composition corporelle (tour de taille / photos), pas la balance.
  objectif: {
    modele: "Tom Holland (Spider-Man)",
    traits: [
      "Sec (peu de gras)",
      "Épaules larges",
      "Poitrine dessinée",
      "Ventre plat",
      "Taille fine",
      "Bras dessinés",
      "PAS un physique de culturiste",
    ],
    poids_cible_kg: 72,      // estimation athlétique pour 165 cm — éditable
    tour_taille_cible_cm: 84 // cible « taille fine » — éditable
  }
};

/* Évolution du poids (kg) — source : suivi manuel de l'utilisateur */
const SEED_POIDS = [
  { date: "2026-06-27", kg: 86.0 },
  { date: "2026-06-28", kg: 85.0 },
  { date: "2026-06-29", kg: 84.5 },
  { date: "2026-07-05", kg: 84.4 },
  { date: "2026-07-06", kg: 84.0 },
  { date: "2026-07-07", kg: 83.4 },
  { date: "2026-07-09", kg: 82.9 },
  { date: "2026-07-13", kg: 83.3 },
  { date: "2026-07-14", kg: 82.3 },
  { date: "2026-07-15", kg: 82.0 },
  { date: "2026-07-17", kg: 81.7 },
  { date: "2026-07-19", kg: 82.7 },
  { date: "2026-07-20", kg: 82.1 },
  { date: "2026-07-21", kg: 81.0 },
  { date: "2026-07-22", kg: 80.0 },
  { date: "2026-07-24", kg: 80.8 },
  { date: "2026-07-27", kg: 81.3 },
  { date: "2026-08-01", kg: 80.5 },
  { date: "2026-08-02", kg: 81.5 },
];

/* Tour de taille (cm) — mesure du dimanche */
const SEED_TAILLE = [
  { date: "2026-08-02", cm: 96.5 },
];

/* Activité mensuelle (StepsApp) */
const SEED_ACTIVITE = [
  {
    mois: "2026-07",
    pas: 271499,
    km: 194,
    heures: 46,
    etages: 241,
    pas_moyen_jour: 8758,
  },
];

/* Analyses sanguines — points à surveiller.
   Ajouter les valeurs réelles au fur et à mesure. */
const SEED_ANALYSES = [
  // Exemple de structure :
  // { date: "2026-06-15", ldl: 145, creatinine: null, fer: null, notes: "LDL élevé" }
];

/* Aliments habituels — sert au générateur de repas */
const ALIMENTS = {
  proteines: ["Œufs", "Poulet", "Saumon", "Thon", "Steak 5%", "Yaourt PRO Danone", "Yaourt GO"],
  feculents: ["Pommes de terre", "Riz", "Pâtes", "Pain complet"],
  fruits: ["Pommes", "Bananes", "Pastèque"],
  legumes: ["Légumes", "Salades"],
};

/* Journal quotidien — vide au départ, rempli via le Suivi quotidien */
const SEED_JOURNAL = [
  // { date, poids, pas, sport, repas, faim, fatigue, sommeil, humeur, hydratation }
];
