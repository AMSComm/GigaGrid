use crate::index::CsvIndex;
use crate::overlay::Overlay;
use std::fs::File;
use std::io::{Read, Seek};

/// Scan forward cell-by-cell starting AFTER `(from_row, from_col)` in
/// row-major order, wrapping around the whole file — returns the exact
/// `(row, col)` of the next match so the frontend can SELECT that cell, not
/// just scroll to its row. Falls back to re-checking `from_row`'s own
/// columns up to and including `from_col` (the one range the main wrap-
/// around loop never revisits, since it starts back at `from_row` only via
/// `offset == 0`, at `from_col + 1`) so a lone match keeps re-selecting
/// itself on repeated "next" instead of vanishing.
///
/// All coordinates are LOGICAL (post insert/delete row/col) — reads go
/// through `overlay.read_logical_row`, same as every other read path, so a
/// match inside an inserted row/column or an edited cell is found exactly
/// like one in untouched original data.
pub fn find_next(
    overlay: &Overlay,
    index: &CsvIndex,
    file: &mut File,
    query: &str,
    from_row: usize,
    from_col: usize,
) -> Option<(usize, usize)> {
    let row_count = overlay.row_count();
    if row_count == 0 || query.is_empty() {
        return None;
    }
    for offset in 0..row_count {
        let r = (from_row + offset) % row_count;
        if let Ok(row) = overlay.read_logical_row(index, file, r) {
            let start_col = if offset == 0 { from_col + 1 } else { 0 };
            for (c, cell) in row.iter().enumerate().skip(start_col) {
                if cell.contains(query) {
                    return Some((r, c));
                }
            }
        }
    }
    if let Ok(row) = overlay.read_logical_row(index, file, from_row) {
        for (c, cell) in row.iter().enumerate() {
            if c > from_col {
                break;
            }
            if cell.contains(query) {
                return Some((from_row, c));
            }
        }
    }
    None
}

/// Mirror of `find_next`, scanning backward from BEFORE `(from_row,
/// from_col)`.
pub fn find_prev(
    overlay: &Overlay,
    index: &CsvIndex,
    file: &mut File,
    query: &str,
    from_row: usize,
    from_col: usize,
) -> Option<(usize, usize)> {
    let row_count = overlay.row_count();
    if row_count == 0 || query.is_empty() {
        return None;
    }
    for offset in 0..row_count {
        let r = (from_row + row_count - offset) % row_count;
        if let Ok(row) = overlay.read_logical_row(index, file, r) {
            let upper = if offset == 0 { from_col } else { row.len() };
            for c in (0..upper.min(row.len())).rev() {
                if row[c].contains(query) {
                    return Some((r, c));
                }
            }
        }
    }
    if let Ok(row) = overlay.read_logical_row(index, file, from_row) {
        for c in (from_col..row.len()).rev() {
            if row[c].contains(query) {
                return Some((from_row, c));
            }
        }
    }
    None
}

/// Full scan counting every matching CELL (not row) across the whole
/// file — same order of cost as one `find_next` sweep, run once per query
/// change (debounced on the frontend), not on every fetch.
pub fn count_matches(overlay: &Overlay, index: &CsvIndex, file: &mut File, query: &str) -> usize {
    let row_count = overlay.row_count();
    if row_count == 0 || query.is_empty() {
        return 0;
    }
    let mut count = 0;
    for r in 0..row_count {
        if let Ok(row) = overlay.read_logical_row(index, file, r) {
            count += row.iter().filter(|cell| cell.contains(query)).count();
        }
    }
    count
}

/// Computes every cell edit needed to replace ALL occurrences of `query`
/// with `replacement` in every cell that contains it, across the WHOLE
/// file (logical coordinates). Doesn't mutate anything; the caller applies
/// the result via `Overlay::set_many` so the whole replace-all lands in
/// ONE undo group, same as a paste.
pub fn compute_replace_all(
    overlay: &Overlay,
    index: &CsvIndex,
    file: &mut File,
    query: &str,
    replacement: &str,
) -> Vec<(usize, usize, String)> {
    let mut edits = Vec::new();
    if query.is_empty() {
        return edits;
    }
    let row_count = overlay.row_count();
    for r in 0..row_count {
        if let Ok(row) = overlay.read_logical_row(index, file, r) {
            for (c, cell) in row.iter().enumerate() {
                if cell.contains(query) {
                    edits.push((r, c, cell.replace(query, replacement)));
                }
            }
        }
    }
    edits
}

/// Same replace, scoped to a single LOGICAL cell — used by "Replace" (as
/// opposed to "Replace All") on whatever cell the search cursor currently
/// sits on. Returns `None` if the cell doesn't actually contain `query`
/// (nothing to do) so the caller doesn't push a no-op undo entry.
pub fn compute_replace_cell(
    overlay: &Overlay,
    index: &CsvIndex,
    file: &mut File,
    row: usize,
    col: usize,
    query: &str,
    replacement: &str,
) -> Option<String> {
    if query.is_empty() {
        return None;
    }
    let current = overlay.read_logical_row(index, file, row).ok()?.get(col)?.clone();
    if !current.contains(query) {
        return None;
    }
    Some(current.replace(query, replacement))
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConditionType {
    None,
    IsEmpty,
    IsNotEmpty,
    TextContains,
    TextNotContains,
    TextStartsWith,
    TextEndsWith,
    TextExactly,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FilterCriterion {
    pub col: Option<usize>,
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub condition: Option<ConditionType>,
    #[serde(default)]
    pub condition_value: Option<String>,
    #[serde(default)]
    pub selected_values: Option<Vec<String>>,
}

impl FilterCriterion {
    pub fn is_active(&self) -> bool {
        if !self.query.trim().is_empty() {
            return true;
        }
        if let Some(ref cond) = self.condition {
            if *cond != ConditionType::None {
                return true;
            }
        }
        if self.selected_values.is_some() {
            return true;
        }
        false
    }
}

pub struct CompiledFilter<'a> {
    pub orig_col: Option<usize>,
    pub logical_col: Option<usize>,
    pub legacy_query_lower: Option<String>,
    pub condition: Option<ConditionType>,
    pub condition_val_raw: String,
    pub condition_val_lower: String,
    pub condition_val_num: Option<f64>,
    pub selected_values: Option<std::collections::HashSet<&'a str>>,
    pub has_blanks_selected: bool,
}

impl<'a> CompiledFilter<'a> {
    pub fn matches(&self, cell: &str) -> bool {
        // 1. Legacy query check (if present)
        if let Some(ref needle) = self.legacy_query_lower {
            if !cell.to_lowercase().contains(needle) {
                return false;
            }
        }

        // 2. Condition check
        if let Some(ref cond) = self.condition {
            let is_empty = cell.trim().is_empty();
            let passes = match cond {
                ConditionType::None => true,
                ConditionType::IsEmpty => is_empty,
                ConditionType::IsNotEmpty => !is_empty,
                ConditionType::TextContains => cell.to_lowercase().contains(&self.condition_val_lower),
                ConditionType::TextNotContains => !cell.to_lowercase().contains(&self.condition_val_lower),
                ConditionType::TextStartsWith => cell.to_lowercase().starts_with(&self.condition_val_lower),
                ConditionType::TextEndsWith => cell.to_lowercase().ends_with(&self.condition_val_lower),
                ConditionType::TextExactly => cell.eq_ignore_ascii_case(&self.condition_val_raw),
                ConditionType::GreaterThan => {
                    if let (Some(cn), Ok(cell_n)) = (self.condition_val_num, cell.trim().parse::<f64>()) {
                        cell_n > cn
                    } else {
                        cell > self.condition_val_raw.as_str()
                    }
                }
                ConditionType::GreaterThanOrEqual => {
                    if let (Some(cn), Ok(cell_n)) = (self.condition_val_num, cell.trim().parse::<f64>()) {
                        cell_n >= cn
                    } else {
                        cell >= self.condition_val_raw.as_str()
                    }
                }
                ConditionType::LessThan => {
                    if let (Some(cn), Ok(cell_n)) = (self.condition_val_num, cell.trim().parse::<f64>()) {
                        cell_n < cn
                    } else {
                        cell < self.condition_val_raw.as_str()
                    }
                }
                ConditionType::LessThanOrEqual => {
                    if let (Some(cn), Ok(cell_n)) = (self.condition_val_num, cell.trim().parse::<f64>()) {
                        cell_n <= cn
                    } else {
                        cell <= self.condition_val_raw.as_str()
                    }
                }
            };
            if !passes {
                return false;
            }
        }

        // 3. Selected values whitelist check
        if let Some(ref allowed_set) = self.selected_values {
            let is_empty = cell.trim().is_empty();
            let in_set = allowed_set.contains(cell) || (is_empty && self.has_blanks_selected);
            if !in_set {
                return false;
            }
        }

        true
    }
}

fn cmp_values(a: &str, b: &str) -> std::cmp::Ordering {
    if let (Ok(na), Ok(nb)) = (a.trim().parse::<f64>(), b.trim().parse::<f64>()) {
        na.partial_cmp(&nb).unwrap_or(std::cmp::Ordering::Equal)
    } else {
        a.cmp(b)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DistinctValuesResult {
    pub values: Vec<String>,
    pub total_sampled: usize,
    pub exceeded_limit: bool,
}

pub fn get_column_distinct_values_impl(
    overlay: &Overlay,
    index: &CsvIndex,
    file: &mut File,
    col: usize,
    limit: usize,
    freeze_header: bool,
) -> DistinctValuesResult {
    let row_count = overlay.row_count();
    let start_row = if freeze_header && row_count > 0 { 1 } else { 0 };
    let sample_limit = (start_row + 50_000).min(row_count);

    let mut distinct_set = std::collections::BTreeSet::new();
    let delimiter = index.delimiter();
    let encoding = index.encoding();
    let edited_keys = overlay.edited_row_keys();

    let mut reader_opt = file.try_clone().ok().map(|f| std::io::BufReader::with_capacity(2 * 1024 * 1024, f));
    let mut curr_pos: u64 = if start_row < row_count {
        index.row_span(start_row).map(|s| s.0).unwrap_or(0)
    } else {
        0
    };
    if let Some(ref mut reader) = reader_opt {
        let _ = reader.seek(std::io::SeekFrom::Start(curr_pos));
    }
    let mut buf = Vec::new();
    let mut sampled_count = 0;

    for r in start_row..sample_limit {
        sampled_count += 1;
        let row_key = overlay.get_row_source(r);
        let is_clean = match row_key {
            Some(crate::overlay::RowKey::Original(orig_r)) => {
                !edited_keys.contains(&crate::overlay::RowKey::Original(orig_r))
            }
            _ => false,
        };

        let val_opt = if is_clean {
            if let (Some(crate::overlay::RowKey::Original(orig_r)), Some(ref mut reader)) =
                (row_key, &mut reader_opt)
            {
                if let Some((start, end)) = index.row_span(orig_r) {
                    let len = (end - start) as usize;
                    if start != curr_pos {
                        let _ = reader.seek(std::io::SeekFrom::Start(start));
                    }
                    buf.resize(len, 0);
                    if reader.read_exact(&mut buf).is_ok() {
                        curr_pos = end;
                        let orig_col = overlay.logical_to_orig_col(col);
                        if let Some(oc) = orig_col {
                            extract_field_from_raw_line(&buf, delimiter, encoding, oc)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        let cell_val = match val_opt {
            Some(v) => v,
            None => {
                curr_pos = 0;
                overlay
                    .read_logical_row(index, file, r)
                    .ok()
                    .and_then(|row| row.get(col).cloned())
                    .unwrap_or_default()
            }
        };

        let display_val = if cell_val.trim().is_empty() {
            "(Blanks)".to_string()
        } else {
            cell_val
        };

        distinct_set.insert(display_val);
        if distinct_set.len() > limit {
            return DistinctValuesResult {
                values: Vec::new(),
                total_sampled: sampled_count,
                exceeded_limit: true,
            };
        }
    }

    DistinctValuesResult {
        values: distinct_set.into_iter().collect(),
        total_sampled: sampled_count,
        exceeded_limit: false,
    }
}

pub fn extract_field_from_raw_line(
    raw_bytes: &[u8],
    delimiter: u8,
    encoding: &'static encoding_rs::Encoding,
    target_col: usize,
) -> Option<String> {
    let mut line = raw_bytes;
    while matches!(line.last(), Some(b'\n') | Some(b'\r')) {
        line = &line[..line.len() - 1];
    }
    let mut curr_col = 0;
    let mut in_quotes = false;
    let mut field_start = 0;
    let mut i = 0;
    while i < line.len() {
        let b = line[i];
        if in_quotes {
            if b == b'"' {
                if i + 1 < line.len() && line[i + 1] == b'"' {
                    i += 2;
                    continue;
                }
                in_quotes = false;
            }
        } else if b == b'"' {
            in_quotes = true;
        } else if b == delimiter {
            if curr_col == target_col {
                return Some(decode_field_bytes(&line[field_start..i], encoding));
            }
            curr_col += 1;
            field_start = i + 1;
        }
        i += 1;
    }
    if curr_col == target_col {
        Some(decode_field_bytes(&line[field_start..], encoding))
    } else {
        None
    }
}

fn decode_field_bytes(field_bytes: &[u8], encoding: &'static encoding_rs::Encoding) -> String {
    let mut field = field_bytes;
    if field.starts_with(b"\"") && field.ends_with(b"\"") && field.len() >= 2 {
        field = &field[1..field.len() - 1];
    }
    let (decoded, _, _) = encoding.decode(field);
    if decoded.contains('"') {
        decoded.replace("\"\"", "\"")
    } else {
        decoded.into_owned()
    }
}

/// Returns LOGICAL row indices in the desired display order/subset — a
/// permutation (or filtered subset) of `0..overlay.row_count()`, never a
/// data copy. Reads go through `overlay.read_logical_row` (same as every
/// other path), so an edited cell, an inserted row, or an inserted column
/// is what gets sorted/filtered on, not stale/missing data.
pub fn sorted_filtered_view(
    overlay: &Overlay,
    index: &CsvIndex,
    file: &mut File,
    sort_col: Option<usize>,
    sort_desc: bool,
    filters: &[FilterCriterion],
    freeze_header: bool,
) -> Vec<usize> {
    let row_count = overlay.row_count();
    let active_criteria: Vec<&FilterCriterion> = filters.iter().filter(|f| f.is_active()).collect();

    let (start_row, mut rows) = if freeze_header && row_count > 0 {
        let mut r = Vec::with_capacity(row_count);
        r.push(0);
        (1, r)
    } else {
        (0, Vec::with_capacity(row_count))
    };

    if active_criteria.is_empty() {
        rows.extend(start_row..row_count);
    } else {
        let compiled_filters: Vec<CompiledFilter> = active_criteria
            .iter()
            .map(|f| {
                let orig_col = match f.col {
                    Some(lc) => overlay.logical_to_orig_col(lc),
                    None => None,
                };
                let legacy_query_lower = if !f.query.trim().is_empty() {
                    Some(f.query.to_lowercase())
                } else {
                    None
                };
                let raw_val = f.condition_value.as_deref().unwrap_or("").trim().to_string();
                let lower_val = raw_val.to_lowercase();
                let num_val = raw_val.parse::<f64>().ok();

                let mut has_blanks = false;
                let selected_set = f.selected_values.as_ref().map(|vals| {
                    let mut s = std::collections::HashSet::with_capacity(vals.len());
                    for v in vals {
                        if v == "(Blanks)" || v.is_empty() {
                            has_blanks = true;
                        }
                        s.insert(v.as_str());
                    }
                    s
                });

                CompiledFilter {
                    orig_col,
                    logical_col: f.col,
                    legacy_query_lower,
                    condition: f.condition.clone(),
                    condition_val_raw: raw_val,
                    condition_val_lower: lower_val,
                    condition_val_num: num_val,
                    selected_values: selected_set,
                    has_blanks_selected: has_blanks,
                }
            })
            .collect();

        let edited_keys = overlay.edited_row_keys();
        let delimiter = index.delimiter();
        let encoding = index.encoding();

        let mut reader_opt = file.try_clone().ok().map(|f| std::io::BufReader::with_capacity(2 * 1024 * 1024, f));
        let mut curr_pos: u64 = if start_row < row_count {
            index.row_span(start_row).map(|s| s.0).unwrap_or(0)
        } else {
            0
        };
        if let Some(ref mut reader) = reader_opt {
            let _ = reader.seek(std::io::SeekFrom::Start(curr_pos));
        }
        let mut buf = Vec::new();

        for r in start_row..row_count {
            let row_key = overlay.get_row_source(r);
            let is_clean = match row_key {
                Some(crate::overlay::RowKey::Original(orig_r)) => {
                    !edited_keys.contains(&crate::overlay::RowKey::Original(orig_r))
                }
                _ => false,
            };

            if is_clean {
                if let (Some(crate::overlay::RowKey::Original(orig_r)), Some(ref mut reader)) =
                    (row_key, &mut reader_opt)
                {
                    if let Some((start, end)) = index.row_span(orig_r) {
                        let len = (end - start) as usize;
                        if start != curr_pos {
                            let _ = reader.seek(std::io::SeekFrom::Start(start));
                        }
                        buf.resize(len, 0);
                        if reader.read_exact(&mut buf).is_ok() {
                            curr_pos = end;
                            let matches = compiled_filters.iter().all(|cf| {
                                raw_line_matches_compiled(&buf, delimiter, encoding, cf)
                            });
                            if matches {
                                rows.push(r);
                            }
                            continue;
                        }
                    }
                }
            }

            // Fallback for edited rows, newly inserted rows, or unbuffered read fallback
            curr_pos = 0;
            if let Ok(row) = overlay.read_logical_row(index, file, r) {
                let matches = compiled_filters.iter().all(|cf| {
                    match cf.logical_col {
                        Some(col_idx) => {
                            let cell = row.get(col_idx).map(|s| s.as_str()).unwrap_or("");
                            cf.matches(cell)
                        }
                        None => row.iter().any(|cell| cf.matches(cell)),
                    }
                });
                if matches {
                    rows.push(r);
                }
            }
        }
    }

    if let Some(col) = sort_col {
        let (header_slice, data_slice) = if freeze_header && !rows.is_empty() {
            (&rows[..1], &rows[1..])
        } else {
            (&[][..], &rows[..])
        };
        let mut keyed: Vec<(usize, String)> = data_slice
            .iter()
            .copied()
            .map(|r| {
                let value = overlay
                    .read_logical_row(index, file, r)
                    .ok()
                    .and_then(|row| row.get(col).cloned())
                    .unwrap_or_default();
                (r, value)
            })
            .collect();
        if sort_desc {
            keyed.sort_by(|a, b| cmp_values(&b.1, &a.1));
        } else {
            keyed.sort_by(|a, b| cmp_values(&a.1, &b.1));
        }
        let mut sorted_rows = Vec::with_capacity(rows.len());
        sorted_rows.extend_from_slice(header_slice);
        sorted_rows.extend(keyed.into_iter().map(|(r, _)| r));
        rows = sorted_rows;
    }

    rows
}

fn raw_line_matches_compiled(
    raw_bytes: &[u8],
    delimiter: u8,
    encoding: &'static encoding_rs::Encoding,
    filter: &CompiledFilter,
) -> bool {
    let mut line = raw_bytes;
    while matches!(line.last(), Some(b'\n') | Some(b'\r')) {
        line = &line[..line.len() - 1];
    }

    if let Some(target_col) = filter.orig_col {
        let mut curr_col = 0;
        let mut in_quotes = false;
        let mut field_start = 0;
        let mut i = 0;
        while i < line.len() {
            let b = line[i];
            if in_quotes {
                if b == b'"' {
                    if i + 1 < line.len() && line[i + 1] == b'"' {
                        i += 2;
                        continue;
                    }
                    in_quotes = false;
                }
            } else if b == b'"' {
                in_quotes = true;
            } else if b == delimiter {
                if curr_col == target_col {
                    let decoded = decode_field_bytes(&line[field_start..i], encoding);
                    return filter.matches(&decoded);
                }
                curr_col += 1;
                field_start = i + 1;
            }
            i += 1;
        }
        if curr_col == target_col {
            let decoded = decode_field_bytes(&line[field_start..], encoding);
            return filter.matches(&decoded);
        }
        filter.matches("")
    } else {
        let mut in_quotes = false;
        let mut field_start = 0;
        let mut i = 0;
        while i < line.len() {
            let b = line[i];
            if in_quotes {
                if b == b'"' {
                    if i + 1 < line.len() && line[i + 1] == b'"' {
                        i += 2;
                        continue;
                    }
                    in_quotes = false;
                }
            } else if b == b'"' {
                in_quotes = true;
            } else if b == delimiter {
                let decoded = decode_field_bytes(&line[field_start..i], encoding);
                if filter.matches(&decoded) {
                    return true;
                }
                field_start = i + 1;
            }
            i += 1;
        }
        let decoded = decode_field_bytes(&line[field_start..], encoding);
        filter.matches(&decoded)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_temp(name: &str, content: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("gigagrid_search_test_{}_{}.csv", name, std::process::id()));
        let mut f = File::create(&path).unwrap();
        f.write_all(content.as_bytes()).unwrap();
        path
    }

    fn overlay_for(row_count: usize, col_count: usize) -> Overlay {
        Overlay::new(row_count, col_count)
    }

    #[test]
    fn find_next_wraps_around() {
        let path = write_temp("find_next_wrap", "a,b\nc,needle\ne,f\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 2);
        // start search from the last row -> should wrap and find row 1, col 1
        assert_eq!(find_next(&overlay, &index, &mut file, "needle", 2, 0), Some((1, 1)));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn find_next_advances_within_the_same_row() {
        let path = write_temp("find_next_same_row", "needle,needle,x\na,b,c\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(2, 3);
        // anchored at (0,0) (the first match) -> next should be (0,1), the
        // SECOND match in the same row, not skip ahead to another row
        assert_eq!(find_next(&overlay, &index, &mut file, "needle", 0, 0), Some((0, 1)));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn find_next_lone_match_keeps_reselecting_itself() {
        let path = write_temp("find_next_lone", "a,needle\nc,d\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(2, 2);
        // anchored exactly ON the only match -> pressing "next" again wraps
        // all the way around and must land back on it, not return None
        assert_eq!(find_next(&overlay, &index, &mut file, "needle", 0, 1), Some((0, 1)));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn find_prev_wraps_around() {
        let path = write_temp("find_prev_wrap", "needle,b\nc,d\ne,f\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 2);
        // start search from row 0 backward -> should wrap and find row 0 itself
        assert_eq!(find_prev(&overlay, &index, &mut file, "needle", 0, 0), Some((0, 0)));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn no_match_returns_none() {
        let path = write_temp("no_match", "a,b\nc,d\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(2, 2);
        assert_eq!(find_next(&overlay, &index, &mut file, "zzz", 0, 0), None);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn find_next_sees_inserted_row() {
        let path = write_temp("find_next_inserted_row", "a,b\nc,d\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let mut overlay = overlay_for(2, 2);
        overlay.insert_row(1);
        overlay.set(1, 0, "needle".to_string());
        assert_eq!(find_next(&overlay, &index, &mut file, "needle", 0, 0), Some((1, 0)));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn count_matches_counts_every_matching_cell() {
        let path = write_temp("count_matches", "needle,x\nneedle,needle\ny,z\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 2);
        assert_eq!(count_matches(&overlay, &index, &mut file, "needle"), 3);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn count_matches_empty_query_is_zero() {
        let path = write_temp("count_matches_empty", "a,b\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(1, 2);
        assert_eq!(count_matches(&overlay, &index, &mut file, ""), 0);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn compute_replace_all_finds_every_matching_cell_across_the_file() {
        let path = write_temp("replace_all", "foo,x\nbarfoo,foobar\ny,z\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 2);
        let mut edits = compute_replace_all(&overlay, &index, &mut file, "foo", "QUX");
        edits.sort();
        assert_eq!(
            edits,
            vec![
                (0, 0, "QUX".to_string()),
                (1, 0, "barQUX".to_string()),
                (1, 1, "QUXbar".to_string()),
            ]
        );
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn compute_replace_all_reads_through_overlay_not_stale_raw_value() {
        let path = write_temp("replace_all_overlay", "raw,x\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let mut overlay = overlay_for(1, 2);
        overlay.set(0, 0, "editedfoo".to_string());
        let edits = compute_replace_all(&overlay, &index, &mut file, "foo", "bar");
        assert_eq!(edits, vec![(0, 0, "editedbar".to_string())]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn compute_replace_all_empty_query_replaces_nothing() {
        let path = write_temp("replace_all_empty", "a,b\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(1, 2);
        assert_eq!(compute_replace_all(&overlay, &index, &mut file, "", "x"), Vec::new());
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn compute_replace_cell_replaces_all_occurrences_within_that_one_cell() {
        let path = write_temp("replace_cell", "foofoo,other\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(1, 2);
        let result = compute_replace_cell(&overlay, &index, &mut file, 0, 0, "foo", "bar");
        assert_eq!(result, Some("barbar".to_string()));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn compute_replace_cell_none_when_cell_has_no_match() {
        let path = write_temp("replace_cell_none", "a,b\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(1, 2);
        assert_eq!(compute_replace_cell(&overlay, &index, &mut file, 0, 0, "zzz", "y"), None);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_sorts_by_column() {
        let path = write_temp("view_sort", "c,3\na,1\nb,2\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 2);
        // Ascending sort
        let view = sorted_filtered_view(&overlay, &index, &mut file, Some(0), false, &[], false);
        assert_eq!(view, vec![1, 2, 0]);

        // Descending sort
        let view_desc = sorted_filtered_view(&overlay, &index, &mut file, Some(0), true, &[], false);
        assert_eq!(view_desc, vec![0, 2, 1]);

        // With freeze_header: true, row 0 stays at index 0, data rows 1..2 sorted -> rows 0,1,2
        let view_frozen = sorted_filtered_view(&overlay, &index, &mut file, Some(0), false, &[], true);
        assert_eq!(view_frozen, vec![0, 1, 2]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_filters_subset() {
        let path = write_temp("view_filter", "apple,1\nbanana,2\navocado,3\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 2);
        let filters = vec![FilterCriterion {
            col: None,
            query: "av".to_string(),
            ..Default::default()
        }];
        // Unpinned: row 2 ("avocado") matches -> [2]
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filters, false);
        assert_eq!(view, vec![2]);

        // Pinned: row 0 ("apple") is pinned as header, row 2 ("avocado") matches -> [0, 2]
        let view_frozen = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filters, true);
        assert_eq!(view_frozen, vec![0, 2]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_filters_by_specific_column() {
        let path = write_temp("view_filter_col", "john,developer\njane,designer\nbob,developer\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 2);
        // Col 0 has names, Col 1 has roles. Filter Col 1 for "developer"
        let filters = vec![FilterCriterion {
            col: Some(1),
            query: "developer".to_string(),
            ..Default::default()
        }];
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filters, false);
        assert_eq!(view, vec![0, 2]);

        // With freeze_header: true, row 0 (john) is pinned as header, and data row 2 (bob) matches -> [0, 2]
        let view_frozen = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filters, true);
        assert_eq!(view_frozen, vec![0, 2]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_multi_criteria_and() {
        let path = write_temp("view_filter_multi", "alice,sales,east\nbob,sales,west\ncharlie,dev,east\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 3);
        // Role = sales AND Region = east -> only row 0 (alice)
        let filters = vec![
            FilterCriterion {
                col: Some(1),
                query: "sales".to_string(),
                ..Default::default()
            },
            FilterCriterion {
                col: Some(2),
                query: "east".to_string(),
                ..Default::default()
            },
        ];
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filters, false);
        assert_eq!(view, vec![0]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_case_insensitive() {
        let path = write_temp("view_filter_case", "Apple\nBANANA\ncherry\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 1);
        let filters = vec![FilterCriterion {
            col: None,
            query: "banana".to_string(),
            ..Default::default()
        }];
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filters, false);
        assert_eq!(view, vec![1]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_reads_through_overlay() {
        let path = write_temp("view_overlay", "z,1\ny,2\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let mut overlay = overlay_for(2, 2);
        overlay.set(0, 0, "a".to_string()); // row 0 was "z", now overlay says "a"
        let view = sorted_filtered_view(&overlay, &index, &mut file, Some(0), false, &[], false);
        // sorted by overlay-merged col 0: "a" (row 0), "y" (row 1) -> [0, 1]
        assert_eq!(view, vec![0, 1]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_condition_filters() {
        let path = write_temp("view_conditions", "id,score,status\n1,100,active\n2,45,pending\n3,80,\n4,25,active\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(5, 3);

        // Test IsEmpty condition on Col 2 (status): row 3 has empty status
        let filter_empty = vec![FilterCriterion {
            col: Some(2),
            condition: Some(ConditionType::IsEmpty),
            ..Default::default()
        }];
        let view_empty = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filter_empty, true);
        assert_eq!(view_empty, vec![0, 3]);

        // Test GreaterThan condition on Col 1 (score > 50): rows 1 (100) and 3 (80)
        let filter_gt = vec![FilterCriterion {
            col: Some(1),
            condition: Some(ConditionType::GreaterThan),
            condition_value: Some("50".to_string()),
            ..Default::default()
        }];
        let view_gt = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filter_gt, true);
        assert_eq!(view_gt, vec![0, 1, 3]);

        // Test TextStartsWith condition on Col 2 ("act"): rows 1 and 4
        let filter_sw = vec![FilterCriterion {
            col: Some(2),
            condition: Some(ConditionType::TextStartsWith),
            condition_value: Some("act".to_string()),
            ..Default::default()
        }];
        let view_sw = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filter_sw, true);
        assert_eq!(view_sw, vec![0, 1, 4]);

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_selected_values_filter() {
        let path = write_temp("view_values", "id,category\n1,Fruit\n2,Vegetable\n3,Meat\n4,Fruit\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(5, 2);

        // Select only Fruit and Meat
        let filter_vals = vec![FilterCriterion {
            col: Some(1),
            selected_values: Some(vec!["Fruit".to_string(), "Meat".to_string()]),
            ..Default::default()
        }];
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filter_vals, true);
        assert_eq!(view, vec![0, 1, 3, 4]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn get_column_distinct_values_extracts_correct_set_and_honors_limit() {
        let path = write_temp("distinct_test", "Header\nA\nB\nA\nC\nB\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(6, 1);

        // Limit 5: should return ["A", "B", "C"]
        let res = get_column_distinct_values_impl(&overlay, &index, &mut file, 0, 5, true);
        assert!(!res.exceeded_limit);
        assert_eq!(res.values, vec!["A".to_string(), "B".to_string(), "C".to_string()]);

        // Limit 2: exceeds limit because unique count is 3
        let res_exceeded = get_column_distinct_values_impl(&overlay, &index, &mut file, 0, 2, true);
        assert!(res_exceeded.exceeded_limit);
        assert!(res_exceeded.values.is_empty());

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn test_fuseichousa_filtered_view() {
        let path = std::path::PathBuf::from("/Users/huy/Downloads/fuseichousa_journal_monthly.csv");
        if !path.exists() {
            return;
        }
        let index = crate::index::CsvIndex::build_with_options(&path, None, None).unwrap();
        let mut file = std::fs::File::open(&path).unwrap();
        let overlay = overlay_for(index.row_count(), 7);
        let filters = vec![FilterCriterion {
            col: Some(6),
            query: "取引中止".to_string(),
            ..Default::default()
        }];
        let view_unpinned = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filters, false);
        assert_eq!(view_unpinned.len(), 56019);

        let view_pinned = sorted_filtered_view(&overlay, &index, &mut file, None, false, &filters, true);
        assert_eq!(view_pinned.len(), 56020);
        assert_eq!(view_pinned[0], 0);
    }
}
