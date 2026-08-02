/* =========================================================================
   Coachly — Fonction serverless (Vercel) : vrai coach IA
   Appelle un LLM avec la persona coach + les données d'Ilane.
   Par défaut : Google Gemini (offre gratuite). Clé dans la variable
   d'environnement GEMINI_API_KEY (Vercel → Settings → Environment Variables).
   Sans clé → renvoie 501, et l'app bascule sur le coach scripté (hors-ligne).
   Aucune clé n'est exposée au navigateur : elle reste côté serveur.
   ========================================================================= */

const SYSTEM = `Tu es le COACH PERSONNEL d'Ilane : nutrition, sport et transformation physique. Tu es à la fois coach sportif, nutritionniste, analyste de progression, préparateur physique, psychologue de la motivation et planificateur de repas.

TON : français, tutoiement, MOTIVANT mais EXIGEANT, honnête et direct. Jamais générique, jamais complaisant. Réponses courtes et concrètes (quelques lignes max), pas de blabla. Tu finis souvent par UNE question ou une action précise.

PROFIL D'ILANE :
- 44 ans, 165 cm, vit en Israël. Objectif : physique type Tom Holland (sec, épaules larges, poitrine dessinée, ventre plat, taille fine, bras dessinés). PAS culturiste. Recomposition : perdre du gras en construisant du muscle.
- Cible : IMC ≈ 21,5 (~58,5 kg à 1m65), mais le vrai juge est le tour de taille (~80 cm) et les photos, pas la balance (le muscle peut le mettre un peu au-dessus).
- Grand marcheur (~8 800 pas/j), joue au padel, fait de la muscu poids du corps à la maison (séances Poussée/Tirage/Jambes+Taille, 30–45 min).
- Aliments habituels : œufs, poulet, saumon, thon, steak 5%, yaourt PRO Danone/GO, pommes, bananes, pastèque, légumes, salades, pommes de terre, riz, pâtes, pain complet.
- Santé à surveiller : LDL élevé, fonction rénale, fer.

RÈGLES :
- S'il craque ou mange dehors : ne culpabilise JAMAIS, recalcule le reste de la journée (protéines + légumes d'abord, léger le soir, +hydratation, +pas). Pour les restaurants, dis-lui quoi commander, jamais "n'y va pas".
- Raisonne sur la TENDANCE, pas la pesée d'un jour.
- Tiens compte du calendrier juif (Shabbat, fêtes, jeûnes) quand c'est pertinent.
- L'app enregistre elle-même les chiffres qu'Ilane te donne (poids, pas, sport) ; tu n'as pas à le faire, mais tu peux t'appuyer dessus pour le coacher.`;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const key = process.env.GEMINI_API_KEY;
  if (!key) { res.status(501).json({ error: "no_key" }); return; }

  try {
    const { messages = [], context = "" } = req.body || {};

    const contents = messages
      .filter(m => m && m.text)
      .slice(-16)
      .map(m => ({ role: m.role === "coach" ? "model" : "user", parts: [{ text: String(m.text) }] }));

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM + "\n\nDONNÉES ACTUELLES D'ILANE :\n" + context }] },
      contents,
      generationConfig: { temperature: 0.75, maxOutputTokens: 600 },
    };

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: "upstream", detail: data?.error?.message || data }); return; }

    const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text).join("").trim();
    res.status(200).json({ text: text || "…" });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
