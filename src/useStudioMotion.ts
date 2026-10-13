import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

export function useStudioMotion() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return !reduced && visible;
}

export const panelVariants = {
  enter: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  still: { opacity: 1, y: 0, transition: { duration: 0 } },
  exit: { opacity: 0, y: -5, transition: { duration: 0.12 } },
};
