"""Read-only index of the Functional workbook for targeted artifact-tool edits."""
from collections import Counter
from pathlib import Path
import json
import re
import openpyxl

root = Path(r"C:\Users\vohon\petnova_app")
source = Path(r"D:\Hk1 năm 3\LT_KDCLPM\Nhóm09\Nhóm09FullnewsPetNoVa.xlsx")
book = openpyxl.load_workbook(source, data_only=False)
data = {"sheets": {}, "requirements": []}

for number in range(1, 13):
    sheet = book[f"Testcase_F{number}"]
    starts = [row for row in range(1, sheet.max_row + 1)
              if isinstance(sheet.cell(row, 3).value, str)
              and re.match(rf"^F{number}(?:[._])", sheet.cell(row, 3).value)]
    cases = []
    for index, start in enumerate(starts):
        end = starts[index + 1] - 1 if index + 1 < len(starts) else sheet.max_row
        steps = [row for row in range(start, end + 1)
                 if isinstance(sheet.cell(row, 6).value, (int, float))]
        results = [sheet.cell(row, 11).value for row in steps]
        if "Failed" in results:
            status = "Failed"
        elif results and all(result == "Passed" for result in results):
            status = "Passed"
        elif any(result in ("Passed", "Failed") for result in results):
            status = "Partial"
        else:
            status = "Not Executed"
        if number >= 5:
            # The source has two illustrative result cells merged across
            # unrelated cases. The user confirmed real results only for F1–F4.
            status = "Not Executed"
        cases.append({"id": sheet.cell(start, 3).value, "start": start,
                      "end": end, "steps": steps, "status": status,
                      "note": sheet.cell(start, 10).value})
    bad_merges = []
    for merged in sheet.merged_cells.ranges:
        if merged.min_col in (11, 12, 13) and merged.min_col == merged.max_col and merged.max_row > merged.min_row:
            overlap = [row for row in starts if merged.min_row <= row <= merged.max_row]
            if len(overlap) > 1 or (overlap and overlap[0] != merged.min_row):
                bad_merges.append(str(merged))
    nonsteps_with_results = []
    step_set = {row for case in cases for row in case["steps"]}
    for row in range(starts[0], sheet.max_row + 1):
        if row not in step_set and any(sheet.cell(row, col).value is not None for col in (11, 12, 13)):
            nonsteps_with_results.append(row)
    data["sheets"][sheet.title] = {"maxRow": sheet.max_row, "firstCase": starts[0],
                                     "cases": cases, "badMerges": bad_merges,
                                     "nonStepResults": nonsteps_with_results,
                                     "imageCount": len(sheet._images)}

requirements = book["Test Requirements"]
for row in range(4, requirements.max_row + 1):
    req_id = requirements.cell(row, 2).value
    if not isinstance(req_id, str) or not re.fullmatch(r"F\d+(?:\.\d+)?", req_id):
        continue
    number = int(re.match(r"F(\d+)", req_id).group(1))
    cases = data["sheets"][f"Testcase_F{number}"]["cases"]
    if "." not in req_id:
        matching = cases
        pattern = "F*"  # only case identifiers in column C begin with F
    elif req_id.endswith(".1"):
        matching = [case for case in cases if case["id"].startswith(f"F{number}_")]
        pattern = f"F{number}_*"
    else:
        matching = [case for case in cases if case["id"].startswith(req_id + "_")]
        pattern = req_id + "_*"
    statuses = [case["status"] for case in matching]
    if "Failed" in statuses:
        status = "Failed"
    elif statuses and all(s == "Passed" for s in statuses):
        status = "Passed"
    elif "Partial" in statuses:
        status = "In Progress"
    else:
        status = "Not Executed"
    data["requirements"].append({"row": row, "id": req_id, "sheet": f"Testcase_F{number}",
                                  "count": len(matching), "pattern": pattern,
                                  "status": status, "caseIds": [case["id"] for case in matching]})

destination = root / ".codex_tmp" / "testcase_completion" / "fullnews_index.json"
destination.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print("cases", sum(len(s["cases"]) for s in data["sheets"].values()),
      "steps", sum(sum(len(c["steps"]) for c in s["cases"]) for s in data["sheets"].values()),
      "requirements", len(data["requirements"]))
for name, sheet in data["sheets"].items():
    print(name, len(sheet["cases"]), "first", sheet["firstCase"], "max", sheet["maxRow"],
          "statuses", dict(Counter(case["status"] for case in sheet["cases"])),
          "bad merges", sheet["badMerges"], "nonsteps", sheet["nonStepResults"])
print("empty matches", [r["id"] for r in data["requirements"] if r["count"] == 0])
