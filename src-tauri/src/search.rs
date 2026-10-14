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
pub struct FilterCriterion {
    pub col: Option<usize>,
    pub query: String,
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
    filters: &[FilterCriterion],
    freeze_header: bool,
) -> Vec<usize> {
    let row_count = overlay.row_count();
    let active_filters: Vec<(&FilterCriterion, String)> = filters
        .iter()
        .filter(|f| !f.query.trim().is_empty())
        .map(|f| (f, f.query.to_lowercase()))
        .collect();

    let (start_row, mut rows) = if freeze_header && row_count > 0 {
        let mut r = Vec::with_capacity(row_count);
        r.push(0);
        (1, r)
    } else {
        (0, Vec::with_capacity(row_count))
    };

    if active_filters.is_empty() {
        rows.extend(start_row..row_count);
    } else {
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
                            let matches = active_filters.iter().all(|(criterion, needle_lower)| {
                                let orig_col = match criterion.col {
                                    Some(lc) => match overlay.logical_to_orig_col(lc) {
                                        Some(c) => Some(c),
                                        None => return false,
                                    },
                                    None => None,
                                };
                                raw_line_matches(&buf, delimiter, encoding, orig_col, needle_lower)
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
                let matches = active_filters.iter().all(|(criterion, needle_lower)| {
                    match criterion.col {
                        Some(col_idx) => row
                            .get(col_idx)
                            .map(|cell| cell.to_lowercase().contains(needle_lower))
                            .unwrap_or(false),
                        None => row
                            .iter()
                            .any(|cell| cell.to_lowercase().contains(needle_lower)),
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
        keyed.sort_by(|a, b| a.1.cmp(&b.1));
        let mut sorted_rows = Vec::with_capacity(rows.len());
        sorted_rows.extend_from_slice(header_slice);
        sorted_rows.extend(keyed.into_iter().map(|(r, _)| r));
        rows = sorted_rows;
    }

    rows
}

fn raw_line_matches(
    raw_bytes: &[u8],
    delimiter: u8,
    encoding: &'static encoding_rs::Encoding,
    orig_col: Option<usize>,
    needle_lower: &str,
) -> bool {
    let mut line = raw_bytes;
    while matches!(line.last(), Some(b'\n') | Some(b'\r')) {
        line = &line[..line.len() - 1];
    }

    if let Some(target_col) = orig_col {
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
                    return field_matches(&line[field_start..i], encoding, needle_lower);
                }
                curr_col += 1;
                field_start = i + 1;
            }
            i += 1;
        }
        if curr_col == target_col {
            return field_matches(&line[field_start..], encoding, needle_lower);
        }
        false
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
                if field_matches(&line[field_start..i], encoding, needle_lower) {
                    return true;
                }
                field_start = i + 1;
            }
            i += 1;
        }
        field_matches(&line[field_start..], encoding, needle_lower)
    }
}

fn field_matches(
    field_bytes: &[u8],
    encoding: &'static encoding_rs::Encoding,
    needle_lower: &str,
) -> bool {
    let mut field = field_bytes;
    if field.starts_with(b"\"") && field.ends_with(b"\"") && field.len() >= 2 {
        field = &field[1..field.len() - 1];
    }
    let (decoded, _, _) = encoding.decode(field);
    if decoded.contains('"') {
        decoded.replace("\"\"", "\"").to_lowercase().contains(needle_lower)
    } else {
        decoded.to_lowercase().contains(needle_lower)
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
        // With freeze_header: false, all rows sorted: 0="c,3", 1="a,1", 2="b,2" -> a,b,c -> rows 1,2,0
        let view = sorted_filtered_view(&overlay, &index, &mut file, Some(0), &[], false);
        assert_eq!(view, vec![1, 2, 0]);

        // With freeze_header: true, row 0 stays at index 0, data rows 1..2 sorted -> rows 0,1,2
        let view_frozen = sorted_filtered_view(&overlay, &index, &mut file, Some(0), &[], true);
        assert_eq!(view_frozen, vec![0, 1, 2]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_filters_subset() {
        let path = write_temp("view_filter", "apple,1\nbanana,2\navocado,3\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 2);
        let filters = vec![FilterCriterion { col: None, query: "av".to_string() }];
        // Unpinned: row 2 ("avocado") matches -> [2]
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, &filters, false);
        assert_eq!(view, vec![2]);

        // Pinned: row 0 ("apple") is pinned as header, row 2 ("avocado") matches -> [0, 2]
        let view_frozen = sorted_filtered_view(&overlay, &index, &mut file, None, &filters, true);
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
        let filters = vec![FilterCriterion { col: Some(1), query: "developer".to_string() }];
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, &filters, false);
        assert_eq!(view, vec![0, 2]);

        // With freeze_header: true, row 0 (john) is pinned as header, and data row 2 (bob) matches -> [0, 2]
        let view_frozen = sorted_filtered_view(&overlay, &index, &mut file, None, &filters, true);
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
            FilterCriterion { col: Some(1), query: "sales".to_string() },
            FilterCriterion { col: Some(2), query: "east".to_string() },
        ];
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, &filters, false);
        assert_eq!(view, vec![0]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn sorted_filtered_view_case_insensitive() {
        let path = write_temp("view_filter_case", "Apple\nBANANA\ncherry\n");
        let index = CsvIndex::build(&path).unwrap();
        let mut file = File::open(&path).unwrap();
        let overlay = overlay_for(3, 1);
        let filters = vec![FilterCriterion { col: None, query: "banana".to_string() }];
        let view = sorted_filtered_view(&overlay, &index, &mut file, None, &filters, false);
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
        let view = sorted_filtered_view(&overlay, &index, &mut file, Some(0), &[], false);
        // sorted by overlay-merged col 0: "a" (row 0), "y" (row 1) -> [0, 1]
        assert_eq!(view, vec![0, 1]);
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
        }];
        let view_unpinned = sorted_filtered_view(&overlay, &index, &mut file, None, &filters, false);
        assert_eq!(view_unpinned.len(), 56019);

        let view_pinned = sorted_filtered_view(&overlay, &index, &mut file, None, &filters, true);
        assert_eq!(view_pinned.len(), 56020);
        assert_eq!(view_pinned[0], 0);
    }
}
