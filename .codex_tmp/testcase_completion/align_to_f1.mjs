import fs from 'node:fs/promises';
import path from 'node:path';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';

const workDir='C:/Users/vohon/petnova_app/.codex_tmp/testcase_completion';
const plan=JSON.parse(await fs.readFile(path.join(workDir,'align_plan.json'),'utf8'));
const outputDir='C:/Users/vohon/petnova_app/outputs/01a0c27b-f522-7c62-8cec-50db5c0bf907';
const outputPath=path.join(outputDir,'Nhom09Full.xlsx');
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(plan.source));
const set=(sheet,addr,value)=>{sheet.getRange(addr).values=[[value]];};

// The author's F1 groups cases by requirement. Keep that pattern on every
// testcase sheet, including the two IDs accidentally placed on step 2 in F1.
for (const [group,info] of Object.entries(plan.groups)) {
  const sheet=wb.worksheets.getItem(`Testcase_${group}`);
  for (const rec of info.cases) {
    set(sheet,`B${rec.start}`,rec.showReq?rec.req:null);
    const cRange=sheet.getRange(`C${rec.start}:C${rec.end}`);
    const needsRepair=!rec.oldids.length || rec.oldids.some(([row])=>row!==rec.start);
    if(needsRepair && rec.end>rec.start){
      cRange.unmerge();
      for(let row=rec.start;row<=rec.end;row++) set(sheet,`C${row}`,null);
      cRange.merge();
    }
    set(sheet,`C${rec.start}`,rec.id);
  }
  if(group==='F1'){
    for(const [start,end,id] of [[56,57,'F1.5_02'],[76,77,'F1.7_02']]){
      sheet.getRange(`C${start}:C${end}`).merge();
      set(sheet,`C${start}`,id);
    }
  }
  // F2, F6 and F7 kept Excel's default row heights in the image and header
  // area. F1's measured heights provide the reference without changing cases.
  if(['F2','F6','F7'].includes(group)) {
    sheet.getRange('A1:J1').format.rowHeight=37.95;
    sheet.getRange('A2:J19').format.rowHeight=22.95;
    sheet.getRange('A20:J20').format.rowHeight=28.05;
    sheet.getRange('A21:J21').format.rowHeight=43.05;
    sheet.getRange('A22:J22').format.rowHeight=24;
    sheet.getRange(`A${info.guiRow}:J${info.guiRow}`).format.rowHeight=24;
  }
  console.log(`${group}: ${info.cases.length} cases; first requirement ${info.firstReq}`);
}

// The supplied workbook's requirement counts point to [1] external sheets.
// Count each local case ID, so the grouped B column stays readable and totals
// recalculate inside this workbook after it is copied or submitted.
const register=wb.worksheets.getItem('Test Requirements');
for (const {row,id} of plan.master) {
  const group=id.match(/^F\d+/)?.[0];
  const info=plan.groups[group];
  if(!info?.counts[id]) continue; // Parent SUM formulas remain in place.
  const selected=info.cases.filter(c=>c.req===id);
  const runs=[];
  for(const c of selected){
    const last=runs.at(-1);
    if(last && c.start===last.end+1) last.end=c.end;
    else runs.push({start:c.start,end:c.end});
  }
  const formula='='+runs.map(({start,end})=>
    `COUNTA('Testcase_${group}'!$C$${start}:$C$${end})`
  ).join('+');
  register.getRange(`I${row}`).formulas=[[formula]];
}

wb.recalculate();
console.log('Register preview', (await wb.inspect({
  kind:'table',range:"'Test Requirements'!H10:I18",include:'values,formulas',
  tableMaxRows:9,tableMaxCols:2,maxChars:2200
})).ndjson);
console.log('Formula scan', (await wb.inspect({
  kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options:{useRegex:true,maxResults:50},summary:'final formula error scan'
})).ndjson);

await fs.mkdir(outputDir,{recursive:true});
await (await SpreadsheetFile.exportXlsx(wb)).save(outputPath);
console.log('Saved',outputPath);

for(const group of Object.keys(plan.groups)) {
  const sheetName=`Testcase_${group}`;
  const ranges=[['left','A23:E24'],['right','F23:J24']];
  if(['F2','F6','F7'].includes(group)) ranges.push(['top','A1:J22']);
  for(const [part,range] of ranges){
    const png=await wb.render({sheetName,range,scale:1,format:'png'});
    await fs.writeFile(path.join(workDir,`aligned_${group}_${part}.png`),new Uint8Array(await png.arrayBuffer()));
  }
}
for(const [part,range] of [['left','A8:E15'],['right','F8:J15']]){
  const png=await wb.render({sheetName:'Test Requirements',range,scale:1,format:'png'});
  await fs.writeFile(path.join(workDir,`aligned_master_${part}.png`),new Uint8Array(await png.arrayBuffer()));
}
