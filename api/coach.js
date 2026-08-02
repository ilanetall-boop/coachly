/* =========================================================================
   Coachly — Fonction serverless (Vercel) : vrai coach IA
   Supporte deux fournisseurs, détectés automatiquement via la variable
   d'environnement présente (Groq prioritaire car gratuit sans CB) :
     - GROQ_API_KEY   → Groq (Llama 3.3 70B) — gratuit, international
     - GEMINI_API_KEY → Google Gemini (free tier selon pays)
   POST : réponse du coach. GET : diagnostic (sans exposer la clé).
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

const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];

function provider() {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

/* Normalise les tours de conversation en {role:'user'|'assistant', text}. */
function normTurns(messages) {
  return (messages || [])
    .filter(m => m && m.text)
    .slice(-16)
    .map(m => ({ role: m.role === "coach" ? "assistant" : "user", text: String(m.text) }));
}

async function callGroq(key, model, systemText, turns) {
  const messages = [{ role: "system", content: systemText }, ...turns.map(t => ({ role: t.role, content: t.text }))];
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.75, max_tokens: 600 }),
  });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, text: data?.choices?.[0]?.message?.content?.trim(), error: data?.error?.message };
}

async function callGemini(key, model, systemText, turns) {
  const contents = turns.map(t => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] }));
  const body = { systemInstruction: { parts: [{ text: systemText }] }, contents, generationConfig: { temperature: 0.75, maxOutputTokens: 600 } };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  let data = null; try { data = await r.json(); } catch (e) {}
  const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text).join("").trim();
  return { ok: r.ok, status: r.status, text, error: data?.error?.message };
}

function config() {
  const p = provider();
  if (p === "groq") return { p, key: process.env.GROQ_API_KEY, models: process.env.GROQ_MODEL ? [process.env.GROQ_MODEL] : GROQ_MODELS, call: callGroq };
  if (p === "gemini") return { p, key: process.env.GEMINI_API_KEY, models: process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : GEMINI_MODELS, call: callGemini };
  return null;
}

export default async function handler(req, res) {
  const cfg = config();

  // -------- Diagnostic --------
  if (req.method === "GET") {
    if (!cfg) { res.status(200).json({ ok: false, hasKey: false, note: "Aucune clé (GROQ_API_KEY ou GEMINI_API_KEY) sur le serveur" }); return; }
    const ping = [{ role: "user", text: "Réponds juste: OK" }];
    let lastErr = "aucun modèle disponible";
    for (const m of cfg.models) {
      try {
        const r = await cfg.call(cfg.key, m, "Tu réponds OK.", ping);
        if (r.ok) { res.status(200).json({ ok: true, hasKey: true, provider: cfg.p, model: m }); return; }
        lastErr = r.error || ("HTTP " + r.status);
        if (r.status !== 404) { res.status(200).json({ ok: false, hasKey: true, provider: cfg.p, model: m, error: lastErr }); return; }
      } catch (e) { lastErr = String(e.message || e); }
    }
    res.status(200).json({ ok: false, hasKey: true, provider: cfg.p, error: lastErr });
    return;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non supportée" }); return; }
  if (!cfg) { res.status(501).json({ error: "no_key" }); return; }

  try {
    const { messages = [], context = "" } = req.body || {};
    const turns = normTurns(messages);
    const systemText = SYSTEM + "\n\nDONNÉES ACTUELLES D'ILANE :\n" + context;

    let lastErr = "inconnu";
    for (const m of cfg.models) {
      const r = await cfg.call(cfg.key, m, systemText, turns);
      if (r.ok && r.text) { res.status(200).json({ text: r.text, provider: cfg.p, model: m }); return; }
      lastErr = r.error || ("HTTP " + r.status);
      if (r.status !== 404) break;
    }
    res.status(502).json({ error: "upstream", detail: lastErr });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
