/* =========================================================================
   Coachly — Moteur d'analyse
   Calculs de progression, tendances, projections.
   Aucune dépendance externe.
   ========================================================================= */

const Coach = {
  jours(dateA, dateB) {
    return Math.round((new Date(dateB) - new Date(dateA)) / 86400000);
  },

  fmt(n, d = 1) {
    return Number.isFinite(n) ? n.toFixed(d) : "—";
  },

  fmtDateFr(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  },

  /* Moyenne mobile pour lisser les fluctuations quotidiennes (eau, sel...). */
  moyenneMobile(serie, fenetre = 7) {
    return serie.map((pt, i) => {
      const debut = Math.max(0, i - fenetre + 1);
      const tranche = serie.slice(debut, i + 1);
      const moy = tranche.reduce((s, p) => s + p.kg, 0) / tranche.length;
      return { date: pt.date, kg: moy };
    });
  },

  /* Régression linéaire (moindres carrés) sur la série de poids.
     x = jours depuis la 1re mesure, y = kg. */
  tendance(serie) {
    if (serie.length < 2) return null;
    const t0 = serie[0].date;
    const pts = serie.map(p => ({ x: this.jours(t0, p.date), y: p.kg }));
    const n = pts.length;
    const sx = pts.reduce((s, p) => s + p.x, 0);
    const sy = pts.reduce((s, p) => s + p.y, 0);
    const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
    const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const pente = (n * sxy - sx * sy) / denom;   // kg / jour
    const ordonnee = (sy - pente * sx) / n;
    return { pente, ordonnee, t0, kgParSemaine: pente * 7 };
  },

  /* Analyse complète de la progression du poids. */
  analysePoids() {
    const serie = Store.poids();
    if (serie.length === 0) return null;

    const premier = serie[0];
    const dernier = serie[serie.length - 1];
    const min = serie.reduce((m, p) => (p.kg < m.kg ? p : m), serie[0]);
    const max = serie.reduce((m, p) => (p.kg > m.kg ? p : m), serie[0]);

    const perteTotale = premier.kg - dernier.kg;
    const joursTotal = this.jours(premier.date, dernier.date) || 1;
    const perteParSemaine = (perteTotale / joursTotal) * 7;

    // Tendance lissée (plus fiable que 1er↔dernier point pour la projection)
    const tend = this.tendance(serie);
    const kgSemaineTendance = tend ? tend.kgParSemaine : -perteParSemaine;

    const obj = Store.objectif();
    const cible = obj.poids_cible_kg;
    const resteAperdre = dernier.kg - cible;

    // Projection basée sur la tendance lissée (uniquement si on perd)
    let projection = null;
    if (tend && tend.pente < 0 && resteAperdre > 0) {
      const semaines = resteAperdre / Math.abs(kgSemaineTendance);
      const dateCible = new Date(dernier.date);
      dateCible.setDate(dateCible.getDate() + Math.round(semaines * 7));
      projection = {
        semaines,
        dateISO: dateCible.toISOString().slice(0, 10),
      };
    }

    // Momentum sur 7 derniers jours vs 7 précédents
    const mm = this.moyenneMobile(serie, 7);
    const momentum = mm.length >= 2
      ? mm[mm.length - 1].kg - mm[Math.max(0, mm.length - 8)].kg
      : 0;

    const imc = dernier.kg / Math.pow(PROFILE.taille_cm / 100, 2);

    return {
      serie,
      moyenneMobile: mm,
      premier, dernier, min, max,
      perteTotale, joursTotal, perteParSemaine,
      kgSemaineTendance, momentum,
      cible, resteAperdre, projection,
      imc,
    };
  },

  /* Analyse du tour de taille. */
  analyseTaille() {
    const serie = Store.taille();
    if (serie.length === 0) return null;
    const premier = serie[0];
    const dernier = serie[serie.length - 1];
    const obj = Store.objectif();
    return {
      serie,
      dernier,
      variation: dernier.cm - premier.cm,
      cible: obj.tour_taille_cible_cm,
      reste: dernier.cm - obj.tour_taille_cible_cm,
      // Ratio taille/hauteur : < 0.5 = bon indicateur de santé
      ratioTailleHauteur: dernier.cm / PROFILE.taille_cm,
    };
  },

  /* Moyenne des pas récents (journal), sinon activité mensuelle seed. */
  recentSteps() {
    const j = Store.journal().filter(e => e.pas).slice(-14);
    if (j.length) return Math.round(j.reduce((s, e) => s + e.pas, 0) / j.length);
    const a = SEED_ACTIVITE[SEED_ACTIVITE.length - 1];
    return a ? a.pas_moyen_jour : 8000;
  },

  /* Facteur d'activité déduit du nombre de pas quotidiens. */
  activiteFacteur(steps) {
    return steps < 6000 ? 1.35 : steps < 8000 ? 1.45 : steps < 10000 ? 1.55 : steps < 12500 ? 1.65 : 1.75;
  },

  /* Cible adaptative (façon MacroFactor, sans logger chaque repas) :
     - TDEE = BMR (Mifflin-St Jeor) × facteur d'activité (pas réels)
     - Cible calories pour une perte muscle-préservante (~0,7 kg/sem)
     - Protéines élevées, plancher de sécurité, note pilotée par la tendance.
     Tout se recalcule à mesure que le poids et les pas évoluent. */
  cibleAdaptative() {
    const p = this.analysePoids();
    if (!p) return null;
    const kg = p.dernier.kg;
    const bmr = 10 * kg + 6.25 * PROFILE.taille_cm - 5 * PROFILE.age + 5;
    const steps = this.recentSteps();
    const fa = this.activiteFacteur(steps);
    const tdee = Math.round(bmr * fa);

    const tauxCible = 0.7; // kg/semaine, muscle-préservant
    const deficit = Math.round(tauxCible * 7700 / 7); // ≈ 770 kcal/j
    const plancher = Math.round(bmr * 1.1 / 10) * 10; // ne pas descendre trop bas
    let cibleKcal = Math.round((tdee - deficit) / 10) * 10;
    if (cibleKcal < plancher) cibleKcal = plancher;

    const prot = Math.round(1.8 * kg / 5) * 5;   // ~1,8 g/kg
    const lip = Math.round(0.8 * kg / 5) * 5;    // ~0,8 g/kg
    const glu = Math.max(0, Math.round((cibleKcal - prot * 4 - lip * 9) / 4));

    const r = p.kgSemaineTendance; // négatif = perte
    let note;
    if (r <= -1.1) note = `Tu perds vite (${this.fmt(Math.abs(r))} kg/sem). Ne descends pas sous ${plancher} kcal et vise bien tes ${prot} g de protéines pour garder le muscle.`;
    else if (r <= -0.4) note = `Rythme idéal — tiens ${cibleKcal} kcal + tes protéines, c'est la zone recomposition.`;
    else if (r < 0.3) note = `Plateau : le corps s'est adapté. Ajoute ~2000 pas ou retire ~150 kcal.`;
    else note = `Ça remonte : resserre à ${cibleKcal} kcal et loggue tes repas quelques jours.`;

    return { bmr: Math.round(bmr), tdee, steps, fa, cibleKcal, prot, lip, glu, plancher, tauxCible, note };
  },

  /* Message coach : ton exigeant, honnête, basé sur les chiffres. */
  verdict() {
    const p = this.analysePoids();
    if (!p) return { ton: "neutre", titre: "Aucune donnée", texte: "Ajoute ta première pesée." };

    const semaine = p.kgSemaineTendance; // négatif = on perd
    let ton, titre, texte;

    if (semaine <= -1.2) {
      ton = "alerte";
      titre = "Trop rapide";
      texte = `Tu perds ${this.fmt(Math.abs(semaine))} kg/sem. Au-delà de ~1 kg/sem tu risques de perdre du muscle — exactement ce qu'on veut garder pour le physique visé. Mange un peu plus de protéines et vérifie ton sommeil.`;
    } else if (semaine <= -0.3) {
      ton = "bien";
      titre = "Rythme idéal";
      texte = `${this.fmt(Math.abs(semaine))} kg/sem en tendance. C'est exactement la zone recomposition : tu perds du gras sans crâmer ton muscle. Continue, ne relâche rien.`;
    } else if (semaine < 0.3) {
      ton = "attention";
      titre = "Plateau";
      texte = `La tendance est quasi plate (${this.fmt(semaine)} kg/sem). Le corps s'est adapté. On resserre : plus de pas, musculation régulière, et on surveille les portions du soir. Pas de panique, on recalcule.`;
    } else {
      ton = "alerte";
      titre = "Ça remonte";
      texte = `Tendance à +${this.fmt(semaine)} kg/sem. Je ne te culpabilise pas — on regarde les faits : les derniers jours ont dérapé. On reprend le contrôle dès aujourd'hui. Loggue tes repas, je m'occupe du reste.`;
    }

    // Rappel sur le dernier point vs tendance (fluctuation normale)
    const ecart = p.dernier.kg - p.moyenneMobile[p.moyenneMobile.length - 1].kg;
    if (Math.abs(ecart) > 0.8) {
      texte += ` (Note : ${this.fmt(p.dernier.kg)} kg aujourd'hui est ${ecart > 0 ? "au-dessus" : "en dessous"} de ta moyenne lissée — probablement de l'eau/sel, pas du gras. On regarde la tendance, pas la photo d'un jour.)`;
    }

    return { ton, titre, texte };
  },
};
