import fs from 'node:fs/promises';
import path from 'node:path';
import {FileBlob, SpreadsheetFile, Workbook} from '@oai/artifact-tool';
import {requirements as rootRequirements, cases as rootCases} from './root_cases.mjs';

const dir = 'C:/Users/vohon/petnova_app/.codex_tmp/testcase_completion';
const templatePath = 'D:/Hk1 năm 3/TH_KDCLPM/Lab3_Buoi6.xlsx';
const studentPath = 'D:/Hk1 năm 3/LT_KDCLPM/Nhóm09.xlsx';
const mode = process.argv[2] || 'preview';
if (mode === 'preview') {
  const template = await SpreadsheetFile.importXlsx(await FileBlob.load(templatePath));
  console.log((await template.inspect({kind:'sheet',include:'id,name',maxChars:2500})).ndjson);
  console.log(template.help('worksheet', {search:'copy|name|delete',include:'index,notes',maxChars:3500}).ndjson);
  for (const [sheetName, range, name] of [
    ['Testcase_F2_LOGIN','A21:J38','template_cases'],
    ['Test Requirements','A7:J14','template_requirements'],
    ['Cover Page','B2:E16','template_cover']
  ]) {
    const png = await template.render({sheetName,range,scale:1,format:'png'});
    await fs.writeFile(path.join(dir,name+'.png'),new Uint8Array(await png.arrayBuffer()));
    console.log('Rendered',name);
  }
  const student = await SpreadsheetFile.importXlsx(await FileBlob.load(studentPath));
  const png = await student.render({sheetName:'F1',range:'A8:J17',scale:1,format:'png'});
  await fs.writeFile(path.join(dir,'student_before.png'),new Uint8Array(await png.arrayBuffer()));
  console.log('Student preview done');
}
if (mode === 'probe') {
  const template = await SpreadsheetFile.importXlsx(await FileBlob.load(templatePath));
  const wb=Workbook.create();
  const sheet=wb.worksheets.add('Cover Page');
  sheet.getRange('A1:F20').copyFrom(template.worksheets.getItem('Cover Page').getRange('A1:F20'),'all');
  console.log((await wb.inspect({kind:'table',range:"'Cover Page'!B2:E7",tableMaxRows:6,tableMaxCols:4,maxChars:1400})).ndjson);
  console.log(wb.help('range.merge',{include:'index,examples,notes',maxChars:2500}).ndjson);
  const png=await wb.render({sheetName:'Cover Page',range:'B2:E16',scale:1,format:'png'});
  await fs.writeFile(path.join(dir,'copy_probe.png'),new Uint8Array(await png.arrayBuffer()));
}
if (mode === 'rendercheck') {
  const file='C:/Users/vohon/petnova_app/outputs/petnova-testcase-20261024/Nhóm09.xlsx';
  const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
  for(const group of ['F4','F11','F12']){
    const png=await wb.render({sheetName:`Testcase_${group}`,range:'A21:J25',scale:1,format:'png'});
    await fs.writeFile(path.join(dir,`check_${group}.png`),new Uint8Array(await png.arrayBuffer()));
    const png2=await wb.render({sheetName:`Testcase_${group}`,range:'A23:E24',scale:1,format:'png'});
    await fs.writeFile(path.join(dir,`check_${group}_left.png`),new Uint8Array(await png2.arrayBuffer()));
  }
}

if (mode === 'build') {
  const [auth, booking, vet, meta, extracted, refs] = await Promise.all([
    'auth_pets.json','booking_payment.json','vet_admin.json',
    'template_metadata.json','workbooks.json','references.json'
  ].map(async f => JSON.parse(await fs.readFile(path.join(dir,f),'utf8'))));
  const requirements = [...auth.requirements,...booking.requirements,...rootRequirements,...vet.requirements];
  const cases = [...auth.cases,...booking.cases,...rootCases,...vet.cases].map(c=>
    c.req==='F12.4' ? {...c,gui:true} : c
  );
  const byReq = new Map(requirements.map(x=>[x.id,x]));
  const byGroup = new Map(Array.from({length:12},(_,i)=>[`F${i+1}`,[]]));
  for (const c of cases) {
    if (!byReq.has(c.req)) throw Error(`Case refers to missing requirement: ${c.req}`);
    const group = c.req.match(/^F\d+/)?.[0];
    if (!byGroup.has(group)) throw Error(`Bad group: ${c.req}`);
    if (!Array.isArray(c.steps) || !c.steps.length || c.steps.some(s=>!s.action||!s.expected)) throw Error(`Incomplete case: ${c.req} ${c.objective}`);
    byGroup.get(group).push(c);
  }
  if (requirements.length !== 67 || cases.length !== 273) throw Error(`Unexpected coverage: ${requirements.length} requirements / ${cases.length} cases`);

  const outDir = 'C:/Users/vohon/petnova_app/outputs/petnova-testcase-20261024';
  await fs.mkdir(outDir,{recursive:true});
  const wb=Workbook.create();
  const cover=wb.worksheets.add('Cover Page');
  const master=wb.worksheets.add('Test Requirements');
  const manifest={requirements:requirements.length,cases:cases.length,groups:{},requirementCounts:{}};
  const set=(sheet,addr,value)=>{sheet.getRange(addr).values=[[value]];};
  const col=n=>String.fromCharCode(65+n);
  const border='#000000';
  const pale='#FFF2CC';
  const green='#CCFFCC';
  const lightBlue='#DDEBF7';
  const setWidths=(sh,widths,cols)=>{
    for (const c of cols) if (widths[c]) sh.getRange(`${c}:${c}`).format.columnWidth=widths[c];
  };
  const fmt=(sh,address,config)=>{sh.getRange(address).format=config;};
  const lineCount=(text,width)=>{
    const txt=String(text??'');
    return txt.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/Math.max(7,width*0.88))),0);
  };
  const groupNames={
    F1:'Xác thực tài khoản', F2:'Tổng quan khách hàng', F3:'Quản lý thú cưng',
    F4:'Quản lý lịch hẹn', F5:'Thanh toán', F6:'Xem hồ sơ sức khỏe',
    F7:'Thông báo cá nhân', F8:'Tài khoản khách hàng', F9:'Vận hành lịch hẹn',
    F10:'Hồ sơ thú y', F11:'Quản trị hệ thống', F12:'Phân quyền và giao diện'
  };
  const tcHeader=['No.','Test Requirement ID','Test Case ID','Test Objective/ Test description/ Test Items','Pre-conditions','Step #','Step Action','Test Data','Expected Result','Notes'];
  const tcWidths=meta.Testcase_F2_LOGIN.widths;
  const actualCaseRange={};
  for(let groupNo=1;groupNo<=12;groupNo++){
    const group=`F${groupNo}`;
    const sh=wb.worksheets.add(`Testcase_${group}`);
    sh.showGridLines=false;
    sh.tabColor=groupNo<=8?'#70AD47':groupNo<=10?'#5B9BD5':'#ED7D31';
    setWidths(sh,tcWidths,'ABCDEFGHIJ');
    sh.getRange('A1:J1').merge();
    set(sh,'A1',`Test Cases for '${groupNames[group]}' function of PetNoVa`);
    fmt(sh,'A1:J1',{fill:'#FFFFFF',font:{name:'Arial',size:20,bold:true,color:'#C00000'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,borders:{top:{style:'medium',color:border},bottom:{style:'medium',color:border}}});
    sh.getRange('A1:J1').format.rowHeight=38;
    sh.getRange('A2:J19').format.rowHeight=23;
    sh.getRange('A20:J20').merge();
    const originalRef=refs[group];
    const topNote=originalRef
      ? `Hình tham chiếu từ file Nhóm09 ban đầu; không phải bằng chứng thực thi các ca dưới đây.`
      : `Chưa có hình tham chiếu cho ${group} trong file Nhóm09 ban đầu. Các ca được thiết kế từ mã nguồn PetNoVa.`;
    set(sh,'A20',topNote);
    fmt(sh,'A20:J20',{font:{name:'Arial',size:10,italic:true,color:'#595959'},fill:'#F2F2F2',wrapText:true,verticalAlignment:'center'});
    sh.getRange('A20:J20').format.rowHeight=28;
    if(originalRef){
      const data=await fs.readFile(originalRef.path);
      const scale=Math.min(900/originalRef.width,410/originalRef.height,1);
      const width=Math.round(originalRef.width*scale);
      const height=Math.round(originalRef.height*scale);
      sh.images.add({dataUrl:`data:image/png;base64,${data.toString('base64')}`,anchor:{from:{row:2,col:3},extent:{widthPx:width,heightPx:height}}});
    } else {
      sh.getRange('C8:I14').merge();
      set(sh,'C8',`Màn hình ${groupNames[group]} — chưa có ảnh tham chiếu trong file ban đầu`);
      fmt(sh,'C8:I14',{font:{name:'Arial',size:15,color:'#7F7F7F'},fill:'#F7F7F7',horizontalAlignment:'center',verticalAlignment:'center',wrapText:true});
    }
    sh.getRange('A21:J21').values=[tcHeader];
    fmt(sh,'A21:J21',{fill:green,font:{name:'Arial',size:11,bold:true,color:'#000000'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,borders:{preset:'all',style:'medium',color:border}});
    sh.getRange('A21:J21').format.rowHeight=43;

    let row=22;
    const ordered=[...byGroup.get(group).filter(c=>!c.gui),...byGroup.get(group).filter(c=>c.gui)];
    const functional=ordered.filter(c=>!c.gui).length;
    const gui=ordered.length-functional;
    const firstCaseRow=23;
    let seq=0;
    for(const [section,sectionCases] of [['Functional TCs',ordered.filter(c=>!c.gui)],['Look and Feel (GUI) TCs',ordered.filter(c=>c.gui)]]){
      sh.getRange(`A${row}:J${row}`).merge();
      set(sh,`A${row}`,section);
      fmt(sh,`A${row}:J${row}`,{fill:pale,font:{name:'Arial',size:11,bold:true,color:'#0563C1'},horizontalAlignment:'left',verticalAlignment:'center',borders:{top:{style:'medium',color:border},bottom:{style:'medium',color:border}}});
      sh.getRange(`A${row}:J${row}`).format.rowHeight=24;
      row++;
      for(const c of sectionCases){
        seq++;
        const id=`${group}_${String(seq).padStart(2,'0')}`;
        const start=row;
        const end=start+c.steps.length-1;
        const note=(c.notes ? c.notes.trim()+ '\n' : '') + 'Chưa thực thi.';
        const values=c.steps.map((s,i)=>[
          i===0?seq:null,i===0?c.req:null,i===0?id:null,i===0?c.objective:null,i===0?c.pre:null,
          i+1,s.action,s.data??'',s.expected,i===0?note:null
        ]);
        sh.getRange(`A${start}:J${end}`).values=values;
        fmt(sh,`A${start}:J${end}`,{font:{name:'Arial',size:11,color:'#000000'},fill:'#FFFFFF',wrapText:true,verticalAlignment:'top',borders:{preset:'all',style:'thin',color:border}});
        for(const letter of ['A','B','C','D','E','J']) if(end>start) sh.getRange(`${letter}${start}:${letter}${end}`).merge();
        fmt(sh,`A${start}:C${end}`,{font:{name:'Arial',size:11,bold:true,color:'#000000'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'top'});
        fmt(sh,`F${start}:F${end}`,{font:{name:'Arial',size:11,bold:true,color:'#0563C1'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'});
        fmt(sh,`D${start}:E${end}`,{font:{name:'Arial',size:11,color:'#000000'},wrapText:true,horizontalAlignment:'left',verticalAlignment:'top'});
        fmt(sh,`G${start}:J${end}`,{font:{name:'Arial',size:11,color:'#000000'},wrapText:true,horizontalAlignment:'left',verticalAlignment:'top'});
        const needed=Math.max(lineCount(c.objective,29),lineCount(c.pre,21),lineCount(note,45))*16+12;
        const basic=c.steps.map(s=>Math.max(28,Math.min(156,Math.max(lineCount(s.action,34),lineCount(s.data,23),lineCount(s.expected,43))*16+12)));
        const deficit=Math.max(0,needed-basic.reduce((a,b)=>a+b,0));
        for(let i=0;i<c.steps.length;i++) sh.getRange(`A${start+i}:J${start+i}`).format.rowHeight=Math.min(220,basic[i]+Math.ceil(deficit/c.steps.length));
        sh.getRange(`A${start}:J${end}`).format.borders={top:{style:'medium',color:border},bottom:{style:'medium',color:border},left:{style:'medium',color:border},right:{style:'medium',color:border}};
        manifest.requirementCounts[c.req]=(manifest.requirementCounts[c.req]||0)+1;
        row=end+1;
      }
    }
    actualCaseRange[group]={start:firstCaseRow,end:row-1};
    manifest.groups[group]={functional,gui,total:ordered.length,lastRow:row-1};
    console.log(`Built ${group}: ${ordered.length} cases / ${row-1} rows`);
  }

  // Master requirement register follows the template's ten-column header and module bands.
  master.showGridLines=false; master.tabColor='#4472C4';
  setWidths(master,meta['Test Requirements'].widths,'ABCDEFGHIJ');
  master.getRange('A1:J1').merge();set(master,'A1','General Information');
  fmt(master,'A1:J1',{font:{name:'Arial',size:12,bold:true,color:'#000000'},verticalAlignment:'center'});
  const infos=[['Test Designed By','Nhóm 09','Test Designed Date','24-Oct-2026'],['Test Reviewed By','','Reviewed Date',''],['Project','PetNoVa','Test Phase','Test case design — chưa thực thi']];
  for(let i=0;i<infos.length;i++){
    let r=i+2;
    master.getRange(`A${r}:B${r}`).merge();master.getRange(`C${r}:E${r}`).merge();master.getRange(`G${r}:J${r}`).merge();
    set(master,`A${r}`,infos[i][0]);set(master,`C${r}`,infos[i][1]);set(master,`F${r}`,infos[i][2]);set(master,`G${r}`,infos[i][3]);
    fmt(master,`A${r}:J${r}`,{font:{name:'Arial',size:10,color:'#000000'},borders:{preset:'all',style:'thin',color:border},verticalAlignment:'center'});
    fmt(master,`A${r}:B${r}`,{font:{name:'Arial',size:10,bold:true}});
    fmt(master,`F${r}`,{font:{name:'Arial',size:10,bold:true}});
    master.getRange(`A${r}:J${r}`).format.rowHeight=24;
  }
  master.getRange('A7:J7').merge();set(master,'A7','List of Test Requirements');
  fmt(master,'A7:J7',{font:{name:'Arial',size:12,bold:true},borders:{bottom:{style:'medium',color:border}}});
  master.getRange('A8:J8').values=[['No.','Test Requirement ID','Requirement Functions','Mô tả chức năng','Test Requirement Description (Test scenarios)','Test Type','Importance','Status','Number of TCs','Note']];
  fmt(master,'A8:J8',{fill:green,font:{name:'Arial',size:11,bold:true},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,borders:{preset:'all',style:'medium',color:border}});
  master.getRange('A8:J8').format.rowHeight=48;
  const sourceMaster=extracted.student['Test Requirements'].cells;
  const parentMap={};
  for(let r=9;r<=extracted.student['Test Requirements'].max_row;r++){
    const id=String(sourceMaster[`B${r}`]??'').trim();
    if(/^F\d+$/.test(id))parentMap[id]={name:sourceMaster[`C${r}`]??groupNames[id],description:sourceMaster[`D${r}`]??'',scenarios:sourceMaster[`E${r}`]??''};
  }
  const modules=[
    {name:'Module Xác thực và khách hàng',start:1,end:8},
    {name:'Module Nhân viên vận hành',start:9,end:9},
    {name:'Module Bác sĩ thú y',start:10,end:10},
    {name:'Module Quản trị',start:11,end:11},
    {name:'Module Hệ thống và giao diện',start:12,end:12}
  ];
  let mr=9, no=0;
  const masterRows=new Map();
  for(const module of modules){
    master.getRange(`A${mr}:D${mr}`).merge();set(master,`A${mr}`,module.name);
    fmt(master,`A${mr}:D${mr}`,{fill:'#FFFF00',font:{name:'Arial',size:11,bold:true},verticalAlignment:'center',borders:{left:{style:'medium',color:border},bottom:{style:'thin',color:border}}});
    fmt(master,`E${mr}:J${mr}`,{fill:'#FFFF00',borders:{bottom:{style:'thin',color:border}}});
    master.getRange(`A${mr}:J${mr}`).format.rowHeight=22;mr++;
    for(let groupNo=module.start;groupNo<=module.end;groupNo++){
      const group=`F${groupNo}`;
      const children=requirements.filter(q=>q.id.startsWith(`${group}.`)).sort((a,b)=>Number(a.id.split('.')[1])-Number(b.id.split('.')[1]));
      const parent=parentMap[group]??{name:groupNames[group],description:'',scenarios:''};
      if(children.length){
        no++;masterRows.set(group,mr);
        master.getRange(`A${mr}:J${mr}`).values=[[no,group,parent.name,parent.description,parent.scenarios,'Functional / GUI','High','Not Executed',null,'Nhóm chức năng; tổng ca bên dưới.']];
        fmt(master,`A${mr}:J${mr}`,{fill:lightBlue,font:{name:'Arial',size:11,bold:true},wrapText:true,verticalAlignment:'center',borders:{preset:'all',style:'thin',color:border}});
        master.getRange(`A${mr}:J${mr}`).format.rowHeight=Math.max(44,Math.min(92,lineCount(parent.description,85)*16+12));
        mr++;
      }
      for(const req of (children.length?children:requirements.filter(q=>q.id===group))){
        no++;masterRows.set(req.id,mr);
        const counts=actualCaseRange[group];
        const formula=`=COUNTIFS('Testcase_${group}'!$B$${counts.start}:$B$${counts.end},"${req.id}")`;
        const sourceNames=[...new Set(req.sources.map(s=>path.basename(s)))].join('; ');
        const note=`Nguồn: ${sourceNames}`;
        master.getRange(`A${mr}:J${mr}`).values=[[no,req.id,req.name,req.description,req.scenarios,req.type,req.importance,'Not Executed',null,note]];
        master.getRange(`I${mr}`).formulas=[[formula]];
        fmt(master,`A${mr}:J${mr}`,{fill:'#FFFFFF',font:{name:'Arial',size:11,color:'#000000'},wrapText:true,verticalAlignment:'top',borders:{preset:'all',style:'thin',color:border}});
        fmt(master,`A${mr}:B${mr}`,{font:{name:'Arial',size:11,bold:true},horizontalAlignment:'center'});
        fmt(master,`F${mr}:I${mr}`,{font:{name:'Arial',size:11,color:'#000000'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true});
        master.getRange(`A${mr}:J${mr}`).format.rowHeight=Math.max(48,Math.min(128,Math.max(lineCount(req.description,85),lineCount(req.scenarios,120),lineCount(note,31))*16+12));
        mr++;
      }
      if(children.length){
        const parentRow=masterRows.get(group);
        const first=parentRow+1,last=mr-1;
        master.getRange(`I${parentRow}`).formulas=[[`=SUM(I${first}:I${last})`]];
      }
    }
  }
  manifest.masterLastRow=mr-1;

  // Preserve the template's cover-page sections and reference table.
  cover.showGridLines=false;cover.tabColor='#7030A0';
  setWidths(cover,meta['Cover Page'].widths,'ABCDEF');
  for(const address of meta['Cover Page'].merges) cover.getRange(address).merge();
  cover.getRange('B2:E2').format.rowHeight=35.25;cover.getRange('B3:E3').format.rowHeight=31.5;
  set(cover,'B2','Test requirement');set(cover,'B3','for PetNoVa');
  fmt(cover,'B2:E3',{font:{name:'Arial',size:20,bold:true,color:'#C00000'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'});
  set(cover,'B5','Document History – To maintain a list of changes being made');
  fmt(cover,'B5:E5',{fill:green,font:{name:'Arial',size:12,bold:true,color:'#C00000'},borders:{preset:'outside',style:'medium',color:border}});
  cover.getRange('B6:E6').values=[['Version','Date','Author','Description of Changes']];
  fmt(cover,'B6:E6',{font:{name:'Arial',size:12,bold:true},horizontalAlignment:'center',verticalAlignment:'center',borders:{preset:'all',style:'thin',color:border}});
  cover.getRange('B7:E7').values=[['1.0','24-Oct-2026','Nhóm 09','Thiết kế ca kiểm thử PetNoVa theo mẫu Lab3; chưa thực thi.']];
  fmt(cover,'B7:E7',{font:{name:'Arial',size:10},wrapText:true,verticalAlignment:'center',borders:{preset:'all',style:'thin',color:border}});
  cover.getRange('B7:E7').format.rowHeight=32;
  set(cover,'B12','This document has been generated from template ST-FunctionalTestCase-Template, version 1.2');
  fmt(cover,'B12:E12',{font:{name:'Arial',size:10,italic:true,color:'#595959'},wrapText:true});
  set(cover,'B14','Reference Documents – Clearly mark the document used as an input to create the test case');
  fmt(cover,'B14:E14',{fill:green,font:{name:'Arial',size:12,bold:true,color:'#C00000'},wrapText:true,borders:{preset:'outside',style:'medium',color:border}});
  cover.getRange('B15:D15').values=[['Version','Date','Document Name']];
  fmt(cover,'B15:E15',{font:{name:'Arial',size:11,bold:true},horizontalAlignment:'center',borders:{preset:'all',style:'thin',color:border}});
  const refsCover=[
    ['1.2','','Lab3_Buoi6.xlsx — mẫu trình bày testcase'],
    ['','','Nhóm09.xlsx — danh sách yêu cầu và ảnh tham chiếu ban đầu'],
    ['','','Mã nguồn PetNoVa — web-react/src và backend/PetNoVaApi']
  ];
  for(let i=0;i<refsCover.length;i++){
    let r=16+i;set(cover,`B${r}`,refsCover[i][0]);set(cover,`C${r}`,refsCover[i][1]);set(cover,`D${r}`,refsCover[i][2]);
    fmt(cover,`B${r}:E${r}`,{font:{name:'Arial',size:10},wrapText:true,verticalAlignment:'center',borders:{preset:'all',style:'thin',color:border}});
    cover.getRange(`B${r}:E${r}`).format.rowHeight=30;
  }
  set(cover,'B20','KH_A, PET_A và các mã QA_* là ký hiệu dữ liệu cần chuẩn bị khi chạy; trạng thái Passed/Failed được ghi sau khi kiểm thử.');
  fmt(cover,'B20:E20',{font:{name:'Arial',size:10,italic:true,color:'#595959'},wrapText:true});
  cover.getRange('B20:E20').format.rowHeight=32;

  const checklist=wb.worksheets.add('CheckList-GUI');
  checklist.showGridLines=false;checklist.tabColor='#FFC000';
  setWidths(checklist,meta['CheckList-GUI'].widths,'ABC');
  checklist.getRange('A1:C1').merge();set(checklist,'A1','GUI CHECKLIST — PetNoVa');
  fmt(checklist,'A1:C1',{font:{name:'Arial',size:16,bold:true,color:'#C00000'},horizontalAlignment:'center',verticalAlignment:'center'});
  checklist.getRange('A1:C1').format.rowHeight=35;
  checklist.getRange('A3:C3').merge();set(checklist,'A3','x = mục thuộc phạm vi kiểm tra; chưa phải kết quả Passed.');
  fmt(checklist,'A3:C3',{font:{name:'Arial',size:10,italic:true,color:'#595959'}});
  checklist.getRange('A5:C5').values=[['ID','CheckItem','PetNoVa']];
  fmt(checklist,'A5:C5',{fill:'#FFFF00',font:{name:'Arial',size:11,bold:true},horizontalAlignment:'center',verticalAlignment:'center',borders:{preset:'all',style:'thin',color:border}});
  checklist.getRange('A5:C5').format.rowHeight=28;
  const oldItems=extracted.student['CheckList-GUI'].cells;
  for(let i=1;i<=20;i++){
    const r=5+i;
    const label=oldItems[`B${i+1}`];
    if(typeof label!=='string'||!label.trim()) throw Error(`Missing original GUI checklist item ${i}`);
    checklist.getRange(`A${r}:C${r}`).values=[[i,label,'x']];
    fmt(checklist,`A${r}:C${r}`,{font:{name:'Arial',size:11,color:'#1F2937'},wrapText:true,verticalAlignment:'center',borders:{preset:'all',style:'thin',color:border}});
    fmt(checklist,`A${r}`,{horizontalAlignment:'right'});fmt(checklist,`C${r}`,{horizontalAlignment:'center'});
    checklist.getRange(`A${r}:C${r}`).format.rowHeight=30;
  }

  const lookups=wb.worksheets.add('Sheet2');
  lookups.showGridLines=false;lookups.tabColor='#A5A5A5';
  lookups.getRange('D:D').format.columnWidth=12.77734375;
  lookups.getRange('A2').values=[['Priority']];
  lookups.getRange('A3:A5').values=[['High'],['Medium'],['Low']];
  lookups.getRange('D2').values=[['Status']];
  lookups.getRange('D3:D5').values=[['Not Executed'],['Passed'],['Failed']];
  lookups.getRange('G2').values=[['Type']];
  lookups.getRange('G3:G6').values=[['LooknFeel'],['Positive'],['Negative'],['Boundary']];
  fmt(lookups,'A2:G6',{font:{name:'Arial',size:11}});
  for(const cell of ['A2','D2','G2'])fmt(lookups,cell,{font:{name:'Arial',size:11,bold:true},fill:green});

  wb.recalculate();
  const outputPath=path.join(outDir,'Nhóm09.xlsx');
  await (await SpreadsheetFile.exportXlsx(wb)).save(outputPath);
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
  console.log('Saved',outputPath);
  // Every visible worksheet gets a compact visual preview for layout verification.
  for(const name of ['Cover Page','Test Requirements',...Array.from({length:12},(_,i)=>`Testcase_F${i+1}`),'CheckList-GUI','Sheet2']){
    const range=name==='Cover Page'?'B2:E20':name==='Test Requirements'?'A7:J15':name==='CheckList-GUI'?'A1:C12':name==='Sheet2'?'A2:G6':'A20:J29';
    try{
      const png=await wb.render({sheetName:name,range,scale:1,format:'png'});
      await fs.writeFile(path.join(dir,`final_${name.replaceAll(/[^A-Za-z0-9]/g,'_')}.png`),new Uint8Array(await png.arrayBuffer()));
      console.log('Rendered',name);
    }catch(e){console.warn('Render warning',name,e.message);}
  }
  console.log(JSON.stringify(manifest.groups));
}
