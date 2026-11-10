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
