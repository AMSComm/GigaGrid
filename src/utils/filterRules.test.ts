import { describe, expect, it } from "vitest";
import {
  addFilterRule,
  countActiveColumnFilters,
  countAppliedFilters,
  createDefaultFilterRules,
  extractActiveCriteria,
  isColumnFilterActive,
  removeFilterRule,
  toBackendCriteria,
  updateFilterRule,
  type ColumnFilter,
  type FilterRule,
} from "./filterRules";

describe("filterRules utilities", () => {
  describe("createDefaultFilterRules", () => {
    it("returns an array with a single initial default rule", () => {
      // Act
      const rules = createDefaultFilterRules();

      // Assert
      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        id: 1,
        col: null,
        query: "",
        enabled: true,
      });
    });
  });

  describe("extractActiveCriteria", () => {
    it("returns active criteria only for enabled rules with non-empty query", () => {
      // Arrange
      const rules: FilterRule[] = [
        { id: 1, col: null, query: "alice", enabled: true },
        { id: 2, col: 3, query: "  ", enabled: true }, // whitespace only -> ignored
        { id: 3, col: 0, query: "bob", enabled: false }, // disabled -> ignored
        { id: 4, col: 2, query: "  charlie  ", enabled: true }, // trimmed
      ];

      // Act
      const criteria = extractActiveCriteria(rules);

      // Assert
      expect(criteria).toEqual([
        { col: null, query: "alice" },
        { col: 2, query: "charlie" },
      ]);
    });

    it("returns empty array when all rules are blank or disabled", () => {
      // Arrange
      const rules: FilterRule[] = [
        { id: 1, col: null, query: "", enabled: true },
        { id: 2, col: 1, query: "inactive", enabled: false },
      ];

      // Act
      const criteria = extractActiveCriteria(rules);

      // Assert
      expect(criteria).toEqual([]);
    });
  });

  describe("countAppliedFilters", () => {
    it("counts valid active criteria correctly", () => {
      // Arrange
      const rules: FilterRule[] = [
        { id: 1, col: null, query: "apple", enabled: true },
        { id: 2, col: 1, query: "banana", enabled: true },
        { id: 3, col: 2, query: "", enabled: true },
      ];

      // Act & Assert
      expect(countAppliedFilters(rules)).toBe(2);
    });
  });

  describe("updateFilterRule", () => {
    it("immutably updates the matching rule without mutating original array", () => {
      // Arrange
      const initial: FilterRule[] = [
        { id: 1, col: null, query: "old", enabled: true },
        { id: 2, col: 1, query: "keep", enabled: true },
      ];

      // Act
      const updated = updateFilterRule(initial, 1, { query: "new", col: 0 });

      // Assert
      expect(updated).not.toBe(initial);
      expect(updated[0]).toEqual({ id: 1, col: 0, query: "new", enabled: true });
      expect(updated[1]).toEqual(initial[1]);
      expect(initial[0].query).toBe("old"); // original untouched
    });
  });

  describe("addFilterRule", () => {
    it("appends a new rule with id incremented from highest existing id", () => {
      // Arrange
      const rules: FilterRule[] = [
        { id: 1, col: null, query: "first", enabled: true },
        { id: 5, col: 2, query: "second", enabled: true },
      ];

      // Act
      const result = addFilterRule(rules);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[2]).toEqual({
        id: 6,
        col: null,
        query: "",
        enabled: true,
      });
    });

    it("creates rule with id 1 when adding to an empty array", () => {
      // Act
      const result = addFilterRule([]);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe("removeFilterRule", () => {
    it("removes specified rule by id", () => {
      // Arrange
      const rules: FilterRule[] = [
        { id: 1, col: null, query: "a", enabled: true },
        { id: 2, col: 1, query: "b", enabled: true },
      ];

      // Act
      const result = removeFilterRule(rules, 1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("falls back to default rule when the last remaining rule is removed", () => {
      // Arrange
      const rules: FilterRule[] = [{ id: 5, col: 2, query: "last", enabled: false }];

      // Act
      const result = removeFilterRule(rules, 5);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        col: null,
        query: "",
        enabled: true,
      });
    });
  });

  describe("tab filter state preservation across tabs", () => {
    it("preserves independent filter rules and applied count for multiple tabs", () => {
      // Arrange: Two tabs opened with default filters
      interface MockTab {
        id: number;
        filterRules: FilterRule[];
        appliedFilterCount: number;
        filterActive: boolean;
      }

      let tabs: MockTab[] = [
        {
          id: 1,
          filterRules: createDefaultFilterRules(),
          appliedFilterCount: 0,
          filterActive: false,
        },
        {
          id: 2,
          filterRules: createDefaultFilterRules(),
          appliedFilterCount: 0,
          filterActive: false,
        },
      ];

      // Act 1: User applies a filter on Tab 1
      const tab1Rules: FilterRule[] = [
        { id: 1, col: 0, query: "admin", enabled: true },
        { id: 2, col: 1, query: "active", enabled: true },
      ];
      tabs = tabs.map((t) =>
        t.id === 1
          ? {
              ...t,
              filterRules: tab1Rules,
              appliedFilterCount: countAppliedFilters(tab1Rules),
              filterActive: true,
            }
          : t,
      );

      // Act 2: Switch to Tab 2 and apply different filter
      const tab2Rules: FilterRule[] = [{ id: 1, col: 2, query: "guest", enabled: true }];
      tabs = tabs.map((t) =>
        t.id === 2
          ? {
              ...t,
              filterRules: tab2Rules,
              appliedFilterCount: countAppliedFilters(tab2Rules),
              filterActive: true,
            }
          : t,
      );

      // Assert: Both tabs retain their independent filter configurations
      const tab1 = tabs.find((t) => t.id === 1)!;
      const tab2 = tabs.find((t) => t.id === 2)!;

      expect(tab1.filterActive).toBe(true);
      expect(tab1.appliedFilterCount).toBe(2);
      expect(extractActiveCriteria(tab1.filterRules)).toEqual([
        { col: 0, query: "admin" },
        { col: 1, query: "active" },
      ]);

      expect(tab2.filterActive).toBe(true);
      expect(tab2.appliedFilterCount).toBe(1);
      expect(extractActiveCriteria(tab2.filterRules)).toEqual([{ col: 2, query: "guest" }]);
    });

    it("allows re-applying filter on Tab 1 without criteria loss after switching tabs", () => {
      // Arrange: Tab 1 has an active filter
      const tab1Rules: FilterRule[] = [{ id: 1, col: 0, query: "finance", enabled: true }];
      const tab1 = {
        id: 1,
        filterRules: tab1Rules,
        appliedFilterCount: 1,
        filterActive: true,
      };

      // Act: Extract active criteria for reapply (e.g. after editing a cell in filtered view)
      const criteriaForReapply = extractActiveCriteria(tab1.filterRules);

      // Assert: Reapply sends the valid saved criteria, not empty filters
      expect(criteriaForReapply).toEqual([{ col: 0, query: "finance" }]);
      expect(criteriaForReapply.length).toBeGreaterThan(0);
    });
  });

  describe("ColumnFilter utilities", () => {
    it("isColumnFilterActive detects active condition or selectedValues", () => {
      expect(isColumnFilterActive(undefined)).toBe(false);
      expect(isColumnFilterActive({ col: 0, condition: "none" })).toBe(false);
      expect(isColumnFilterActive({ col: 0, condition: "textContains", conditionValue: "test" })).toBe(true);
      expect(isColumnFilterActive({ col: 0, condition: "isEmpty" })).toBe(true);
      expect(isColumnFilterActive({ col: 0, selectedValues: ["A", "B"] })).toBe(true);
      expect(isColumnFilterActive({ col: 0, selectedValues: [] })).toBe(true);
    });

    it("countActiveColumnFilters counts active filters across columns correctly", () => {
      const filters: Record<number, ColumnFilter> = {
        0: { col: 0, condition: "textContains", conditionValue: "hello" },
        1: { col: 1, condition: "none" },
        2: { col: 2, selectedValues: ["val1"] },
      };
      expect(countActiveColumnFilters(filters)).toBe(2);
    });

    it("toBackendCriteria formats filters correctly for Rust IPC", () => {
      const filters: Record<number, ColumnFilter> = {
        0: { col: 0, condition: "textStartsWith", conditionValue: " abc " },
        1: { col: 1, condition: "none" },
        2: { col: 2, selectedValues: ["Active", "(Blanks)"] },
      };
      const criteria = toBackendCriteria(filters);
      expect(criteria).toEqual([
        {
          col: 0,
          condition: "textStartsWith",
          conditionValue: "abc",
          selectedValues: undefined,
        },
        {
          col: 2,
          condition: undefined,
          conditionValue: undefined,
          selectedValues: ["Active", "(Blanks)"],
        },
      ]);
    });

    it("preserves independent columnFilters per tab when switching tabs", () => {
      interface MockTab {
        id: number;
        columnFilters: Record<number, ColumnFilter>;
        filterActive: boolean;
      }

      let tabs: MockTab[] = [
        { id: 1, columnFilters: {}, filterActive: false },
        { id: 2, columnFilters: {}, filterActive: false },
      ];

      // Tab 1 sets column filter on col 0 and col 1
      tabs = tabs.map((t) =>
        t.id === 1
          ? {
              ...t,
              columnFilters: {
                0: { col: 0, condition: "textStartsWith", conditionValue: "A" },
                1: { col: 1, selectedValues: ["Active", "Pending"] },
              },
              filterActive: true,
            }
          : t,
      );

      // Tab 2 sets filter on col 3
      tabs = tabs.map((t) =>
        t.id === 2
          ? {
              ...t,
              columnFilters: {
                3: { col: 3, condition: "greaterThan", conditionValue: "100" },
              },
              filterActive: true,
            }
          : t,
      );

      // Verify Tab 1 preserved its exact filters
      const tab1 = tabs.find((t) => t.id === 1)!;
      expect(countActiveColumnFilters(tab1.columnFilters)).toBe(2);
      expect(tab1.columnFilters[0].conditionValue).toBe("A");
      expect(tab1.columnFilters[1].selectedValues).toEqual(["Active", "Pending"]);

      // Verify Tab 2 preserved its exact filters
      const tab2 = tabs.find((t) => t.id === 2)!;
      expect(countActiveColumnFilters(tab2.columnFilters)).toBe(1);
      expect(tab2.columnFilters[3].condition).toBe("greaterThan");
    });
  });
});
