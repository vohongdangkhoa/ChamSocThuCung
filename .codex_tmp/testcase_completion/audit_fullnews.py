"""Read-only audit of the supplied Functional test workbook."""
from collections import Counter
from pathlib import Path
import json
import re
import openpyxl

p = Path(r"D:\Hk1 năm 3\LT_KDCLPM\Nhóm09\Nhóm09FullnewsPetNoVa.xlsx")
w = openpyxl.load_workbook(p, data_only=False, read_only=False)
v = openpyxl.load_workbook(p, data_only=True, read_only=True)
print("FILE", p, p.stat().st_size, "SHEETS", w.sheetnames, "EXTERNAL_LINKS", len(w._external_links))
for s in w.worksheets:
    print("SHEET", s.title, "size", s.max_row, s.max_column, "images", len(s._images), "merged", len(s.merged_cells.ranges), "freeze", s.freeze_panes)
for n in ["Sheet1", "Test Requirements", "GUI CHECKLIST ", "Sheet16"]:
    s=w[n]
    print("CONTENT",n)
    for row in s:
        vals=[f"{c.coordinate}={str(c.value)[:125]}" for c in row if c.value is not None]
        if vals and (n!="Test Requirements" or row[0].row<=8 or row[0].row>=78):
            print(" ","; ".join(vals[:8]))
print("REQUIREMENT_COUNTS")
s=w["Test Requirements"]; sv=v["Test Requirements"]
for r in range(4,84):
    if s.cell(r,2).value:
        print(r,s.cell(r,2).value,"I_formula",str(s.cell(r,9).value)[:90],"I_cached",sv.cell(r,9).value)
print("CASE_AUDIT")
all_ids=set()
for n in range(1,13):
    s=w[f"Testcase_F{n}"]
    starts=[r for r in range(1,s.max_row+1) if isinstance(s.cell(r,3).value,str) and s.cell(r,3).value.startswith("F")]
    issues=[]; statuses=[]; steps=0
    for i,start in enumerate(starts):
        end=starts[i+1]-1 if i+1<len(starts) else s.max_row
        cid=s.cell(start,3).value
        if cid in all_ids: issues.append((cid,"duplicate ID"))
        all_ids.add(cid)
        if not s.cell(start,4).value: issues.append((cid,"no objective"))
        if not s.cell(start,5).value: issues.append((cid,"no precondition"))
        if not s.cell(start,10).value: issues.append((cid,"no note"))
        for r in range(start,end+1):
            if isinstance(s.cell(r,6).value,(int,float)):
                steps+=1
                if not s.cell(r,7).value: issues.append((cid,f"G{r} empty"))
                if not s.cell(r,9).value: issues.append((cid,f"I{r} empty"))
            if s.cell(r,11).value is not None or s.cell(r,12).value is not None or s.cell(r,13).value is not None:
                statuses.append((r,s.cell(r,11).value,s.cell(r,12).value,s.cell(r,13).value))
    bad_merges=[]
    for m in s.merged_cells.ranges:
        if m.min_col in [11,12,13] and m.max_col==m.min_col and m.max_row>m.min_row:
            overlaps=[r for r in starts if m.min_row<=r<=m.max_row]
            if len(overlaps)>1 or (overlaps and overlaps[0]!=m.min_row):
                bad_merges.append(str(m))
    print(s.title,"cases",len(starts),"steps",steps,"issues",issues[:20],"issue_count",len(issues),"execution_entries",statuses[:25],"execution_count",len(statuses),"bad_result_merges",bad_merges[:20])
print("TOTAL_IDS",len(all_ids))
