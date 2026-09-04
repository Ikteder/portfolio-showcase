const modelData = [
  {name:'MobileNetV3', accuracy:86.0, latency:18.829, size:16.911, reason:'The compact trade-off: strong accuracy without the latency and footprint of the largest vision model.'},
  {name:'EfficientNet-B0', accuracy:89.0, latency:31.252, size:16.133, reason:'The balanced choice: higher demo accuracy than MobileNetV3 at a similar model size, with added latency.'},
  {name:'ConvNeXt-Tiny', accuracy:94.0, latency:84.127, size:111.343, reason:'The quality-first choice: the highest vision accuracy in this demo, with the largest latency and memory cost.'}
];

const priority = document.querySelector('#priority');
const recommendation = document.querySelector('#recommended-model');
const reason = document.querySelector('#recommended-reason');
const accuracy = document.querySelector('#metric-accuracy');
const latency = document.querySelector('#metric-latency');
const svg = document.querySelector('#tradeoff-chart');
const ns = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) { const el = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v)); return el; }
function drawChart(selected = 0) {
  const grid = svg.querySelector('.grid'); const axes = svg.querySelector('.axes'); const points = svg.querySelector('.points');
  if (!grid.childElementCount) {
    [90,170,250,330].forEach((y,i) => { grid.append(svgEl('line',{x1:60,y1:y,x2:680,y2:y})); const t=svgEl('text',{x:12,y:y+4}); t.textContent=`${96-i*4}%`; axes.append(t); });
    [20,40,60,80].forEach((v,i) => { grid.append(svgEl('line',{x1:80+i*150,y1:50,x2:80+i*150,y2:365})); const t=svgEl('text',{x:65+i*150,y:395}); t.textContent=`${v} ms`; axes.append(t); });
  }
  points.replaceChildren();
  modelData.forEach((m,i) => {
    const x=80+(m.latency-20)/60*450; const y=330-(m.accuracy-84)/12*240;
    const c=svgEl('circle',{cx:x,cy:y,r:i===selected?15:9,fill:i===selected?'#c9ff5e':'#667080',opacity:i===selected?'1':'.62'});
    const t=svgEl('text',{x:x+18,y:y+5}); t.textContent=m.name; points.append(c,t);
  });
}
function updateModel() {
  const value=Number(priority.value); const index=value<34?0:value<68?1:2; const m=modelData[index];
  recommendation.textContent=m.name; reason.textContent=m.reason; accuracy.textContent=`${m.accuracy.toFixed(1)}%`; latency.textContent=`${m.latency.toFixed(3)} ms`; drawChart(index);
}
priority.addEventListener('input', updateModel); updateModel();

const weightSlider=document.querySelector('#weight-slider');
function formatSigned(value,digits=2){const fixed=Math.abs(value).toFixed(digits);return value<0?`−${fixed}`:fixed;}
function updateWeight(){
  const value=Number(weightSlider.value)/100;
  const sign=value<0?-1:1;
  const candidates=[0,.125,.25,.5,1];
  const magnitude=Math.abs(value);
  const nearest=candidates.reduce((best,n)=>Math.abs(n-magnitude)<Math.abs(best-magnitude)?n:best,0);
  const quantized=sign*nearest;
  const exponent=nearest===0?null:Math.round(Math.log2(nearest));
  document.querySelector('#weight-output').textContent=formatSigned(value);
  document.querySelector('#weight-original').textContent=formatSigned(value);
  document.querySelector('#weight-quantized').innerHTML=nearest===0?'0':`${quantized<0?'−':''}2<sup>${exponent<0?'−':''}${Math.abs(exponent)}</sup>`;
  document.querySelector('#weight-operation').textContent=nearest===0?'zero skip':`${quantized<0?'sign + ':''}${exponent===0?'no shift':`right shift ${Math.abs(exponent)}`}`;
  document.querySelector('#quant-error').textContent=`Absolute rounding error: ${Math.abs(value-quantized).toFixed(3)}`;
  document.querySelector('#weight-marker').style.left=`${(value+1)/2*100}%`;
}
weightSlider.addEventListener('input',updateWeight);updateWeight();

const driftSlider=document.querySelector('#drift-slider');
function curvePath(mean){const pts=[];for(let i=0;i<=80;i++){const x=-3+i/80*6;const y=Math.exp(-.5*(x-mean)**2);pts.push(`${i?'L':'M'} ${30+i/80*560} ${205-y*155}`);}return pts.join(' ');}
function updateDrift(){
  const shift=Number(driftSlider.value)/100;
  document.querySelector('#drift-output').textContent=`${shift.toFixed(2)}σ`;
  document.querySelector('#baseline-curve').setAttribute('d',curvePath(0));
  document.querySelector('#current-curve').setAttribute('d',curvePath(shift));
  const label=document.querySelector('#drift-label'),action=document.querySelector('#drift-action'),light=document.querySelector('#drift-light');
  if(shift<.5){label.textContent='Stable';action.textContent='Continue monitoring. No intervention indicated.';light.style.background='#c9ff5e';light.style.boxShadow='0 0 14px #c9ff5e';}
  else if(shift<1.2){label.textContent='Watch';action.textContent='Inspect slices and recent operating conditions.';light.style.background='#ffd25e';light.style.boxShadow='0 0 14px #ffd25e';}
  else{label.textContent='Investigate';action.textContent='Review failure modes before trusting predictions.';light.style.background='#ff6846';light.style.boxShadow='0 0 14px #ff6846';}
}
driftSlider.addEventListener('input',updateDrift);updateDrift();

const datasetSelect=document.querySelector('#dataset-select');
const noiseSlider=document.querySelector('#noise-slider');
const trainButton=document.querySelector('#train-model');
const resetButton=document.querySelector('#reset-model');
const boundaryGrid=document.querySelector('#boundary-grid');
const samplePoints=document.querySelector('#sample-points');
const hiddenUnits=8;
let samples=[],network={},epoch=0,lossHistory=[],isTraining=false;

function seededRandom(seed){let state=seed>>>0;return()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function buildDataset(){
  const type=datasetSelect.value,noise=Number(noiseSlider.value)/100;
  const seed={linear:1049,xor:2081,wave:4093}[type]+Number(noiseSlider.value);
  const random=seededRandom(seed); samples=[];
  for(let i=0;i<120;i++){
    const cleanX=random()*2-1,cleanY=random()*2-1;
    let label=cleanX+cleanY>0?1:0;
    if(type==='xor')label=(cleanX>0)!==(cleanY>0)?1:0;
    if(type==='wave')label=cleanY>.45*Math.sin(cleanX*3)?1:0;
    const x=clamp(cleanX+(random()-.5)*noise*1.5,-1.15,1.15);
    const y=clamp(cleanY+(random()-.5)*noise*1.5,-1.15,1.15);
    samples.push({x,y,label});
  }
}
function initializeNetwork(){
  const random=seededRandom(731+datasetSelect.selectedIndex*97);
  network={w1:Array.from({length:hiddenUnits},()=>[(random()-.5)*1.5,(random()-.5)*1.5]),b1:Array(hiddenUnits).fill(0),w2:Array.from({length:hiddenUnits},()=> (random()-.5)*1.5),b2:0};
  epoch=0;lossHistory=[];
}
function predict(x,y){
  const hidden=network.w1.map((w,j)=>Math.tanh(w[0]*x+w[1]*y+network.b1[j]));
  const logit=hidden.reduce((sum,h,j)=>sum+h*network.w2[j],network.b2);
  return {hidden,probability:1/(1+Math.exp(-clamp(logit,-20,20)))};
}
function trainEpoch(){
  const gw1=Array.from({length:hiddenUnits},()=>[0,0]),gb1=Array(hiddenUnits).fill(0),gw2=Array(hiddenUnits).fill(0);let gb2=0;
  samples.forEach(s=>{const {hidden,probability}=predict(s.x,s.y);const outputDelta=probability-s.label;gb2+=outputDelta;hidden.forEach((h,j)=>{gw2[j]+=outputDelta*h;const hiddenDelta=outputDelta*network.w2[j]*(1-h*h);gw1[j][0]+=hiddenDelta*s.x;gw1[j][1]+=hiddenDelta*s.y;gb1[j]+=hiddenDelta;});});
  const rate=.8/samples.length;for(let j=0;j<hiddenUnits;j++){network.w1[j][0]-=rate*gw1[j][0];network.w1[j][1]-=rate*gw1[j][1];network.b1[j]-=rate*gb1[j];network.w2[j]-=rate*gw2[j];}network.b2-=rate*gb2;epoch++;
}
function metrics(){let loss=0,correct=0;samples.forEach(s=>{const p=predict(s.x,s.y).probability;loss-=s.label*Math.log(Math.max(p,1e-7))+(1-s.label)*Math.log(Math.max(1-p,1e-7));correct+=(p>=.5)==s.label;});return{loss:loss/samples.length,accuracy:correct/samples.length};}
function probabilityColor(p){const a=[27,61,130],b=[226,82,61];const mix=a.map((v,i)=>Math.round(v+(b[i]-v)*p));return`rgb(${mix.join(',')})`;}
function renderPlayground(){
  boundaryGrid.replaceChildren();samplePoints.replaceChildren();const columns=28,rows=20;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const x=-1.2+(col+.5)/columns*2.4,y=1.2-(row+.5)/rows*2.4,p=predict(x,y).probability;boundaryGrid.append(svgEl('rect',{class:'boundary-cell',x:col*640/columns,y:row*470/rows,width:640/columns+.5,height:470/rows+.5,fill:probabilityColor(p)}));}
  samples.forEach(s=>samplePoints.append(svgEl('circle',{class:'sample-dot',cx:(s.x+1.2)/2.4*640,cy:(1.2-s.y)/2.4*470,r:5,fill:s.label?'#ffdeca':'#bfe4ff'})));
  const result=metrics();document.querySelector('#epoch-value').textContent=epoch;document.querySelector('#loss-value').textContent=result.loss.toFixed(3);document.querySelector('#accuracy-value').textContent=`${(result.accuracy*100).toFixed(1)}%`;
  if(!lossHistory.length||epoch>0)lossHistory.push(result.loss);const recent=lossHistory.slice(-120),high=Math.max(.72,...recent),low=Math.min(...recent)*.96;const span=Math.max(.05,high-low);document.querySelector('#loss-line').setAttribute('points',recent.map((value,i)=>`${i/Math.max(1,recent.length-1)*420},${65-(value-low)/span*58}`).join(' '));
}
function resetPlayground(){buildDataset();initializeNetwork();renderPlayground();document.querySelector('#training-state').textContent='READY';}
function setTraining(active){isTraining=active;trainButton.disabled=active;resetButton.disabled=active;datasetSelect.disabled=active;noiseSlider.disabled=active;document.querySelector('#training-state').textContent=active?'TRAINING…':'UPDATED';}
trainButton.addEventListener('click',async()=>{if(isTraining)return;setTraining(true);const chunks=reduced?1:10,perChunk=200/chunks;for(let chunk=0;chunk<chunks;chunk++){for(let i=0;i<perChunk;i++)trainEpoch();renderPlayground();if(!reduced)await new Promise(resolve=>requestAnimationFrame(resolve));}setTraining(false);});
resetButton.addEventListener('click',resetPlayground);
datasetSelect.addEventListener('change',resetPlayground);
noiseSlider.addEventListener('input',()=>{document.querySelector('#noise-output').textContent=(Number(noiseSlider.value)/100).toFixed(2);resetPlayground();});
resetPlayground();

const tabs=[...document.querySelectorAll('[role=tab]')];
tabs.forEach((tab,index)=>tab.addEventListener('click',()=>selectTab(index)));
tabs.forEach((tab,index)=>tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const next=(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(next);tabs[next].focus();}));
function selectTab(index){tabs.forEach((tab,i)=>{const active=i===index;tab.setAttribute('aria-selected',active);document.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden=!active;});}

const scenarios=[
  {tag:'ON-DEVICE',title:'A battery-powered camera needs a useful result before the next frame.',detail:'Latency matters most. Some accuracy can be traded for a substantially lighter response.',answer:'MobileNetV3',why:'MobileNetV3 is the best fit here: 18.829 ms latency versus 84.127 ms for ConvNeXt-Tiny in the documented demo.'},
  {tag:'QUALITY GATE',title:'An offline review can wait, but missing a visual pattern is costly.',detail:'Choose the highest measured vision accuracy; latency is secondary.',answer:'ConvNeXt-Tiny',why:'ConvNeXt-Tiny leads this demo at 94.0% accuracy. Its 84.127 ms latency is acceptable only because the brief prioritizes quality.'},
  {tag:'BALANCED',title:'A local assistant needs a compact model with extra quality headroom.',detail:'Model size must stay near 17 MB, but you can accept moderate latency.',answer:'EfficientNet-B0',why:'EfficientNet-B0 reaches 89.0% accuracy at 16.133 MB—the highest quality among the two compact options in this demo.'}
];
let scenarioIndex=0, score=0;
const choices=document.querySelector('#choices'), verdict=document.querySelector('#verdict'), next=document.querySelector('#next-scenario');
function renderScenario(){const s=scenarios[scenarioIndex];document.querySelector('#scenario-count').textContent=`Scenario ${scenarioIndex+1} of ${scenarios.length}`;document.querySelector('#scenario-tag').textContent=s.tag;document.querySelector('#scenario-title').textContent=s.title;document.querySelector('#scenario-detail').textContent=s.detail;verdict.textContent='';next.hidden=true;choices.replaceChildren();modelData.forEach(m=>{const b=document.createElement('button');b.textContent=`${m.name} — ${m.accuracy.toFixed(0)}% / ${m.latency.toFixed(1)} ms / ${m.size.toFixed(1)} MB`;b.addEventListener('click',()=>answer(b,m.name));choices.append(b);});}
function answer(button,name){const s=scenarios[scenarioIndex];[...choices.children].forEach(b=>b.disabled=true);if(name===s.answer){button.classList.add('correct');score++;document.querySelector('#score').textContent=score;verdict.textContent=`Good call. ${s.why}`;}else{button.classList.add('wrong');[...choices.children].find(b=>b.textContent.startsWith(s.answer)).classList.add('correct');verdict.textContent=`Not for this brief. ${s.why}`;}next.textContent=scenarioIndex===scenarios.length-1?'Replay decisions ↻':'Next scenario →';next.hidden=false;}
next.addEventListener('click',()=>{scenarioIndex++;if(scenarioIndex>=scenarios.length){scenarioIndex=0;score=0;document.querySelector('#score').textContent=0;}renderScenario();});renderScenario();

const progress=document.querySelector('#scroll-progress');addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;progress.style.width=`${max?scrollY/max*100:0}%`;},{passive:true});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

const canvas=document.querySelector('#field'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let dots=[],pointer={x:.72,y:.45};
function resize(){const dpr=Math.min(devicePixelRatio,2);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);dots=Array.from({length:85},(_,i)=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*2+.4,z:Math.random(),phase:i}));}
addEventListener('resize',resize);addEventListener('pointermove',e=>{pointer={x:e.clientX/innerWidth,y:e.clientY/innerHeight};},{passive:true});resize();
function paint(time=0){ctx.clearRect(0,0,innerWidth,innerHeight);const gx=innerWidth*pointer.x,gy=innerHeight*pointer.y;const gradient=ctx.createRadialGradient(gx,gy,0,gx,gy,Math.max(innerWidth,innerHeight)*.65);gradient.addColorStop(0,'rgba(60,117,255,.36)');gradient.addColorStop(.45,'rgba(82,33,115,.18)');gradient.addColorStop(1,'rgba(9,11,16,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,innerWidth,innerHeight);dots.forEach(d=>{const drift=reduced?0:Math.sin(time*.0003+d.phase)*12*d.z;ctx.beginPath();ctx.arc(d.x+drift,d.y,d.r,0,Math.PI*2);ctx.fillStyle=`rgba(201,255,94,${.15+d.z*.65})`;ctx.fill();});if(!reduced)requestAnimationFrame(paint);}paint();
document.querySelector('#year').textContent=`© ${new Date().getFullYear()}`;
