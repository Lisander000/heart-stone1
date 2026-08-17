// Shared framer-motion variants used across the app.
import type { Transition, Variants } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade + slide up — for individual cards/items. Use with initial="hidden" animate="visible". */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/** Container that staggers its children. Use with initial="hidden" animate="visible". */
export const stagger = (staggerChildren = 0.05, delayChildren = 0.02): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren, delayChildren } },
});

/** Page-level transition used by the AppShell (initial="hidden" animate="visible" exit="exit"). */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2, ease: "easeIn" } },
};

/* ── Springs ──────────────────────────────────────────────────────────────
 *
 * De varianten hierboven zijn tweens: vaste duur, niet te onderbreken, geen
 * besef van snelheid. Prima voor entrees die niemand aanraakt. Zodra iets
 * wél aanraakbaar is — slepen, wegflikken, halverwege terugtrekken — heb je
 * een spring nodig, want die animeert altijd vanaf de huidige waarde.
 *
 * Apple beschrijft een spring met twee ontwerpparameters in plaats van de
 * natuurkunde-triplet massa/stijfheid/demping:
 *
 *   demping (damping ratio) — hoeveel de beweging doorschiet.
 *                             1.0 = kritisch gedempt, geen overshoot.
 *   respons (response)      — hoe snel de waarde zijn doel bereikt, in
 *                             seconden. Dit is géén duur; een spring heeft
 *                             er geen.
 *
 * In Framer Motion 12 vertaalt dat rechtstreeks naar `bounce` (≈ 1 − demping)
 * en `visualDuration` (= respons).
 *
 * Vuistregel: standaard `springUI`, zonder overshoot. Doorveren mag alleen
 * wanneer het gebaar zélf momentum had — een flick, een sleep, een worp. Een
 * paneel dat gewoon verschijnt hoort niet te stuiteren.
 */

/** Verplaatsen en herpositioneren. Apple: demping 1.0, respons 0.4. */
export const springUI: Transition = { type: "spring", bounce: 0, visualDuration: 0.4 };

/** Korte, directe reacties: tooltips, badges, popovers. */
export const springSnappy: Transition = { type: "spring", bounce: 0, visualDuration: 0.25 };

/** Lades en sheets. Apple: demping 0.8, respons 0.3. */
export const springSheet: Transition = { type: "spring", bounce: 0.2, visualDuration: 0.3 };

/** Alleen ná een gebaar met snelheid. Apple: demping 0.8, respons 0.4. */
export const springThrown: Transition = { type: "spring", bounce: 0.3, visualDuration: 0.4 };

export const spring = {
  ui: springUI,
  snappy: springSnappy,
  sheet: springSheet,
  thrown: springThrown,
} as const;

/**
 * Waar een gebaar eindigt als je het loslaat.
 *
 * Apple's projectiefunctie uit de *Designing Fluid Interfaces* voorbeeldcode:
 * exponentieel verval, net als scroll-deceleratie. Nadrukkelijk níet de
 * natuurkundeformule v²/(2a) — die geeft een stroever, minder natuurlijk gevoel.
 *
 * Gebruik het resultaat om te bepalen wáárheen je animeert (welk snappunt het
 * dichtst bij het geprojecteerde eindpunt ligt) en geef daarna de snelheid van
 * het gebaar door aan de spring, zodat er geen naad zit tussen slepen en animeren.
 *
 * @param velocity          snelheid bij loslaten, in px/s
 * @param decelerationRate  0.998 voor normaal scrollgevoel, 0.99 voor sneller afremmen
 * @returns afstand in px die de beweging nog aflegt
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Rubber-banding: hoe ver een element meebeweegt voorbij een grens.
 *
 * Hoe verder je sleept, hoe minder het volgt. Een harde stop leest als
 * "vastgelopen"; oplopende weerstand leest als "hier houdt het op".
 *
 * @param overshoot  afstand voorbij de grens, in px
 * @param dimension  maat van het element in dezelfde richting, in px
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
