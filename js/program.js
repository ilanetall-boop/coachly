/* =========================================================================
   Coachly — Programme de sport progressif (poids du corps → haltères)
   Objectif : physique type Tom Holland — épaules, poitrine, dos, gainage,
   taille fine. À la maison, 30–45 min, adaptation par paliers.
   ========================================================================= */

const Program = {
  /* 3 séances/semaine en rotation, ciblées haut du corps + gainage + jambes
     léger (on garde la marche + padel pour le cardio). */
  seances: {
    A: {
      nom: "Poussée — Poitrine / Épaules / Triceps",
      focus: "Poitrine dessinée + épaules larges",
      exercices: [
        { nom: "Pompes (largeur standard)", base: 8, prog: "reps" },
        { nom: "Pompes prise large", base: 6, prog: "reps" },
        { nom: "Pike push-ups (épaules)", base: 5, prog: "reps" },
        { nom: "Dips sur chaise", base: 8, prog: "reps" },
        { nom: "Gainage planche", base: 30, prog: "secondes" },
      ],
    },
    B: {
      nom: "Tirage — Dos / Biceps / Posture",
      focus: "Dos large (effet V) + bras dessinés",
      exercices: [
        { nom: "Rowing serviette / élastique", base: 10, prog: "reps" },
        { nom: "Superman (bas du dos)", base: 10, prog: "reps" },
        { nom: "Rowing table (australian pull-up)", base: 6, prog: "reps" },
        { nom: "Curl bouteilles d'eau / haltères", base: 10, prog: "reps" },
        { nom: "Gainage latéral (par côté)", base: 20, prog: "secondes" },
      ],
    },
    C: {
      nom: "Jambes légères + Taille fine",
      focus: "Ventre plat + taille fine, sans épaissir la taille",
      exercices: [
        { nom: "Squats poids du corps", base: 15, prog: "reps" },
        { nom: "Fentes alternées (par jambe)", base: 10, prog: "reps" },
        { nom: "Relevés de jambes (abdos bas)", base: 10, prog: "reps" },
        { nom: "Mountain climbers", base: 20, prog: "reps" },
        { nom: "Vacuum abdominal (taille fine)", base: 15, prog: "secondes" },
      ],
    },
  },

  /* Planning hebdo : on cale le sport autour de la marche et du padel. */
  planningSemaine: [
    { jour: "Lundi", seance: "A" },
    { jour: "Mardi", seance: null, note: "Marche + éventuel padel" },
    { jour: "Mercredi", seance: "B" },
    { jour: "Jeudi", seance: null, note: "Marche" },
    { jour: "Vendredi", seance: "C", note: "Court, avant Shabbat" },
    { jour: "Samedi", seance: null, note: "Repos / Shabbat / marche douce" },
    { jour: "Dimanche", seance: null, note: "Mesures + marche" },
  ],

  /* Progression : +1 rep (ou +5 s) par exercice et par semaine réussie.
     À partir de la semaine indiquée, on passe à 4 séries au lieu de 3. */
  progression(semaine) {
    const series = semaine >= 5 ? 4 : 3;
    const calc = (base, type) => {
      const inc = type === "secondes" ? 5 : 1;
      const val = base + (semaine - 1) * inc;
      return { val, unite: type === "secondes" ? "s" : "reps" };
    };
    const seances = {};
    for (const [cle, s] of Object.entries(this.seances)) {
      seances[cle] = {
        ...s,
        series,
        exercices: s.exercices.map(e => ({
          nom: e.nom,
          ...calc(e.base, e.prog),
        })),
      };
    }
    return { semaine, series, seances };
  },

  /* Numéro de semaine depuis le début du programme (août 2026). */
  semaineActuelle(debut = "2026-08-01") {
    const j = Coach.jours(debut, new Date().toISOString().slice(0, 10));
    return Math.max(1, Math.floor(j / 7) + 1);
  },
};
