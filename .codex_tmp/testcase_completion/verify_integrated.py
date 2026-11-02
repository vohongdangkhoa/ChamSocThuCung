"""Read-only check of the combined Functional and Integrated workbook."""
from pathlib import Path
import re
import openpyxl

root=Path(r'C:\Users\vohon\petnova_app')
folder=root/'outputs'/'01a0c27b-f522-7c62-8cec-50db5c0bf907'
base=openpyxl.load_workbook(folder/'Nhom09FullnewsPetNoVa_hoan_chinh.xlsx')
source=openpyxl.load_workbook(folder/'Nhom09_IntergrationTC_hoan_chinh.xlsx')
combined_path=folder/'Nhom09FullnewsPetNoVa_co_Integrated.xlsx'
combined=openpyxl.load_workbook(combined_path)
assert combined.sheetnames==base.sheetnames+['Integrated']
assert sum(len(s._images) for s in combined.worksheets)==sum(len(s._images) for s in base.worksheets)==13
for prior in base.worksheets:
    current=combined[prior.title]
    assert prior.max_row==current.max_row and prior.max_column==current.max_column,prior.title
    assert {str(m) for m in prior.merged_cells.ranges}=={str(m) for m in current.merged_cells.ranges},prior.title
    for row in prior:
        for cell in row:
            assert cell.value==current[cell.coordinate].value,(prior.title,cell.coordinate)
integrated=combined['Integrated']
original=source['Integration Test Cases']
assert integrated.max_row==209 and integrated.max_column==10
assert integrated['A2'].value=='Integration TCs'
case_rows=[]
for row in range(3,210):
    for col in range(1,11):
        assert integrated.cell(row,col).value==original.cell(row,col).value,(row,col)
    if re.fullmatch(r'FI_\d+',str(integrated.cell(row,3).value)):
        case_rows.append(row)
assert len(case_rows)==69 and case_rows==list(range(3,210,3))
assert len(integrated.merged_cells.ranges)==1+69*6
functional_ids={cell.value for sheet in base.worksheets for row in sheet for cell in row
                if isinstance(cell.value,str) and re.fullmatch(r'F\d+(?:\.\d+)?_\d+',cell.value)}
references=[part for row in case_rows for part in integrated.cell(row,2).value.split('-')]
assert all(part in functional_ids for part in references)
assert sum(1 for row in case_rows if 'Chưa thực thi' in integrated.cell(row,10).value)==69
print('PASS',combined_path.stat().st_size,'sheets',len(combined.sheetnames),
      'functional_cases',len(functional_ids),'integration_cases',len(case_rows),
      'integration_steps',69*3,'functional_refs',len(references),'images',13)
