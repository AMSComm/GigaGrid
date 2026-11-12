export interface FilterRule {
  id: number;
  col: number | null; // null = All Columns, or 0-based column index
  query: string;
  enabled: boolean;
}

export interface FilterCriterion {
  col: number | null;
  query: string;
}

export function createDefaultFilterRules(): FilterRule[] {
  return [{ id: 1, col: null, query: "", enabled: true }];
}

export function extractActiveCriteria(rules: FilterRule[]): FilterCriterion[] {
  return rules
    .filter((r) => r.enabled && r.query.trim().length > 0)
    .map((r) => ({ col: r.col, query: r.query.trim() }));
}

export function countAppliedFilters(rules: FilterRule[]): number {
  return extractActiveCriteria(rules).length;
}

export function updateFilterRule(
  rules: FilterRule[],
  id: number,
  patch: Partial<FilterRule>,
): FilterRule[] {
  return rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

export function addFilterRule(rules: FilterRule[]): FilterRule[] {
  const maxId = rules.reduce((max, r) => Math.max(max, r.id), 0);
  return [...rules, { id: maxId + 1, col: null, query: "", enabled: true }];
}

export function removeFilterRule(rules: FilterRule[], id: number): FilterRule[] {
  const remaining = rules.filter((r) => r.id !== id);
  return remaining.length > 0 ? remaining : createDefaultFilterRules();
}

export type ConditionType =
  | "none"
  | "isEmpty"
  | "isNotEmpty"
  | "textContains"
  | "textNotContains"
  | "textStartsWith"
  | "textEndsWith"
  | "textExactly"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual";

export interface ColumnFilter {
  col: number;
  condition?: ConditionType;
  conditionValue?: string;
  selectedValues?: string[]; // undefined = all selected, string[] = allowed values
}

export interface DistinctValuesResult {
  values: string[];
  totalSampled: number;
  exceededLimit: boolean;
}

export const CONDITION_OPTIONS: { value: ConditionType; label: string; requiresValue: boolean }[] = [
  { value: "none", label: "None", requiresValue: false },
  { value: "isEmpty", label: "Is empty", requiresValue: false },
  { value: "isNotEmpty", label: "Is not empty", requiresValue: false },
  { value: "textContains", label: "Text contains", requiresValue: true },
  { value: "textNotContains", label: "Text does not contain", requiresValue: true },
  { value: "textStartsWith", label: "Text starts with", requiresValue: true },
  { value: "textEndsWith", label: "Text ends with", requiresValue: true },
  { value: "textExactly", label: "Text is exactly", requiresValue: true },
  { value: "greaterThan", label: "Greater than (>)", requiresValue: true },
  { value: "greaterThanOrEqual", label: "Greater than or equal (>=)", requiresValue: true },
  { value: "lessThan", label: "Less than (<)", requiresValue: true },
  { value: "lessThanOrEqual", label: "Less than or equal (<=)", requiresValue: true },
];

export function isColumnFilterActive(filter?: ColumnFilter): boolean {
  if (!filter) return false;
  if (filter.condition && filter.condition !== "none") {
    return true;
  }
  if (filter.selectedValues !== undefined) {
    return true;
  }
  return false;
}

export function countActiveColumnFilters(filters: Record<number, ColumnFilter> | ColumnFilter[]): number {
  if (Array.isArray(filters)) {
    return filters.filter(isColumnFilterActive).length;
  }
  return Object.values(filters).filter(isColumnFilterActive).length;
}

export function toBackendCriteria(filters: Record<number, ColumnFilter>): any[] {
  return Object.values(filters)
    .filter(isColumnFilterActive)
    .map((f) => ({
      col: f.col,
      condition: f.condition && f.condition !== "none" ? f.condition : undefined,
      conditionValue: f.conditionValue ? f.conditionValue.trim() : undefined,
      selectedValues: f.selectedValues,
    }));
}
