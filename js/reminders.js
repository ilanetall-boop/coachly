/* =========================================================================
   Coachly — Rappels locaux (Notifications)
   Rappel quotidien de check-in quand l'app est installée / ouverte.
   ⚠️ Limite navigateur : un site ne peut pas garantir une notification
   quand l'app est totalement fermée (surtout iPhone). Pour des rappels
   fiables même app fermée, on utilise en plus une Routine Claude (email/push).
   ========================================================================= */

const Reminders = {
  KEY: "coachly.reminder",

  config() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch { return {}; }
  },
  save(cfg) { localStorage.setItem(this.KEY, JSON.stringify(cfg)); },

  supported() {
    return "Notification" in window && "serviceWorker" in navigator;
  },

  async enable(heure) {
    if (!this.supported()) throw new Error("Notifications non supportées sur ce navigateur.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Permission refusée.");
    this.save({ actif: true, heure, dernier: null });
    this.schedule();
    return true;
  },

  disable() {
    this.save({ actif: false });
  },

  /* Envoie la notif via le service worker (fallback : Notification directe). */
  async _fire() {
    const heureLabel = this.config().heure || "";
    const payload = {
      type: "notify",
      title: "💪 Coachly — check-in du jour",
      body: "Poids, pas, sport, repas, ressenti. 2 minutes. On garde le cap.",
    };
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.active ? reg.active.postMessage(payload)
                 : reg.showNotification(payload.title, { body: payload.body, icon: "assets/icon-192.png" });
    } catch {
      if (Notification.permission === "granted") new Notification(payload.title, { body: payload.body });
    }
    const cfg = this.config();
    cfg.dernier = new Date().toISOString().slice(0, 10);
    this.save(cfg);
  },

  /* Vérifie chaque minute si l'heure du rappel est atteinte (app ouverte). */
  schedule() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this._tick(), 60 * 1000);
    this._tick();
  },

  _tick() {
    const cfg = this.config();
    if (!cfg.actif || !cfg.heure) return;
    const now = new Date();
    const [h, m] = cfg.heure.split(":").map(Number);
    const dejaFait = cfg.dernier === now.toISOString().slice(0, 10);
    // Fenêtre de déclenchement : à l'heure prévue (±2 min), une fois par jour
    if (!dejaFait && now.getHours() === h && Math.abs(now.getMinutes() - m) <= 2) {
      this._fire();
    }
  },
};

// Démarre le planificateur au chargement si un rappel est actif
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    if (Reminders.config().actif) Reminders.schedule();
  });
}
