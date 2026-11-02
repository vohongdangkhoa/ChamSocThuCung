"""Read-only structural and traceability check of the delivered workbook."""
import json
import re
import zipfile
from pathlib import Path
import openpyxl

root = Path(r"C:\Users\vohon\petnova_app")
book_path = root / "outputs/01a0c27b-f522-7c62-8cec-50db5c0bf907/Nhom09_IntergrationTC_hoan_chinh.xlsx"
index = json.loads((root / ".codex_tmp/testcase_completion/integration_source_index.json").read_text(encoding="utf-8"))
known = index["functional_cases"]
wf = openpyxl.load_workbook(book_path, read_only=False, data_only=False)
wv = openpyxl.load_workbook(book_path, read_only=True, data_only=True)
assert wf.sheetnames == ["Cover Page", "Test Requirements", "Integration Test Cases", "Sheet4"]
tc = wf["Integration Test Cases"]
req = wf["Test Requirements"]
assert [tc.cell(2, c).value for c in range(1, 14)] == [
    "No.", "Test Requirement ID", "Test Case ID", "Test Objective", "Pre-conditions",
    "Step #", "Step Action", "Test Data", "Expected Result", "Notes",
    "Result", "By tester", "Note",
]
starts = [r for r in range(3, tc.max_row + 1) if re.fullmatch(r"FI_\d{2}", str(tc.cell(r, 3).value or ""))]
assert len(starts) == 69 and tc.max_row == 209
assert len(set(tc.cell(r, 2).value for r in starts)) == 69
modules = set()
for i, row in enumerate(starts, 1):
    chain = tc.cell(row, 2).value
    links = chain.split("-")
    assert len(links) >= 2 and all(x in known for x in links), (i, chain)
    modules.update(int(re.match(r"F(\d+)", x).group(1)) for x in links)
    assert tc.cell(row, 3).value == f"FI_{i:02d}"
    assert tc.cell(row, 1).value == i
    assert tc.cell(row, 4).value and tc.cell(row, 5).value
    assert tc.cell(row, 11).value == "Not Executed"
    assert tc.cell(row, 12).value is None and tc.cell(row, 13).value is None
    assert "Nguồn Functional:" in tc.cell(row, 10).value
    for step in range(3):
        rr = row + step
        assert tc.cell(rr, 6).value == step + 1
        assert tc.cell(rr, 7).value and tc.cell(rr, 9).value
    rreq = i + 8
    assert req.cell(rreq, 2).value == chain
    assert wv["Test Requirements"].cell(rreq, 5).value == 1
    assert req.cell(rreq, 3).value == tc.cell(row, 4).value
    for link in links:
        loc = f"{known[link]['sheet']}!C{known[link]['row']}"
        assert loc in req.cell(rreq, 6).value and loc in tc.cell(row, 10).value
assert modules == set(range(1, 13))
assert wv["Test Requirements"]["E79"].value == 69
assert len([m for m in tc.merged_cells.ranges if m.min_col == m.max_col == 11 and m.min_row >= 3]) == 69
assert not wf._external_links
content = " ".join(str(c.value or "") for sh in wf.worksheets for rows in sh for c in rows)
for unrelated in ["Quản lý bán hàng online", "Nhớ điền + đánh giá thành viên", "Portal Huflit", "CTDT_CNTT_2026"]:
    assert unrelated not in content
with zipfile.ZipFile(book_path) as z:
    assert z.testzip() is None
print(f"PASS: {len(starts)} integration cases, 207 steps, F1–F12 represented, 69 source chains valid, 69 Not Executed statuses, 4 sheets, {book_path.stat().st_size} bytes")
