# Working on Poloroid

Poloroid is a React 19 + TypeScript + Vite photo studio. Read `README.md`
and `docs/DESIGN.md` before changing its interface. Preserve the warm paper
palette, upright frame, photo-first layout, and Start → Edit → Finish flow.

## Installed design and animation skills

Project-local skills live in `.agents/skills/`. Read the relevant `SKILL.md`
and only the references required by the current request:

- `impeccable`: design direction, UX reviews, accessibility, responsive layout,
  typography, and polish. On Windows use its `scripts/impeccable.cmd` launcher.
  The existing design context is `docs/DESIGN.md`; inspect it when the context
  helper looks only for a root-level `DESIGN.md`.
- `make-interfaces-feel-better`: detailed interaction, typography, surface,
  icon, and animation reviews.
- `transitions-dev`: CSS interaction recipes and reduced-motion fallbacks.
- `transitions-polish`: tune existing motion and timing.
- `transitions-ui-generation`: use only for a requested generated-UI reveal.
- `gsap-core`, `gsap-react`, `gsap-timeline`, `gsap-scrolltrigger`,
  `gsap-plugins`, `gsap-utils`, `gsap-performance`, `gsap-frameworks`:
  use the relevant skills when implementing or reviewing GSAP.

Motion for React is already installed and used by the studio. Prefer its
existing patterns for ordinary UI changes. The GSAP skills are installed;
`gsap` and `@gsap/react` are not runtime dependencies yet. Add those with pnpm
when an actual feature uses GSAP. Give each animated property one owner;
avoid competing CSS, Motion, and GSAP animations on the same property.

Honor reduced-motion preferences and hidden-page behavior in
`src/useStudioMotion.ts`. Keep animation presentation separate from composition
state and undo history (`src/presentation.ts`). Exports and printing must render
the complete composition independently of temporary UI animation.

Use the user's request to choose the task; installing these skills does not
authorize a redesign, hook activation, live relay, account login, or deployment.
See `docs/DESIGN-SKILLS.md` for usage examples, source revisions, and licenses.

## Validation

Use pnpm and the scripts in `package.json`. For application changes run
`pnpm test`, `pnpm typecheck`, and `pnpm build`. For interface changes also
inspect the affected screens and states at desktop and mobile widths, including
keyboard interaction and reduced motion. Keep uploaded photos on the device.
