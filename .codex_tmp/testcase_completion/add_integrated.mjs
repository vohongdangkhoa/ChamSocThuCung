import fs from 'node:fs/promises';
import path from 'node:path';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';

const root='C:/Users/vohon/petnova_app';
const outputDir=`${root}/outputs/01a0c27b-f522-7c62-8cec-50db5c0bf907`;
const basePath=`${outputDir}/Nhom09FullnewsPetNoVa_hoan_chinh.xlsx`;
const integrationPath=`${outputDir}/Nhom09_IntergrationTC_hoan_chinh.xlsx`;
const outputPath=`${outputDir}/Nhom09FullnewsPetNoVa_co_Integrated.xlsx`;
const previewDir=`${root}/.codex_tmp/testcase_completion/fullnews_previews`;

const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(basePath));
const integration=await SpreadsheetFile.importXlsx(await FileBlob.load(integrationPath));
const source=integration.worksheets.getItem('Integration Test Cases');
const target=workbook.worksheets.add('Integrated');

const header=[
  'No.','Test Requirement ID','Test Case ID',
  'Test Objective/ Test description/ Test Items','Pre-conditions',
  'Step #','Step Action','Test Data','Expected Result','Notes'
];
target.getRange('A1:J1').values=[header];
target.mergeCells('A2:J2');
target.getRange('A2').values=[['Integration TCs']];
target.getRange('A3:J209').values=source.getRange('A3:J209').values;

// Reproduce Lab3_Buoi6's Integrated grid and grouping, with enough width
// for the PetNoVa cases to remain legible.
target.showGridLines=false;
target.tabColor='#A9D18E';
target.freezePanes.freezeRows(2);
const widths={A:8,B:27,C:12,D:38,E:34,F:9,G:48,H:28,I:49,J:42};
for(const [col,width] of Object.entries(widths)){
  target.getRange(`${col}1:${col}209`).format.columnWidth=width;
}
const whole=target.getRange('A1:J209');
whole.format.font={name:'Arial',size:11,color:'#111111'};
whole.format.wrapText=true;
whole.format.verticalAlignment='top';
whole.format.borders={preset:'all',style:'thin',color:'#444444'};
const heading=target.getRange('A1:J1');
heading.format.fill='#CCFFCC';
heading.format.font={name:'Arial',size:11,bold:true,color:'#111111'};
heading.format.horizontalAlignment='center';
heading.format.verticalAlignment='center';
heading.format.rowHeight=62;
heading.format.borders={preset:'all',style:'medium',color:'#222222'};
const band=target.getRange('A2:J2');
band.format.fill='#FFF2CC';
band.format.font={name:'Arial',size:11,bold:true,color:'#0563C1'};
band.format.rowHeight=18;
band.format.verticalAlignment='center';
band.format.borders={preset:'outside',style:'medium',color:'#222222'};
target.getRange('A3:J209').format.rowHeight=52;
target.getRange('A3:C209').format.font={name:'Arial',size:11,bold:true,color:'#111111'};
target.getRange('F3:F209').format.font={name:'Arial',size:11,bold:true,color:'#0563C1'};
for(const col of ['A','B','C','F']){
  target.getRange(`${col}3:${col}209`).format.horizontalAlignment='center';
}
for(let caseNo=0;caseNo<69;caseNo++){
  const start=3+caseNo*3;
  const end=start+2;
  for(const col of ['A','B','C','D','E','J']) target.mergeCells(`${col}${start}:${col}${end}`);
  target.getRange(`A${start}:J${end}`).format.borders={preset:'outside',style:'medium',color:'#222222'};
}

workbook.recalculate();
for(const [range,name] of [['A1:J8','integrated_first'],['A93:J98','integrated_middle'],['A204:J209','integrated_last']]){
  const preview=await workbook.render({sheetName:'Integrated',range,scale:1,format:'png'});
  await fs.writeFile(path.join(previewDir,`${name}.png`),new Uint8Array(await preview.arrayBuffer()));
}
console.log('INTEGRATED_CHECK',(await workbook.inspect({kind:'table',sheetId:'Integrated',range:'A1:J5',include:'values',tableMaxRows:5,tableMaxCols:10,maxChars:3000})).ndjson);
console.log('ERROR_CHECK',(await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:25},summary:'combined functional and integration formula error scan',maxChars:1000})).ndjson);
await fs.mkdir(outputDir,{recursive:true});
const blob=await SpreadsheetFile.exportXlsx(workbook);
await blob.save(outputPath);
console.log('OUTPUT',outputPath);
