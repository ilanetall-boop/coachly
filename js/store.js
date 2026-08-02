/* =========================================================================
   Coachly — Persistance (localStorage)
   Fusionne les données seed (data.js) avec les saisies de l'utilisateur.
   Tout est local au navigateur : aucune donnée n'est envoyée sur Internet.
   ========================================================================= */

const STORE_KEY = "coachly.v1";

const Store = {
  _load() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  },

  _save(state) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  },

  _state: null,
  state() {
    if (!this._state) this._state = this._load();
    return this._state;
  },

  /* Fusionne seed + saisies utilisateur pour une liste datée, triée par date.
     Les entrées utilisateur du même jour écrasent le seed. */
  _merge(seed, userList, dateKey = "date") {
    const map = new Map();
    for (const item of seed) map.set(item[dateKey], { ...item });
    for (const item of (userList || [])) map.set(item[dateKey], { ...item });
    return [...map.values()].sort((a, b) => a[dateKey].localeCompare(b[dateKey]));
  },

  poids()   { return this._merge(SEED_POIDS,   this.state().poids); },
  taille()  { return this._merge(SEED_TAILLE,  this.state().taille); },
  analyses(){ return this._merge(SEED_ANALYSES,this.state().analyses); },
  journal() { return this._merge(SEED_JOURNAL, this.state().journal); },

  objectif() {
    return { ...PROFILE.objectif, ...(this.state().objectif || {}) };
  },

  setObjectif(patch) {
    const s = this.state();
    s.objectif = { ...(s.objectif || {}), ...patch };
    this._save(s);
  },

  /* Ajoute (ou remplace) une entrée datée dans une collection utilisateur. */
  upsert(collection, entry) {
    const s = this.state();
    if (!s[collection]) s[collection] = [];
    const idx = s[collection].findIndex(e => e.date === entry.date);
    if (idx >= 0) s[collection][idx] = { ...s[collection][idx], ...entry };
    else s[collection].push(entry);
    this._save(s);
    this._state = s;
  },

  remove(collection, date) {
    const s = this.state();
    if (!s[collection]) return;
    s[collection] = s[collection].filter(e => e.date !== date);
    this._save(s);
    this._state = s;
  },

  exportJSON() {
    return JSON.stringify({
      profil: PROFILE,
      objectif: this.objectif(),
      poids: this.poids(),
      taille: this.taille(),
      analyses: this.analyses(),
      journal: this.journal(),
    }, null, 2);
  },

  importJSON(text) {
    const data = JSON.parse(text);
    const s = this.state();
    if (data.poids)    s.poids = data.poids;
    if (data.taille)   s.taille = data.taille;
    if (data.analyses) s.analyses = data.analyses;
    if (data.journal)  s.journal = data.journal;
    if (data.objectif) s.objectif = data.objectif;
    this._save(s);
    this._state = s;
  },

  reset() {
    localStorage.removeItem(STORE_KEY);
    this._state = null;
  },
};
