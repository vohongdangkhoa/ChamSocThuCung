import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Local editable slide authoring. Content is read only from the checked source plan.
const taskDir = path.dirname(fileURLToPath(import.meta.url));
const dependencyDir = 'C:/Users/vohon/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES=path.join(dependencyDir,'node/node_modules');
process.env.RUNTIME_NODE=path.join(dependencyDir,'node/bin/node.exe');
process.env.RUNTIME_PYTHON=path.join(dependencyDir,'python/python.exe');
process.env.RUNTIME_BIN_DIR=path.join(dependencyDir,'bin/override');
const skillDir = 'C:/Users/vohon/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations';
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(dependencyDir, 'node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(path.join(dependencyDir, 'node/node_modules/@napi-rs/canvas'));
const sharp = require(path.join(dependencyDir, 'node/node_modules/sharp'));
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);

const W = 1920, H = 1080;
const C = { navy: '#102C40', teal: '#087F82', ivory: '#F8F5ED', ink: '#17364B', secondary: '#496272', white: '#FFFFFF', quiet: '#C5D9DD', lightTeal: '#77CFCA' };
const FONT = 'Arial';
if (!GlobalFonts.families.some(x => x.family === FONT)) throw new Error('Arial is unavailable in the bundled runtime.');
const ctx = createCanvas(10, 10).getContext('2d');
const inputArg = process.argv.find(x => x.startsWith('--plan='));
const inputPath = inputArg ? inputArg.slice(7) : path.join(taskDir, 'slide_plan.json');
const suffixArg = process.argv.find(x => x.startsWith('--revision='));
const revision = suffixArg ? suffixArg.slice(11) : 'v1';
const sample = process.argv.includes('--sample');
const skipFinalize = process.argv.includes('--skip-finalize');
const buildDir = path.join(taskDir, '.build', revision);
const previewDir = path.join(taskDir, 'previews', revision);
const outputDir = path.join(taskDir, 'output');
await Promise.all([buildDir, previewDir, outputDir].map(p => fs.mkdir(p, {recursive:true})));

const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
let plan = structuredClone(Array.isArray(input) ? input : input.slides);
// Keep the five narrow code captures at readable width across two pages.
plan = plan.flatMap(s => s.images?.length === 5 ? [
  {...s, images: s.images.slice(0, 3), paragraphs: s.paragraphs, split_part: 1},
  {...s, images: s.images.slice(3), paragraphs: [], split_part: 2},
] : [s]);
plan.forEach((s,i) => {s.source_slide_id=s.id;s.id=i+1;});
for (const s of plan) {
  for (const image of s.images ?? []) image.path = path.resolve(image.path.replace(/\\+/g, '/'));
}
await fs.writeFile(path.join(taskDir, 'rendered_plan.json'), JSON.stringify({source:input.source,slides:plan},null,2));

const presentation = Presentation.create({slideSize:{width:W,height:H}});
const metrics = [];

function measureLines(text, width, size, bold=false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  // Reserve 4% for inline emphasis and differences between renderer font engines.
  const max = width * 0.96;
  let lines = 0;
  for (const hardLine of text.split('\n')) {
    let line = '';
    const words = hardLine.split(/\s+/).filter(Boolean);
    if (!words.length) {lines++;continue;}
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word;
      if (ctx.measureText(attempt).width <= max) line = attempt;
      else {
        if (line) lines++;
        line = word;
        if (ctx.measureText(word).width > max) {
          let chunk = '';
          for (const c of word) {
            if (chunk && ctx.measureText(chunk+c).width > max) { lines++;chunk=c; }
            else chunk+=c;
          }
          line=chunk;
        }
      }
    }
    if (line) lines++;
  }
  return Math.max(1,lines);
}

function textHeight(text,width,size,lineSpacing=1.34,bold=false) {
  return Math.ceil(measureLines(text,width,size,bold)*size*lineSpacing+size*0.34+3);
}

function addText(slide,text,frame,{size=40,bold=false,color=C.ink,lineSpacing=1.34,name='text',italic=false,emphasis=false,align='left'}={}) {
  const shape=slide.shapes.add({geometry:'textbox',name,position:frame,fill:'none',line:{fill:'none',width:0,style:'solid'}});
  shape.text = text;
  shape.text.style={typeface:FONT,fontSize:size,bold,color,lineSpacing,alignment:align,verticalAlignment:'top',wrap:'square',autoFit:'none',insets:0,italic};
  if(emphasis){
    for(const part of emphasize(text,color)){
      if(typeof part==='string')continue;
      const range=shape.text.get(part.run);
      range.bold=true;
      range.fill=part.style.color;
    }
  }
  return shape;
}

function emphasize(text, baseColor) {
  const regex = /\b(?:FI_\d+(?:–FI_\d+)?|F\d+(?:\.\d+_\d+)?|PENDING|CONFIRMED|IN_PROGRESS|COMPLETED|PAID|FAILED|PASS|Passed|Firebase|Cloudinary|PayOS|SQL Server|SQL|React|ASP\.NET Core|OTP|HTTP|API|273|129|207|255|256|254|128|101|100|88|79|69|66|34|19|16)\b/g;
  const output=[];let cursor=0;
  for (const m of text.matchAll(regex)) {
    if(m.index>cursor)output.push(text.slice(cursor,m.index));
    output.push({run:m[0],style:{bold:true,color:baseColor===C.white?C.lightTeal:C.teal}});
    cursor=m.index+m[0].length;
  }
  if(cursor<text.length)output.push(text.slice(cursor));
  return output.length?output:[text];
}

function footer(slide,number,dark) {
  addText(slide,String(number).padStart(2,'0'),{left:1718,top:1004,width:90,height:42},{size:24,color:dark?C.quiet:C.secondary,align:'right',name:`page-${number}`});
}

function addHeader(slide,title,dark,id) {
  const size=/^F\d+$/.test(title)?84:58;
  const height=textHeight(title,1660,size,1.12,true);
  if(height>210)throw new Error(`Header on slide ${id} is too tall: ${height}px`);
  addText(slide,title,{left:128,top:90,width:1660,height},{size,bold:true,color:dark?C.white:C.ink,lineSpacing:1.12,name:`title-${id}`});
  return Math.max(244,90+height+54);
}

function bodyItems(spec) {
  let titleConsumed=false;
  return (spec.paragraphs??[]).filter(p=>{
    if(!titleConsumed&&p.text.trim()===spec.title.trim()){titleConsumed=true;return false;}
    return Boolean(p.text.trim());
  }).map(p=>p.block_id===68?{...p,text:p.text.replace(/(115|146|243|291|299)/g,'\n$1 ').trim()}:p);
}

function chooseTextSize(items,width,height,{max=44,min=34,gap=28,lineSpacing=1.34}={}) {
  for(let size=max;size>=min;size-=2){
    const measured=items.map(p=>({p,size:p.text.trim().startsWith('[')?Math.max(30,size-6):size}));
    const needed=measured.reduce((n,x)=>n+textHeight(x.p.text,width,x.size,lineSpacing),0)+Math.max(0,items.length-1)*gap;
    if(needed<=height)return {size,needed,measured,gap,lineSpacing};
  }
  const needed=items.reduce((n,p)=>n+textHeight(p.text,width,min,lineSpacing),0)+Math.max(0,items.length-1)*gap;
  throw new Error(`Text does not fit (${needed}>${height}, min${min}px): ${items.map(p=>p.block_id).join(',')}`);
}

function addBody(slide,spec,items,frame,dark,opts={}) {
  const fit=chooseTextSize(items,frame.width,frame.height,opts);
  const maxShift=opts.vCenter?Math.max(0,(frame.height-fit.needed)/2):0;
  let y=frame.top+maxShift;
  for(const {p,size} of fit.measured) {
    const cue=p.text.trim().startsWith('[');
    const h=textHeight(p.text,frame.width,size,fit.lineSpacing);
    addText(slide,p.text,{left:frame.left,top:y,width:frame.width,height:h},{size,color:cue?(dark?C.quiet:C.secondary):(dark?C.white:C.ink),lineSpacing:fit.lineSpacing,name:`source-block-${p.block_id}`,italic:cue,emphasis:!cue});
    metrics.push({slide:spec.id,block_id:p.block_id,kind:'text',font_size:size,left:frame.left,top:y,width:frame.width,height:h,estimated_lines:measureLines(p.text,frame.width,size)});
    y+=h+fit.gap;
  }
}

async function imageMeta(image) {
  const bytes=await fs.readFile(image.path);
  const meta=await sharp(bytes).metadata();
  return {...image,bytes,width:meta.width,height:meta.height};
}

function containRect(image,box,maxUpscale=1.6) {
  const scale=Math.min(box.width/image.width,box.height/image.height,maxUpscale);
  const width=image.width*scale,height=image.height*scale;
  return {left:box.left+(box.width-width)/2,top:box.top+(box.height-height)/2,width,height};
}

function addImage(slide,spec,image,box) {
  const rect=containRect(image,box);
  const buf=image.bytes;
  slide.images.add({blob:buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),contentType:'image/png',alt:path.basename(image.path),fit:'contain',position:rect});
  metrics.push({slide:spec.id,block_id:image.block_id,kind:'image',file:image.path,native_width:image.width,native_height:image.height,...rect});
}

function stackImageBoxes(images,box,gap=28) {
  const widthScale=Math.min(...images.map(im=>box.width/im.width),1.6);
  const nativeTotal=images.reduce((n,im)=>n+im.height,0);
  const scale=Math.min(widthScale,(box.height-gap*(images.length-1))/nativeTotal);
  const used=nativeTotal*scale+gap*(images.length-1);
  let y=box.top+(box.height-used)/2;
  return images.map(im=>{const h=im.height*scale;const b={left:box.left,top:y,width:box.width,height:h};y+=h+gap;return b;});
}

for (const spec of plan) {
  const slide=presentation.slides.add();
  const dark=spec.kind==='cover'||spec.kind==='section';
  slide.background.fill=dark?C.navy:(spec.kind==='image'?C.white:(spec.id%3===0?C.white:C.ivory));
  const items=bodyItems(spec);
  const images=await Promise.all((spec.images??[]).map(imageMeta));
  footer(slide,spec.id,dark);
  if(spec.kind==='cover'){
    const title=spec.paragraphs?.find(p=>p.text.trim())?.text??spec.title;
    const parts=title.match(/^(KỊCH BẢN THUYẾT TRÌNH)\s+(KIỂM THỬ PETNOVA)\s+(— NHÓM 09)$/);
    if(parts){
      addText(slide,parts[1],{left:160,top:278,width:1560,height:88},{size:48,bold:true,color:C.quiet,lineSpacing:1.1,name:'source-cover-1'});
      const main=addText(slide,parts[2],{left:155,top:412,width:1605,height:148},{size:112,bold:true,color:C.white,lineSpacing:1.1,name:'source-cover-2'});
      main.text.get('PETNOVA').fill=C.lightTeal;
      addText(slide,parts[3],{left:160,top:620,width:1560,height:88},{size:48,bold:true,color:C.quiet,lineSpacing:1.1,name:'source-cover-3'});
      metrics.push({slide:spec.id,block_id:spec.paragraphs?.[0]?.block_id,kind:'text',font_size:112,left:155,top:278,width:1605,height:430});
    }else{
      const h=textHeight(title,1560,90,1.13,true);
      addText(slide,title,{left:160,top:(H-h)/2-25,width:1560,height:h},{size:90,bold:true,color:C.white,lineSpacing:1.13,name:'source-cover'});
      metrics.push({slide:spec.id,block_id:spec.paragraphs?.[0]?.block_id,kind:'text',font_size:90,left:160,top:(H-h)/2-25,width:1560,height:h});
    }
  }else{
    const top=addHeader(slide,spec.title,dark,spec.id);
    const content={left:128,top,width:1664,height:968-top};
    if(images.length===0){
      if(items.length)addBody(slide,spec,items,content,dark,{max:spec.kind==='section'?44:46,min:36,gap:34,lineSpacing:1.36,vCenter:spec.kind==='section'});
    }else if(items.length===0){
      const boxes=images.length===1?[content]:stackImageBoxes(images,content,24);
      images.forEach((im,i)=>addImage(slide,spec,im,boxes[i]));
    }else{
      // The source mixed pages use wide code captures, which read best below the text.
      const fit=chooseTextSize(items,content.width,360,{max:42,min:36,gap:24,lineSpacing:1.3});
      addBody(slide,spec,items,{...content,height:fit.needed},dark,{max:fit.size,min:fit.size,gap:24,lineSpacing:1.3});
      const imageBox={left:content.left,top:content.top+fit.needed+34,width:content.width,height:content.height-fit.needed-34};
      if(imageBox.height<130)throw new Error(`No image room on slide ${spec.id}`);
      const boxes=images.length===1?[imageBox]:stackImageBoxes(images,imageBox,24);
      images.forEach((im,i)=>addImage(slide,spec,im,boxes[i]));
    }
  }
  slide.speakerNotes.text=(spec.paragraphs??[]).map(p=>p.text).join('\n\n');
  if(spec.id%10===0)console.log(JSON.stringify({stage:'authored',slide:spec.id,total:plan.length}));
}

await fs.writeFile(path.join(buildDir,'layout_metrics.json'),JSON.stringify(metrics,null,2));
const draft=path.join(buildDir,'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(draft);
console.log(JSON.stringify({stage:'draft',path:draft,slides:plan.length}));

let finalPath=draft;
if(!skipFinalize){
  finalPath=path.join(outputDir,`PETNOVA_NGUYEN_VAN_100_${revision}.pptx`);
  const result=await finalizePresentation({
    workspaceDir:taskDir,candidatePath:draft,finalPath,
    pythonExecutable:path.join(dependencyDir,'python/python.exe'),
    integrityValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_package_integrity.py'),
    layoutValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_layout_geometry.py'),
    explicitTotalSlideCount:plan.length,
    layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-bullet-geometry','--validate-heading-fit'],
    requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],
    fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,
    receiptPath:path.join(buildDir,'validation.json'),
  });
  console.log(JSON.stringify({stage:'validated',finalPath,result}));
}

const renderIndices=sample?[0,1,2,10,19,24,25,42,43,56,69,70].filter(i=>i<plan.length):plan.map((_,i)=>i);
for(const index of renderIndices){
  const slide=presentation.slides.items[index];
  const stem=`slide-${String(index+1).padStart(3,'0')}`;
  const png=await presentation.export({slide,format:'png',scale:1});
  await fs.writeFile(path.join(previewDir,`${stem}.png`),new Uint8Array(await png.arrayBuffer()));
  const layout=await slide.export({format:'layout'});
  await fs.writeFile(path.join(previewDir,`${stem}.layout.json`),await layout.text());
  if((index+1)%5===0||sample)console.log(JSON.stringify({stage:'rendered',slide:index+1,total:plan.length}));
}
await fs.writeFile(path.join(taskDir,'build_result.json'),JSON.stringify({finalPath,draft,previewDir,slides:plan.length,rendered:renderIndices.length,metrics:path.join(buildDir,'layout_metrics.json')},null,2));
console.log(JSON.stringify({stage:'complete',finalPath,previewDir,slides:plan.length,rendered:renderIndices.length}));
