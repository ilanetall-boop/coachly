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
