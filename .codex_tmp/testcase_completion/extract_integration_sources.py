"""Read-only extraction of the two supplied workbooks for traceable authoring."""
import json
from pathlib import Path
import openpyxl

root = Path(r"C:\Users\vohon\petnova_app\.codex_tmp\testcase_completion")
functional_path = Path(r"D:\Hk1 năm 3\LT_KDCLPM\Nhóm09\Nhóm09FullnewsPetNoVa.xlsx")
integration_path = Path(r"D:\Hk1 năm 3\LT_KDCLPM\Nhóm09\Nhom09_IntergrationTC.xlsx")

functional = openpyxl.load_workbook(functional_path, read_only=True, data_only=True)
functional_cases = {}
for n in range(1, 13):
    sheet = functional[f"Testcase_F{n}"]
    starts = [r for r in range(1, sheet.max_row + 1)
              if isinstance(sheet.cell(r, 3).value, str)
              and sheet.cell(r, 3).value.startswith("F")]
    for i, start in enumerate(starts):
        end = (starts[i + 1] - 1) if i + 1 < len(starts) else sheet.max_row
        case_id = sheet.cell(start, 3).value
        steps = []
        for row in range(start, end + 1):
            if isinstance(sheet.cell(row, 6).value, (int, float)):
                steps.append({
                    "action": str(sheet.cell(row, 7).value or ""),
                    "data": str(sheet.cell(row, 8).value or ""),
                    "expected": str(sheet.cell(row, 9).value or ""),
                })
        functional_cases[case_id] = {
            "sheet": sheet.title,
            "row": start,
            "objective": str(sheet.cell(start, 4).value or ""),
            "pre": str(sheet.cell(start, 5).value or ""),
            "steps": steps,
        }

integration = openpyxl.load_workbook(integration_path, read_only=True, data_only=True)
sheet = integration["Integration Test Cases"]
starts = [r for r in range(3, sheet.max_row + 1)
          if isinstance(sheet.cell(r, 3).value, str)
          and sheet.cell(r, 3).value.startswith("F")]
base_cases = []
for i, start in enumerate(starts):
    end = (starts[i + 1] - 1) if i + 1 < len(starts) else sheet.max_row
    steps = []
    for row in range(start, end + 1):
        if isinstance(sheet.cell(row, 6).value, (int, float)):
            steps.append({
                "action": str(sheet.cell(row, 7).value or ""),
                "data": str(sheet.cell(row, 8).value or ""),
                "expected": str(sheet.cell(row, 9).value or ""),
            })
    base_cases.append({
        "old_id": sheet.cell(start, 3).value,
        "row": start,
        "objective": str(sheet.cell(start, 4).value or ""),
        "pre": str(sheet.cell(start, 5).value or ""),
        "steps": steps,
        "notes": str(sheet.cell(start, 10).value or ""),
    })

payload = {
    "functional_source": str(functional_path),
    "integration_source": str(integration_path),
    "functional_cases": functional_cases,
    "base_cases": base_cases,
}
output = root / "integration_source_index.json"
output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Extracted {len(functional_cases)} functional cases and {len(base_cases)} existing integration cases to {output}")
