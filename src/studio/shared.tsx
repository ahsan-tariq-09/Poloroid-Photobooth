import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useStudioMotion } from "../useStudioMotion";
import { texture } from "../render";
import { DEFAULT_CROP, type Asset, type Composition } from "../model";
export function Range({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
  onChange,
  onFinish,
  disabled = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  onFinish: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <b>
          {Math.round(value)}
          {suffix}
        </b>
      </span>
      <input
        aria-label={label}
        disabled={disabled}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={
          {
            "--progress": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onFinish}
        onPointerCancel={onFinish}
        onKeyUp={onFinish}
        onBlur={onFinish}
      />
    </label>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    enabled = useStudioMotion();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const controls =
          ref.current?.querySelectorAll<HTMLElement>("button,a[href]");
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <motion.div
      className="modal-backdrop"
      initial={enabled ? { opacity: 0 } : false}
      animate={enabled ? "visible" : "still"}
      variants={{
        visible: { opacity: 1, transition: { duration: 0.16 } },
        still: { opacity: 1, transition: { duration: 0 } },
      }}
      exit={enabled ? { opacity: 0 } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        tabIndex={-1}
        className="info-modal"
        initial={enabled ? { y: 28, scale: 0.96 } : false}
        animate={enabled ? "visible" : "still"}
        variants={{
          visible: {
            y: 0,
            scale: 1,
            transition: { type: "spring", stiffness: 260, damping: 26 },
          },
          still: { y: 0, scale: 1, transition: { duration: 0 } },
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
      >
        <div className="modal-top">
          <span />
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="info-title">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}
export function PresetThumbnail({
  asset,
  composition,
  crop,
  film,
  copier,
}: {
  asset: Asset | null;
  composition: Composition;
  crop: typeof DEFAULT_CROP;
  film: number;
  copier: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const signature = JSON.stringify([
    crop,
    composition.effects.seed,
    film,
    copier,
  ]);
  useEffect(() => {
    let disposed = false;
    if (!asset) return;
    texture(
      asset,
      {
        crop,
        effects: { film, copier, seed: composition.effects.seed },
      },
      0.2,
    )
      .then((image) => {
        if (disposed || !ref.current) return;
        ref.current.width = image.width;
        ref.current.height = image.height;
        ref.current.getContext("2d")!.drawImage(image, 0, 0);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [asset, signature]);
  return <canvas ref={ref} className="preset-image" aria-hidden="true" />;
}
