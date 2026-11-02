import fs from 'node:fs/promises';
import path from 'node:path';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';

const root='C:/Users/vohon/petnova_app';
const source='D:/Hk1 năm 3/LT_KDCLPM/Nhóm09/Nhóm09FullnewsPetNoVa.xlsx';
const scratch=`${root}/.codex_tmp/testcase_completion/fullnews_previews`;
const outputDir=`${root}/outputs/01a0c27b-f522-7c62-8cec-50db5c0bf907`;
const outputPath=`${outputDir}/Nhom09FullnewsPetNoVa_hoan_chinh.xlsx`;
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(source));
await fs.mkdir(scratch,{recursive:true});
if(process.argv[2]==='preview'){
  console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:4000})).ndjson);
  for(const [sheetName,range,name] of [
    ['Sheet1','B2:E17','cover_before'],
    ['Test Requirements','A1:J12','req_first_before'],
    ['Test Requirements','A29:J38','req_middle_before'],
    ['Testcase_F1','A20:M30','f1_before'],
    ['Testcase_F5','A20:M31','f5_before'],
    ['Testcase_F11','A31:M43','f11_before'],
    ['Sheet16','A1:G6','lookup_before'],
  ]){
    const png=await wb.render({sheetName,range,scale:1,format:'png'});
    await fs.writeFile(path.join(scratch,name+'.png'),new Uint8Array(await png.arrayBuffer()));
  }
  process.exit(0);
}
if(process.argv[2]!=='build') throw Error('Expected preview or build');

const index=JSON.parse(await fs.readFile(`${root}/.codex_tmp/testcase_completion/fullnews_index.json`,'utf8'));
const cover=wb.worksheets.getItem('Sheet1');
cover.getRange('B2').values=[['Functional test cases']];
cover.getRange('E7').values=[['Thiết kế ca kiểm thử PetNoVa theo mẫu Lab3. F1–F4 đã có kết quả thực thi; F5–F12 chờ kiểm thử.']];
cover.getRange('D16').values=[['Lab3_Buoi6.xlsx (mẫu trình bày); mã nguồn PetNoVa (theo cột Note của Test Requirements)']];
cover.getRange('C7').setNumberFormat('dd/mm/yyyy');

const req=wb.worksheets.getItem('Test Requirements');
for(const entry of index.requirements){
  req.getRange(`H${entry.row}`).values=[[entry.status]];
  req.getRange(`I${entry.row}`).values=[[entry.count]];
}
req.getRange('J7').values=[['Nguồn: trang-dang-nhap.jsx; xac-thuc.jsx; UserAccountsController.cs']];

for(let n=1;n<=12;n++){
  const sheetName=`Testcase_F${n}`;
  const sheet=wb.worksheets.getItem(sheetName);
  const info=index.sheets[sheetName];
  if(n<=4){
    // Keep all observed step results and tester names. Only remove header-row status.
    for(const row of info.nonStepResults){
      sheet.getRange(`K${row}:M${row}`).clear({applyTo:'contents'});
    }
    for(const testCase of info.cases){
      if(typeof testCase.note==='string' && testCase.note.includes('Chưa thực thi.')){
        sheet.getRange(`J${testCase.start}`).values=[[
          testCase.note.replace('Chưa thực thi.','Đã thực thi; xem kết quả từng bước tại cột K–M.')
        ]];
      }
    }
  } else {
    // The source's Passed/Failed cells here were template examples spanning
    // multiple cases, not test observations. Give each step an editable state.
    for(const address of info.badMerges) sheet.unmergeCells(address);
    sheet.getRange(`K${info.firstCase}:M${info.maxRow}`).clear({applyTo:'contents'});
    const stepRows=new Set(info.cases.flatMap(c=>c.steps));
    const values=[];
    for(let row=info.firstCase;row<=info.maxRow;row++){
      values.push([stepRows.has(row)?'Not Executed':null]);
    }
    sheet.getRange(`K${info.firstCase}:K${info.maxRow}`).values=values;
  }
}

wb.recalculate();
for(const [sheetName,range,name] of [
  ['Sheet1','B2:E17','cover_after'],
  ['Test Requirements','A1:J12','req_first_after'],
  ['Test Requirements','A29:J38','req_middle_after'],
  ['Testcase_F2','F21:M30','f2_after'],
  ['Testcase_F5','F21:M31','f5_after'],
  ['Testcase_F11','F34:M44','f11_after'],
]){
  const png=await wb.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(path.join(scratch,name+'.png'),new Uint8Array(await png.arrayBuffer()));
}
console.log('REQ_CHECK', (await wb.inspect({kind:'table',sheetId:'Test Requirements',range:'H4:I15',include:'values,formulas',tableMaxRows:12,tableMaxCols:2,maxChars:4000})).ndjson);
console.log('ERROR_CHECK', (await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:25},summary:'functional final formula error scan',maxChars:2000})).ndjson);
await fs.mkdir(outputDir,{recursive:true});
const output=await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);
console.log('OUTPUT',outputPath);
