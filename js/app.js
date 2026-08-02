/* =========================================================================
   Coachly — Interface
   Rendu des onglets, graphique SVG maison, formulaires, persistance.
   ========================================================================= */

const $ = (sel, el = document) => el.querySelector(sel);
function appendKids(parent, kids) {
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    if (Array.isArray(kid)) { appendKids(parent, kid); continue; }
    parent.appendChild(
      (typeof kid === "string" || typeof kid === "number")
        ? document.createTextNode(String(kid))
        : kid
    );
  }
}
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  appendKids(n, [].concat(kids));
  return n;
};
const today = () => new Date().toISOString().slice(0, 10);

/* ---------------------------------------------------------------------------
   Graphique SVG (poids brut + moyenne mobile + ligne cible)
--------------------------------------------------------------------------- */
function chartPoids(an) {
  const W = 720, H = 280, P = { t: 20, r: 20, b: 34, l: 40 };
  const serie = an.serie, mm = an.moyenneMobile;
  const allKg = serie.map(p => p.kg).concat([an.cible]);
  let minY = Math.floor(Math.min(...allKg) - 1);
  let maxY = Math.ceil(Math.max(...allKg) + 1);
  const t0 = new Date(serie[0].date), t1 = new Date(serie[serie.length - 1].date);
  const spanD = Math.max(1, (t1 - t0) / 86400000);

  const x = d => P.l + ((new Date(d) - t0) / 86400000 / spanD) * (W - P.l - P.r);
  const y = kg => P.t + (1 - (kg - minY) / (maxY - minY)) * (H - P.t - P.b);

  const svgNS = "http://www.w3.org/2000/svg";
  const S = (tag, attrs) => {
    const n = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const svg = S("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet" });

  // Grille + axe Y
  for (let i = 0; i <= 4; i++) {
    const kg = minY + (i / 4) * (maxY - minY);
    const yy = y(kg);
    svg.appendChild(S("line", { class: "grid-line", x1: P.l, y1: yy, x2: W - P.r, y2: yy }));
    const t = S("text", { class: "axis", x: 6, y: yy + 4 }); t.textContent = kg.toFixed(0);
    svg.appendChild(t);
  }
  // Axe X (quelques dates)
  const nb = Math.min(6, serie.length);
  for (let i = 0; i < nb; i++) {
    const idx = Math.round(i * (serie.length - 1) / (nb - 1 || 1));
    const p = serie[idx];
    const t = S("text", { class: "axis", x: x(p.date), y: H - 12, "text-anchor": "middle" });
    t.textContent = Coach.fmtDateFr(p.date).slice(0, 5);
    svg.appendChild(t);
  }
  // Ligne cible
  svg.appendChild(S("line", { class: "target", x1: P.l, y1: y(an.cible), x2: W - P.r, y2: y(an.cible) }));
  const tc = S("text", { class: "axis", x: W - P.r, y: y(an.cible) - 5, "text-anchor": "end", fill: "#f2cc60" });
  tc.textContent = `cible ${an.cible} kg`; svg.appendChild(tc);

  // Courbe brute
  svg.appendChild(S("polyline", { class: "line-raw", points: serie.map(p => `${x(p.date)},${y(p.kg)}`).join(" ") }));
  // Moyenne mobile
  svg.appendChild(S("polyline", { class: "line-mm", points: mm.map(p => `${x(p.date)},${y(p.kg)}`).join(" ") }));
  // Points
  for (const p of serie) svg.appendChild(S("circle", { class: "pt", cx: x(p.date), cy: y(p.kg), r: 2.5 }));

  return el("div", { class: "chart-wrap" }, [svg]);
}

/* ---------------------------------------------------------------------------
   Onglet : Tableau de bord
--------------------------------------------------------------------------- */
function renderDashboard() {
  const wrap = el("div", { class: "grid" });
  const an = Coach.analysePoids();
  if (!an) { wrap.appendChild(el("div", { class: "card" }, ["Ajoute ta première pesée dans l'onglet Poids."])); return wrap; }
  const ta = Coach.analyseTaille();
  const v = Coach.verdict();

  // Verdict coach
  wrap.appendChild(el("div", { class: `card verdict ${v.ton}` }, [
    el("div", {}, [el("span", { class: `badge ${v.ton}` }, ["Coach"]), " ",
      el("span", { class: "titre" }, [v.titre])]),
    el("p", {}, [v.texte]),
  ]));

  // Stat tiles
  const perteCls = an.perteTotale > 0 ? "down" : an.perteTotale < 0 ? "up" : "flat";
  const momCls = an.momentum < -0.05 ? "down" : an.momentum > 0.05 ? "up" : "flat";
  const tiles = el("div", { class: "grid cols-4" }, [
    statTile("Poids actuel", `${Coach.fmt(an.dernier.kg)} kg`, `le ${Coach.fmtDateFr(an.dernier.date)}`),
    statTile("Perte totale", `${Coach.fmt(an.perteTotale)} kg`, `depuis ${Coach.fmtDateFr(an.premier.date)}`, perteCls),
    statTile("Tendance", `${Coach.fmt(an.kgSemaineTendance)} kg/sem`, "lissée (régression)", an.kgSemaineTendance < 0 ? "down" : "up"),
    statTile("Reste à perdre", `${Coach.fmt(Math.max(0, an.resteAperdre))} kg`, `cible ${an.cible} kg`),
  ]);
  wrap.appendChild(tiles);

  const objD = Store.objectif();
  const tiles2 = el("div", { class: "grid cols-4" }, [
    statTile("Momentum 7j", `${an.momentum <= 0 ? "" : "+"}${Coach.fmt(an.momentum)} kg`, "moyenne lissée", momCls),
    statTile("IMC", Coach.fmt(an.imc, 1), `cible ${objD.imc_cible} (Tom Holland)`, an.imc >= 25 ? "up" : an.imc <= objD.imc_cible + 0.5 ? "down" : "flat"),
    statTile("Poids le + bas", `${Coach.fmt(an.min.kg)} kg`, Coach.fmtDateFr(an.min.date)),
    an.projection
      ? statTile("Projection cible", Coach.fmtDateFr(an.projection.dateISO), `~${Math.round(an.projection.semaines)} sem au rythme actuel`)
      : statTile("Projection", "—", "tendance non descendante"),
  ]);
  wrap.appendChild(tiles2);

  // Graphique
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["📉 Évolution du poids"]),
    chartPoids(an),
    el("p", { class: "muted" }, ["Ligne épaisse = moyenne mobile 7 jours (la vraie tendance). Ligne fine = pesées brutes."]),
  ]));

  // Tour de taille + activité
  const side = el("div", { class: "grid cols-2" });
  if (ta) {
    side.appendChild(el("div", { class: "card" }, [
      el("h2", {}, ["📏 Tour de taille"]),
      el("div", { class: "stat" }, [
        el("div", { class: "val" }, [`${Coach.fmt(ta.dernier.cm)} cm`]),
        el("div", { class: "label" }, [`cible ${ta.cible} cm · reste ${Coach.fmt(Math.max(0, ta.reste))} cm`]),
      ]),
      el("p", { class: "muted" }, [
        `Ratio taille/hauteur : ${Coach.fmt(ta.ratioTailleHauteur, 2)} `,
        `(objectif santé < 0,50 — c'est LE meilleur indicateur de gras abdominal).`
      ]),
    ]));
  }
  const act = Store.__act = SEED_ACTIVITE[SEED_ACTIVITE.length - 1];
  side.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["👟 Activité (dernier mois)"]),
    el("div", { class: "grid cols-2" }, [
      statTile("Pas / jour", act.pas_moyen_jour.toLocaleString("fr-FR"), "moyenne"),
      statTile("Distance", `${act.km} km`, "sur le mois"),
      statTile("Pas total", act.pas.toLocaleString("fr-FR"), ""),
      statTile("Étages", act.etages, ""),
    ]),
    el("p", { class: "muted" }, ["Excellente base cardio. On ajoute la musculation par-dessus, sans réduire la marche."]),
  ]));
  wrap.appendChild(side);

  return wrap;
}

function statTile(label, val, sub, cls = "") {
  return el("div", { class: "card stat" }, [
    el("div", { class: "label" }, [label]),
    el("div", { class: `val ${cls}` }, [val]),
    sub ? el("div", { class: "delta " + cls }, [sub]) : null,
  ]);
}

/* ---------------------------------------------------------------------------
   Onglet : Coach (chat)
--------------------------------------------------------------------------- */
function renderCoach() {
  const wrap = el("div", { class: "grid" });
  const card = el("div", { class: "card", style: "grid-column:1/-1" });
  card.appendChild(el("h2", {}, ["💬 Parle à ton coach"]));

  const feed = el("div", { class: "chat-feed", id: "chatFeed" });
  const hist = CoachChat.history();
  if (hist.length === 0) {
    addBubble(feed, "coach", "Salut Ilane 💪 Je suis ton coach intégré. Donne-moi tes chiffres (« je pèse 81 », « 9500 pas », « séance A faite ») ou demande-moi ta séance, un repas, ou « où j'en suis ? ». On vise le physique Tom Holland — on ne relâche rien.");
  } else {
    for (const m of hist) addBubble(feed, m.role, m.text);
  }
  card.appendChild(feed);

  // Chips d'actions rapides
  const chips = ["Séance du jour ?", "Quoi manger ?", "Où j'en suis ?", "J'ai craqué", "Motivation"];
  const chipRow = el("div", { class: "chip-row" }, chips.map(c =>
    el("button", { class: "chip-btn", onclick: () => sendChat(c) }, [c])
  ));
  card.appendChild(chipRow);

  // Zone de saisie
  const input = el("input", { type: "text", id: "chatInput", placeholder: "Écris à ton coach…", autocomplete: "off" });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { sendChat(input.value); input.value = ""; } });
  const send = el("button", { class: "btn", onclick: () => { sendChat(input.value); input.value = ""; } }, ["Envoyer"]);
  card.appendChild(el("div", { class: "chat-input-row" }, [input, send]));

  card.appendChild(el("p", { class: "muted", style: "margin-top:.6rem" }, [
    "Ce coach comprend le langage naturel, met à jour tes données et fonctionne hors-ligne. ",
    "Pour une conversation libre avec Claude, réponds à tes notifications dans l'app Claude."
  ]));

  const clear = el("button", { class: "btn ghost small", onclick: () => { CoachChat.clear(); rerender(); } }, ["🗑️ Effacer la conversation"]);
  card.appendChild(clear);

  wrap.appendChild(card);
  setTimeout(() => { const f = $("#chatFeed"); if (f) f.scrollTop = f.scrollHeight; }, 0);
  return wrap;
}

function addBubble(feed, role, text) {
  feed.appendChild(el("div", { class: `bubble ${role}` }, [
    el("div", { class: "bubble-inner" }, text.split("\n").flatMap((line, i) => i === 0 ? [line] : [el("br", {}), line])),
  ]));
}

function sendChat(text) {
  text = (text || "").trim();
  if (!text) return;
  const feed = $("#chatFeed");
  CoachChat.push("user", text);
  addBubble(feed, "user", text);
  const reply = CoachChat.respond(text);
  CoachChat.push("coach", reply);
  addBubble(feed, "coach", reply);
  feed.scrollTop = feed.scrollHeight;
}

/* ---------------------------------------------------------------------------
   Onglet : Poids & Mesures
--------------------------------------------------------------------------- */
function renderMesures() {
  const wrap = el("div", { class: "grid cols-2" });

  // Formulaire pesée
  const dInput = el("input", { type: "date", value: today() });
  const kgInput = el("input", { type: "number", step: "0.1", placeholder: "kg" });
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["⚖️ Ajouter une pesée"]),
    el("label", { class: "field" }, [el("span", {}, ["Date"]), dInput]),
    el("label", { class: "field" }, [el("span", {}, ["Poids (kg)"]), kgInput]),
    el("button", { class: "btn", onclick: () => {
      const kg = parseFloat(kgInput.value);
      if (!kg) return alert("Entre un poids.");
      Store.upsert("poids", { date: dInput.value, kg });
      rerender();
    }}, ["Enregistrer"]),
  ]));

  // Formulaire tour de taille
  const dT = el("input", { type: "date", value: today() });
  const cmT = el("input", { type: "number", step: "0.1", placeholder: "cm" });
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["📏 Tour de taille (dimanche)"]),
    el("label", { class: "field" }, [el("span", {}, ["Date"]), dT]),
    el("label", { class: "field" }, [el("span", {}, ["Tour de taille (cm)"]), cmT]),
    el("button", { class: "btn", onclick: () => {
      const cm = parseFloat(cmT.value);
      if (!cm) return alert("Entre une mesure.");
      Store.upsert("taille", { date: dT.value, cm });
      rerender();
    }}, ["Enregistrer"]),
  ]));

  // Objectif éditable
  const obj = Store.objectif();
  const cibleKg = el("input", { type: "number", step: "0.5", value: obj.poids_cible_kg });
  const cibleCm = el("input", { type: "number", step: "0.5", value: obj.tour_taille_cible_cm });
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["🎯 Objectif (éditable)"]),
    el("label", { class: "field" }, [el("span", {}, ["Poids cible (kg)"]), cibleKg]),
    el("label", { class: "field" }, [el("span", {}, ["Tour de taille cible (cm)"]), cibleCm]),
    el("button", { class: "btn ghost", onclick: () => {
      Store.setObjectif({ poids_cible_kg: parseFloat(cibleKg.value), tour_taille_cible_cm: parseFloat(cibleCm.value) });
      rerender();
    }}, ["Mettre à jour"]),
    el("p", { class: "muted" }, ["Rappel : la vraie cible est le tour de taille et les photos, pas la balance."]),
  ]));

  // Historique poids
  const userDates = new Set((Store.state().poids || []).map(e => e.date));
  const rows = Store.poids().slice().reverse().map((p, i, arr) => {
    const prev = arr[i + 1];
    const d = prev ? p.kg - prev.kg : 0;
    const editable = userDates.has(p.date);
    return el("tr", {}, [
      el("td", {}, [Coach.fmtDateFr(p.date)]),
      el("td", {}, [Coach.fmt(p.kg) + " kg"]),
      el("td", { class: d < 0 ? "down" : d > 0 ? "up" : "flat" }, [prev ? `${d > 0 ? "+" : ""}${Coach.fmt(d)}` : "—"]),
      el("td", { style: "text-align:right" }, [
        editable ? el("button", {
          class: "btn ghost small", title: "Supprimer cette pesée",
          onclick: () => {
            if (!confirm(`Supprimer la pesée du ${Coach.fmtDateFr(p.date)} (${Coach.fmt(p.kg)} kg) ?`)) return;
            Store.remove("poids", p.date);
            const s = Store.state();
            if (s.journal) { const j = s.journal.find(e => e.date === p.date); if (j) { delete j.poids; Store._save(s); Store._state = s; } }
            rerender();
          }
        }, ["✕"]) : el("span", { class: "muted", title: "Donnée initiale" }, ["·"]),
      ]),
    ]);
  });
  const tableCard = el("div", { class: "card", style: "grid-column:1/-1" }, [
    el("h2", {}, ["📜 Historique des pesées"]),
    el("p", { class: "muted" }, ["Les pesées que tu as saisies ont un bouton ✕ pour les supprimer. Les données de départ (·) ne sont pas modifiables."]),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [el("th", {}, ["Date"]), el("th", {}, ["Poids"]), el("th", {}, ["Δ"]), el("th", {}, [""])])]),
      el("tbody", {}, rows),
    ]),
  ]);
  wrap.appendChild(tableCard);

  return wrap;
}

/* ---------------------------------------------------------------------------
   Onglet : Programme sport
--------------------------------------------------------------------------- */
function renderSport() {
  const wrap = el("div", { class: "grid" });
  const sem = Program.semaineActuelle();
  const prog = Program.progression(sem);

  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, [`🏋️ Programme — Semaine ${sem}`]),
    el("p", {}, [`${prog.series} séries par exercice. Objectif : `,
      el("b", {}, ["physique Tom Holland"]), " — épaules larges, poitrine dessinée, taille fine. Poids du corps à la maison, 30–45 min."]),
    el("p", { class: "muted" }, ["Progression : +1 rep (ou +5 s de gainage) chaque semaine réussie. Passage à 4 séries dès la semaine 5."]),
  ]));

  // Planning hebdo
  const planning = el("div", { class: "grid cols-3" });
  for (const j of Program.planningSemaine) {
    const s = j.seance ? prog.seances[j.seance] : null;
    planning.appendChild(el("div", { class: "day-card" }, [
      el("div", { class: "jour" }, [j.jour]),
      s ? el("div", {}, [el("b", {}, [`Séance ${j.seance}`]), " — ", s.focus]) : el("div", { class: "muted" }, [j.note || "Repos"]),
      j.note && s ? el("div", { class: "muted" }, [j.note]) : null,
    ]));
  }
  wrap.appendChild(el("div", { class: "card" }, [el("h2", {}, ["🗓️ Semaine type"]), planning]));

  // Détail des séances
  const detail = el("div", { class: "grid cols-3" });
  for (const [cle, s] of Object.entries(prog.seances)) {
    detail.appendChild(el("div", { class: "card" }, [
      el("h3", {}, [`Séance ${cle} · ${s.nom}`]),
      el("p", { class: "muted" }, [s.focus]),
      ...s.exercices.map(e => el("div", { class: "ex-row" }, [
        el("span", {}, [e.nom]),
        el("span", { class: "val" }, [`${prog.series} × ${e.val} ${e.unite}`]),
      ])),
    ]));
  }
  wrap.appendChild(detail);

  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["📈 Plus tard : haltères"]),
    el("p", {}, ["Quand le poids du corps devient facile (toutes les séries au max sans forcer), on introduit des haltères pour continuer à progresser sur le développé, le rowing et les curls — sans jamais viser un physique de culturiste."]),
  ]));

  return wrap;
}

/* ---------------------------------------------------------------------------
   Onglet : Nutrition
--------------------------------------------------------------------------- */
function renderNutrition() {
  const wrap = el("div", { class: "grid" });
  const sem = Program.semaineActuelle();
  const plan = Nutrition.planningSemaine(sem);

  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["🍽️ Planning de la semaine (varié)"]),
    el("p", { class: "muted" }, ["Change chaque semaine. Construit à partir de tes aliments habituels. Jamais deux jours identiques."]),
    el("div", { class: "grid cols-3", style: "margin-top:.8rem" },
      plan.map(d => el("div", { class: "day-card" }, [
        el("div", { class: "jour" }, [d.jour]),
        el("div", { class: "meal" }, [el("b", {}, ["Matin : "]), d.petitDej]),
        el("div", { class: "meal" }, [el("b", {}, ["Midi : "]), d.dejeuner]),
        el("div", { class: "meal" }, [el("b", {}, ["Soir : "]), d.diner]),
        el("div", { class: "meal" }, [el("b", {}, ["Collation : "]), d.collation]),
        d.note ? el("div", { class: "muted" }, [d.note]) : null,
      ]))
    ),
  ]));

  // Rattrapage
  const sel = el("select", {}, [
    el("option", { value: "resto" }, ["Je vais / suis allé au restaurant"]),
    el("option", { value: "matin" }, ["J'ai trop mangé ce matin"]),
    el("option", { value: "midi" }, ["Gros déjeuner"]),
    el("option", { value: "soir" }, ["J'ai craqué ce soir"]),
  ]);
  const out = el("p", {}, [Nutrition.rattrapage("resto")]);
  sel.addEventListener("change", () => out.textContent = Nutrition.rattrapage(sel.value));
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["🔄 J'ai craqué / mangé dehors — on recalcule"]),
    el("p", { class: "muted" }, ["On ne culpabilise pas. On rééquilibre le reste de la journée."]),
    el("label", { class: "field" }, [el("span", {}, ["Situation"]), sel]),
    el("div", { class: "card", style: "background:var(--bg-elev)" }, [out]),
  ]));

  // Restaurants
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["🍴 Guide restaurants — quoi commander"]),
    el("div", { class: "grid cols-2" }, Nutrition.restaurants.map(r => el("div", { class: "day-card" }, [
      el("div", { class: "jour" }, [r.type]),
      el("div", { class: "meal" }, [el("b", {}, ["✅ "]), r.commander]),
      el("div", { class: "meal" }, [el("b", {}, ["⚠️ "]), r.eviter]),
      el("div", { class: "muted" }, ["💡 " + r.astuce]),
    ]))),
  ]));

  // Calendrier juif
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["🕎 Shabbat, fêtes & jeûnes"]),
    ...Nutrition.calendrier.map(c => el("div", { class: "day-card", style: "margin-bottom:.5rem" }, [
      el("div", { class: "jour" }, [c.nom]),
      el("div", { class: "meal" }, [c.strategie]),
    ])),
  ]));

  // Aliments habituels
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["🥗 Tes aliments de base"]),
    ...Object.entries(ALIMENTS).map(([groupe, items]) => el("div", { style: "margin:.4rem 0" }, [
      el("b", { class: "muted" }, [groupe.toUpperCase() + " : "]),
      ...items.map(x => el("span", { class: "pill" }, [x])),
    ])),
  ]));

  return wrap;
}

/* ---------------------------------------------------------------------------
   Onglet : Suivi quotidien
--------------------------------------------------------------------------- */
function renderReminderCard() {
  const cfg = Reminders.config();
  const card = el("div", { class: "card", style: "grid-column:1/-1" });
  const heure = el("input", { type: "time", value: cfg.heure || "20:00", style: "max-width:160px" });
  const statut = el("span", { class: "muted" }, [
    Reminders.supported()
      ? (cfg.actif ? `✅ Rappel actif à ${cfg.heure}` : "Rappel désactivé")
      : "⚠️ Notifications non supportées sur ce navigateur",
  ]);
  card.appendChild(el("h2", {}, ["🔔 Rappel quotidien (sur cet appareil)"]));
  card.appendChild(el("div", { class: "row" }, [
    el("label", { class: "field", style: "margin:0" }, [el("span", {}, ["Heure du rappel"]), heure]),
    el("button", { class: "btn", onclick: async () => {
      try { await Reminders.enable(heure.value); rerender(); }
      catch (e) { alert(e.message); }
    }}, ["Activer"]),
    cfg.actif ? el("button", { class: "btn ghost", onclick: () => { Reminders.disable(); rerender(); } }, ["Désactiver"]) : null,
    el("button", { class: "btn ghost small", onclick: () => Reminders._fire() }, ["Tester"]),
  ]));
  card.appendChild(el("div", { style: "margin-top:.5rem" }, [statut]));
  card.appendChild(el("p", { class: "muted", style: "margin-top:.5rem" }, [
    "Fonctionne quand l'app Coachly est installée et ouverte/en arrière-plan. ",
    el("b", {}, ["Pour un rappel fiable même app fermée"]),
    ", ton coach t'envoie aussi une notification chaque jour via Claude (email / app Claude)."
  ]));
  return card;
}

function renderSuivi() {
  const wrap = el("div", { class: "grid cols-2" });
  const d = today();
  const existing = Store.journal().find(j => j.date === d) || {};

  wrap.appendChild(renderReminderCard());

  const scales = {};
  function emojiScale(name, emojis, current) {
    const btns = emojis.map((e, i) => {
      const b = el("button", { type: "button", class: current === i + 1 ? "sel" : "" }, [e]);
      b.addEventListener("click", () => {
        scales[name] = i + 1;
        [...b.parentNode.children].forEach(c => c.classList.remove("sel"));
        b.classList.add("sel");
      });
      return b;
    });
    if (current) scales[name] = current;
    return el("div", { class: "emoji-scale" }, btns);
  }

  const poids = el("input", { type: "number", step: "0.1", value: existing.poids || "", placeholder: "kg" });
  const pas = el("input", { type: "number", value: existing.pas || "", placeholder: "nombre de pas" });
  const sport = el("input", { type: "text", value: existing.sport || "", placeholder: "Séance A / padel / marche…" });
  const repas = el("textarea", { rows: "3", placeholder: "Ce que tu as mangé…" }, [existing.repas || ""]);
  const hydra = el("input", { type: "number", step: "0.25", value: existing.hydratation || "", placeholder: "litres d'eau" });

  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, [`📋 Check-in du ${Coach.fmtDateFr(d)}`]),
    el("label", { class: "field" }, [el("span", {}, ["Poids (kg)"]), poids]),
    el("label", { class: "field" }, [el("span", {}, ["Pas"]), pas]),
    el("label", { class: "field" }, [el("span", {}, ["Sport effectué"]), sport]),
    el("label", { class: "field" }, [el("span", {}, ["Repas"]), repas]),
    el("label", { class: "field" }, [el("span", {}, ["Hydratation (L)"]), hydra]),
  ]));

  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["🧠 Ressenti"]),
    el("label", { class: "field" }, [el("span", {}, ["Faim"]), emojiScale("faim", ["😌","🙂","😐","😣","🤤"], existing.faim)]),
    el("label", { class: "field" }, [el("span", {}, ["Fatigue"]), emojiScale("fatigue", ["⚡","🙂","😐","😪","🥵"], existing.fatigue)]),
    el("label", { class: "field" }, [el("span", {}, ["Sommeil"]), emojiScale("sommeil", ["😴","🙂","😐","😑","😵"], existing.sommeil)]),
    el("label", { class: "field" }, [el("span", {}, ["Humeur"]), emojiScale("humeur", ["😄","🙂","😐","😕","😞"], existing.humeur)]),
    el("button", { class: "btn", style: "margin-top:.6rem", onclick: () => {
      const entry = {
        date: d,
        poids: parseFloat(poids.value) || undefined,
        pas: parseInt(pas.value) || undefined,
        sport: sport.value || undefined,
        repas: repas.value || undefined,
        hydratation: parseFloat(hydra.value) || undefined,
        ...scales,
      };
      Store.upsert("journal", entry);
      // Si un poids est saisi, on l'ajoute aussi à la courbe
      if (entry.poids) Store.upsert("poids", { date: d, kg: entry.poids });
      alert("Check-in enregistré. Le coach a mis à jour ton suivi.");
      rerender();
    }}, ["Enregistrer le check-in"]),
  ]));

  // Historique journal
  const jrows = Store.journal().slice().reverse().slice(0, 14).map(j => el("tr", {}, [
    el("td", {}, [Coach.fmtDateFr(j.date)]),
    el("td", {}, [j.poids ? j.poids + " kg" : "—"]),
    el("td", {}, [j.pas ? j.pas.toLocaleString("fr-FR") : "—"]),
    el("td", {}, [j.sport || "—"]),
    el("td", {}, [j.hydratation ? j.hydratation + " L" : "—"]),
  ]));
  wrap.appendChild(el("div", { class: "card", style: "grid-column:1/-1" }, [
    el("h2", {}, ["📆 Derniers check-ins"]),
    jrows.length ? el("table", {}, [
      el("thead", {}, [el("tr", {}, ["Date","Poids","Pas","Sport","Eau"].map(h => el("th", {}, [h])))]),
      el("tbody", {}, jrows),
    ]) : el("p", { class: "muted" }, ["Aucun check-in encore. Remplis le premier ci-dessus."]),
  ]));

  return wrap;
}

/* ---------------------------------------------------------------------------
   Onglet : Analyses & Photos
--------------------------------------------------------------------------- */
function renderAnalyses() {
  const wrap = el("div", { class: "grid cols-2" });

  const dA = el("input", { type: "date", value: today() });
  const ldl = el("input", { type: "number", placeholder: "LDL (mg/dL)" });
  const creat = el("input", { type: "number", step: "0.01", placeholder: "Créatinine" });
  const fer = el("input", { type: "number", placeholder: "Fer / Ferritine" });
  const notesA = el("input", { type: "text", placeholder: "Notes" });
  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["🩸 Ajouter une analyse sanguine"]),
    el("label", { class: "field" }, [el("span", {}, ["Date"]), dA]),
    el("label", { class: "field" }, [el("span", {}, ["LDL (mg/dL)"]), ldl]),
    el("label", { class: "field" }, [el("span", {}, ["Créatinine (fonction rénale)"]), creat]),
    el("label", { class: "field" }, [el("span", {}, ["Fer / Ferritine"]), fer]),
    el("label", { class: "field" }, [el("span", {}, ["Notes"]), notesA]),
    el("button", { class: "btn", onclick: () => {
      Store.upsert("analyses", {
        date: dA.value,
        ldl: parseFloat(ldl.value) || undefined,
        creatinine: parseFloat(creat.value) || undefined,
        fer: parseFloat(fer.value) || undefined,
        notes: notesA.value || undefined,
      });
      rerender();
    }}, ["Enregistrer"]),
  ]));

  wrap.appendChild(el("div", { class: "card" }, [
    el("h2", {}, ["👀 Points à surveiller"]),
    el("div", { class: "day-card", style: "margin-bottom:.5rem" }, [
      el("b", {}, ["LDL élevé"]), el("p", { class: "muted" }, ["Privilégier saumon/thon (oméga-3), avoine, légumes, huile d'olive. Limiter viandes grasses et fritures. La perte de gras et le sport font baisser le LDL."])]),
    el("div", { class: "day-card", style: "margin-bottom:.5rem" }, [
      el("b", {}, ["Fonction rénale"]), el("p", { class: "muted" }, ["Bien s'hydrater (viser 2–2,5 L/j). Éviter les excès de protéines en poudre. Surveiller avec le médecin."])]),
    el("div", { class: "day-card" }, [
      el("b", {}, ["Fer"]), el("p", { class: "muted" }, ["Steak maigre, jaune d'œuf, légumes verts. Vitamine C (agrumes) pour l'absorption."])]),
  ]));

  const arows = Store.analyses().slice().reverse().map(a => el("tr", {}, [
    el("td", {}, [Coach.fmtDateFr(a.date)]),
    el("td", {}, [a.ldl ?? "—"]),
    el("td", {}, [a.creatinine ?? "—"]),
    el("td", {}, [a.fer ?? "—"]),
    el("td", {}, [a.notes || "—"]),
  ]));
  wrap.appendChild(el("div", { class: "card", style: "grid-column:1/-1" }, [
    el("h2", {}, ["📊 Historique des analyses"]),
    arows.length ? el("table", {}, [
      el("thead", {}, [el("tr", {}, ["Date","LDL","Créatinine","Fer","Notes"].map(h => el("th", {}, [h])))]),
      el("tbody", {}, arows),
    ]) : el("p", { class: "muted" }, ["Aucune analyse enregistrée."]),
  ]));

  // Photos (guide — le suivi photo se fait hors app pour la vie privée)
  wrap.appendChild(el("div", { class: "card", style: "grid-column:1/-1" }, [
    el("h2", {}, ["📸 Photos hebdomadaires (dimanche)"]),
    el("p", {}, ["Chaque dimanche : photo de face + profil, même lumière, même heure. Points à comparer d'une semaine à l'autre :"]),
    el("div", {}, ["Épaules","Poitrine","Ventre","Taille","Bras","Posture"].map(x => el("span", { class: "pill" }, [x]))),
    el("p", { class: "muted", style:"margin-top:.6rem" }, ["Astuce : ces photos restent privées. Range-les dans un album dédié et compare-les à J-7 et J-30. La photo révèle des progrès que la balance cache (recomposition)."]),
  ]));

  // Données : export / import / reset
  wrap.appendChild(el("div", { class: "card", style: "grid-column:1/-1" }, [
    el("h2", {}, ["💾 Tes données"]),
    el("p", { class: "muted" }, ["Tout est stocké dans ton navigateur (localStorage). Rien n'est envoyé sur Internet. Exporte régulièrement pour ne rien perdre."]),
    el("div", { class: "row" }, [
      el("button", { class: "btn ghost small", onclick: exportData }, ["⬇️ Exporter (JSON)"]),
      el("button", { class: "btn ghost small", onclick: importData }, ["⬆️ Importer"]),
      el("button", { class: "btn ghost small", onclick: () => { if (confirm("Effacer toutes tes saisies (seed conservé) ?")) { Store.reset(); rerender(); } } }, ["🗑️ Réinitialiser"]),
    ]),
  ]));

  return wrap;
}

function exportData() {
  const blob = new Blob([Store.exportJSON()], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `coachly-${today()}.json` });
  a.click();
}
function importData() {
  const input = el("input", { type: "file", accept: ".json" });
  input.addEventListener("change", () => {
    const f = input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { Store.importJSON(r.result); rerender(); alert("Import réussi."); } catch (e) { alert("Fichier invalide."); } };
    r.readAsText(f);
  });
  input.click();
}

/* ---------------------------------------------------------------------------
   Navigation & bootstrap
--------------------------------------------------------------------------- */
const TABS = [
  { id: "dashboard", label: "📊 Tableau de bord", render: renderDashboard },
  { id: "coach", label: "💬 Coach", render: renderCoach },
  { id: "mesures", label: "⚖️ Poids & Mesures", render: renderMesures },
  { id: "sport", label: "🏋️ Programme sport", render: renderSport },
  { id: "nutrition", label: "🍽️ Nutrition", render: renderNutrition },
  { id: "suivi", label: "📋 Suivi quotidien", render: renderSuivi },
  { id: "analyses", label: "🩸 Analyses & Photos", render: renderAnalyses },
];
let currentTab = "dashboard";

function rerender() {
  const nav = $("#tabs"), content = $("#content");
  nav.innerHTML = ""; content.innerHTML = "";
  for (const t of TABS) {
    nav.appendChild(el("button", {
      class: t.id === currentTab ? "active" : "",
      onclick: () => { currentTab = t.id; rerender(); },
    }, [t.label]));
  }
  content.appendChild(TABS.find(t => t.id === currentTab).render());
  window.scrollTo(0, 0);
}

document.addEventListener("DOMContentLoaded", rerender);
