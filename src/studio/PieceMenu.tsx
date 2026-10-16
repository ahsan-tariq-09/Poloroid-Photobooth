import * as Context from "@radix-ui/react-context-menu";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  AlignHorizontalJustifyCenter,
  ChevronRight,
  Copy,
  Layers,
  MoreHorizontal,
  ClipboardPaste,
  Trash2,
} from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import type { Studio } from "./useStudioSession";

const compactQuery = "(max-width: 600px)";
const subscribeCompact = (notify: () => void) => {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const getCompact = () => window.matchMedia(compactQuery).matches;

// Both entry points share the same actions, focus behavior and submenus.
function Items({ s, context = false }: { s: Studio; context?: boolean }) {
  const Menu = context ? Context : Dropdown;
  const compact = useSyncExternalStore(
    subscribeCompact,
    getCompact,
    () => false,
  );
  const band = s.composition.layers.filter(
    (l) => (l.kind === "photo") === (s.layer?.kind === "photo"),
  );
  const index = band.findIndex((l) => l.id === s.selected);
  return (
    <>
      <Menu.Item
        className="piece-menu-item"
        disabled={!s.layer}
        onSelect={s.copy}
      >
        <Copy size={16} />
        Copy
      </Menu.Item>
      <Menu.Item
        className="piece-menu-item"
        disabled={!s.clipboard}
        onSelect={s.paste}
      >
        <ClipboardPaste size={16} />
        Paste
      </Menu.Item>
      <Menu.Item
        className="piece-menu-item"
        disabled={!s.layer}
        onSelect={s.remove}
      >
        <Trash2 size={16} />
        Delete
      </Menu.Item>
      <Menu.Separator className="piece-menu-separator" />
      <Menu.Sub>
        <Menu.SubTrigger className="piece-menu-item" disabled={!s.layer}>
          <Layers size={16} />
          Layer
          <ChevronRight className="submenu-arrow" size={16} />
        </Menu.SubTrigger>
        <Menu.Portal>
          <Menu.SubContent
            className="piece-menu"
            sideOffset={compact ? -200 : 5}
            collisionPadding={10}
          >
            {(
              [
                ["forward", "Bring forward"],
                ["front", "Bring to front"],
                ["backward", "Send backward"],
                ["back", "Send to back"],
              ] as const
            ).map(([action, label]) => (
              <Menu.Item
                key={action}
                className="piece-menu-item"
                disabled={
                  index < 0 ||
                  (action === "forward" || action === "front"
                    ? index === band.length - 1
                    : index === 0)
                }
                onSelect={() => s.reorder(action)}
              >
                {label}
              </Menu.Item>
            ))}
          </Menu.SubContent>
        </Menu.Portal>
      </Menu.Sub>
      <Menu.Sub>
        <Menu.SubTrigger className="piece-menu-item" disabled={!s.layer}>
          <AlignHorizontalJustifyCenter size={16} />
          Align to page
          <ChevronRight className="submenu-arrow" size={16} />
        </Menu.SubTrigger>
        <Menu.Portal>
          <Menu.SubContent
            className="piece-menu"
            sideOffset={compact ? -200 : 5}
            collisionPadding={10}
          >
            {(
              ["left", "center", "right", "top", "middle", "bottom"] as const
            ).map((alignment) => (
              <Menu.Item
                key={alignment}
                className="piece-menu-item"
                onSelect={() => s.align(alignment)}
              >
                {alignment[0].toUpperCase() + alignment.slice(1)}
              </Menu.Item>
            ))}
          </Menu.SubContent>
        </Menu.Portal>
      </Menu.Sub>
    </>
  );
}
export function PieceContextMenu({
  studio,
  children,
  onOpenChange,
}: {
  studio: Studio;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Context.Root
      onOpenChange={(open) => {
        if (open) studio.finish();
        onOpenChange(open);
      }}
    >
      <Context.Trigger asChild>{children}</Context.Trigger>
      <Context.Portal>
        <Context.Content className="piece-menu" collisionPadding={10}>
          <Items s={studio} context />
        </Context.Content>
      </Context.Portal>
    </Context.Root>
  );
}
export default function PieceMenu({
  studio,
  onOpenChange,
}: {
  studio: Studio;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dropdown.Root
      onOpenChange={(open) => {
        if (open) studio.finish();
        onOpenChange(open);
      }}
    >
      <Dropdown.Trigger className="piece-menu-button" aria-label="Piece menu">
        <MoreHorizontal size={20} />
        Piece menu
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="piece-menu"
          sideOffset={6}
          collisionPadding={10}
          align="end"
        >
          <Items s={studio} />
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
