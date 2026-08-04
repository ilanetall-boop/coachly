/* =========================================================================
   Coachly — Analyse de repas par photo (vision IA)
   POST { image: dataURL(jpeg), note? } → estimation calories/macros en JSON.
   Utilise un modèle vision : Groq (Llama vision) prioritaire, sinon Gemini.
   ========================================================================= */

const PROMPT = `Tu es nutritionniste. À partir de la PHOTO d'un repas, estime son contenu de façon réaliste (portions visibles). Réponds UNIQUEMENT en JSON strict, sans aucun texte autour, au format :
{"items":[{"nom":"aliment","kcal":0,"prot":0}],"total_kcal":0,"total_prot":0,"total_glu":0,"total_lip":0,"commentaire":"un conseil coach court en français, orienté objectif sec/Tom Holland"}
Sois honnête sur l'incertitude mais donne toujours une estimation chiffrée.`;

const GROQ_VISION = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama-3.2-90b-vision-preview",
  "llama-3.2-11b-vision-preview",
];
const GEMINI_VISION = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

function extractJSON(text) {
  if (!text) return null;
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (e) { return null; }
}

async function groqVision(key, model, image, note) {
  const content = [
    { type: "text", text: PROMPT + (note ? `\nPrécision de l'utilisateur : ${note}` : "") },
    { type: "image_url", image_url: { url: image } },
  ];
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], temperature: 0.3, max_tokens: 700 }),
  });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, text: d?.choices?.[0]?.message?.content, error: d?.error?.message };
}

async function geminiVision(key, model, image, note) {
  const b64 = String(image).replace(/^data:image\/\w+;base64,/, "");
  const body = { contents: [{ role: "user", parts: [{ text: PROMPT + (note ? `\nPrécision : ${note}` : "") }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 700 } };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  let d = null; try { d = await r.json(); } catch (e) {}
  const text = (d?.candidates?.[0]?.content?.parts || []).map(p => p.text).join("");
  return { ok: r.ok, status: r.status, text, error: d?.error?.message };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const groq = process.env.GROQ_API_KEY, gem = process.env.GEMINI_API_KEY;
  if (!groq && !gem) { res.status(501).json({ error: "no_key" }); return; }

  try {
    const { image, note = "" } = req.body || {};
    if (!image) { res.status(400).json({ error: "no_image" }); return; }

    let lastErr = "vision indisponible";
    const attempts = groq
      ? GROQ_VISION.map(m => ({ call: () => groqVision(groq, m, image, note), m }))
      : GEMINI_VISION.map(m => ({ call: () => geminiVision(gem, m, image, note), m }));

    for (const a of attempts) {
      const r = await a.call();
      if (r.ok && r.text) {
        const json = extractJSON(r.text);
        if (json) { res.status(200).json({ estimation: json, model: a.m }); return; }
        lastErr = "réponse non exploitable";
      } else {
        lastErr = r.error || ("HTTP " + r.status);
        if (r.status && r.status !== 404 && r.status !== 400) break;
      }
    }
    res.status(502).json({ error: "vision", detail: lastErr });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
