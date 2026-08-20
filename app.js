import { normalizeData, basicEIS, calculateDIA, buildSpectra, processSlope, reconstructPoint } from './core.js';

const $ = id => document.getElementById(id);
const state = {
  data: null,
  originalData: null,
  dia: null,
  spectra: null,
  fileName: '',
  rangeStart: 0,
  rangeEnd: 1,
  correctionPreview: null,
  undoStack: [],
  selectedPoint: 0,
};

const colors = {
  data: '#293534', T: '#73956f', R: '#c67b73', C: '#6f8fad', Rs: '#9b82aa',
  Z: '#4c5554', phase: '#62a4a0', Ceff: '#555555', secondaryT: '#73956f', oneMinusN: '#6f8fad', n: '#c67b73',
  reference: '#4f7fbe', preview: '#4f9b68', range: '#8a9c98'
};

function setStatus(message, type='info') {
  const el = $('status'); el.textContent = message; el.className = `status ${type}`;
}
function fmt(v, digits=4) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if ((a !== 0 && a < 1e-3) || a >= 1e4) return v.toExponential(3);
  return v.toLocaleString(undefined, { maximumSignificantDigits: digits });
}
function currentOptions() {
  return {
    densification: Number($('densification').value), smoothP: Number($('smoothingP').value),
    smoothing: $('smoothingEnabled').checked, roundPrimary: Number($('roundPrimary').value),
    roundSecondary: Number($('roundSecondary').value), selectivity: Number($('selectivity').value)
  };
}
function visible(name) { return document.querySelector(`[data-series="${name}"]`)?.checked ?? false; }

function parseDelimited(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return lines.map(line => line.split(/[;,\t ]+/).map(v => v.trim())).filter(r => r.length >= 3);
}

async function readFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    return normalizeData(parseDelimited(await file.text()));
  }
  if (!globalThis.XLSX) throw new Error('SheetJS did not load; XLS/XLSX import is unavailable.');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  return normalizeData(rows);
}

function demoData() {
  const freq=[];
  const n=61, fmax=1e5, fmin=1e-2;
  for(let i=0;i<n;i++) freq.push(10**(Math.log10(fmax)+i*(Math.log10(fmin/fmax)/(n-1))));
  const Rs=4.5, R1=95, C1=22e-6, R2=460, C2=1.7e-3;
  const re=[], im=[];
  freq.forEach((f,i)=>{
    const w=2*Math.PI*f;
    const z1re=R1/(1+(w*R1*C1)**2), z1im=-w*R1*R1*C1/(1+(w*R1*C1)**2);
    const z2re=R2/(1+(w*R2*C2)**2), z2im=-w*R2*R2*C2/(1+(w*R2*C2)**2);
    const ripple=1+0.002*Math.sin(i*1.73);
    re.push((Rs+z1re+z2re)*ripple); im.push((z1im+z2im)*(2-ripple));
  });
  return {frequency:freq,re,im};
}

function activateUI() {
  ['exportButton','recalculateButton','rangeHigh','rangeLow','pointIndex','previewCorrection'].forEach(id => $(id).disabled=false);
  $('pointIndex').max = state.data.frequency.length;
}

function updateStats() {
  if (!state.data) return;
  $('fileInfo').textContent = state.fileName || 'Dataset';
  $('pointsCount').textContent = state.data.frequency.length;
  $('fMax').textContent = `${fmt(Math.max(...state.data.frequency))} Hz`;
  $('fMin').textContent = `${fmt(Math.min(...state.data.frequency))} Hz`;
}

function recalculate(resetRange=false) {
  if (!state.data) return;
  try {
    state.dia = calculateDIA(state.data, currentOptions());
    const max = state.dia.primary.nu.length-1;
    $('rangeHigh').max=max; $('rangeLow').max=max;
    if (resetRange || state.rangeEnd > max) {
      state.rangeStart = Math.round(max*0.15); state.rangeEnd = Math.round(max*0.85);
    }
    $('rangeHigh').value=state.rangeStart; $('rangeLow').value=state.rangeEnd;
    state.correctionPreview=null; $('replacePoint').disabled=true;
    updateAllPlots(); updateRangeLabels(); updateTable();
    setStatus(`DIA calculated on ${state.data.frequency.length} EIS points (${state.dia.primary.nu.length} densified points).`, 'success');
  } catch(err) {
    console.error(err); setStatus(err.message || String(err), 'error');
  }
}

const plotConfig = {responsive:true, displaylogo:false, scrollZoom:true, toImageButtonOptions:{format:'svg', filename:'DIALab_plot'}};
function baseLayout(title,xTitle,yTitle) {
  return {title:{text:title,font:{size:15}}, margin:{l:64,r:28,t:48,b:56}, paper_bgcolor:'#fff', plot_bgcolor:'#fff',
    xaxis:{title:xTitle,gridcolor:'#e8eeee',zerolinecolor:'#d7e0de'}, yaxis:{title:yTitle,gridcolor:'#e8eeee',zerolinecolor:'#d7e0de'},
    legend:{orientation:'h',y:1.1,x:0}, hovermode:'closest', font:{family:'Inter, system-ui, sans-serif',size:11,color:'#33413f'}};
}

function decadeAnnotations() {
  const targets=[1e3,1e2,1e1,1,1e-1,1e-2];
  const labels=['1 kHz','100 Hz','10 Hz','1 Hz','0.1 Hz','0.01 Hz'];
  const out=[];
  targets.forEach((t,j)=>{
    let idx=0,best=Infinity;
    state.data.frequency.forEach((f,i)=>{const d=Math.abs(Math.log10(f)-Math.log10(t)); if(d<best){best=d;idx=i;}});
    if(best<0.55) out.push({x:state.data.re[idx],y:-state.data.im[idx],text:labels[j],showarrow:true,arrowhead:0,ax:25,ay:-18,font:{size:10}});
  });
  return out;
}

function correctionTracesNyquist() {
  const traces=[];
  if (!state.correctionPreview) return traces;
  const c=state.correctionPreview;
  if ($('showReferences').checked) traces.push({x:[state.data.re[c.idxH],state.data.re[c.idxL]],y:[-state.data.im[c.idxH],-state.data.im[c.idxL]],mode:'markers',name:'Reference',marker:{size:10,color:colors.reference,symbol:'circle'}});
  traces.push({x:[c.re],y:[-c.im],mode:'markers',name:'Reconstructed',marker:{size:12,color:colors.preview,symbol:'diamond'}});
  return traces;
}

function renderEIS() {
  if (!state.data) return;
  const basic=basicEIS(state.data);
  const nyq=[{x:state.data.re,y:state.data.im.map(v=>-v),mode:'lines+markers',name:'Data',line:{color:colors.data,width:2},marker:{size:5,color:colors.data},customdata:state.data.frequency.map((f,i)=>[f,state.data.re[i],state.data.im[i]]),hovertemplate:'f=%{customdata[0]:.4g} Hz<br>Z′=%{customdata[1]:.5g} Ω<br>Z″=%{customdata[2]:.5g} Ω<extra></extra>'},...correctionTracesNyquist()];
  const l1=baseLayout('Nyquist plot','Z′ [Ω]','−Z″ [Ω]'); l1.yaxis.scaleanchor='x'; l1.yaxis.scaleratio=1; l1.annotations=decadeAnnotations();
  Plotly.react('nyquistPlot',nyq,l1,plotConfig);

  const bode=[
    {x:state.data.frequency,y:basic.magnitude,mode:'lines+markers',name:'|Z|',line:{color:'#556f84'},marker:{size:4},yaxis:'y'},
    {x:state.data.frequency,y:basic.phase,mode:'lines+markers',name:'Phase',line:{color:'#8b7163'},marker:{size:4},yaxis:'y2'}
  ];
  const l2=baseLayout('Bode plot','Frequency [Hz]','|Z| [Ω]');
  l2.xaxis.type='log'; l2.xaxis.autorange='reversed'; l2.yaxis.type='log';
  l2.yaxis2={title:'Phase [°]',overlaying:'y',side:'right',gridcolor:'rgba(0,0,0,0)'}; l2.margin.r=65;
  Plotly.react('bodePlot',bode,l2,plotConfig);
}

function rangeShapes(xmin,xmax) {
  return [
    {type:'rect',xref:'x',yref:'paper',x0:xmin,x1:xmax,y0:0,y1:1,fillcolor:'rgba(92,126,118,.08)',line:{width:0},layer:'below'},
    {type:'line',xref:'x',yref:'paper',x0:xmin,x1:xmin,y0:0,y1:1,line:{color:colors.range,width:2,dash:'dash'}},
    {type:'line',xref:'x',yref:'paper',x0:xmax,x1:xmax,y0:0,y1:1,line:{color:colors.range,width:2,dash:'dash'}}
  ];
}

function renderPrimary() {
  if (!state.dia) return;
  const p=state.dia.primary, traces=[];
  if(visible('T')) traces.push({x:p.nu,y:p.logT,name:'log T',mode:'lines',line:{color:colors.T,width:2}});
  if(visible('R')) traces.push({x:p.nu,y:p.logR,name:'log R',mode:'lines',line:{color:colors.R,width:2}});
  if(visible('C')) traces.push({x:p.nu,y:p.logC,name:'log C',mode:'lines',line:{color:colors.C,width:2}});
  if(visible('Rs')) traces.push({x:p.nu,y:p.logRs,name:'log Rs',mode:'lines',line:{color:colors.Rs,width:2}});
  if(visible('Z')) {
    const b=basicEIS(state.data); const nu=state.data.frequency.slice(1).map(f=>Math.log10(1/(2*Math.PI*f)));
    traces.push({x:nu,y:b.magnitude.slice(1).map(v=>Math.log10(Math.abs(v))),name:'log |Z|',mode:'lines',line:{color:colors.Z,width:1.5}});
  }
  if(visible('phase')) {
    const b=basicEIS(state.data); const nu=state.data.frequency.slice(1).map(f=>Math.log10(1/(2*Math.PI*f)));
    traces.push({x:nu,y:b.phase.slice(1),name:'θ [°]',mode:'lines',line:{color:colors.phase,width:1.5,dash:'dot'},yaxis:'y2'});
  }
  if(visible('Ceff')) {
    traces.push({x:state.dia.secondary.nu,y:state.dia.secondary.logCeff,name:'log Ceff',mode:'lines',line:{color:colors.Ceff,width:1.7}});
  }
  const lo=Math.min(state.rangeStart,state.rangeEnd), hi=Math.max(state.rangeStart,state.rangeEnd);
  const l=baseLayout('Primary DIA — temporal plot','ν = log₁₀(1/ω)','log₁₀(P)');
  l.shapes=rangeShapes(p.nu[lo],p.nu[hi]);
  if(visible('phase')) l.yaxis2={title:'Phase [°]',overlaying:'y',side:'right',showgrid:false};
  Plotly.react('primaryTemporal',traces,l,plotConfig);
}

function renderSecondary() {
  if (!state.dia) return;
  const s=state.dia.secondary;
  const traces=[];
  if(visible('T')) traces.push({x:s.nu,y:s.secondaryT,name:'secondary T',mode:'lines',line:{color:colors.secondaryT,width:2}});
  if(visible('R')) traces.push({x:s.nu,y:s.n,name:'n',mode:'lines',line:{color:colors.n,width:2}});
  if(visible('C')) traces.push({x:s.nu,y:s.oneMinusN,name:'1−n',mode:'lines',line:{color:colors.oneMinusN,width:2}});
  const lo=Math.min(state.rangeStart,state.rangeEnd), hi=Math.min(Math.max(state.rangeStart,state.rangeEnd),s.nu.length-1);
  const l=baseLayout('Secondary DIA — differential temporal plot','ν = log₁₀(1/ω)','Differential parameter');
  l.shapes=rangeShapes(s.nu[Math.min(lo,s.nu.length-1)],s.nu[hi]);
  Plotly.react('secondaryTemporal',traces,l,plotConfig);
}

function barTrace(spec,name,color){return {x:spec.x,y:spec.y,type:'bar',name,marker:{color,opacity:.72,line:{width:0}},hovertemplate:`${name}: %{x}<br>weight: %{y:.4g}<extra></extra>`};}
function renderSpectra() {
  if(!state.dia) return;
  state.spectra=buildSpectra(state.dia,state.rangeStart,state.rangeEnd,currentOptions());
  const p=state.spectra.primary,s=state.spectra.secondary;
  const pt=[],st=[];
  if(visible('T')) pt.push(barTrace(p.T,'T',colors.T));
  if(visible('R')) pt.push(barTrace(p.R,'R',colors.R));
  if(visible('C')) pt.push(barTrace(p.C,'C',colors.C));
  if(visible('Rs')) pt.push(barTrace(p.Rs,'Rs',colors.Rs));
  if(visible('T')) st.push(barTrace(s.T,'secondary T',colors.T));
  if(visible('R')) st.push(barTrace(s.n,'n',colors.R));
  if(visible('C')) st.push(barTrace(s.oneMinusN,'1−n',colors.C));
  if(visible('Ceff')) st.push(barTrace(s.Ceff,'log Ceff',colors.Ceff));
  const lp=baseLayout('Primary parameter spectra','Parameter value','Weighted count / a.u.'); lp.barmode='overlay';
  const ls=baseLayout('Secondary parameter spectra','Parameter value','Weighted count / a.u.'); ls.barmode='overlay';
  Plotly.react('primarySpectrum',pt,lp,plotConfig); Plotly.react('secondarySpectrum',st,ls,plotConfig);
}

function updateAllPlots(){renderEIS();renderPrimary();renderSecondary();renderSpectra();}

function updateRangeLabels(){
  if(!state.dia)return;
  const p=state.dia.primary; let a=Number($('rangeHigh').value), b=Number($('rangeLow').value);
  if(a>b){[a,b]=[b,a];}
  state.rangeStart=a;state.rangeEnd=b;
  $('rangeHighLabel').textContent=`${fmt(p.frequency[a])} Hz`; $('rangeLowLabel').textContent=`${fmt(p.frequency[b])} Hz`;
  const n=processSlope(state.dia,a,b); $('processN').textContent=Number.isFinite(n)?fmt(n,4):'—';
  $('processSpan').textContent=`${fmt(p.frequency[a])} → ${fmt(p.frequency[b])} Hz`;
}

function updateTable(){
  if(!state.data)return;
  const b=basicEIS(state.data), tbody=$('dataTable').querySelector('tbody'); tbody.innerHTML='';
  state.data.frequency.forEach((f,i)=>{
    const tr=document.createElement('tr'); if(i===state.selectedPoint)tr.classList.add('selected');
    tr.innerHTML=`<td>${i+1}</td><td>${fmt(f,7)}</td><td>${fmt(state.data.re[i],7)}</td><td>${fmt(state.data.im[i],7)}</td><td>${fmt(b.magnitude[i],7)}</td><td>${fmt(b.phase[i],6)}</td>`;
    tr.addEventListener('click',()=>{state.selectedPoint=i;$('pointIndex').value=i+1;updateTable();previewCorrection();}); tbody.appendChild(tr);
  });
}

function previewCorrection(){
  if(!state.data)return;
  try{
    const idx=Math.max(0,Math.min(state.data.frequency.length-1,Number($('pointIndex').value)-1)); state.selectedPoint=idx;
    const c=reconstructPoint(state.data,idx,$('useHigher').checked); state.correctionPreview=c;
    $('replacePoint').disabled=false;
    $('correctionInfo').textContent=`Point ${idx+1}: (${fmt(state.data.re[idx])}, ${fmt(state.data.im[idx])}) → (${fmt(c.re)}, ${fmt(c.im)}) Ω; references ${c.idxH+1}, ${c.idxL+1}.`;
    renderEIS();updateTable();
  }catch(err){state.correctionPreview=null;$('replacePoint').disabled=true;$('correctionInfo').textContent=err.message;setStatus(err.message,'warn');renderEIS();}
}

function replacePoint(){
  const c=state.correctionPreview;if(!c)return;
  state.undoStack.push({index:c.index,re:state.data.re[c.index],im:state.data.im[c.index]});
  state.data.re[c.index]=c.re;state.data.im[c.index]=c.im;state.correctionPreview=null;
  $('undoPoint').disabled=state.undoStack.length===0;$('replacePoint').disabled=true;
  $('correctionInfo').textContent=`Point ${c.index+1} replaced. DIA recalculated.`;recalculate(false);
}
function undoPoint(){
  const u=state.undoStack.pop();if(!u)return; state.data.re[u.index]=u.re;state.data.im[u.index]=u.im;
  $('undoPoint').disabled=state.undoStack.length===0;state.selectedPoint=u.index;$('pointIndex').value=u.index+1;recalculate(false);
}

function exportWorkbook(){
  if(!state.data||!state.dia)return;
  if(!globalThis.XLSX){setStatus('SheetJS is unavailable; cannot create XLSX.','error');return;}
  const wb=XLSX.utils.book_new(); const b=basicEIS(state.data);
  const eis=[['frequency_Hz','Zreal_Ohm','Zimag_Ohm','Zmodulus_Ohm','phase_deg']];
  state.data.frequency.forEach((f,i)=>eis.push([f,state.data.re[i],state.data.im[i],b.magnitude[i],b.phase[i]]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(eis),'EIS');
  const p=[['frequency_Hz','nu','logT','logR','logC','logRs','T','R','C','Rs']];
  state.dia.primary.nu.forEach((nu,i)=>p.push([state.dia.primary.frequency[i],nu,state.dia.primary.logT[i],state.dia.primary.logR[i],state.dia.primary.logC[i],state.dia.primary.logRs[i],state.dia.primary.T[i],state.dia.primary.R[i],state.dia.primary.C[i],state.dia.primary.Rs[i]]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(p),'Primary DIA');
  const s=[['nu','n','secondary_T','one_minus_n','A_CPE','Ceff','logCeff']];
  state.dia.secondary.nu.forEach((nu,i)=>s.push([nu,state.dia.secondary.n[i],state.dia.secondary.secondaryT[i],state.dia.secondary.oneMinusN[i],state.dia.secondary.Acpe[i],state.dia.secondary.Ceff[i],state.dia.secondary.logCeff[i]]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s),'Secondary DIA');
  const sp=state.spectra||buildSpectra(state.dia,state.rangeStart,state.rangeEnd,currentOptions());
  const rows=[['series','parameter_value','weighted_count']];
  const add=(name,o)=>o.x.forEach((x,i)=>rows.push([name,x,o.y[i]]));
  Object.entries(sp.primary).forEach(([k,v])=>add(`primary_${k}`,v)); Object.entries(sp.secondary).forEach(([k,v])=>add(`secondary_${k}`,v));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Spectra');
  const base=(state.fileName||'DIALab').replace(/\.[^.]+$/,'').replace(/[^A-Za-z0-9_-]+/g,'_'); XLSX.writeFile(wb,`${base}_DIA.xlsx`);
}

async function loadDataset(data,name){
  state.data={frequency:[...data.frequency],re:[...data.re],im:[...data.im]}; state.originalData=structuredClone(state.data);state.fileName=name;state.undoStack=[];state.selectedPoint=0;
  activateUI();updateStats();$('undoPoint').disabled=true;$('pointIndex').value=1;recalculate(true);
}

$('fileInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{setStatus(`Reading ${f.name}…`);await loadDataset(await readFile(f),f.name);}catch(err){console.error(err);setStatus(err.message||String(err),'error');}finally{e.target.value='';}});
$('demoButton').addEventListener('click',()=>loadDataset(demoData(),'demo_two_R-C_processes.csv'));
$('recalculateButton').addEventListener('click',()=>recalculate(false));
$('exportButton').addEventListener('click',exportWorkbook);
['densification','smoothingP','roundPrimary','roundSecondary','selectivity','smoothingEnabled'].forEach(id=>$(id).addEventListener('change',()=>state.data&&recalculate(false)));
document.querySelectorAll('[data-series]').forEach(el=>el.addEventListener('change',()=>state.data&&updateAllPlots()));
['rangeHigh','rangeLow'].forEach(id=>$(id).addEventListener('input',()=>{if(!state.dia)return;updateRangeLabels();renderPrimary();renderSecondary();renderSpectra();}));
$('pointIndex').addEventListener('change',previewCorrection);$('useHigher').addEventListener('change',previewCorrection);$('showReferences').addEventListener('change',()=>state.data&&renderEIS());
$('previewCorrection').addEventListener('click',previewCorrection);$('replacePoint').addEventListener('click',replacePoint);$('undoPoint').addEventListener('click',undoPoint);
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-page').forEach(p=>p.classList.remove('active'));tab.classList.add('active');$(tab.dataset.tab).classList.add('active');window.dispatchEvent(new Event('resize'));}));

document.addEventListener('DOMContentLoaded',()=>{
  const deps=[];deps.push(globalThis.Plotly?'Plotly ✓':'Plotly ✗');deps.push(globalThis.XLSX?'SheetJS ✓':'SheetJS ✗');deps.push(globalThis.csapsjs?.csaps?'CSAPS ✓':'CSAPS fallback: PCHIP');$('dependencyStatus').textContent=deps.join(' · ');
});
