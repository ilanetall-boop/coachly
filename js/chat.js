/* =========================================================================
   Coachly — Coach intégré (chat)
   Comprend le langage naturel, répond dans le ton coach, et MET À JOUR
   les données (poids, pas, sport, repas). 100% local, aucune API.
   Objectif nord : physique Tom Holland (sec, épaules larges, taille fine).
   ========================================================================= */

const CoachChat = {
  KEY: "coachly.chat",

  history() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },
  _save(h) { localStorage.setItem(this.KEY, JSON.stringify(h.slice(-200))); },
  push(role, text) { const h = this.history(); h.push({ role, text, t: Date.now ? undefined : undefined }); this._save(h); },
  clear() { localStorage.removeItem(this.KEY); },

  norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); },
  num(s) { const m = this.norm(s).replace(",", ".").match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; },
  moment() { const h = new Date().getHours(); return h < 11 ? "matin" : h < 16 ? "midi" : "soir"; },
  jourFr() { return new Date().toLocaleDateString("fr-FR", { weekday: "long" }).toLowerCase(); },

  /* Détecte une question (pour ne JAMAIS l'enregistrer comme une donnée). */
  estQuestion(input, t) {
    if (input.includes("?")) return true;
    return /\b(pourquoi|pour quoi|comment|quel|quelle|quels|quelles|combien|est[- ]?ce|qu'est|qu est|c'est quoi|cest quoi|ca veut dire|explique|signifie|qui|quand)\b/.test(t);
  },

  /* ---- Point d'entrée : renvoie le texte de réponse du coach ---- */
  respond(input) {
    const t = this.norm(input);
    const has = (...w) => w.some(x => t.includes(x));
    const q = this.estQuestion(input, t);
    const n = this.num(t);

    // 0) CORRECTION d'une pesée erronée (prioritaire)
    if (has("corrige", "supprime", "efface", "annule", "enleve", "c'est faux", "cest faux", "pas mon poids", "erreur") &&
        (has("poids", "pese", "pesee", "kg") || n)) {
      return this._corrigePoids();
    }

    // ===== INTENTIONS DE QUESTION / COMMANDE (marchent même en question) =====

    // Objectif / pourquoi 72 kg
    if (has("tom holland") || (has("objectif", "cible", "but", "72") && (q || has("objectif", "cible")))) {
      return this._objectif();
    }
    // Séance du jour
    if (has("seance du jour", "seance aujourd", "entrainement", "quel sport", "sport aujourd", "je m'entraine", "je mentraine", "quelle seance", "mon programme")) {
      return this._seanceDuJour();
    }
    // Quoi manger
    if (has("quoi manger", "quel repas", "je mange quoi", "que manger", "idee repas", "propose", "manger ce soir", "manger ce midi", "manger quoi") && !has("craque", "trop mange")) {
      return this._repas();
    }
    // Progrès / bilan
    if (has("ou j'en suis", "ou jen suis", "progres", "progrès", "stats", "bilan", "resultat", "resultats", "evolution", "combien perdu", "combien j'ai perdu")) {
      return this._progres();
    }
    // Restaurant — quoi commander
    if (has("commander", "je vais manger dehors", "au restaurant", "invitation", "invite") || (has("shabbat") && q)) {
      return this._restaurant(t);
    }
    // Motivation / coup de mou
    if (has("motivation", "j'en peux plus", "jen peux plus", "envie d'abandonner", "abandonner", "demoralise", "decourage", "marre", "pas envie", "j'ai pas envie")) {
      return this._motivation();
    }

    // ===== J'AI CRAQUÉ / RESTO (déclaration, pas une question) =====
    if (has("craque", "pizza", "gateau", "j'ai trop mange", "jai trop mange", "burger", "frites", "dessert", "chocolat", "aperitif", "apero", "resto", "restaurant")) {
      const moment = this.moment();
      const conseil = Nutrition.rattrapage(has("restaurant", "resto") ? "resto" : moment);
      return `🔄 On ne culpabilise pas — on rééquilibre. ${conseil} Un écart ne casse rien ; c'est la tendance sur la semaine qui compte. Tu reprends le contrôle dès le prochain repas. 💪`;
    }

    // ===== ENREGISTREMENT DE DONNÉES — JAMAIS si c'est une question =====
    if (!q) {
      // Sport effectué
      if (has("seance a", "seance b", "seance c", "j'ai fait", "jai fait", "entrainement fait", "muscu faite", "padel", "j'ai couru", "jai marche", "jai fait ma marche", "seance faite")) {
        let quoi = has("padel") ? "padel" : has("marche", "marché") ? "marche" : has("seance a") ? "Séance A" : has("seance b") ? "Séance B" : has("seance c") ? "Séance C" : "séance";
        Store.upsert("journal", { date: today(), sport: quoi });
        return `💪 Noté : ${quoi} enregistré aujourd'hui. Chaque séance te rapproche du physique visé. Tu as fait combien de pas aujourd'hui ?`;
      }
      // Pas
      if (has("pas") && n && n >= 100) {
        const pas = Math.round(n);
        Store.upsert("journal", { date: today(), pas });
        const verdict = pas >= 12000 ? "Excellent, tu es une machine." : pas >= 8000 ? "Solide, dans ta moyenne." : "Un peu court — vise 10 000+, une marche digestive après le repas et c'est plié.";
        return `👟 ${pas.toLocaleString("fr-FR")} pas enregistrés. ${verdict}`;
      }
      // Tour de taille (nécessite le mot "taille"/"ventre")
      if (has("tour de taille", "tour de ventre", "mon ventre", "ma taille") && n && n >= 60 && n <= 130) {
        Store.upsert("taille", { date: today(), cm: n });
        const obj = Store.objectif();
        return `📏 Tour de taille ${n} cm enregistré. Cible : ${obj.tour_taille_cible_cm} cm (reste ${Math.max(0, n - obj.tour_taille_cible_cm).toFixed(1)} cm). C'est LE vrai indicateur pour le physique Tom Holland.`;
      }
      // Poids (mot explicite + nombre)
      if (has("kg", "poids", "pese", "je fais", "balance", "je pese", "kilos") && n && n >= 40 && n <= 200) {
        return this._logPoids(n);
      }
      // Nombre seul plausible comme poids (ex "81.5")
      if (/^\s*\d{2,3}([.,]\d)?\s*$/.test(t) && n >= 50 && n <= 130) {
        return this._logPoids(n);
      }
    }

    // Salutation
    if (has("salut", "bonjour", "coucou", "hello", "hey", "ca va", "bonsoir")) {
      return `Salut Ilane 💪 Prêt à avancer vers le physique Tom Holland ? Donne-moi tes chiffres du jour (poids, pas, sport) ou demande-moi ta séance / ton repas. On ne relâche rien.`;
    }

    // ===== C'est une question à laquelle je ne sais pas répondre de façon scriptée =====
    if (q) {
      return `Bonne question 🤔 Ce chat intégré gère surtout ton SUIVI (enregistrer poids/pas/sport, sortir ta séance, un repas, ton bilan) — il ne discute pas librement.\nPour une vraie réponse détaillée, pose-la moi dans l'app Claude : réponds à une de tes notifications (6h/10h/14h/20h) et je te réponds à fond.\nSi c'est sur ton objectif, ton programme ou ta nutrition, utilise les mots « objectif », « séance » ou « repas » et je t'aide tout de suite.`;
    }

    return `Je t'écoute, coach mode ON 💪 Tu peux me dire :\n• « je pèse 81 » → j'enregistre + j'analyse\n• « 9500 pas » → je note ton activité\n• « séance du jour ? » → ton entraînement\n• « quoi manger ce soir ? » → une idée de repas\n• « j'ai craqué / pizza » → je recalcule ta journée\n• « où j'en suis ? » → tes progrès vers Tom Holland`;
  },

  /* ---------- Réponses composées ---------- */
  _objectif() {
    const an = Coach.analysePoids();
    const obj = Store.objectif();
    const etat = an ? `Tu es à ${Coach.fmt(an.dernier.kg)} kg (${Coach.fmt(an.perteTotale)} kg perdus).` : "";
    return `🎯 Ton objectif, c'est le physique de Tom Holland : sec, épaules larges, poitrine dessinée, ventre plat, taille fine. Du DESSIN, pas du volume.\n\nÀ propos du chiffre de ${obj.poids_cible_kg} kg : ce n'est PAS une cible figée, juste une estimation éditable pour un physique sec à 1m65. Le vrai repère, c'est ton TOUR DE TAILLE (viser ~${obj.tour_taille_cible_cm} cm) et tes PHOTOS — pas la balance. Tu peux être « Tom Holland » à 70 comme à 74 kg selon ton muscle. Tu peux changer cette cible dans l'onglet Poids & Mesures.\n${etat} On avance sur 2 leviers : perdre le gras + construire du muscle au poids du corps.`;
  },

  _corrigePoids() {
    Store.remove("poids", today());
    // Nettoie aussi le poids du jour dans le journal
    const s = Store.state();
    if (s.journal) { const j = s.journal.find(e => e.date === today()); if (j) { delete j.poids; Store._save(s); Store._state = s; } }
    const an = Coach.analysePoids();
    const actuel = an ? `Ton poids affiché revient à ${Coach.fmt(an.dernier.kg)} kg (${Coach.fmtDateFr(an.dernier.date)}).` : "";
    return `✅ Corrigé : j'ai supprimé la pesée enregistrée aujourd'hui. ${actuel}\nSi tu veux enregistrer ton vrai poids du jour, écris-le clairement, par exemple « je pèse 81.5 ».`;
  },

  _logPoids(kg) {
    Store.upsert("poids", { date: today(), kg });
    Store.upsert("journal", { date: today(), poids: kg });
    const an = Coach.analysePoids();
    const v = Coach.verdict();
    const mm = an.moyenneMobile[an.moyenneMobile.length - 1].kg;
    const ecart = kg - mm;
    let note = "";
    if (Math.abs(ecart) > 0.8) note = ` (${Coach.fmt(kg)} est ${ecart > 0 ? "au-dessus" : "sous"} ta moyenne lissée — sûrement de l'eau, on regarde la tendance.)`;
    return `⚖️ ${Coach.fmt(kg)} kg enregistré.${note}\n${v.titre} — ${v.texte}\nPerte totale : ${Coach.fmt(an.perteTotale)} kg · reste ${Coach.fmt(Math.max(0, an.resteAperdre))} kg vers ${an.cible} kg.`;
  },

  _seanceDuJour() {
    const jour = this.jourFr();
    const plan = Program.planningSemaine.find(p => this.norm(p.jour) === jour);
    const sem = Program.semaineActuelle();
    const prog = Program.progression(sem);
    if (!plan || !plan.seance) {
      return `Aujourd'hui (${jour}) : ${plan && plan.note ? plan.note : "repos"}. Repos = récupération = muscle qui se construit. Garde la marche active. Demain on remet une séance. 💪`;
    }
    const s = prog.seances[plan.seance];
    const lignes = s.exercices.map(e => `• ${e.nom} — ${prog.series} × ${e.val} ${e.unite}`).join("\n");
    return `🏋️ Séance du jour (${jour}, semaine ${sem}) — ${s.nom}\nObjectif : ${s.focus}\n${lignes}\nChaque semaine on ajoute des reps. Donne tout, préviens-moi quand c'est fait.`;
  },

  _repas() {
    const m = this.moment();
    const banque = m === "matin" ? Nutrition.banque.petitDej : m === "midi" ? Nutrition.banque.dejeuner : Nutrition.banque.diner;
    const i = new Date().getDate() % banque.length;
    const idee = banque[i];
    const extra = m === "soir" ? "Le soir : léger en féculents, protéines + légumes en priorité." : m === "matin" ? "Protéines au petit-déj = moins de fringales dans la journée." : "Protéines + légumes d'abord, féculent mesuré.";
    return `🍽️ Idée ${m} : ${idee}.\n${extra} Envie d'autre chose ? Dis-moi ce que tu as sous la main, je t'adapte ça.`;
  },

  _progres() {
    const an = Coach.analysePoids();
    if (!an) return "Donne-moi une première pesée et je te fais ton bilan.";
    const ta = Coach.analyseTaille();
    let txt = `📊 Ton bilan vers Tom Holland :\n• Poids : ${Coach.fmt(an.dernier.kg)} kg (départ ${Coach.fmt(an.premier.kg)} → ${Coach.fmt(an.perteTotale)} kg perdus)\n• Tendance : ${Coach.fmt(an.kgSemaineTendance)} kg/sem\n• Reste ${Coach.fmt(Math.max(0, an.resteAperdre))} kg vers ${an.cible} kg`;
    if (an.projection) txt += `\n• Projection cible : ${Coach.fmtDateFr(an.projection.dateISO)}`;
    if (ta) txt += `\n• Tour de taille : ${Coach.fmt(ta.dernier.cm)} cm (cible ${ta.cible})`;
    const v = Coach.verdict();
    txt += `\n\n${v.titre} : ${v.texte}`;
    return txt;
  },

  _restaurant(t) {
    let r;
    if (t.includes("viande")) r = Nutrition.restaurants.find(x => this.norm(x.type).includes("viande"));
    else if (t.includes("pizza")) r = Nutrition.restaurants.find(x => this.norm(x.type).includes("pizza"));
    else if (t.includes("halavi") || t.includes("poisson") || t.includes("laitier")) r = Nutrition.restaurants.find(x => this.norm(x.type).includes("halavi"));
    else if (t.includes("falafel") || t.includes("houmous")) r = Nutrition.restaurants.find(x => this.norm(x.type).includes("falafel"));
    else if (t.includes("shabbat")) return Nutrition.calendrier[0].strategie + " Profite, sans culpabiliser — tu compenses avec la marche et un dimanche carré.";
    else if (t.includes("invit") || t.includes("anniversaire")) r = Nutrition.restaurants.find(x => this.norm(x.type).includes("invitation"));
    if (!r) return `Dis-moi le type de resto (viande, halavi/poisson, pizza, falafel, invitation, Shabbat) et je te dis exactement quoi commander. Je ne te dirai JAMAIS « n'y va pas » — on optimise, c'est tout.`;
    return `🍴 ${r.type}\n✅ Commande : ${r.commander}\n⚠️ Évite : ${r.eviter}\n💡 ${r.astuce}\nEt on allège le reste de la journée. Profite !`;
  },

  _motivation() {
    const an = Coach.analysePoids();
    const perte = an ? Coach.fmt(an.perteTotale) : "plusieurs";
    const msgs = [
      `Stop. Regarde les faits : tu as déjà perdu ${perte} kg. Ça, personne ne te l'enlève. Le physique Tom Holland ne se construit pas les jours faciles — il se construit MAINTENANT, quand t'as pas envie. Une séance courte, même 15 min. On y va.`,
      `Je ne vais pas te bercer. Tu veux le résultat ou tu veux les excuses ? Tu as déjà prouvé que tu pouvais (${perte} kg). Aujourd'hui tu fais le minimum non-négociable : bouge, protéines, hydrate-toi. Demain tu me remercies.`,
      `La fatigue est réelle, je l'entends. Mais on ne casse pas une série. Fais juste UNE chose maintenant : 20 pompes ou 20 min de marche. L'élan revient par l'action, pas par l'envie. Envoie.`,
    ];
    return msgs[new Date().getDate() % msgs.length];
  },
};
