/* =========================================================================
   Coachly — Coach scripté (repli hors-ligne / sans clé IA)
   Deux rôles séparés :
   - tryLog(input)   : enregistre les données présentes (poids, pas, sport,
                       taille) SANS jamais logger une question. Renvoie
                       { kind, note, value } ou { kind:null }.
   - replyText(input, logres) : produit la réponse du coach (sans logger).
   respond(input) = tryLog + replyText (utilisé quand l'IA est indisponible).
   L'objectif nord : physique Tom Holland (IMC ~21,5).
   ========================================================================= */

const CoachChat = {
  KEY: "coachly.chat",

  history() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },
  _save(h) { localStorage.setItem(this.KEY, JSON.stringify(h.slice(-200))); },
  push(role, text) { const h = this.history(); h.push({ role, text }); this._save(h); },
  clear() { localStorage.removeItem(this.KEY); },

  norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); },
  num(s) { const m = this.norm(s).replace(",", ".").match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; },
  moment() { const h = new Date().getHours(); return h < 11 ? "matin" : h < 16 ? "midi" : "soir"; },
  jourFr() { return new Date().toLocaleDateString("fr-FR", { weekday: "long" }).toLowerCase(); },

  estQuestion(input, t) {
    if (input.includes("?")) return true;
    return /\b(pourquoi|pour quoi|comment|quel|quelle|quels|quelles|combien|est[- ]?ce|qu'est|qu est|c'est quoi|cest quoi|ca veut dire|explique|signifie|qui|quand)\b/.test(t);
  },

  /* ---------- ENREGISTREMENT (jamais sur une question) ---------- */
  tryLog(input) {
    const t = this.norm(input);
    const has = (...w) => w.some(x => t.includes(x));
    const n = this.num(t);
    if (this.estQuestion(input, t)) return { kind: null };

    // Sport
    if (has("seance a", "seance b", "seance c", "j'ai fait", "jai fait", "entrainement fait", "muscu faite", "padel", "j'ai couru", "jai marche", "jai fait ma marche", "seance faite")) {
      const quoi = has("padel") ? "padel" : has("marche", "marché") ? "marche" : has("seance a") ? "Séance A" : has("seance b") ? "Séance B" : has("seance c") ? "Séance C" : "séance";
      Store.upsert("journal", { date: today(), sport: quoi });
      return { kind: "sport", note: `${quoi} enregistré`, value: quoi };
    }
    // Pas
    if (has("pas") && n && n >= 100) {
      const pas = Math.round(n);
      Store.upsert("journal", { date: today(), pas });
      return { kind: "pas", note: `${pas.toLocaleString("fr-FR")} pas enregistrés`, value: pas };
    }
    // Tour de taille (mot explicite requis)
    if (has("tour de taille", "tour de ventre", "mon ventre", "ma taille") && n && n >= 60 && n <= 130) {
      Store.upsert("taille", { date: today(), cm: n });
      return { kind: "taille", note: `tour de taille ${n} cm enregistré`, value: n };
    }
    // Poids (mot explicite + nombre)
    if (has("kg", "poids", "pese", "je fais", "balance", "je pese", "kilos") && n && n >= 40 && n <= 200) {
      Store.upsert("poids", { date: today(), kg: n });
      Store.upsert("journal", { date: today(), poids: n });
      return { kind: "poids", note: `${Coach.fmt(n)} kg enregistré`, value: n };
    }
    // Nombre seul plausible comme poids
    if (/^\s*\d{2,3}([.,]\d)?\s*$/.test(t) && n >= 50 && n <= 130) {
      Store.upsert("poids", { date: today(), kg: n });
      Store.upsert("journal", { date: today(), poids: n });
      return { kind: "poids", note: `${Coach.fmt(n)} kg enregistré`, value: n };
    }
    return { kind: null };
  },

  /* ---------- RÉPONSE (ne logue rien) ---------- */
  replyText(input, logres) {
    const t = this.norm(input);
    const has = (...w) => w.some(x => t.includes(x));
    const q = this.estQuestion(input, t);
    logres = logres || { kind: null };

    // Correction d'une pesée
    if (has("corrige", "supprime", "efface", "annule", "enleve", "c'est faux", "cest faux", "pas mon poids", "erreur") &&
        (has("poids", "pese", "pesee", "kg") || this.num(t))) {
      return this._corrigePoids();
    }

    // Suite d'un enregistrement → feedback chiffré
    if (logres.kind === "poids") return this._poidsVerdict();
    if (logres.kind === "pas") {
      const p = logres.value;
      const v = p >= 12000 ? "Excellent, tu es une machine." : p >= 8000 ? "Solide, dans ta moyenne." : "Un peu court — vise 10 000+, une marche digestive après le repas et c'est plié.";
      return `👟 ${p.toLocaleString("fr-FR")} pas enregistrés. ${v}`;
    }
    if (logres.kind === "taille") {
      const obj = Store.objectif();
      return `📏 ${logres.note}. Cible : ${obj.tour_taille_cible_cm} cm (reste ${Math.max(0, logres.value - obj.tour_taille_cible_cm).toFixed(1)} cm). C'est LE vrai indicateur pour le physique Tom Holland.`;
    }
    if (logres.kind === "sport") {
      return `💪 Noté : ${logres.note} aujourd'hui. Chaque séance te rapproche du physique visé. Tu as fait combien de pas aujourd'hui ?`;
    }

    // Intentions
    if (has("tom holland") || (has("objectif", "cible", "but", "72", "21", "imc") && (q || has("objectif", "cible", "imc")))) return this._objectif();
    if (has("seance du jour", "seance aujourd", "entrainement", "quel sport", "sport aujourd", "je m'entraine", "je mentraine", "quelle seance", "mon programme")) return this._seanceDuJour();
    if (has("quoi manger", "quel repas", "je mange quoi", "que manger", "idee repas", "propose", "manger ce soir", "manger ce midi", "manger quoi") && !has("craque", "trop mange")) return this._repas();
    if (has("ou j'en suis", "ou jen suis", "progres", "progrès", "stats", "bilan", "resultat", "resultats", "evolution", "combien perdu", "combien j'ai perdu")) return this._progres();
    if (has("calorie", "macro", "proteine", "protéine", "tdee", "cible du jour", "cible calorique", "combien manger", "combien de calories")) return this._cible();
    if (has("commander", "je vais manger dehors", "au restaurant", "invitation", "invite") || (has("shabbat") && q)) return this._restaurant(t);
    if (has("motivation", "j'en peux plus", "jen peux plus", "envie d'abandonner", "abandonner", "demoralise", "decourage", "marre", "pas envie", "j'ai pas envie")) return this._motivation();
    if (has("craque", "pizza", "gateau", "j'ai trop mange", "jai trop mange", "burger", "frites", "dessert", "chocolat", "aperitif", "apero", "resto", "restaurant")) {
      const conseil = Nutrition.rattrapage(has("restaurant", "resto") ? "resto" : this.moment());
      return `🔄 On ne culpabilise pas — on rééquilibre. ${conseil} Un écart ne casse rien ; c'est la tendance sur la semaine qui compte. 💪`;
    }
    if (has("salut", "bonjour", "coucou", "hello", "hey", "ca va", "bonsoir")) {
      return `Salut Ilane 💪 Prêt à avancer vers le physique Tom Holland ? Donne-moi tes chiffres (poids, pas, sport) ou demande-moi ta séance / ton repas.`;
    }

    if (q) {
      return `Bonne question 🤔 Le coach hors-ligne gère surtout ton SUIVI (poids, pas, sport, séance, repas, bilan). Pour une vraie discussion, active le coach IA (voir la note en bas du chat) ou pose-la moi dans l'app Claude.`;
    }
    return `Je t'écoute, coach mode ON 💪 Dis-moi tes chiffres (« je pèse 81 », « 9500 pas », « séance A faite ») ou demande « séance du jour ? », « quoi manger ce soir ? », « où j'en suis ? ».`;
  },

  /* Version complète (log + réponse) pour usage hors-ligne. */
  respond(input) {
    const logres = this.tryLog(input);
    return this.replyText(input, logres);
  },

  /* ---------- Réponses composées ---------- */
  _poidsVerdict() {
    const an = Coach.analysePoids();
    const v = Coach.verdict();
    const mm = an.moyenneMobile[an.moyenneMobile.length - 1].kg;
    const ecart = an.dernier.kg - mm;
    let note = "";
    if (Math.abs(ecart) > 0.8) note = ` (${Coach.fmt(an.dernier.kg)} est ${ecart > 0 ? "au-dessus" : "sous"} ta moyenne lissée — sûrement de l'eau, on regarde la tendance.)`;
    return `⚖️ ${Coach.fmt(an.dernier.kg)} kg enregistré.${note}\n${v.titre} — ${v.texte}\nPerte totale : ${Coach.fmt(an.perteTotale)} kg · reste ${Coach.fmt(Math.max(0, an.resteAperdre))} kg vers ${an.cible} kg.`;
  },

  _objectif() {
    const an = Coach.analysePoids();
    const obj = Store.objectif();
    const etat = an ? `Tu es à ${Coach.fmt(an.dernier.kg)} kg (IMC ${Coach.fmt(an.imc)}) — reste ~${Coach.fmt(Math.max(0, an.resteAperdre))} kg.` : "";
    return `🎯 Objectif : le physique de Tom Holland — sec, épaules larges, ventre plat, taille fine. Du DESSIN, pas du volume.\nRepère : IMC ≈ ${obj.imc_cible}, soit ~${obj.poids_cible_kg} kg à 1m65. Mais le vrai juge, c'est ton TOUR DE TAILLE (~${obj.tour_taille_cible_cm} cm) et tes PHOTOS — pas la balance. Cible éditable dans Poids & Mesures.\n${etat}`;
  },

  _corrigePoids() {
    Store.remove("poids", today());
    const s = Store.state();
    if (s.journal) { const j = s.journal.find(e => e.date === today()); if (j) { delete j.poids; Store._save(s); Store._state = s; } }
    const an = Coach.analysePoids();
    const actuel = an ? `Ton poids affiché revient à ${Coach.fmt(an.dernier.kg)} kg (${Coach.fmtDateFr(an.dernier.date)}).` : "";
    return `✅ Corrigé : j'ai supprimé la pesée d'aujourd'hui. ${actuel}\nPour enregistrer ton vrai poids, écris par ex. « je pèse 81.5 ».`;
  },

  _seanceDuJour() {
    const jour = this.jourFr();
    const plan = Program.planningSemaine.find(p => this.norm(p.jour) === jour);
    const sem = Program.semaineActuelle();
    const prog = Program.progression(sem);
    if (!plan || !plan.seance) {
      return `Aujourd'hui (${jour}) : ${plan && plan.note ? plan.note : "repos"}. Repos = récupération = muscle qui se construit. Garde la marche active. 💪`;
    }
    const s = prog.seances[plan.seance];
    const lignes = s.exercices.map(e => `• ${e.nom} — ${prog.series} × ${e.val} ${e.unite}`).join("\n");
    return `🏋️ Séance du jour (${jour}, semaine ${sem}) — ${s.nom}\nObjectif : ${s.focus}\n${lignes}\nDonne tout, préviens-moi quand c'est fait.`;
  },

  _repas() {
    const m = this.moment();
    const banque = m === "matin" ? Nutrition.banque.petitDej : m === "midi" ? Nutrition.banque.dejeuner : Nutrition.banque.diner;
    const idee = banque[new Date().getDate() % banque.length];
    const extra = m === "soir" ? "Le soir : léger en féculents, protéines + légumes en priorité." : m === "matin" ? "Protéines au petit-déj = moins de fringales." : "Protéines + légumes d'abord, féculent mesuré.";
    return `🍽️ Idée ${m} : ${idee}.\n${extra} Envie d'autre chose ? Dis-moi ce que tu as sous la main.`;
  },

  _cible() {
    const c = Coach.cibleAdaptative();
    if (!c) return "Donne-moi une pesée et je te calcule ta cible du jour.";
    return `🎯 Ta cible du jour (adaptative) :\n• ${c.cibleKcal} kcal\n• Protéines ${c.prot} g · Glucides ${c.glu} g · Lipides ${c.lip} g\nDépense estimée ~${c.tdee} kcal (${c.steps.toLocaleString("fr-FR")} pas/j). ${c.note}`;
  },

  _progres() {
    const an = Coach.analysePoids();
    if (!an) return "Donne-moi une première pesée et je te fais ton bilan.";
    const ta = Coach.analyseTaille();
    let txt = `📊 Bilan vers Tom Holland :\n• Poids : ${Coach.fmt(an.dernier.kg)} kg (IMC ${Coach.fmt(an.imc)}, ${Coach.fmt(an.perteTotale)} kg perdus)\n• Tendance : ${Coach.fmt(an.kgSemaineTendance)} kg/sem\n• Reste ${Coach.fmt(Math.max(0, an.resteAperdre))} kg vers ${an.cible} kg (IMC ${Store.objectif().imc_cible})`;
    if (an.projection) txt += `\n• Projection : ${Coach.fmtDateFr(an.projection.dateISO)}`;
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
    else if (t.includes("shabbat")) return Nutrition.calendrier[0].strategie + " Profite, sans culpabiliser — tu compenses avec la marche.";
    else if (t.includes("invit") || t.includes("anniversaire")) r = Nutrition.restaurants.find(x => this.norm(x.type).includes("invitation"));
    if (!r) return `Dis-moi le type de resto (viande, halavi/poisson, pizza, falafel, invitation, Shabbat) et je te dis quoi commander. Jamais « n'y va pas » — on optimise.`;
    return `🍴 ${r.type}\n✅ Commande : ${r.commander}\n⚠️ Évite : ${r.eviter}\n💡 ${r.astuce}\nEt on allège le reste de la journée. Profite !`;
  },

  _motivation() {
    const an = Coach.analysePoids();
    const perte = an ? Coach.fmt(an.perteTotale) : "plusieurs";
    const msgs = [
      `Stop. Regarde les faits : ${perte} kg déjà perdus. Le physique Tom Holland ne se construit pas les jours faciles — il se construit MAINTENANT, quand t'as pas envie. Une séance courte, même 15 min. On y va.`,
      `Je ne vais pas te bercer. Tu veux le résultat ou les excuses ? Tu as déjà prouvé que tu pouvais (${perte} kg). Aujourd'hui : bouge, protéines, hydrate-toi. Demain tu me remercies.`,
      `La fatigue est réelle. Mais on ne casse pas une série. Fais UNE chose maintenant : 20 pompes ou 20 min de marche. L'élan revient par l'action. Envoie.`,
    ];
    return msgs[new Date().getDate() % msgs.length];
  },
};
