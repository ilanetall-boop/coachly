/* =========================================================================
   Coachly — Nutrition : planning varié, contexte Israël, restaurants,
   Shabbat / fêtes / jeûnes, et rattrapage de journée ("j'ai craqué / resto").
   Basé sur les aliments habituels d'Ilane (voir data.js).
   ========================================================================= */

const Nutrition = {
  /* Banque de repas variés construite à partir des aliments habituels.
     Objectif : jamais deux fois la même chose, riche en protéines. */
  banque: {
    petitDej: [
      "Omelette 3 œufs + légumes + 1 tranche pain complet",
      "Yaourt PRO Danone + banane + flocons d'avoine",
      "Œufs à la coque (2) + salade tomate/concombre + pain complet",
      "Shakshuka (œufs, tomates, poivrons) + pain complet",
      "Yaourt GO + pomme + poignée d'amandes",
      "Fromage blanc + pastèque (l'été, portion mesurée)",
    ],
    dejeuner: [
      "Poulet grillé + riz + grande salade",
      "Saumon au four + pommes de terre vapeur + légumes verts",
      "Steak 5% + patate douce + salade israélienne",
      "Thon + pâtes complètes + légumes sautés",
      "Blanc de poulet + boulgour + salade + houmous (portion)",
      "Filet de poisson blanc + riz + légumes grillés",
    ],
    diner: [
      "Salade composée + thon + 1 œuf dur (léger le soir)",
      "Poulet + beaucoup de légumes vapeur (peu de féculent le soir)",
      "Omelette + salade verte",
      "Saumon + salade + 1 petite portion de riz",
      "Soupe de légumes + blanc de poulet",
      "Yaourt PRO + fruit (si dîner très léger)",
    ],
    collation: [
      "Yaourt GO", "Pomme", "Banane (autour du sport)",
      "Poignée d'amandes", "Œuf dur", "Bâtonnets de légumes",
    ],
  },

  /* Génère un planning hebdo sans répétition, sélection pseudo-déterministe
     à partir du numéro de semaine (pour que ça change chaque semaine). */
  planningSemaine(seed = 0) {
    const jours = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
    const pick = (arr, i) => arr[(i + seed) % arr.length];
    return jours.map((jour, i) => {
      const shabbat = jour === "Vendredi" || jour === "Samedi";
      return {
        jour,
        petitDej: pick(this.banque.petitDej, i),
        dejeuner: pick(this.banque.dejeuner, i + 2),
        diner: shabbat
          ? "Repas de Shabbat — voir stratégie dédiée"
          : pick(this.banque.diner, i + 1),
        collation: pick(this.banque.collation, i),
        note: shabbat ? "Shabbat : profiter en contrôlant les portions." : null,
      };
    });
  },

  /* Stratégies restaurant : quoi commander, jamais « n'y va pas ». */
  restaurants: [
    {
      type: "Restaurant viande (Bassari)",
      commander: "Grillade (poulet / entrecôte maigre / brochettes) + grande salade. Pain pita : max 1.",
      eviter: "Fritures, sauces crémeuses à volonté, sodas sucrés.",
      astuce: "Demander la viande grillée, pas panée. Doubler les légumes plutôt que les féculents.",
    },
    {
      type: "Restaurant Halavi (laitier / poisson)",
      commander: "Poisson grillé ou au four + salade. Pâtes : demi-portion.",
      eviter: "Plats gratinés très fromagers, pizzas entières.",
      astuce: "Le poisson est ton meilleur allié ici. Une part de dessert partagée, pas une entière.",
    },
    {
      type: "Pizza",
      commander: "2–3 parts + grande salade avant. Base fine plutôt qu'épaisse.",
      eviter: "Pizza entière solo + soda.",
      astuce: "Manger la salade EN PREMIER coupe la faim et réduit le nombre de parts.",
    },
    {
      type: "Falafel / Houmous",
      commander: "Assiette houmous + salade + 1 pita, plutôt qu'une pita bourrée frite.",
      eviter: "Falafel frit à volonté + frites.",
      astuce: "Le houmous nature est bon ; c'est le pain frit qui coûte cher.",
    },
    {
      type: "Anniversaire / Invitation",
      commander: "Se servir en protéines + légumes d'abord, gâteau : 1 part.",
      eviter: "Grignoter sans compter toute la soirée.",
      astuce: "Arriver sans avoir sauté de repas (sinon on se jette sur tout).",
    },
  ],

  /* Événements du calendrier juif — stratégie sans frustration. */
  calendrier: [
    { nom: "Shabbat (vendredi soir + samedi)", strategie: "2 gros repas festifs. Charger en protéines (poisson, poulet, viande), salades à volonté, hallah mesurée (1–2 parts). Marche douce le samedi. Reprise normale le dimanche." },
    { nom: "Rosh Hashana / Fêtes", strategie: "Repas riches sur plusieurs jours : viser les protéines et légumes en premier, goûter aux plats sucrés symboliques sans excès. On lisse sur la semaine, pas sur le repas." },
    { nom: "Jeûnes (Yom Kippour, Tisha BeAv...)", strategie: "Rupture de jeûne PROGRESSIVE : eau + fruit d'abord, puis repas normal riche en protéines. Ne pas se ruer sur le sucre à jeun. Bien s'hydrater avant/après." },
    { nom: "Souccot / repas fréquents", strategie: "Beaucoup d'invitations : appliquer la règle protéines+légumes d'abord, et compenser par les pas (marche) dans la journée." },
  ],

  /* « J'ai mangé au resto / j'ai craqué » → recalcule le reste de la journée.
     On ne culpabilise pas : on rééquilibre. */
  rattrapage(momentJournee) {
    const base = {
      matin: "Excès le matin → déjeuner et dîner légers : protéines maigres + légumes, zéro féculent le soir. +2000 pas.",
      midi: "Gros déjeuner → dîner très léger (salade + protéine maigre ou yaourt PRO). Marche 20–30 min après le repas.",
      soir: "Excès le soir → pas de drame. Demain : petit-déj protéiné, journée normale, +3000 pas. On ne saute PAS de repas pour 'compenser'.",
      resto: "Au resto : protéines + légumes d'abord, 1 féculent max, eau. Le reste de la journée : léger et beaucoup d'eau.",
    };
    return base[momentJournee] || base.resto;
  },
};
