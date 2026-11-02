"""Read-only preservation and consistency checks for the edited workbook."""
from collections import Counter
from pathlib import Path
import json
import openpyxl

root = Path(r"C:\Users\vohon\petnova_app")
source = Path(r"D:\Hk1 năm 3\LT_KDCLPM\Nhóm09\Nhóm09FullnewsPetNoVa.xlsx")
output = root / "outputs" / "01a0c27b-f522-7c62-8cec-50db5c0bf907" / "Nhom09FullnewsPetNoVa_hoan_chinh.xlsx"
index = json.loads((root / ".codex_tmp" / "testcase_completion" / "fullnews_index.json").read_text(encoding="utf-8"))
a = openpyxl.load_workbook(source, data_only=False)
b = openpyxl.load_workbook(output, data_only=False)
assert b.sheetnames == a.sheetnames, (a.sheetnames, b.sheetnames)
assert sum(len(s._images) for s in a.worksheets) == sum(len(s._images) for s in b.worksheets) == 13
assert len(b._external_links) == len(a._external_links)

changes = Counter()
unexpected = []
for old, new in zip(a.worksheets, b.worksheets):
    assert old.max_row == new.max_row and old.max_column == new.max_column, old.title
    assert len(old._images) == len(new._images), old.title
    assert old.freeze_panes == new.freeze_panes, old.title
    expected_removed_merges = set(index["sheets"].get(old.title, {}).get("badMerges", []))
    old_merges = {str(m) for m in old.merged_cells.ranges}
    new_merges = {str(m) for m in new.merged_cells.ranges}
    assert new_merges == old_merges - expected_removed_merges, (old.title, old_merges ^ new_merges)
    for row in old:
        for old_cell in row:
            coord = old_cell.coordinate
            new_cell = new[coord]
            if old_cell.value != new_cell.value:
                if old.title == "Sheet1" and coord in {"B2", "E7", "D16", "C7"}:
                    category = "cover"
                elif old.title == "Test Requirements" and old_cell.column in (8, 9) and 4 <= old_cell.row <= 83:
                    category = "requirements"
                elif old.title == "Test Requirements" and coord == "J7":
                    category = "source note"
                elif old.title.startswith("Testcase_F"):
                    number = int(old.title.split("F")[1])
                    info = index["sheets"][old.title]
                    if number <= 4 and old_cell.column == 10 and old_cell.row in {c["start"] for c in info["cases"]}:
                        category = "execution note"
                    elif number <= 4 and old_cell.column in (11, 12, 13) and old_cell.row in info["nonStepResults"]:
                        category = "header placeholder"
                    elif number >= 5 and old_cell.column in (11, 12, 13) and info["firstCase"] <= old_cell.row <= info["maxRow"]:
                        category = "unexecuted step"
                    else:
                        category = "unexpected"
                else:
                    category = "unexpected"
                changes[category] += 1
                if category == "unexpected":
                    unexpected.append((old.title, coord, str(old_cell.value)[:80], str(new_cell.value)[:80]))
    if old.title.startswith("Testcase_F"):
        number = int(old.title.split("F")[1])
        info = index["sheets"][old.title]
        for case in info["cases"]:
            for step in case["steps"]:
                assert all(old.cell(step, col).value == new.cell(step, col).value for col in (11, 12, 13)) if number <= 4 else new.cell(step, 11).value == "Not Executed"
                if number >= 5:
                    assert new.cell(step, 12).value is None and new.cell(step, 13).value is None
        if number >= 5:
            assert all(new.cell(row, 11).value not in ("Passed", "Failed") for row in range(info["firstCase"], info["maxRow"] + 1))

req = b["Test Requirements"]
for entry in index["requirements"]:
    row = entry["row"]
    assert req.cell(row, 8).value == entry["status"], entry
    assert req.cell(row, 9).value == entry["count"], entry
assert not unexpected, unexpected[:20]
assert sum(len(s["cases"]) for s in index["sheets"].values()) == 273
print("PASS", output.stat().st_size, "sheets", len(b.sheetnames), "images", sum(len(s._images) for s in b.worksheets),
      "cases", 273, "changes", dict(changes))
print("SUMMARY", Counter(entry["status"] for entry in index["requirements"]))
