/* =========================================================================
   Coachly — Client du coach IA
   Appelle la fonction serverless /api/coach. Si indisponible (pas de clé,
   hors-ligne, erreur) → l'app bascule sur le coach scripté (chat.js).
   ========================================================================= */

const CoachAI = {
  _disponible: null, // null=inconnu, true/false=testé

  async send(messages, context) {
    try {
      const r = await fetch("api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, context }),
      });
      if (r.status === 501) { this._disponible = false; return { ok: false, reason: "no_key" }; }
      if (!r.ok) return { ok: false, reason: "http_" + r.status };
      const d = await r.json();
      this._disponible = true;
      return { ok: true, text: d.text };
    } catch (e) {
      return { ok: false, reason: "network" };
    }
  },

  /* Contexte de données transmis à l'IA pour qu'elle coache sur du concret. */
  buildContext() {
    const parts = [`Date du jour : ${today()}.`];
    const an = Coach.analysePoids();
    const obj = Store.objectif();
    if (an) {
      parts.push(`Poids actuel ${Coach.fmt(an.dernier.kg)} kg (IMC ${Coach.fmt(an.imc)}), départ ${Coach.fmt(an.premier.kg)} kg le ${Coach.fmtDateFr(an.premier.date)}, perte totale ${Coach.fmt(an.perteTotale)} kg, tendance ${Coach.fmt(an.kgSemaineTendance)} kg/sem.`);
    }
    parts.push(`Cible : IMC ${obj.imc_cible} (~${obj.poids_cible_kg} kg), tour de taille ${obj.tour_taille_cible_cm} cm.`);
    const ta = Coach.analyseTaille();
    if (ta) parts.push(`Dernier tour de taille : ${Coach.fmt(ta.dernier.cm)} cm.`);

    // Séance du jour
    try {
      const jour = new Date().toLocaleDateString("fr-FR", { weekday: "long" }).toLowerCase();
      const plan = Program.planningSemaine.find(p => p.jour.toLowerCase() === jour);
      const sem = Program.semaineActuelle();
      if (plan && plan.seance) {
        const s = Program.seances[plan.seance];
        parts.push(`Séance prévue aujourd'hui (${jour}, semaine ${sem}) : ${plan.seance} — ${s.nom} (${s.focus}).`);
      } else {
        parts.push(`Aujourd'hui (${jour}) : ${plan && plan.note ? plan.note : "repos"}.`);
      }
    } catch (e) {}

    // Journal du jour
    const j = Store.journal().find(e => e.date === today());
    if (j) {
      const bits = [];
      if (j.pas) bits.push(`${j.pas} pas`);
      if (j.sport) bits.push(`sport: ${j.sport}`);
      if (j.repas) bits.push(`repas: ${j.repas}`);
      if (bits.length) parts.push(`Déjà noté aujourd'hui : ${bits.join(", ")}.`);
    }
    return parts.join(" ");
  },
};
