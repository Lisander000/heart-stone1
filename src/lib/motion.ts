// Shared framer-motion variants used across the app.
import type { Variants } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade + slide up — for individual cards/items. Use with initial="hidden" animate="visible". */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/** Container that staggers its children. Use with initial="hidden" animate="visible". */
export const stagger = (staggerChildren = 0.05): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren, delayChildren: 0.02 } },
});

/** Page-level transition used by the AppShell (initial="hidden" animate="visible" exit="exit"). */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2, ease: "easeIn" } },
};
