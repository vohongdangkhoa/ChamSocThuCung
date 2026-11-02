import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const w=await SpreadsheetFile.importXlsx(await FileBlob.load('D:/Hk1 năm 3/TH_KDCLPM/Lab3_Buoi6.xlsx'));
const p=await w.render({sheetName:'Integrated',range:'A1:J10',scale:1,format:'png'});
await fs.writeFile('C:/Users/vohon/petnova_app/.codex_tmp/testcase_completion/fullnews_previews/lab_integrated.png',new Uint8Array(await p.arrayBuffer()));
