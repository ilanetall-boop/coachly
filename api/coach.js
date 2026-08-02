/* =========================================================================
   Coachly — Fonction serverless (Vercel) : vrai coach IA (Google Gemini)
   - POST : génère la réponse du coach (persona + données d'Ilane).
   - GET  : diagnostic (clé détectée ? quel modèle répond ?) — sans exposer
            la clé. Sert au voyant d'état dans l'app.
   Clé côté serveur : variable d'environnement GEMINI_API_KEY.
   ========================================================================= */

const SYSTEM = `Tu es le COACH PERSONNEL d'Ilane : nutrition, sport et transformation physique. Tu es à la fois coach sportif, nutritionniste, analyste de progression, préparateur physique, psychologue de la motivation et planificateur de repas.

TON : français, tutoiement, MOTIVANT mais EXIGEANT, honnête et direct. Jamais générique, jamais complaisant. Réponses courtes et concrètes (quelques lignes max), pas de blabla. Tu finis souvent par UNE question ou une action précise.

PROFIL D'ILANE :
- 44 ans, 165 cm, vit en Israël. Objectif : physique type Tom Holland (sec, épaules larges, poitrine dessinée, ventre plat, taille fine, bras dessinés). PAS culturiste. Recomposition : perdre du gras en construisant du muscle.
- Cible : IMC ≈ 21,5 (~58,5 kg à 1m65), mais le vrai juge est le tour de taille (~80 cm) et les photos, pas la balance.
- Grand marcheur (~8 800 pas/j), joue au padel, muscu poids du corps à la maison (Poussée/Tirage/Jambes+Taille, 30–45 min).
- Aliments habituels : œufs, poulet, saumon, thon, steak 5%, yaourt PRO Danone/GO, pommes, bananes, pastèque, légumes, salades, pommes de terre, riz, pâtes, pain complet.
- Santé à surveiller : LDL élevé, fonction rénale, fer.

RÈGLES :
- S'il craque ou mange dehors : ne culpabilise JAMAIS, recalcule le reste de la journée. Pour les restaurants, dis quoi commander, jamais "n'y va pas".
- Raisonne sur la TENDANCE, pas la pesée d'un jour.
- Tiens compte du calendrier juif (Shabbat, fêtes, jeûnes).
- L'app enregistre elle-même les chiffres qu'Ilane te donne ; appuie-toi dessus.`;

// Modèles essayés dans l'ordre (le 1er qui répond gagne).
const MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];

async function callGemini(key, model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}

function modelsToTry() {
  return process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : MODELS;
}

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;

  // -------- Diagnostic --------
  if (req.method === "GET") {
    if (!key) { res.status(200).json({ ok: false, hasKey: false, note: "GEMINI_API_KEY absente sur le serveur" }); return; }
    const testBody = { contents: [{ role: "user", parts: [{ text: "Réponds juste: OK" }] }], generationConfig: { maxOutputTokens: 5 } };
    for (const m of modelsToTry()) {
      try {
        const r = await callGemini(key, m, testBody);
        if (r.ok) { res.status(200).json({ ok: true, hasKey: true, model: m }); return; }
        if (r.status !== 404) { res.status(200).json({ ok: false, hasKey: true, model: m, error: r.data?.error?.message || ("HTTP " + r.status) }); return; }
      } catch (e) {}
    }
    res.status(200).json({ ok: false, hasKey: true, error: "Aucun modèle Gemini disponible sur cette clé." });
    return;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non supportée" }); return; }
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

    let lastErr = "inconnu";
    for (const m of modelsToTry()) {
      const r = await callGemini(key, m, body);
      if (r.ok) {
        const text = (r.data?.candidates?.[0]?.content?.parts || []).map(p => p.text).join("").trim();
        res.status(200).json({ text: text || "…", model: m });
        return;
      }
      lastErr = r.data?.error?.message || ("HTTP " + r.status);
      if (r.status !== 404) break; // erreur autre que "modèle inconnu" → on arrête
    }
    res.status(502).json({ error: "upstream", detail: lastErr });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
