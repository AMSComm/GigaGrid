import { describe, expect, it } from "vitest";
import { formatShortcut, getToolbarShortcutLabel, TOOLBAR_SHORTCUTS } from "./shortcuts";

describe("shortcuts utility", () => {
  it("formats macOS shortcuts using standard Apple symbols in HIG order", () => {
    // macOS: Alt ⌥, Shift ⇧, Command ⌘
    expect(formatShortcut({ key: "O", mod: true }, true)).toBe("⌘O");
    expect(formatShortcut({ key: "S", mod: true }, true)).toBe("⌘S");
    expect(formatShortcut({ key: "F", mod: true }, true)).toBe("⌘F");
    expect(formatShortcut({ key: "F", mod: true, shift: true }, true)).toBe("⇧⌘F");
    expect(formatShortcut({ key: "L", mod: true }, true)).toBe("⌘L");
    expect(formatShortcut({ key: "O", mod: true, shift: true }, true)).toBe("⇧⌘O");
    expect(formatShortcut({ key: "G", mod: true, alt: true }, true)).toBe("⌥⌘G");
    expect(formatShortcut({ key: "H", mod: true, shift: true }, true)).toBe("⇧⌘H");
    expect(formatShortcut({ key: "T", mod: true, shift: true }, true)).toBe("⇧⌘T");
    expect(formatShortcut({ key: "U", mod: true, shift: true }, true)).toBe("⇧⌘U");
  });

  it("formats Windows/Linux shortcuts using standard Ctrl+Shift+Key style", () => {
    expect(formatShortcut({ key: "O", mod: true }, false)).toBe("Ctrl+O");
    expect(formatShortcut({ key: "S", mod: true }, false)).toBe("Ctrl+S");
    expect(formatShortcut({ key: "F", mod: true }, false)).toBe("Ctrl+F");
    expect(formatShortcut({ key: "F", mod: true, shift: true }, false)).toBe("Ctrl+Shift+F");
    expect(formatShortcut({ key: "L", mod: true }, false)).toBe("Ctrl+L");
    expect(formatShortcut({ key: "O", mod: true, shift: true }, false)).toBe("Ctrl+Shift+O");
    expect(formatShortcut({ key: "G", mod: true, alt: true }, false)).toBe("Ctrl+Alt+G");
    expect(formatShortcut({ key: "H", mod: true, shift: true }, false)).toBe("Ctrl+Shift+H");
    expect(formatShortcut({ key: "T", mod: true, shift: true }, false)).toBe("Ctrl+Shift+T");
    expect(formatShortcut({ key: "U", mod: true, shift: true }, false)).toBe("Ctrl+Shift+U");
  });

  it("provides valid toolbar shortcut labels for all registered actions", () => {
    const actions = Object.keys(TOOLBAR_SHORTCUTS) as Array<keyof typeof TOOLBAR_SHORTCUTS>;
    expect(actions.length).toBe(10);

    for (const action of actions) {
      const macLabel = getToolbarShortcutLabel(action, true);
      const winLabel = getToolbarShortcutLabel(action, false);

      expect(macLabel).toBeTruthy();
      expect(winLabel).toBeTruthy();
      expect(winLabel).toContain("+");
    }
  });
});
