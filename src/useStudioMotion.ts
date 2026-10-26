import { useEffect, useState, useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const reducedSnapshot = () => window.matchMedia(query).matches;

export function useStudioMotion() {
  const reduced = useSyncExternalStore(subscribe, reducedSnapshot, () => true);
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } },
  still: { opacity: 1, y: 0, transition: { duration: 0 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};
