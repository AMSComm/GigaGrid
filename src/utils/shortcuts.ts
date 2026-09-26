export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export interface ShortcutSpec {
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export function formatShortcut(spec: ShortcutSpec, isMacPlatform = isMac): string {
  if (isMacPlatform) {
    let s = "";
    if (spec.alt) s += "⌥";
    if (spec.shift) s += "⇧";
    if (spec.mod) s += "⌘";
    s += spec.key.toUpperCase();
    return s;
  }
  const parts: string[] = [];
  if (spec.mod) parts.push("Ctrl");
  if (spec.alt) parts.push("Alt");
  if (spec.shift) parts.push("Shift");
  parts.push(spec.key.toUpperCase());
  return parts.join("+");
}

export const TOOLBAR_SHORTCUTS = {
  open: { key: "O", mod: true },
  recent: { key: "O", mod: true, shift: true },
  save: { key: "S", mod: true },
  search: { key: "F", mod: true },
  filter: { key: "F", mod: true, shift: true },
  goto: { key: "L", mod: true },
  gridLines: { key: "G", mod: true, alt: true },
  freezeHeader: { key: "H", mod: true, shift: true },
  theme: { key: "T", mod: true, shift: true },
  update: { key: "U", mod: true, shift: true },
} as const;

export function getToolbarShortcutLabel(
  action: keyof typeof TOOLBAR_SHORTCUTS,
  isMacPlatform = isMac,
): string {
  return formatShortcut(TOOLBAR_SHORTCUTS[action], isMacPlatform);
}
