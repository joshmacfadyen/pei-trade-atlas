/* PEI Trade Returns Atlas
 * Renders three plates (A flow map, B harbour compass, C sunburst), the margin key and commentary,
 * goods search, and the appendices, from two files served next to index.html:
 *   data.json  built by scripts/build_data.py from the workbook (entries, places, harbours, SITC names, routes)
 *   geo.json   coastlines and borders (Natural Earth 1:10m), static
 * Sections: setup and helpers / tooltip / chart furniture / commentary / margin / controls /
 *           Plate A / Plate B / Plate C / appendices / notes / goods search / views and start-up
 */
function startAtlas(DATA, GEO){
"use strict";
const DIRS=['Imports','Exports'];
const CATS=DATA.cats, NC=CATS.length;
const YEARS=DATA.years, PLACES=DATA.places, PORTS=DATA.ports;
const ROWS=DATA.rows.map(r=>({d:r[0],y:r[1],pl:r[2],po:r[3],cat:r[4],dk:r[5],art:r[6],v:r[7]}));
const CENTER=[-63.13,46.24];
const REDUCED=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const divInfo=k=>DATA.divs[k]||{name:k,label:k};
const divName=k=>divInfo(k).label;
const OTHER=CATS.findIndex(c=>c.key==='X');
const CATP=CATS.map((c,i)=>i===OTHER? 'other goods' : c.label.toLowerCase());   // category names in running prose
const THE=new Set(['United Kingdom','United States','West Indies','Magdalen Islands']);
const PORT_LABEL={'Tignish':'w','Cascumpec':'w','Grand River':'w','Malpeque':'n','Bedeque':'s','New London':'n','Rustico':'n','Crapaud':'s','Charlottetown':'s','Orwell Bay':'n','Pinette':'s','Murray Harbour':'s','Georgetown':'e','Colville Bay':'n',"St. Peter's":'n'};
const state={dir:0, year:-1, view:'flow-map', cat:-1, lock:null, hover:null, hier:0, tableBy:'place', search:null};

/* ---------- helpers ---------- */
const fInt=d3.format(',.0f');
const gbp=v=>'£'+fInt(v);
function gbpS(v){ if(v>=1e6) return '£'+d3.format('.2~f')(v/1e6)+'M'; if(v>=1e4) return '£'+d3.format('.0f')(v/1e3)+'k'; if(v>=1e3) return '£'+d3.format('.1f')(v/1e3)+'k'; return '£'+fInt(v); }
function lsd(v){ let p=Math.floor(v), s=(v-p)*20, sh=Math.floor(s+1e-9), d=Math.round((s-sh)*12); if(d===12){d=0;sh++;} if(sh===20){sh=0;p++;} return '£'+fInt(p)+' '+sh+'s '+d+'d'; }
function pct(a,b){ if(!b) return '–'; const x=a/b*100; if(x===0) return '0%'; if(x<0.1) return '<0.1%'; return (x<10? x.toFixed(1): x.toFixed(0))+'%'; }
const ccol=i=>`var(--c${i})`, oncol=i=>`var(--on-c${i})`;
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function sup(n){ const s=el('sup','n'); const a=el('a',null,String(n)); a.href='#note-'+n; a.dataset.note=n; s.append(a); return s; }
const dirL=()=>DIRS[state.dir].toLowerCase();
const placeWord=()=>state.dir===0?'origin':'destination';
const PlaceWord=()=>state.dir===0?'Origin':'Destination';
const yearsList=()=>YEARS.length<2? String(YEARS[0]||'') : YEARS.slice(0,-1).join(', ')+' and '+YEARS[YEARS.length-1];
const yearLabel=()=>state.year<0? yearsList() : String(YEARS[state.year]);
const yearProse=()=>state.year<0? (YEARS.length===1? 'the '+YEARS[0]+' return' : 'the '+(['two','three','four','five','six','seven','eight','nine','ten'][YEARS.length-2]||YEARS.length)+' returns') : 'the '+YEARS[state.year]+' return';
const portOK=i=>PORTS[i]&&PORTS[i].lon!=null;
function base(){ return ROWS.filter(r=>r.d===state.dir && (state.year<0 || r.y===state.year)); }
function goodsMatch(art,dk){ const g=state.search; if(!g) return true; return g.kind==='div'? dk===g.key : g.ids.has(art); }
function cur(){ const b=base(); return b.filter(r=>(state.cat<0||r.cat===state.cat)&&goodsMatch(r.art,r.dk)); }
function entryMatch(e,k){ return e[0]===state.dir&&(state.year<0||e[1]===state.year)&&(state.cat<0||e[4]===state.cat)&&goodsMatch(e[16],e[17])&&(!k||keyMatch(k,{pl:e[2],po:e[3]})); }
const goodsPhrase=()=>state.search? state.search.phrase : '';
function filterNote(){ return [state.cat>=0? CATS[state.cat].label+' only' : null, state.search? 'goods: '+state.search.label : null].filter(Boolean).join(', '); }
function catSums(rows){ const s=new Array(NC).fill(0); for(const r of rows) s[r.cat]+=r.v; return s; }
const sum=rows=>d3.sum(rows,r=>r.v);
const rank=(rows,k)=>d3.rollups(rows,v=>d3.sum(v,r=>r.v),r=>r[k]).sort((a,b)=>b[1]-a[1]);
const mappable=i=>PLACES[i].lon!=null;
function pName(i,start){ const n=PLACES[i].name; return THE.has(n)? (start?'The ':'the ')+n : n; }
function bearing(a,b){ const t=Math.PI/180, f1=a[1]*t, f2=b[1]*t, dl=(b[0]-a[0])*t; const y=Math.sin(dl)*Math.cos(f2), x=Math.cos(f1)*Math.sin(f2)-Math.sin(f1)*Math.cos(f2)*Math.cos(dl); return (Math.atan2(y,x)/t+360)%360; }
const km=(a,b)=>d3.geoDistance(a,b)*6371;
const kmLabel=i=>fInt(Math.round(km(CENTER,[PLACES[i].lon,PLACES[i].lat])/10)*10)+' km';
function niceKeys(max){ const out=[]; for(const f of [1,0.3,0.06]){ const v=max*f; const p=Math.pow(10,Math.floor(Math.log10(v))); const n=Math.max(1,Math.round(v/p))*p; if(!out.includes(n)) out.push(n);} return out.filter(v=>v<=max*1.05).sort((a,b)=>b-a); }
const active=()=>state.hover||state.lock;
function parseKey(k){ if(!k) return null; const p=k.split(':'); if(p[0]==='pl') return {type:'place',pl:+p[1]}; if(p[0]==='po') return {type:'port',po:+p[1]}; return {type:'route',pl:+p[1],po:+p[2]}; }
function keyMatch(k,r){ const s=parseKey(k); if(!s) return true; if(s.type==='place') return r.pl===s.pl; if(s.type==='port') return r.po===s.po; return r.pl===s.pl&&r.po===s.po; }
function keyLabel(k){ const s=parseKey(k); if(!s) return ''; if(s.type==='place') return PLACES[s.pl].name; if(s.type==='port') return PORTS[s.po].name; return state.dir===0? `${PLACES[s.pl].name} to ${PORTS[s.po].name}` : `${PORTS[s.po].name} to ${PLACES[s.pl].name}`; }

/* ---------- tooltip ---------- */
const tip=document.getElementById('tip');
function placeTip(evt){
  let x,y; if(evt && evt.clientX){ x=evt.clientX; y=evt.clientY; } else if(evt && evt.target && evt.target.getBoundingClientRect){ const b=evt.target.getBoundingClientRect(); x=b.left+b.width/2; y=b.top+b.height/2; } else return;
  const pad=14, tw=tip.offsetWidth, th=tip.offsetHeight; let left=x+pad, top=y+pad;
  if(left+tw>innerWidth-8) left=x-tw-pad; if(top+th>innerHeight-8) top=y-th-pad;
  tip.style.left=Math.max(8,left)+'px'; tip.style.top=Math.max(8,top)+'px';
}
function showTip(evt,build){ tip.replaceChildren(); build(tip); tip.hidden=false; placeTip(evt); }
function hideTip(){ tip.hidden=true; }
function topArticles(rows,n){ return d3.rollups(rows,v=>d3.sum(v,r=>r.v),r=>r.art).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([a])=>DATA.arts[a]); }
function tipBreakdown(t,name,rows,extra){
  const s=catSums(rows), tot=d3.sum(s);
  t.append(el('div','t-val',gbp(tot)), el('div','t-name',name), el('div','t-sub',lsd(tot)+(extra?', '+extra:'')));
  const g=el('div','t-rows');
  s.map((v,i)=>({v,i})).filter(d=>d.v>0).sort((a,b)=>b.v-a.v).forEach(d=>{ const k=el('span','t-key'); k.style.background=ccol(d.i); g.append(k, el('span',null,CATS[d.i].label), el('span','r',gbpS(d.v)), el('span','m',pct(d.v,tot))); });
  if(tot>0) t.append(g);
  const top=topArticles(rows,3); if(top.length) t.append(el('div','t-note','Largest entries: '+top.join(', ')+'.'));
}
function bindNode(sel,keyOf,tipOf,labelOf,onChange){
  sel.attr('tabindex',0).attr('role','button').attr('aria-label',d=>labelOf(d))
    .on('pointerenter pointermove',(e,d)=>{ const k=keyOf(d); if(state.hover!==k){ state.hover=k; onChange(); } showTip(e,t=>tipOf(t,d)); })
    .on('pointerleave',()=>{ state.hover=null; hideTip(); onChange(); })
    .on('focus',(e,d)=>{ state.hover=keyOf(d); onChange(); showTip(e,t=>tipOf(t,d)); })
    .on('blur',()=>{ state.hover=null; hideTip(); onChange(); })
    .on('click',(e,d)=>{ e.stopPropagation(); togglePin(keyOf(d)); hideTip(); })
    .on('keydown',(e,d)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); togglePin(keyOf(d)); } });
}
function togglePin(k){ state.lock = state.lock===k? null : k; state.hover=null; renderPinned(); updateView(); EV.shown=100; renderEntries(); }

/* flows: tapered quadratic, wide at the source */
function taper(p0,p1,w0,w1,bend,ctrl){
  const dx=p1[0]-p0[0], dy=p1[1]-p0[1], L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
  const c=ctrl||[(p0[0]+p1[0])/2+nx*L*bend,(p0[1]+p1[1])/2+ny*L*bend];
  const N=26, A=[], B=[];
  for(let i=0;i<=N;i++){ const t=i/N, m=1-t;
    const x=m*m*p0[0]+2*m*t*c[0]+t*t*p1[0], y=m*m*p0[1]+2*m*t*c[1]+t*t*p1[1];
    let tx=2*m*(c[0]-p0[0])+2*t*(p1[0]-c[0]), ty=2*m*(c[1]-p0[1])+2*t*(p1[1]-c[1]); const tl=Math.hypot(tx,ty)||1; tx/=tl; ty/=tl;
    const w=(w0+(w1-w0)*t)/2; A.push((x-ty*w).toFixed(1)+','+(y+tx*w).toFixed(1)); B.push((x+ty*w).toFixed(1)+','+(y-tx*w).toFixed(1)); }
  return {area:'M'+A.join('L')+'L'+B.reverse().join('L')+'Z', line:`M${p0[0].toFixed(1)},${p0[1].toFixed(1)}Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`};
}
/* pie glyph: fixed category order, surface gaps and ring */
const pieGen=d3.pie().sort(null).value(d=>d.v);
function drawPie(g,sums,r,opts={}){
  const tot=d3.sum(sums), ground=opts.ground||'var(--sea)';
  g.selectAll('*').remove();
  if(tot<=0||r<=0){ g.append('circle').attr('r',2.2).style('fill','var(--hair)'); return; }
  g.append('circle').attr('r',r+1.6).style('fill',ground);
  if(r<4.5){ g.append('circle').attr('r',Math.max(r,2.8)).style('fill',ccol(d3.maxIndex(sums))); return; }
  const data=pieGen(sums.map((v,i)=>({v,i})).filter(d=>d.v>0));
  g.selectAll('path').data(data).join('path').attr('d',d3.arc().innerRadius(0).outerRadius(r)).style('fill',d=>ccol(d.data.i))
    .style('stroke',ground).style('stroke-width',data.length>1?(opts.gap||(r>14?1.6:1)):0).style('stroke-linejoin','round');
  if(opts.labels){ const la=d3.arc().innerRadius(r*0.64).outerRadius(r*0.64);
    g.selectAll('text').data(data.filter(d=>d.endAngle-d.startAngle>0.34)).join('text').attr('transform',d=>`translate(${la.centroid(d)})`).attr('text-anchor','middle').attr('dy','0.35em')
      .style('font-size','12.5px').style('font-weight',600).style('fill',d=>oncol(d.data.i)).text(d=>pct(d.data.v,tot)); }
}
/* collision-aware labels around circular marks */
function rectCircle(B,c){ const nx=Math.max(B.x,Math.min(c.x,B.x+B.w)), ny=Math.max(B.y,Math.min(c.y,B.y+B.h)); return (nx-c.x)**2+(ny-c.y)**2 < c.r*c.r; }
function placeLabels(items,W,H,bx,obs){
  // Never drops a label: normal positions first, then leader lines at growing distances, then smaller type, then a forced spot.
  const L=bx||{x0:2,y0:2,x1:W-2,y1:H-2}, O=obs||{};
  const boxes=(O.rects||[]).slice(), fixedN=boxes.length, circles=items.map(d=>({x:d.x,y:d.y,r:d.r+2})), extra=O.circles||[], order=['e','w','n','s','ne','nw','se','sw'];
  items.forEach((d,idx)=>{
    const node=d.g.node(), parent=node.parentNode;
    parent.querySelectorAll(':scope > line.leader').forEach(n=>n.remove());
    if(d.hide){ d.g.style('display','none'); return; }
    d.g.style('display',null).attr('x',0).attr('y',0); d.g.selectAll('tspan').attr('x',0).style('display',null).each(function(){ if(this.dataset.fs===undefined) this.dataset.fs=this.style.fontSize||''; this.style.fontSize=this.dataset.fs; });
    const cands=[d.pref,...order.filter(o=>o!==d.pref)];
    const geom=(c,r,w,h,pad)=>{ let x0,y0; const k=c.length===2?0.72:1;
      if(c==='e'){x0=r+pad;y0=-h/2;} else if(c==='w'){x0=-r-pad-w;y0=-h/2;} else if(c==='n'){x0=-w/2;y0=-r-pad-h;} else if(c==='s'){x0=-w/2;y0=r+pad;}
      else { const sx=c[1]==='e'?1:-1, sy=c[0]==='s'?1:-1; x0=sx>0? r*k+pad-1 : -r*k-pad+1-w; y0=sy>0? r*k+pad-2 : -r*k-pad+2-h; }
      return {x0,y0}; };
    const fits=B=>!(B.x<L.x0||B.y<L.y0||B.x+B.w>L.x1||B.y+B.h>L.y1) && !boxes.some(o=>boxHit(B,o)) && !circles.some((o,j)=>j!==idx&&rectCircle(B,o)) && !extra.some(o=>rectCircle(B,o));
    let res=null;
    const tryAt=offs=>{ const bb=node.getBBox(), w=bb.width, h=bb.height, asc=-bb.y;
      for(const off of offs){ for(const c of cands){ const {x0,y0}=geom(c,d.r+off,w,h,4), B={x:d.x+x0,y:d.y+y0,w,h}; if(fits(B)) return {x0,y0,B,asc,lead:off>0}; } } return null; };
    // 1 full label close in, 2 without its value line, 3 smaller type, 4 led further out into open space
    res=tryAt([0]);
    if(!res){ d.g.selectAll('tspan.lbl-v').style('display','none'); res=tryAt([0,12]); }
    if(!res){ d.g.selectAll('tspan').each(function(){ this.style.fontSize=(parseFloat(getComputedStyle(this).fontSize)*0.86).toFixed(1)+'px'; }); res=tryAt([0,12,26,42,60]); }
    if(!res&&!d.must){ d.g.style('display','none'); return; }
    if(!res){ const bb=node.getBBox(), w=bb.width, h=bb.height; let {x0,y0}=geom(d.pref,d.r,w,h,4); const B0={x:d.x+x0,y:d.y+y0};
      const dx=Math.max(L.x0-B0.x,Math.min(0,L.x1-(B0.x+w))), dy=Math.max(L.y0-B0.y,Math.min(0,L.y1-(B0.y+h))); x0+=dx; y0+=dy; res={x0,y0,B:{x:B0.x+dx,y:B0.y+dy,w,h},asc:-bb.y,lead:false}; }
    boxes.push(res.B);
    d.g.attr('text-anchor','start').attr('x',res.x0).attr('y',res.y0+res.asc); d.g.selectAll('tspan').attr('x',res.x0);
    if(res.lead){ const bx0=res.x0, by0=res.y0, bw=res.B.w, bh=res.B.h, ex=Math.max(bx0,Math.min(bx0+bw,0)), ey=Math.max(by0,Math.min(by0+bh,0)), a=Math.atan2(ey,ex);
      d3.select(parent).insert('line',()=>node).attr('class','leader').attr('x1',Math.cos(a)*(d.r+1)).attr('y1',Math.sin(a)*(d.r+1)).attr('x2',ex).attr('y2',ey)
        .style('stroke','var(--ink-2)').style('stroke-width',.8).style('pointer-events','none'); }
  });
  return boxes.slice(fixedN);
}
const boxHit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
/* hide water names that collide with placed labels (water names are the lower-priority layer) */
function yieldWater(sel,boxes){ sel.each(function(){ const n=this; if(n.style.display==='none') return; const b=n.getBBox(); if(boxes.some(o=>boxHit({x:b.x,y:b.y,w:b.width,h:b.height},o))) n.style.display='none'; }); }
/* cartographic furniture */
function neatline(svg,f){
  svg.append('rect').attr('x',f.x0).attr('y',f.y0).attr('width',f.x1-f.x0).attr('height',f.y1-f.y0).style('fill','none').style('stroke','var(--ink)').style('stroke-width',1);
  svg.append('rect').attr('x',f.x0+3).attr('y',f.y0+3).attr('width',f.x1-f.x0-6).attr('height',f.y1-f.y0-6).style('fill','none').style('stroke','var(--ink)').style('stroke-width',.4);
}
function scaleBar(svg,proj,x,y,kms,label){
  const a=proj([-63,46.2]), b=proj([-62,46.2]), pxKm=Math.hypot(b[0]-a[0],b[1]-a[1])/km([-63,46.2],[-62,46.2]);
  const g=svg.append('g').attr('transform',`translate(${x},${y})`), seg=kms/2*pxKm;
  g.append('rect').attr('width',seg).attr('height',4).style('fill','var(--ink)');
  g.append('rect').attr('x',seg).attr('width',seg).attr('height',4).style('fill','var(--sea)').style('stroke','var(--ink)').style('stroke-width',.8);
  [0,kms/2,kms].forEach((v,i)=>{ if(i===1&&seg<30) return; g.append('text').attr('x',i*seg).attr('y',-5).attr('text-anchor',i===2&&seg<30?'start':'middle').attr('class','grat-l').text(i===2? v+' km':v); });
  if(label) g.append('text').attr('x',2*seg+26).attr('y',4).attr('class','grat-l').text(label);
  return {x:x-6,y:y-18,w:2*seg+34,h:26};
}
const degLbl=(v,h)=>{ const a=Math.abs(v), d=Math.floor(a+1e-9), m=Math.round((a-d)*60); return d+'°'+(m?m+'′':'')+h; };
function graticuleLabels(svg,proj,f,lons,lats){
  const bis=(fn,lo,hi,target)=>{ for(let i=0;i<40;i++){ const mid=(lo+hi)/2; if((fn(mid)-target)*(fn(lo)-target)<=0) hi=mid; else lo=mid; } return (lo+hi)/2; };
  lons.forEach(lon=>{ const la=bis(l=>proj([lon,l])[1],20,60,f.y1); if(Math.abs(proj([lon,la])[1]-f.y1)>1) return; const x=proj([lon,la])[0]; if(x>f.x0+12&&x<f.x1-12){ svg.append('line').attr('x1',x).attr('x2',x).attr('y1',f.y1).attr('y2',f.y1+4).style('stroke','var(--ink)'); svg.append('text').attr('class','grat-l').attr('x',x).attr('y',f.y1+15).attr('text-anchor','middle').text(degLbl(lon,'W')); } });
  lats.forEach(lat=>{ const lo=bis(l=>proj([l,lat])[0],-110,-40,f.x0); if(Math.abs(proj([lo,lat])[0]-f.x0)>1) return; const y=proj([lo,lat])[1]; if(y>f.y0+10&&y<f.y1-10){ svg.append('line').attr('x1',f.x0-4).attr('x2',f.x0).attr('y1',y).attr('y2',y).style('stroke','var(--ink)'); svg.append('text').attr('class','grat-l').attr('x',f.x0-6).attr('y',y).attr('dy','0.35em').attr('text-anchor','end').text(degLbl(lat,'N')); } });
}

/* ---------- keys under figures ---------- */
function circleKey(host,title,rScale,max){
  const k=el('div','k'); k.append(el('span','k-t',title));
  const vals=niceKeys(max), R=rScale(vals[0]), w=R*2+80, top=8;
  let ly=[]; vals.forEach((v,i)=>{ const yTop=top+2*R-2*rScale(v); ly.push(i? Math.max(yTop, ly[i-1]+13) : yTop); });
  const h=Math.max(top+2*R, ly[ly.length-1]+6)+2;
  const svg=d3.select(k).append('svg').attr('width',w).attr('height',h).attr('aria-hidden','true');
  vals.forEach((v,i)=>{ const r=rScale(v), cy=top+2*R-r, yTop=cy-r; svg.append('circle').attr('cx',R+1).attr('cy',cy).attr('r',r).style('fill','none').style('stroke','var(--ink-2)');
    svg.append('path').attr('d',`M${R+1},${yTop}H${R*2+4}L${R*2+9},${ly[i]}`).style('fill','none').style('stroke','var(--hair)');
    svg.append('text').attr('x',R*2+12).attr('y',ly[i]).attr('dy','0.35em').style('font-size','12px').style('fill','var(--ink-2)').text(gbpS(v)); });
  host.append(k);
}
function lineKey(host,title,wScale,max){
  const k=el('div','k'); k.append(el('span','k-t',title));
  const vals=niceKeys(max), svg=d3.select(k).append('svg').attr('width',160).attr('height',vals.length*17).attr('aria-hidden','true');
  vals.forEach((v,i)=>{ const w=Math.max(0.9,wScale(v)), y=8+i*17; svg.append('path').attr('d',taper([2,y],[76,y],w,w*0.45,0).area).style('fill','var(--flow)').style('opacity',.6);
    svg.append('text').attr('x',84).attr('y',y).attr('dy','0.35em').style('font-size','12px').style('fill','var(--ink-2)').text(gbpS(v)); });
  host.append(k);
}

/* ---------- prose commentary computed from the returns ---------- */
function pp(a,b){ const x=a/b*100; return (x>=10? Math.round(x) : x>=0.1? x.toFixed(1) : '<0.1')+'%'; }
function listJoin(a){ return a.length<2? a.join('') : a.slice(0,-1).join(', ')+' and '+a[a.length-1]; }
function commentary(){
  const rows=cur(), tot=sum(rows); if(!tot) return 'No entries in the returns match this selection.';
  const k=active(), s=parseKey(k), imp=state.dir===0, iso=state.cat>=0||!!state.search;
  const noun = (state.cat>=0? `${CATP[state.cat]} ${dirL()}` : dirL())+(state.search? ` of ${goodsPhrase()}` : '');
  if(!s){
    const pl=rank(rows,'pl'), po=rank(rows,'po'), lead=pl.slice(1,3).map(([i,v])=>`${pName(i)} (${pp(v,tot)})`);
    const one=`${pName(pl[0][0],true)} ${imp?'supplied':'took'} the largest share of ${noun} in ${yearProse()}, ${pp(pl[0][1],tot)}${lead.length?', followed by '+listJoin(lead):''}.`;
    if(iso) return one+` ${PORTS[po[0][0]].name} ${imp?'entered':'shipped'} ${pp(po[0][1],tot)} of it.`;
    const leads=d3.rollups(rows,v=>d3.maxIndex(catSums(v)),r=>r.po), cnt=d3.rollups(leads,v=>v.length,d=>d[1]).sort((a,b)=>b[1]-a[1]);
    return one+` ${cap(CATP[cnt[0][0]])} led at ${cnt[0][1]} of the ${leads.length} harbours${cnt[1]?` and ${CATP[cnt[1][0]]} at ${cnt[1][1]}`:''}; ${PORTS[po[0][0]].name}, the busiest, ${imp?'entered':'shipped'} ${pp(po[0][1],tot)} of the value.`;
  }
  const sel=rows.filter(r=>keyMatch(k,r)), v=sum(sel); if(!v) return `No ${noun} recorded for ${keyLabel(k)} in ${yearProse()}.`;
  const cs=catSums(sel), order=cs.map((x,i)=>[i,x]).filter(d=>d[1]>0).sort((a,b)=>b[1]-a[1]), cats=order.slice(0,2).map(([i,x])=>`${CATP[i]} (${pp(x,v)})`);
  if(s.type==='place'){ const po=rank(sel,'po');
    return `${pName(s.pl,true)} ${imp?'supplied':'took'} ${gbp(v)} of ${noun} in ${yearProse()}, ${pp(v,tot)} of the total. `+
      (iso? `${pp(po[0][1],v)} ${imp?'was entered at':'was shipped from'} ${PORTS[po[0][0]].name}.` : `${cap(listJoin(cats))} led, and ${pp(po[0][1],v)} ${imp?'was entered at':'was shipped from'} ${PORTS[po[0][0]].name}.`); }
  if(s.type==='port'){ const pl=rank(sel,'pl');
    return `${PORTS[s.po].name} ${imp?'entered':'shipped'} ${gbp(v)} of ${noun} in ${yearProse()}, ${pp(v,tot)} of the Island’s total. `+
      (iso? `The largest ${placeWord()} was ${pName(pl[0][0])}, at ${pp(pl[0][1],v)}.` : `${cap(CATP[order[0][0]])} led at ${pp(order[0][1],v)}, and the largest ${placeWord()} was ${pName(pl[0][0])} (${pp(pl[0][1],v)}).`); }
  const plTot=sum(rows.filter(r=>r.pl===s.pl));
  return `${gbp(v)} of ${noun} ${imp?`came from ${pName(s.pl)} through ${PORTS[s.po].name}`:`left ${PORTS[s.po].name} for ${pName(s.pl)}`}, ${pp(v,plTot)} of ${pName(s.pl)}’s ${imp?'trade into':'trade from'} the Island. `+(iso? '' : `By category, ${listJoin(cats)}.`);
}
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

/* ---------- margin column ---------- */
function marginSelection(host,o){
  const k=active(), s=parseKey(k), rows=cur(), sel=k? rows.filter(r=>keyMatch(k,r)) : rows, cs=catSums(sel), tot=d3.sum(cs), all=sum(rows);
  const wrap=el('section','m-sel fade');
  const title = k? keyLabel(k) : state.search? `${cap(state.search.label)}, all ${dirL()}` : (state.cat>=0? `${cap(CATP[state.cat])}, all ${dirL()}` : `All ${dirL()}`);
  wrap.append(el('h3',null,title), el('p','m-fig',tot>0? gbp(tot) : '£0'));
  const sub=el('p','m-sub', tot>0? `${lsd(tot)}${k? ', '+pct(tot,all)+' of the total':''}. Returns for ${yearLabel()}.` : `Nothing recorded in ${yearLabel()}.`);
  wrap.append(sub);
  if(o.pie && tot>0){ const w=o.pieSize||200, box=el('div','m-pie'); const svg=d3.select(box).append('svg').attr('width',w).attr('height',w).attr('viewBox',`${-w/2} ${-w/2} ${w} ${w}`).attr('role','img').attr('aria-label',`Pie chart of ${title} by SITC category`);
    drawPie(svg.append('g'),cs,w/2-3,{labels:true,ground:'var(--paper)',gap:2}); wrap.append(box); }
  const h=el('h4',null,'By SITC category'); h.append(sup(3)); wrap.append(h);
  const ul=el('ul','key'); const mx=d3.max(cs)||1;
  cs.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v||a.i-b.i).forEach(d=>{
    const li=el('li', d.v>0?'on':'zero'); const nm=el('span','k-name'); const sw=el('span','sw'); sw.style.background=ccol(d.i);
    const lab=el('span',null,CATS[d.i].label); nm.append(sw,lab); if(d.i===OTHER) lab.append(sup(4));
    const bar=el('span','k-bar'); const fi=el('i'); fi.style.width=(d.v/mx*100)+'%'; fi.style.background=ccol(d.i); bar.append(fi);
    li.append(nm, el('span','k-val',d.v>0?gbpS(d.v):'–'), el('span','k-pct',d.v>0?pct(d.v,tot):''), bar); li.title=`${CATS[d.i].name}: ${CATS[d.i].desc}`;
    li.setAttribute('aria-pressed',String(state.cat===d.i));
    if(d.v>0||state.cat===d.i){ li.tabIndex=0; li.setAttribute('role','button'); li.setAttribute('aria-label',`${CATS[d.i].label}: ${gbp(d.v)}. ${state.cat===d.i?'Show all categories':'Show only this category'}.`);
      const act=()=>{ state.cat=state.cat===d.i?-1:d.i; renderAll(); }; li.addEventListener('click',act); li.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } }); }
    ul.append(li);
  });
  wrap.append(ul);
  const nE=DATA.entries.filter(e=>entryMatch(e,k)).length;
  const ml=el('div','mlinks');
  if(nE){ const b=el('button','textbtn',`Check the ${fInt(nE)} source ${nE===1?'entry':'entries'} (Appendix B)`); b.type='button'; b.addEventListener('click',()=>{ if(k&&state.lock!==k){ state.lock=k; state.hover=null; renderPinned(); updateView(); } openEntries(); }); ml.append(b); }
  { const b=el('button','textbtn','See the values table (Appendix A)'); b.type='button'; b.addEventListener('click',()=>openAppendix('tableview')); ml.append(b); }
  wrap.append(ml);
  if(state.cat>=0){ const b=el('button','textbtn','Show all categories'); b.type='button'; b.addEventListener('click',()=>{ state.cat=-1; renderAll(); }); wrap.append(b); }
  return wrap;
}
function harbourList(onChange){
  const rows=cur(), list=rank(rows,'po'), sec=el('section','m-harb');
  const h=el('h4',null, state.dir===0? 'Leading category by harbour of entry' : 'Leading category by harbour of shipment'); sec.append(h);
  const ol=el('ol','harb'); ol.setAttribute('aria-label','Harbours, largest first');
  list.forEach(([po,v])=>{
    const cs=catSums(rows.filter(r=>r.po===po)), ci=d3.maxIndex(cs), li=el('li'); li.dataset.po=po;
    li.append(el('span','h-name',PORTS[po].name), el('span','h-val',gbpS(v)));
    const bar=el('span','h-bar'); cs.forEach((x,i)=>{ if(x>0){ const s=el('i'); s.style.flex=String(x); s.style.background=ccol(i); bar.append(s);} }); bar.setAttribute('aria-hidden','true');
    const lead=el('span','h-lead'); const sw=el('span','sw'); sw.style.background=ccol(ci); lead.append(sw, document.createTextNode(state.cat>=0? `${pct(v,sum(rows))} of the category` : `${CATS[ci].label}, ${pct(cs[ci],v)}`));
    li.append(bar,lead); li.tabIndex=0; li.setAttribute('role','button'); li.setAttribute('aria-label',`${PORTS[po].name}, ${gbp(v)}. Leading: ${CATS[ci].label}, ${pct(cs[ci],v)}. Select to pin.`);
    const key='po:'+po;
    li.addEventListener('pointerenter',()=>{ if(state.hover!==key){ state.hover=key; onChange(); } });
    li.addEventListener('pointerleave',()=>{ state.hover=null; onChange(); });
    li.addEventListener('focus',()=>{ state.hover=key; onChange(); }); li.addEventListener('blur',()=>{ state.hover=null; onChange(); });
    li.addEventListener('click',()=>togglePin(key)); li.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); togglePin(key);} });
    ol.append(li);
  });
  sec.append(ol); return sec;
}
function syncHarbourList(host){ const k=active(), s=parseKey(k), lk=parseKey(state.lock);
  host.querySelectorAll('.harb li').forEach(li=>{ const po=+li.dataset.po; li.classList.toggle('is-active', !!s && s.type!=='place' && s.po===po); li.classList.toggle('is-pinned', !!lk && lk.type==='port' && lk.po===po); }); }
function renderMargin(id,o){
  const host=document.getElementById(id); let selBox=host.querySelector('.m-sel'), comm=host.querySelector('.commentary');
  const fresh=marginSelection(host,o);
  fresh.style.opacity='0';
  if(selBox) selBox.replaceWith(fresh); else host.prepend(fresh);
  if(!comm){ comm=el('p','commentary fade'); fresh.after(comm); }
  const txt=commentary(); if(comm.textContent!==txt){ comm.style.opacity='0'; comm.textContent=txt; }
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ fresh.style.opacity='1'; comm.style.opacity='1'; }));
  if(o.harbours){ if(!host.querySelector('.m-harb')) host.append(harbourList(o.onChange)); syncHarbourList(host); }
}

/* ---------- controls ---------- */
function seg(id,items,getter,setter){ const host=document.getElementById(id); host.replaceChildren();
  items.forEach(([val,label])=>{ const b=el('button',null,label); b.type='button'; b.id=id+'-'+String(val).replace(/^-/,'neg').replace(/\W/g,''); b.setAttribute('aria-pressed',String(getter()===val)); b.addEventListener('click',()=>setter(val)); host.append(b); }); }
function renderControls(){
  seg('f-dir',[[0,'Imports'],[1,'Exports']],()=>state.dir,v=>{ state.dir=v; renderAll(); });
  seg('f-year',[[-1,'All'],...YEARS.map((y,i)=>[i,String(y)])],()=>state.year,v=>{ state.year=v; renderAll(); });
  seg('f-hier',[[0,`${PlaceWord()}, SITC tiers, harbour`],[1,`SITC tiers, ${placeWord()}`],[2,`Harbour, ${placeWord()}, SITC tiers`]],()=>state.hier,v=>{ state.hier=v; renderSunburst(); renderControls(); });
  seg('f-tv',[['place',PlaceWord()],['port','Harbour']],()=>state.tableBy,v=>{ state.tableBy=v; renderTable(); renderControls(); });
  document.querySelectorAll('.contents button').forEach(t=>{ const on=t.dataset.view===state.view; t.setAttribute('aria-selected',String(on)); t.tabIndex=on?0:-1; });
  renderPinned();
}
function renderPinned(){
  const host=document.getElementById('pinned'); host.replaceChildren();
  if(state.search){ const s=el('span','gfilter'); s.append(document.createTextNode('Goods: '), el('strong',null,state.search.label)); const b=el('button','textbtn','Clear'); b.type='button'; b.addEventListener('click',()=>setGoods(null)); s.append(document.createTextNode(' '), b); host.append(s); }
  if(state.lock){ host.append(document.createTextNode('Pinned: '), el('strong',null,keyLabel(state.lock))); const b=el('button','textbtn','Unpin'); b.type='button'; b.addEventListener('click',()=>{ state.lock=null; renderPinned(); updateView(); renderEntries(); }); host.append(b); }
  else host.append(document.createTextNode(state.view==='sunburst'? 'Click an arc to zoom into it.' : 'Hover a place, harbour or route to read it in the margin; click to pin it.'));
}
const footText=()=>`Source: Prince Edward Island customs returns for ${yearLabel()}, as transcribed in the project workbook.`;
function setFoot(id){ const f=document.getElementById(id); f.replaceChildren(document.createTextNode(footText())); f.append(sup(1)); }

/* =========================================================
   Plate A
   ========================================================= */
const A={zt:d3.zoomIdentity, zp:d3.zoomIdentity, W:0, WP:0};
const imp=()=>state.dir===0;
/* smooth a projected polyline (Catmull-Rom) and build a ribbon that tapers from w0 to w1 */
function smoothLine(pts){
  const P=[]; pts.forEach(p=>{ const q=P[P.length-1]; if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>0.5) P.push(p); });
  if(P.length<3) return P;
  const Dn=[P[0]]; for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/16); for(let j=1;j<=n;j++) Dn.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]); }
  const Q=[Dn[0],...Dn,Dn[Dn.length-1]], out=[];
  for(let i=1;i<Q.length-2;i++){ const p0=Q[i-1],p1=Q[i],p2=Q[i+1],p3=Q[i+2], n=Math.max(2,Math.min(12,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/10)));
    for(let j=0;j<n;j++){ const t=j/n,t2=t*t,t3=t2*t; out.push([0,1].map(k=>0.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3))); } }
  out.push(Dn[Dn.length-1]); return out;
}
function ribbon(pts,w0,w1){
  const n=pts.length; if(n<2) return {area:'',line:''};
  const cum=[0]; for(let i=1;i<n;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const L=cum[n-1]||1, A_=[], B_=[];
  for(let i=0;i<n;i++){ const a=pts[Math.max(0,i-1)], b=pts[Math.min(n-1,i+1)]; let tx=b[0]-a[0], ty=b[1]-a[1]; const tl=Math.hypot(tx,ty)||1; tx/=tl; ty/=tl;
    const w=(w0+(w1-w0)*cum[i]/L)/2; A_.push((pts[i][0]-ty*w).toFixed(1)+','+(pts[i][1]+tx*w).toFixed(1)); B_.push((pts[i][0]+ty*w).toFixed(1)+','+(pts[i][1]-tx*w).toFixed(1)); }
  return {area:'M'+A_.join('L')+'L'+B_.reverse().join('L')+'Z', line:'M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L')};
}
/* zoom buttons shared by both Plate A maps */
function zoomBar(hostId,svg,zoom,f,islandBox){
  const bar=document.getElementById(hostId); bar.replaceChildren();
  const mk=(label,fn)=>{ const b=el('button',null,label); b.type='button'; b.addEventListener('click',fn); bar.append(b); return b; };
  const dur=REDUCED?0:450;
  mk('Zoom in',()=>svg.transition().duration(dur).call(zoom.scaleBy,1.8));
  mk('Zoom out',()=>svg.transition().duration(dur).call(zoom.scaleBy,1/1.8));
  if(islandBox) mk('Zoom to the Island',()=>{ const [[x0,y0],[x1,y1]]=islandBox(), fw=f.x1-f.x0, fh=f.y1-f.y0, k=Math.min(20,0.86*Math.min(fw/(x1-x0),fh/(y1-y0)));
    svg.transition().duration(REDUCED?0:700).call(zoom.transform,d3.zoomIdentity.translate((f.x0+f.x1)/2,(f.y0+f.y1)/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2)); });
  mk('Reset view',()=>svg.transition().duration(dur).call(zoom.transform,d3.zoomIdentity));
}
function makeZoom(svg,f,onZoom,onEnd){
  const z=d3.zoom().scaleExtent([1,24]).extent([[f.x0,f.y0],[f.x1,f.y1]]).translateExtent([[f.x0,f.y0],[f.x1,f.y1]])
    .filter(e=>e.type==='wheel'? (e.ctrlKey||e.metaKey) : (!e.ctrlKey && !e.button))
    .wheelDelta(e=>-e.deltaY*(e.deltaMode===1?0.05:e.deltaMode?1:0.002)*(e.ctrlKey&&Math.abs(e.deltaY)<40?5:1))
    .on('zoom',e=>{ hideTip(); onZoom(e.transform,false); }).on('end',e=>onEnd(e.transform));
  svg.call(z).style('touch-action','pan-y');
  return z;
}

function renderA(){
  document.getElementById('a-title').textContent = `${DIRS[state.dir]} by ${placeWord()} and harbour, ${yearLabel()}`;
  const host=document.getElementById('a-region'); host.replaceChildren();
  const W=Math.max(320,host.clientWidth||860), H=Math.round(Math.min(620,Math.max(300,W*0.6)));
  if(A.W!==W){ A.zt=d3.zoomIdentity; A.W=W; }
  const all=base(), rows=cur(), narrow=W<560;
  const f={x0:34,y0:4,x1:W-4,y1:H-22};
  const ext={type:'MultiPoint',coordinates:[[-72.2,41.7],[-50.8,41.7],[-72.2,50],[-50.8,50],[-61.5,41.3],[-61.5,50.4]]};
  const base0=d3.geoConicConformal().parallels([43,49]).rotate([61.5,0]).fitExtent([[f.x0+6,f.y0+6],[f.x1-6,f.y1-6]],ext);
  const s0=base0.scale(), t0=base0.translate();
  const projAt=t=>d3.geoConicConformal().parallels([43,49]).rotate([61.5,0]).scale(s0*t.k).translate([t0[0]*t.k+t.x,t0[1]*t.k+t.y]);
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${W} ${H}`).attr('width',W).attr('height',H).attr('role','img')
    .attr('aria-label',`Map of ${dirL()} between Prince Edward Island harbours and their ${placeWord()}s, with modelled sea routes. Zoomable.`);
  svg.append('clipPath').attr('id','clipA').append('rect').attr('x',f.x0).attr('y',f.y0).attr('width',f.x1-f.x0).attr('height',f.y1-f.y0);
  const g=svg.append('g').attr('clip-path','url(#clipA)');
  g.append('rect').attr('x',f.x0).attr('y',f.y0).attr('width',f.x1-f.x0).attr('height',f.y1-f.y0).style('fill','var(--sea)');
  const gGrat=g.append('path').datum(d3.geoGraticule().extent([[-90,30],[-40,58]]).step([5,2])()).style('fill','none').style('stroke','var(--grat)');
  const gWL=g.append('g').selectAll('path').data(GEO.region.features).join('path').style('fill','none').style('stroke','var(--waterline)').style('stroke-width',5).style('stroke-linejoin','round');
  const gLand=g.append('g').selectAll('path').data(GEO.region.features).join('path').style('fill',d=>d.properties.pei?'var(--land-pei)':'var(--land)').style('stroke','var(--coast)').style('stroke-width',.7);
  const gLoc=g.append('path').style('fill','none').style('stroke','var(--ink)').style('stroke-width',.8);
  const gBord=g.append('g').selectAll('path').data(GEO.borders.geometries).join('path').style('fill','none').style('stroke','var(--boundary)').style('stroke-width',1).style('stroke-dasharray','6 2 1.5 2');
  const gWater=g.append('g').selectAll('text').data([['Gulf of St. Lawrence',[-61.4,48.45]],['Atlantic Ocean',[-57.2,43.1]],['Strait of Canso',[-61.05,45.62]]]).join('text').attr('class','water').attr('text-anchor','middle').text(d=>d[0]);

  const plTot=d3.rollup(all,v=>d3.sum(v,r=>r.v),r=>r.pl), poTot=d3.rollup(all,v=>d3.sum(v,r=>r.v),r=>r.po);
  A.r=d3.scaleSqrt().domain([0,d3.max(plTot.values())||1]).range([0,Math.max(16,Math.min(32,W*0.037))]);
  const pairAll=d3.rollup(all.filter(r=>mappable(r.pl)&&portOK(r.po)),v=>d3.sum(v,r=>r.v),r=>r.pl+':'+r.po);
  A.w=d3.scaleLinear().domain([0,d3.max(pairAll.values())||1]).range([0,Math.max(7,Math.min(14,W*0.017))]);
  const pairs=d3.rollups(rows.filter(r=>mappable(r.pl)&&portOK(r.po)),v=>d3.sum(v,r=>r.v),r=>r.pl,r=>r.po).flatMap(([pl,arr])=>arr.map(([po,v])=>({pl,po,v}))).sort((a,b)=>b.v-a.v);
  A.flows=g.append('g').selectAll('path').data(pairs).join('path').attr('class','flow');
  const hits=g.append('g').selectAll('path').data(pairs).join('path').attr('class','flow-hit').style('stroke-width',d=>Math.max(10,A.w(d.v)+5));
  bindNode(hits,d=>`rt:${d.pl}:${d.po}`,(t,d)=>tipBreakdown(t,keyLabel(`rt:${d.pl}:${d.po}`),rows.filter(r=>r.pl===d.pl&&r.po===d.po),'modelled sea route'),d=>`${keyLabel(`rt:${d.pl}:${d.po}`)}: ${gbp(d.v)}`,updateA);
  // harbours on the regional map: dots, names once zoomed in
  const pl0=PORTS.map((p,i)=>i).filter(i=>poTot.get(i)&&portOK(i));
  A.hG=g.append('g').selectAll('g').data(pl0).join('g');
  A.hG.append('circle').attr('r',2).style('fill','var(--ink)').style('stroke','var(--sea)').style('stroke-width',1);
  A.hG.append('text').attr('class','halo').append('tspan').attr('class','lbl').style('font-size','12px').text(i=>PORTS[i].name);
  A.hG.append('circle').attr('class','node-hit').attr('r',7);
  bindNode(A.hG.select('.node-hit'),i=>`po:${i}`,(t,i)=>tipBreakdown(t,PORTS[i].name,rows.filter(r=>r.po===i)),i=>`${PORTS[i].name}, ${gbp(poTot.get(i)||0)}`,updateA);
  // places
  const plCur=d3.rollup(rows,v=>d3.sum(v,r=>r.v),r=>r.pl);
  const plist=PLACES.map((p,i)=>i).filter(i=>mappable(i)&&plTot.get(i)).sort((a,b)=>plTot.get(b)-plTot.get(a)).map(i=>({i,off:PLACES[i].off}));
  A.placeG=g.append('g').selectAll('g').data(plist,d=>d.i).join('g');
  A.placeG.append('g').attr('class','pie');
  A.placeG.filter(d=>d.off).append('path').attr('d',d=>{ const p=PLACES[d.i], a0=base0([p.ax,p.ay]), a1=base0([p.lon,p.lat]), a=Math.atan2(a1[1]-a0[1],a1[0]-a0[0]), r=A.r(plTot.get(d.i))+5,
      tx=Math.cos(a)*r, ty=Math.sin(a)*r, q=[tx+Math.cos(a)*10,ty+Math.sin(a)*10];
      return `M${tx.toFixed(1)},${ty.toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}M${(q[0]+Math.cos(a+2.6)*5).toFixed(1)},${(q[1]+Math.sin(a+2.6)*5).toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}L${(q[0]+Math.cos(a-2.6)*5).toFixed(1)},${(q[1]+Math.sin(a-2.6)*5).toFixed(1)}`; })
    .style('fill','none').style('stroke','var(--ink)').style('stroke-width',1.3).style('stroke-linecap','round').style('stroke-linejoin','round');
  A.placeG.each(function(d){ const vc=plCur.get(d.i)||0, t=d3.select(this).append('text').attr('class','halo');
    t.append('tspan').attr('class','lbl-c').text(PLACES[d.i].name);
    if(!narrow) t.append('tspan').attr('class','lbl-v').attr('dy','1.25em').text(`${vc?gbpS(vc):'–'}${d.off? ', '+kmLabel(d.i)+' away':''}`); });
  A.placeG.append('circle').attr('class','node-hit').attr('r',d=>Math.max(13,A.r(plTot.get(d.i))+4));
  bindNode(A.placeG.select('.node-hit'),d=>`pl:${d.i}`,(t,d)=>tipBreakdown(t,PLACES[d.i].name,rows.filter(r=>r.pl===d.i),`drawn at ${PLACES[d.i].rep}`),d=>`${PLACES[d.i].name}, ${gbp(plTot.get(d.i)||0)}`,updateA);
  // furniture outside the clip
  neatline(svg,f); const furn=svg.append('g');

  const layout=(t,final)=>{
    const p=projAt(t), path=d3.geoPath(p);
    gGrat.attr('d',path); gWL.attr('d',path); gLand.attr('d',path); gBord.attr('d',path);
    gWater.attr('x',d=>p(d[1])[0]).attr('y',d=>p(d[1])[1]).style('display',d=>d[0]==='Strait of Canso'&&t.k<3?'none':null);
    if(A.insetBox&&t.k<2.5){ const [x0,y0,x1,y1]=A.insetBox, ring=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]], q=[]; ring.forEach((a,i)=>{ const b=ring[(i+1)%4]; for(let j=0;j<8;j++) q.push(p([a[0]+(b[0]-a[0])*j/8,a[1]+(b[1]-a[1])*j/8])); }); gLoc.attr('d','M'+q.map(v=>v.join(',')).join('L')+'Z').style('display',null); } else gLoc.style('display','none');
    A.flows.each(function(d){ const pts=smoothLine(((DATA.routes[d.pl]||[])[d.po]||[[PLACES[d.pl].ax??PLACES[d.pl].lon,PLACES[d.pl].ay??PLACES[d.pl].lat],[PORTS[d.po].lon,PORTS[d.po].lat]]).map(c=>p(c))), w=Math.max(0.8,A.w(d.v)), rb=imp()? ribbon(pts,w,Math.max(0.7,w*0.45)) : ribbon(pts.slice().reverse(),w,Math.max(0.7,w*0.45)); d.rb=rb; d.pts=pts; d.wpx=w; d3.select(this).attr('d',rb.area); });
    hits.attr('d',d=>d.rb.line);
    A.hG.attr('transform',i=>`translate(${p([PORTS[i].lon,PORTS[i].lat])})`).select('text').style('display','none');
    A.placeG.attr('transform',d=>{ const q=PLACES[d.i]; return `translate(${p(d.off?[q.ax,q.ay]:[q.lon,q.lat])})`; });
    furn.selectAll('*').remove(); graticuleLabels(furn,p,f,[-75,-70,-65,-60,-55,-50],[40,42,44,46,48,50]);
    const kms=t.k>=8?20:t.k>=3?50:(narrow?100:200); const sb=scaleBar(furn,p,f.x0+18,f.y1-16,kms);
    if(final){
      const corr=[]; A.flows.each(d=>{ if(d.wpx>=2.5) d.pts.forEach((q,i)=>{ if(i%3===0) corr.push({x:q[0],y:q[1],r:d.wpx/2+2}); }); });
      const items=[];
      const inView=(x,y)=>x>=f.x0&&x<=f.x1&&y>=f.y0&&y<=f.y1;
      A.placeG.each(function(d,k){ const tr=this.getAttribute('transform').match(/-?[\d.]+/g).map(Number);
        items.push({g:d3.select(this).select('text'),x:tr[0],y:tr[1],hide:!inView(tr[0],tr[1]),must:k<3,r:A.r(plTot.get(d.i))+(d.off?12:0),pref:d.off?(tr[1]>H*0.7?'n':tr[0]>W/2?'w':'e'):(PLACES[d.i].name==='Magdalen Islands'?'ne':tr[0]<W*0.22?'s':'e')}); });
      if(t.k>=3) A.hG.each(function(i){ const q=p([PORTS[i].lon,PORTS[i].lat]); items.push({g:d3.select(this).select('text').style('display',null),x:q[0],y:q[1],r:3,hide:!inView(q[0],q[1]),pref:PORT_LABEL[PORTS[i].name]||'e'}); });
      const placed=placeLabels(items,W,H,{x0:f.x0+5,y0:f.y0+5,x1:f.x1-5,y1:f.y1-5},{rects:[sb],circles:corr});
      gWater.each(function(d){ if(!(d[0]==='Strait of Canso'&&t.k<3)) this.style.display=null; }); yieldWater(gWater,placed.concat([sb]));
    }
  };
  A.layoutRegion=layout;
  A.zoom=makeZoom(svg,f,(t,fin)=>{ A.zt=t; layout(t,fin); },t=>{ A.zt=t; layout(t,true); });
  svg.call(A.zoom.transform,A.zt);
  layout(A.zt,true);
  const peiF={type:'FeatureCollection',features:GEO.region.features.filter(d=>d.properties.pei)};
  zoomBar('a-zoom',svg,A.zoom,f,()=>d3.geoPath(base0).bounds(peiF));

  const cap=document.getElementById('a-cap'); cap.replaceChildren(document.createTextNode(imp()
    ? 'Lines follow a modelled sea route from each origin to the harbour where the goods were entered; line width shows value. Pie area shows value and slices show SITC category. Britain, France, Bermuda and the West Indies sit at the edge of the map, with an arrow toward them and their distance from Charlottetown. Each colony is drawn at a representative port.'
    : 'Lines follow a modelled sea route from the harbour of shipment to each destination; line width shows value. Pie area shows value and slices show SITC category. Britain, France, Bermuda and the West Indies sit at the edge of the map, with an arrow toward them and their distance from Charlottetown. Each colony is drawn at a representative port.'));
  cap.append(sup(5), sup(9)); const un=sum(all.filter(r=>!mappable(r.pl)||!portOK(r.po))); if(un>0){ cap.append(document.createTextNode(` ${gbp(un)} with no mappable ${placeWord()} or harbour is not drawn.`)); cap.append(sup(7)); }
  const keys=document.getElementById('a-keys'); keys.replaceChildren(); circleKey(keys,`${PlaceWord()} pie area`,A.r,A.r.domain()[1]); lineKey(keys,'Line width',A.w,A.w.domain()[1]);
  renderAHarbours(all,rows,poTot);
  setFoot('a-foot'); document.getElementById('a-foot').append(document.createTextNode(' Lambert conformal conic projection, standard parallels 43° and 49° N (main map) and 46° and 47° N (inset); the rectangle on the main map marks the inset.'));
  document.getElementById('a-margin').replaceChildren();
  updateA();
}
function renderAHarbours(all,rows,poTot){
  const host=document.getElementById('a-pei'); host.replaceChildren();
  const W=Math.max(300,host.clientWidth||860), H=Math.round(Math.max(240,W*0.44));
  if(A.WP!==W){ A.zp=d3.zoomIdentity; A.WP=W; }
  const f={x0:46,y0:4,x1:W-4,y1:H-22};
  const pei=GEO.pei.features.filter(d=>d.properties.pei);
  const base0=d3.geoConicConformal().parallels([46,47]).rotate([63.2,0]).fitExtent([[f.x0+16,f.y0+40],[f.x1-16,f.y1-34]],{type:'FeatureCollection',features:pei});
  const s0=base0.scale(), t0=base0.translate(), projAt=t=>d3.geoConicConformal().parallels([46,47]).rotate([63.2,0]).scale(s0*t.k).translate([t0[0]*t.k+t.x,t0[1]*t.k+t.y]);
  A.rp=d3.scaleSqrt().domain([0,d3.max(poTot.values())||1]).range([0,Math.max(14,Math.min(30,W*0.034))]);
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${W} ${H}`).attr('width',W).attr('height',H).attr('role','img').attr('aria-label','Prince Edward Island harbours, with pies of trade by SITC category. Zoomable.');
  svg.append('clipPath').attr('id','clipAP').append('rect').attr('x',f.x0).attr('y',f.y0).attr('width',f.x1-f.x0).attr('height',f.y1-f.y0);
  const g=svg.append('g').attr('clip-path','url(#clipAP)');
  g.append('rect').attr('x',f.x0).attr('y',f.y0).attr('width',f.x1-f.x0).attr('height',f.y1-f.y0).style('fill','var(--sea)');
  const gGrat=g.append('path').datum(d3.geoGraticule().extent([[-66,45],[-60,48]]).step([0.5,0.5])()).style('fill','none').style('stroke','var(--grat)');
  const gWL=g.append('g').selectAll('path').data(GEO.pei.features).join('path').style('fill','none').style('stroke','var(--waterline)').style('stroke-width',5).style('stroke-linejoin','round');
  const gLand=g.append('g').selectAll('path').data(GEO.pei.features).join('path').style('fill',d=>d.properties.pei?'var(--land-pei)':'var(--land)').style('stroke','var(--coast)').style('stroke-width',.7);
  const gWater=g.append('g').selectAll('text').data(W>=560?[['Gulf of St. Lawrence',[-63.05,46.88]],['Northumberland Strait',[-63.25,45.86]],['Hillsborough Bay',[-63.02,46.1]]]:[]).join('text').attr('class','water').attr('text-anchor','middle').text(d=>d[0]);
  const list=PORTS.map((p,i)=>i).filter(i=>poTot.get(i)&&portOK(i)).sort((a,b)=>poTot.get(b)-poTot.get(a)).map(i=>({i}));
  A.portG=g.append('g').selectAll('g').data(list,d=>d.i).join('g');
  A.portG.append('g').attr('class','pie');
  A.portG.append('text').attr('class','halo po-l');
  A.portG.append('circle').attr('class','node-hit').attr('r',d=>Math.max(12,A.rp(poTot.get(d.i))+3));
  A.portG.each(function(d){ const lt=d3.select(this).select('.po-l'); lt.append('tspan').attr('class','lbl').text(PORTS[d.i].name); if(W>=560) lt.append('tspan').attr('class','lbl-v po-v').attr('dy','1.2em').text(gbpS(poTot.get(d.i))); });
  bindNode(A.portG.select('.node-hit'),d=>`po:${d.i}`,(t,d)=>tipBreakdown(t,PORTS[d.i].name,rows.filter(r=>r.po===d.i)),d=>`${PORTS[d.i].name}, ${gbp(poTot.get(d.i)||0)}`,updateA);
  svg.append('text').attr('x',f.x0+12).attr('y',f.y0+24).style('font-family','var(--narrow)').style('font-weight',600).style('font-size','16px').text(imp()?'Inset: harbours of entry':'Inset: harbours of shipment');
  neatline(svg,f); const furn=svg.append('g');
  const layout=(t,final)=>{
    const p=projAt(t), path=d3.geoPath(p);
    gGrat.attr('d',path); gWL.attr('d',path); gLand.attr('d',path); gWater.attr('x',d=>p(d[1])[0]).attr('y',d=>p(d[1])[1]).style('display',d=>d[0]==='Hillsborough Bay'&&t.k<2?'none':null);
    list.forEach(d=>d.xy=p([PORTS[d.i].lon,PORTS[d.i].lat]));
    A.portG.attr('transform',d=>`translate(${d.xy})`);
    furn.selectAll('*').remove(); const sb=scaleBar(furn,p,f.x1-150,f.y1-14,t.k>=4?10:t.k>=2?20:40);
    const st=t.k>=3?[0.25,0.25]:[0.5,0.5]; gGrat.datum(d3.geoGraticule().extent([[-66,45],[-60,48]]).step(st)()).attr('d',path);
    graticuleLabels(furn,p,f,d3.range(-64.5,-61.9,st[0]),d3.range(45.75,47.26,st[1]));
    if(final){ const placed=placeLabels(list.map((d,k)=>({g:d3.select(A.portG.filter(e=>e.i===d.i).node()).select('.po-l'),x:d.xy[0],y:d.xy[1],r:A.rp(poTot.get(d.i)),must:k<3,hide:!(d.xy[0]>=f.x0&&d.xy[0]<=f.x1&&d.xy[1]>=f.y0&&d.xy[1]<=f.y1),pref:PORT_LABEL[PORTS[d.i].name]||'e'})),W,H,{x0:f.x0+4,y0:f.y0+30,x1:f.x1-4,y1:f.y1-4},{rects:[sb]});
      gWater.each(function(d){ if(!(d[0]==='Hillsborough Bay'&&t.k<2)) this.style.display=null; }); yieldWater(gWater,placed.concat([sb])); }
  };
  A.zoomP=makeZoom(svg,f,(t)=>{ A.zp=t; layout(t,false); },t=>{ A.zp=t; layout(t,true); });
  svg.call(A.zoomP.transform,A.zp); layout(A.zp,true);
  { const i0=base0.invert([f.x0,f.y0]), i1=base0.invert([f.x1,f.y1]); A.insetBox=[i0[0],i0[1],i1[0],i1[1]]; if(A.layoutRegion) A.layoutRegion(A.zt,true); }
  zoomBar('a-pzoom',svg,A.zoomP,f,null);
  const pcap=document.getElementById('a-pcap'); pcap.replaceChildren(document.createTextNode('Pie area shows each harbour’s value; slices show SITC category. Hover a place or route on the main map to see only its goods here.')); pcap.append(sup(6));
  const pk=document.getElementById('a-pkeys'); pk.replaceChildren(); circleKey(pk,'Harbour pie area',A.rp,A.rp.domain()[1]);
}
function updateA(){
  const k=active(), s=parseKey(k), rows=cur();
  if(A.flows) A.flows.style('opacity',d=>!k?0.34:(keyMatch(k,{pl:d.pl,po:d.po})?0.9:0.05)).style('fill',state.cat>=0?ccol(state.cat):'var(--flow)');
  if(A.hG) A.hG.style('opacity',i=>s&&((s.type!=='place'&&s.po!==i)||(s.type==='place'&&!rows.some(r=>r.pl===s.pl&&r.po===i)))?0.25:1);
  if(A.placeG) A.placeG.each(function(d){ const sub=s&&s.type!=='place'? rows.filter(r=>r.pl===d.i&&keyMatch(k,r)) : rows.filter(r=>r.pl===d.i); const sums=catSums(sub);
    drawPie(d3.select(this).select('.pie'),sums,A.r(d3.sum(sums)));
    const dim=s&&((s.type!=='port'&&s.pl!==d.i)||(s.type==='port'&&d3.sum(sums)===0)); d3.select(this).style('opacity',dim?0.25:1); });
  if(A.portG) A.portG.each(function(d){ const sub=s&&s.type!=='port'? rows.filter(r=>r.po===d.i&&keyMatch(k,r)) : rows.filter(r=>r.po===d.i); const sums=catSums(sub), v=d3.sum(sums), gg=d3.select(this);
    drawPie(gg.select('.pie'),sums,A.rp(v)); gg.select('.po-v').text(v>0?gbpS(v):'–');
    const dim=s&&((s.type!=='place'&&s.po!==d.i)||(s.type==='place'&&v===0)); gg.style('opacity',dim?0.25:1); });
  renderMargin('a-margin',{pie:false,harbours:true,onChange:updateA});
}

/* =========================================================
   Plate B
   ========================================================= */
const B={};
function renderB(){
  document.getElementById('b-title').textContent = `${DIRS[state.dir]} by bearing from Charlottetown, ${yearLabel()}`;
  const host=document.getElementById('b-map'); host.replaceChildren();
  const W=Math.max(320,host.clientWidth||860), narrow=W<560, lm=narrow?74:178, R=Math.min((W-2*lm)/2,320), H=Math.round(2*R+(narrow?120:130)), cx=W/2, cy=H/2;
  const all=base(), rows=cur(), pei=GEO.pei.features.filter(d=>d.properties.pei);
  const proj=d3.geoConicConformal().parallels([46,47]).rotate([63.2,0]).fitExtent([[cx-R*0.8,cy-R*0.46],[cx+R*0.8,cy+R*0.46]],{type:'FeatureCollection',features:pei});
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${W} ${H}`).attr('width',W).attr('height',H).attr('role','img').attr('aria-label',`Compass diagram of ${dirL()}: ${placeWord()}s arranged around Prince Edward Island by bearing`);
  svg.append('rect').attr('width',W).attr('height',H).style('fill','var(--sea)');
  const ring=svg.append('g');
  ring.append('circle').attr('cx',cx).attr('cy',cy).attr('r',R).style('fill','none').style('stroke','var(--ink)').style('stroke-width',1);
  ring.append('circle').attr('cx',cx).attr('cy',cy).attr('r',R-12).style('fill','none').style('stroke','var(--hair)').style('stroke-width',.6);
  for(let a=0;a<360;a+=5){ const t=a*Math.PI/180, l=a%90===0?12:a%30===0?8:a%10===0?5:3; ring.append('line').attr('x1',cx+Math.sin(t)*R).attr('y1',cy-Math.cos(t)*R).attr('x2',cx+Math.sin(t)*(R-l)).attr('y2',cy-Math.cos(t)*(R-l)).style('stroke','var(--ink)').style('stroke-width',a%90===0?1.2:.6); }
  [['N',0],['E',90],['S',180],['W',270]].forEach(([t,a])=>{ const r=R-26, th=a*Math.PI/180; ring.append('text').attr('x',cx+Math.sin(th)*r).attr('y',cy-Math.cos(th)*r).attr('dy','0.35em').attr('text-anchor','middle').style('font-family','var(--narrow)').style('font-size','14px').style('font-weight',600).style('fill','var(--ink-2)').text(t); });
  svg.append('g').selectAll('path').data(pei).join('path').attr('d',d3.geoPath(proj)).style('fill','var(--land-pei)').style('stroke','var(--coast)').style('stroke-width',.7);
  const plTot=d3.rollup(all,v=>d3.sum(v,r=>r.v),r=>r.pl), poTot=d3.rollup(all,v=>d3.sum(v,r=>r.v),r=>r.po);
  B.rPl=d3.scaleSqrt().domain([0,d3.max(plTot.values())||1]).range([0,narrow?14:22]);
  B.rPo=d3.scaleSqrt().domain([0,d3.max(poTot.values())||1]).range([0,narrow?12:19]);
  let nodes=PLACES.map((p,i)=>({i,b:mappable(i)?bearing(CENTER,[p.lon,p.lat]):null})).filter(d=>d.b!=null&&plTot.get(d.i)); nodes.forEach(d=>d.a=d.b);
  const rOf=d=>B.rPl(plTot.get(d.i)||0);
  const sepFor=(P,Q)=>{ const mid=((P.a+((Q.a-P.a+360)%360)/2)%360)*Math.PI/180, vert=Math.abs(Math.cos(mid))>0.8; return Math.max(vert?(narrow?24:20):(narrow?15:12.5),(rOf(P)+rOf(Q)+16)/R*180/Math.PI); };
  for(let it=0;it<300;it++){ nodes.sort((x,y)=>x.a-y.a); let moved=false;
    for(let j=0;j<nodes.length;j++){ const P=nodes[j], Q=nodes[(j+1)%nodes.length], d=(Q.a-P.a+360)%360, need=sepFor(P,Q); if(nodes.length>1&&d<need){ const push=(need-d)/2; P.a=(P.a-push+360)%360; Q.a=(Q.a+push)%360; moved=true; } }
    if(!moved) break; }
  nodes.forEach(d=>{ const t=d.a*Math.PI/180; d.x=cx+Math.sin(t)*R; d.y=cy-Math.cos(t)*R; d.t=t; });
  const portXY=PORTS.map(p=>p.lon!=null? proj([p.lon,p.lat]) : null);
  const pairAll=d3.rollup(all.filter(r=>mappable(r.pl)&&portOK(r.po)),v=>d3.sum(v,r=>r.v),r=>r.pl+':'+r.po);
  B.w=d3.scaleLinear().domain([0,d3.max(pairAll.values())||1]).range([0,Math.max(7,Math.min(16,W*0.02))]);
  const nodeBy=new Map(nodes.map(n=>[n.i,n]));
  const pairs=d3.rollups(rows.filter(r=>mappable(r.pl)&&portOK(r.po)&&nodeBy.has(r.pl)),v=>d3.sum(v,r=>r.v),r=>r.pl,r=>r.po).flatMap(([pl,arr])=>arr.map(([po,v])=>({pl,po,v}))).sort((a,b)=>b.v-a.v);
  B.flows=svg.append('g').selectAll('path').data(pairs).join('path').attr('class','flow').each(function(d){ const n=nodeBy.get(d.pl), P=[n.x,n.y], Q=portXY[d.po], w=Math.max(0.8,B.w(d.v)), c=[n.x+(cx-n.x)*0.62,n.y+(cy-n.y)*0.62];
    d.t= imp()? taper(P,Q,w,Math.max(0.7,w*0.45),0,c) : taper(Q,P,w,Math.max(0.7,w*0.45),0,c); d3.select(this).attr('d',d.t.area); });
  const hits=svg.append('g').selectAll('path').data(pairs).join('path').attr('class','flow-hit').attr('d',d=>d.t.line).style('stroke-width',d=>Math.max(10,B.w(d.v)+5));
  bindNode(hits,d=>`rt:${d.pl}:${d.po}`,(t,d)=>tipBreakdown(t,keyLabel(`rt:${d.pl}:${d.po}`),rows.filter(r=>r.pl===d.pl&&r.po===d.po)),d=>`${keyLabel(`rt:${d.pl}:${d.po}`)}: ${gbp(d.v)}`,updateB);
  const plist=PORTS.map((p,i)=>i).filter(i=>poTot.get(i)&&portOK(i)).sort((a,b)=>poTot.get(b)-poTot.get(a));
  B.portG=svg.append('g').selectAll('g').data(plist).join('g').attr('transform',i=>`translate(${portXY[i]})`);
  B.portG.append('circle').attr('class','mk').style('fill','var(--node)').style('stroke','var(--sea)').style('stroke-width',2).attr('r',i=>Math.max(3,B.rPo(poTot.get(i))));
  B.portG.append('text').attr('class','halo po-l').append('tspan').attr('class','lbl').style('font-size','12.5px').text(i=>PORTS[i].name);
  B.portG.append('circle').attr('class','node-hit').attr('r',i=>Math.max(12,B.rPo(poTot.get(i))+3));
  B.harbourLabelItems=(narrow?plist.slice(0,4):plist).map((i,k)=>({must:k<3,g:d3.select(B.portG.filter(e=>e===i).node()).select('.po-l'),x:portXY[i][0],y:portXY[i][1],r:Math.max(3,B.rPo(poTot.get(i))),pref:PORT_LABEL[PORTS[i].name]||'e'}));
  if(narrow) B.portG.filter(i=>!plist.slice(0,4).includes(i)).select('.po-l').style('display','none');
  bindNode(B.portG.select('.node-hit'),i=>`po:${i}`,(t,i)=>tipBreakdown(t,PORTS[i].name,rows.filter(r=>r.po===i)),i=>`${PORTS[i].name}, ${gbp(poTot.get(i)||0)}`,updateB);
  const plCur=d3.rollup(rows,v=>d3.sum(v,r=>r.v),r=>r.pl);
  B.nodeG=svg.append('g').selectAll('g').data(nodes).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);
  B.nodeG.append('circle').attr('class','mk').style('fill','var(--node)').style('stroke','var(--sea)').style('stroke-width',2);
  B.nodeG.each(function(d){ const gg=d3.select(this), vc=plCur.get(d.i)||0, t=gg.append('text').attr('class','halo'), nm=PLACES[d.i].name;
    if(narrow&&nm.length>12&&nm.includes(' ')){ const ws=nm.split(' '); let best=1, bd=1e9; for(let k=1;k<ws.length;k++){ const a=ws.slice(0,k).join(' ').length, b=ws.slice(k).join(' ').length; if(Math.abs(a-b)<bd){ bd=Math.abs(a-b); best=k; } }
      t.append('tspan').attr('class','lbl-c').text(ws.slice(0,best).join(' ')); t.append('tspan').attr('class','lbl-c').attr('dy','1.1em').text(ws.slice(best).join(' ')); }
    else t.append('tspan').attr('class','lbl-c').text(nm);
    if(!narrow) t.append('tspan').attr('class','lbl-v').attr('dy','1.25em').text(`${vc?gbpS(vc):'–'}, ${kmLabel(d.i)}`);
    if(narrow) t.selectAll('tspan').style('font-size','12px'); });
  const nodeCircles=nodes.map(d=>({x:d.x,y:d.y,r:rOf(d)+3})), portCircles=plist.map(i=>({x:portXY[i][0],y:portXY[i][1],r:Math.max(3,B.rPo(poTot.get(i)))+2}));
  const ringItems=nodes.slice().sort((a,b)=>(plTot.get(b.i)||0)-(plTot.get(a.i)||0)).map(d=>{ const s=Math.sin(d.t), c=-Math.cos(d.t);
    return {g:d3.select(B.nodeG.filter(e=>e.i===d.i).node()).select('text'), x:d.x, y:d.y, r:rOf(d)+3, must:true, pref: Math.abs(s)>0.35? (s>0?'e':'w') : (c<0?'n':'s')}; });
  const ringBoxes=placeLabels(ringItems,W,H,null,{circles:portCircles.concat([{x:cx,y:cy,r:R-14}])});
  placeLabels(B.harbourLabelItems,W,H,null,{rects:ringBoxes,circles:nodeCircles.concat(portCircles)});
  B.nodeG.append('circle').attr('class','node-hit').attr('r',d=>Math.max(13,rOf(d)+4));
  bindNode(B.nodeG.select('.node-hit'),d=>`pl:${d.i}`,(t,d)=>tipBreakdown(t,PLACES[d.i].name,rows.filter(r=>r.pl===d.i),`drawn at ${PLACES[d.i].rep}`),d=>`${PLACES[d.i].name}, ${gbp(plTot.get(d.i)||0)}`,updateB);
  const cap=document.getElementById('b-cap'); cap.replaceChildren(document.createTextNode(`Each ${placeWord()} sits on the ring at its compass bearing from Charlottetown; direction is kept and distance is printed instead. Line width shows value. The margin pie shows whatever you hover or pin.`)); cap.append(sup(8));
  const keys=document.getElementById('b-keys'); keys.replaceChildren(); lineKey(keys,'Line width',B.w,B.w.domain()[1]); circleKey(keys,`${PlaceWord()} circle area`,B.rPl,B.rPl.domain()[1]); circleKey(keys,'Harbour circle area',B.rPo,B.rPo.domain()[1]);
  setFoot('b-foot');
  document.getElementById('b-margin').replaceChildren();
  updateB();
}
function updateB(){
  const k=active(), s=parseKey(k), rows=cur();
  if(B.flows) B.flows.style('opacity',d=>!k?0.4:(keyMatch(k,{pl:d.pl,po:d.po})?0.92:0.06)).style('fill',state.cat>=0?ccol(state.cat):'var(--flow)');
  if(B.nodeG) B.nodeG.each(function(d){ const v=sum(rows.filter(r=>r.pl===d.i&&(!s||s.type==='place'||keyMatch(k,r)))); d3.select(this).select('.mk').attr('r',Math.max(v>0?3:2,B.rPl(v)));
    const dim=s&&((s.type!=='port'&&s.pl!==d.i)||(s.type==='port'&&v===0)); d3.select(this).style('opacity',dim?0.28:1); });
  if(B.portG) B.portG.each(function(i){ const v=sum(rows.filter(r=>r.po===i&&(!s||s.type==='port'||keyMatch(k,r)))); d3.select(this).select('.mk').attr('r',Math.max(v>0?3:2,B.rPo(v)));
    const dim=s&&((s.type!=='place'&&s.po!==i)||(s.type==='place'&&v===0)); d3.select(this).style('opacity',dim?0.28:1); });
  renderMargin('b-margin',{pie:true,pieSize:210,harbours:true,onChange:updateB});
}

/* =========================================================
   Plate C
   ========================================================= */
const C={};
const sitcName=c=>(DATA.sitc&&DATA.sitc[c])||'';
function hierSpec(){
  // keys read entry records: [d,y,place,harbour,cat,code,...,value@12,...,article@16,division@17]
  const pl={key:e=>'p'+e[2],name:k=>PLACES[+k.slice(1)].name,kind:'place'}, po={key:e=>'h'+e[3],name:k=>PORTS[+k.slice(1)].name,kind:'port'};
  const ca={key:e=>'c'+e[4],name:k=>CATS[+k.slice(1)].label,short:k=>CATS[+k.slice(1)].label,kind:'cat'};
  const dv={key:e=>'d'+e[17],name:k=>{ const c=k.slice(1); return /^\d\d$/.test(c)? `${c} ${divInfo(c).name}` : divInfo(c).name; },short:k=>divName(k.slice(1)),kind:'div'};
  const tier=(n,p,kind)=>({key:e=>{ const c=e[5]; return c&&c.length>=n? p+c.slice(0,n) : p+'~'; },name:k=>k.endsWith('~')? 'No finer code' : `${k.slice(1)} ${sitcName(k.slice(1))}`,kind});
  const g3=tier(3,'g','g3'), g4=tier(4,'s','g4');
  return [[pl,ca,dv,g3,g4,po],[ca,dv,g3,g4,pl],[po,pl,ca,dv,g3,g4]][state.hier];
}
const KINDS={cat:'categories',div:'divisions',g3:'groups',g4:'subgroups',port:'harbours'};
function renderSunburst(){
  const spec=hierSpec();
  // remember where the reader was, so a year or trade change keeps the same view when it still exists
  const prevPath = C.root&&C.focus&&C.hier===state.hier? C.focus.ancestors().reverse().slice(1).map(a=>a.data[0]) : [];
  C.hier=state.hier;
  document.getElementById('c-title').textContent = `${DIRS[state.dir]} by ${[placeWord()+', SITC tier and harbour','SITC tier and '+placeWord(),'harbour, '+placeWord()+' and SITC tier'][state.hier]}, ${yearLabel()}`;
  const host=document.getElementById('c-chart'); host.replaceChildren();
  const rows=DATA.entries.filter(e=>entryMatch(e,state.lock)), size=Math.max(300,Math.min(host.clientWidth||620,700)), radius=size/8.1;
  const nested=d3.rollup(rows,v=>d3.sum(v,e=>e[12]),...spec.map(s=>s.key));
  const root=d3.hierarchy([state.lock? `Pinned: ${keyLabel(state.lock)}` : `All ${dirL()}`,nested],([,v])=>v instanceof Map?Array.from(v):null).sum(([,v])=>typeof v==='number'?v:0);
  root.each(n=>{ n.kind=n.depth===0?'root':spec[n.depth-1].kind; n.label=n.depth===0?n.data[0]:spec[n.depth-1].name(n.data[0]); n.ring=n.depth&&spec[n.depth-1].short? spec[n.depth-1].short(n.data[0]) : n.label; n.catIdx=n.kind==='cat'?+n.data[0].slice(1):(n.parent&&n.parent.catIdx!=null?n.parent.catIdx:null); n.catDepth=n.kind==='cat'?n.depth:(n.parent?n.parent.catDepth:null); });
  root.sort((a,b)=>(a.kind==='cat'&&b.kind==='cat')?a.catIdx-b.catIdx:b.value-a.value);
  d3.partition().size([2*Math.PI,root.height+1])(root); root.each(d=>d.current=d);
  C.root=root; C.focus=root;
  const arc=d3.arc().startAngle(d=>d.x0).endAngle(d=>d.x1).padAngle(d=>Math.min((d.x1-d.x0)/2,0.006)).padRadius(radius*1.5).innerRadius(d=>d.y0*radius).outerRadius(d=>Math.max(d.y0*radius,d.y1*radius-1.5));
  const svg=d3.select(host).append('svg').attr('viewBox',[-size/2,-size/2,size,size]).attr('width',size).attr('height',size).style('margin','0 auto').attr('role','img').attr('aria-label',`Sunburst of ${dirL()} by ${spec.map(s=>s.kind).join(', ')}`);
  const fill=d=>d.catIdx!=null?ccol(d.catIdx):(d.depth===1?'var(--land-pei)':'var(--land)');
  const fop=d=>d.kind==='cat'?1:d.catIdx!=null?([0,0.55,0.42,0.32][d.depth-d.catDepth]||0.24):1;
  const txt=d=>d.kind==='cat'?oncol(d.catIdx):'var(--ink)';
  const vis=d=>d.y1<=4&&d.y0>=1&&d.x1>d.x0, labVis=d=>d.y1<=4&&d.y0>=1&&(d.y1-d.y0)*(d.x1-d.x0)>0.05;
  const labT=d=>{ const x=(d.x0+d.x1)/2*180/Math.PI, y=(d.y0+d.y1)/2*radius; return `rotate(${x-90}) translate(${y},0) rotate(${x<180?0:180})`; };
  const g=svg.append('g');
  const paths=g.append('g').selectAll('path').data(root.descendants().slice(1)).join('path').style('fill',fill).style('fill-opacity',fop).attr('d',d=>arc(d.current))
    .attr('pointer-events',d=>vis(d.current)?'auto':'none').style('opacity',d=>vis(d.current)?1:0).style('cursor',d=>d.children?'pointer':'default')
    .attr('tabindex',d=>vis(d.current)?0:-1).attr('role','button').attr('aria-label',d=>`${chainLabel(d)}: ${gbp(d.value)}`);
  paths.on('pointerenter pointermove',(e,d)=>showTip(e,t=>sunTip(t,d))).on('pointerleave blur',hideTip).on('focus',(e,d)=>showTip(e,t=>sunTip(t,d)))
    .on('click',(e,d)=>{ if(d.children) zoom(d); }).on('keydown',(e,d)=>{ if((e.key==='Enter'||e.key===' ')&&d.children){ e.preventDefault(); zoom(d);} if(e.key==='Escape') zoom(C.focus.parent||root); });
  const mctx=document.createElement('canvas').getContext('2d'), avail=radius-8, fam=getComputedStyle(document.body).fontFamily;
  const fit=d=>{ const L=d.ring; for(const sz of [11.5,11,10.5]){ mctx.font=`${d.kind==='cat'?600:500} ${sz}px ${fam}`; if(mctx.measureText(L).width<=avail) return {sz,txt:L}; }
    let s=L; mctx.font=`${d.kind==='cat'?600:500} 10.5px ${fam}`; while(s.length>2&&mctx.measureText(s+'…').width>avail) s=s.slice(0,-1); return {sz:10.5,txt:s.trimEnd()+'…'}; };
  const labels=g.append('g').attr('pointer-events','none').attr('text-anchor','middle').selectAll('text').data(root.descendants().slice(1)).join('text').attr('dy','0.35em')
    .each(function(d){ const r=fit(d); d3.select(this).style('font-size',r.sz+'px').text(r.txt); })
    .style('font-weight',d=>d.kind==='cat'?600:500).style('fill',txt).style('opacity',d=>+labVis(d.current)).attr('transform',d=>labT(d.current));
  const center=g.append('g');
  center.append('circle').attr('r',radius-2).style('fill','var(--paper)').style('stroke','var(--hair)').style('cursor','pointer').attr('tabindex',0).attr('role','button').attr('aria-label','Zoom out')
    .on('click',()=>zoom(C.focus.parent||root)).on('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); zoom(C.focus.parent||root);} });
  const ct=center.append('text').attr('text-anchor','middle').attr('pointer-events','none');
  function setCenter(p){ ct.selectAll('*').remove(); const nm=p.label.length>18?p.label.slice(0,17)+'…':p.label;
    ct.append('tspan').attr('x',0).attr('dy','-0.45em').style('font-size','12.5px').style('fill','var(--ink-2)').text(nm);
    ct.append('tspan').attr('x',0).attr('dy','1.35em').style('font-size','19px').style('font-weight',600).text(gbpS(p.value));
    if(p!==root) ct.append('tspan').attr('x',0).attr('dy','1.45em').style('font-size','11px').style('fill','var(--muted)').text('zoom out'); }
  function zoom(p,instant){ if(!p) return; C.focus=p; setCenter(p); renderCMargin(); EV.shown=100; renderEntries(); renderJump();
    root.each(d=>d.target={x0:Math.max(0,Math.min(1,(d.x0-p.x0)/(p.x1-p.x0)))*2*Math.PI,x1:Math.max(0,Math.min(1,(d.x1-p.x0)/(p.x1-p.x0)))*2*Math.PI,y0:Math.max(0,d.y0-p.depth),y1:Math.max(0,d.y1-p.depth)});
    const t=svg.transition().duration(REDUCED||instant?0:600).ease(d3.easeCubicOut);
    paths.transition(t).tween('data',d=>{ const i=d3.interpolate(d.current,d.target); return tt=>d.current=i(tt); })
      .filter(function(d){ return +this.style.opacity||vis(d.target); }).style('opacity',d=>vis(d.target)?1:0).attr('pointer-events',d=>vis(d.target)?'auto':'none').attrTween('d',d=>()=>arc(d.current));
    paths.attr('tabindex',d=>vis(d.target)?0:-1);
    labels.filter(function(d){ return +this.style.opacity||labVis(d.target); }).transition(t).style('opacity',d=>+labVis(d.target)).attrTween('transform',d=>()=>labT(d.current)); }
  C.zoom=zoom; setCenter(root); renderCMargin(); setFoot('c-foot');
  let target=root; for(const key of prevPath){ const nx=(target.children||[]).find(c=>c.data[0]===key); if(!nx) break; target=nx; }
  if(target!==root) zoom(target,true);
  else if(state.lock&&root.children&&root.children.length===1) zoom(root.children[0],true);   // open on the pinned place or harbour
}
function chainLabel(d){ return d.ancestors().reverse().slice(1).map(a=>a.label).join(', '); }
function sunTip(t,d){
  t.append(el('div','t-val',gbp(d.value)), el('div','t-name',chainLabel(d)), el('div','t-sub',lsd(d.value)));
  const g=el('div','t-rows'); g.style.gridTemplateColumns='minmax(0,1fr) auto';
  if(d.parent&&d.parent.depth>0) g.append(el('span',null,`Share of ${d.parent.label}`), el('span','r',pct(d.value,d.parent.value)));
  g.append(el('span',null,state.lock? `Share of ${keyLabel(state.lock)}’s ${dirL()}` : `Share of all ${dirL()}`), el('span','r',pct(d.value,C.root.value))); t.append(g);
  if(d.children) t.append(el('div','t-note',`Click to zoom into its ${d.children.length} ${KINDS[d.children[0].kind]||placeWord()+'s'}.`));
}
function sunMatch(node,e){ const spec=hierSpec(); return node.ancestors().every(a=>a.depth===0||spec[a.depth-1].key(e)===a.data[0]); }
function renderCMargin(){
  const host=document.getElementById('c-margin'); host.replaceChildren();
  const p=C.focus, root=C.root, chain=p.ancestors().reverse();
  if(chain.length>1){ const cr=el('nav','crumbs'); cr.setAttribute('aria-label','Zoom path'); chain.forEach((a,i)=>{ if(i) cr.append(el('span',null,'/')); if(a===p) cr.append(el('span',null,a.label)); else { const b=el('button',null,a.label); b.type='button'; b.addEventListener('click',()=>C.zoom(a)); cr.append(b);} }); host.append(cr); }
  const sec=el('section','m-sel'); const nC=entriesNow().length;
  const ml=el('div','mlinks'); { const b=el('button','textbtn',`Check the ${fInt(nC)} source ${nC===1?'entry':'entries'} (Appendix B)`); b.type='button'; b.addEventListener('click',openEntries); ml.append(b); } { const b=el('button','textbtn','See the values table (Appendix A)'); b.type='button'; b.addEventListener('click',()=>openAppendix('tableview')); ml.append(b); }
  sec.append(el('h3',null,p.label), el('p','m-fig',gbp(p.value)), el('p','m-sub',`${lsd(p.value)}, ${pct(p.value,root.value)} of ${state.lock? keyLabel(state.lock)+'’s '+dirL() : 'all '+dirL()}. Returns for ${yearLabel()}.`), ml); host.append(sec);
  const kids=(p.children||[]).slice().sort((a,b)=>b.value-a.value);
  if(kids.length){ const kn={cat:'By SITC category',div:'By SITC division (tier two)',g3:'By SITC group (tier three)',g4:'By SITC subgroup (tier four)',port:'By harbour',place:'By '+placeWord()}[kids[0].kind]; const h=el('h4',null,kn); if(kids[0].kind==='cat') h.append(sup(3)); host.append(h);
    const ul=el('ul','key'); const mx=kids[0].value||1;
    kids.forEach(k=>{ const li=el('li',k.children?'on':''); const nm=el('span','k-name'), sw=el('span','sw'); sw.style.background=k.catIdx!=null?ccol(k.catIdx):'var(--node)'; if(k.kind!=='cat'&&k.catIdx!=null) sw.style.opacity=k.depth-k.catDepth===1?.55:.35;
      nm.append(sw, el('span',null,k.label)); const bar=el('span','k-bar'), fi=el('i'); fi.style.width=(k.value/mx*100)+'%'; fi.style.background=k.catIdx!=null?ccol(k.catIdx):'var(--node)'; bar.append(fi);
      li.append(nm, el('span','k-val',gbpS(k.value)), el('span','k-pct',pct(k.value,p.value)), bar);
      if(k.children){ li.tabIndex=0; li.setAttribute('role','button'); li.setAttribute('aria-label',`Zoom into ${k.label}, ${gbp(k.value)}`); li.addEventListener('click',()=>C.zoom(k)); li.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); C.zoom(k);} }); }
      ul.append(li); });
    host.append(ul); }
  const top=d3.rollups(DATA.entries.filter(e=>entryMatch(e,state.lock)&&sunMatch(p,e)),v=>d3.sum(v,e=>e[12]),e=>e[16]).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([a])=>DATA.arts[a]); if(top.length) host.append(el('p','m-note','Largest entries in the returns: '+top.join(', ')+'.'));
}

/* ---------- appendix table ---------- */
function renderTable(){
  // same scope as Appendix B: filters, the pin, and the Plate C zoom
  const rows=entriesNow().map(e=>({pl:e[2],po:e[3],cat:e[4],v:e[12]})), by=state.tableBy, t=document.getElementById('tv'); t.replaceChildren();
  const f=sunFocus(), scopeA=[filterNote()||null, state.lock? 'pinned: '+keyLabel(state.lock):null, f? 'Plate C: '+f.ancestors().reverse().slice(1).map(a=>a.label).join(' / '):null].filter(Boolean).join(', ');
  document.getElementById('tv-what').textContent= by==='place'? placeWord() : 'harbour';
  const names= by==='place'? PLACES.map(p=>p.name) : PORTS.map(p=>p.name);
  const g=d3.rollups(rows,v=>catSums(v),r=>by==='place'?r.pl:r.po).map(([i,s])=>({name:names[i],s,tot:d3.sum(s)})).sort((a,b)=>b.tot-a.tot);
  t.append(el('caption',null,`${DIRS[state.dir]}, ${yearLabel()}${scopeA?', '+scopeA:''}. Pounds sterling, rounded.`));
  const th=el('thead'), hr=el('tr'); hr.append(el('th',null,by==='place'?PlaceWord():'Harbour'));
  CATS.forEach((c,i)=>{ const h=el('th'), sw=el('span','sw'); sw.style.background=ccol(i); h.title=c.name; h.append(sw,document.createTextNode(c.label)); hr.append(h); }); hr.append(el('th',null,'Total')); th.append(hr); t.append(th);
  const tb=el('tbody'); g.forEach(r=>{ const tr=el('tr'); tr.append(el('td',null,r.name)); r.s.forEach(v=>tr.append(el('td',null,v?fInt(v):'–'))); tr.append(el('td',null,fInt(r.tot))); tb.append(tr); }); t.append(tb);
  const tot=catSums(rows), tf=el('tfoot'), fr=el('tr'); fr.append(el('td',null,'Total')); tot.forEach(v=>fr.append(el('td',null,v?fInt(v):'–'))); fr.append(el('td',null,fInt(d3.sum(tot)))); tf.append(fr); t.append(tf);
}
/* ---------- Appendix B: source entries, Appendix C: reconciliation ---------- */
const EV={sort:'value', shown:100};
const sunFocus=()=>state.view==='sunburst'&&C.focus&&C.focus.depth>0? C.focus : null;
function entriesNow(){ const f=sunFocus(); return DATA.entries.filter(e=>entryMatch(e,state.lock)&&(!f||sunMatch(f,e))); }
function srcCell(e){ const td=el('td','src'); if(e[14]){ const a=el('a',null,'p. '+e[14].split('/')[1]); a.href='https://www.canadiana.ca/view/'+e[14]; a.target='_blank'; a.rel='noopener'; a.title='Canadiana '+e[14].split('/')[0]; td.append(a); } else td.textContent= e[13]? 'p. '+e[13] : '–'; return td; }
function renderEntries(){
  renderTable();
  const list=entriesNow().slice(); if(EV.sort==='value') list.sort((a,b)=>b[12]-a[12]); else list.sort((a,b)=>a[0]-b[0]||a[6]-b[6]);
  const tot=d3.sum(list,e=>e[12]);
  const f=sunFocus();
  const scope=[DIRS[state.dir], yearLabel(), filterNote()||null, state.lock? 'pinned: '+keyLabel(state.lock):null, f? 'Plate C: '+f.ancestors().reverse().slice(1).map(a=>a.label).join(' / '):null].filter(Boolean).join(', ');
  document.getElementById('ev-cap').textContent=`${fInt(list.length)} entries worth ${gbp(tot)} (${scope}). Values are as transcribed; “As printed” is the £ s d column of the returns, and the workbook row locates the line in the ${DIRS[state.dir]} sheet. Pin a place, harbour or route to narrow the list.`;
  const t=document.getElementById('ev'); t.replaceChildren();
  const hr=el('tr'); ['Year','Harbour','Country, as recorded','Article, as recorded','Quantity','As printed','£ used','SITC','Source','Workbook row'].forEach((h,i)=>hr.append(el('th',(i>=1&&i<=4)||i===7||i===8?'l':null,h))); const th=el('thead'); th.append(hr); t.append(th);
  const tb=el('tbody');
  list.slice(0,EV.shown).forEach(e=>{ const tr=el('tr'); const fixed=Math.abs(e[11]-e[12])>0.01; if(fixed) tr.className='fixed';
    const used=el('td',null,d3.format(',.2f')(e[12])); if(fixed){ used.append(sup(2)); used.title=`The workbook’s value column reads ${e[11]}`; }
    tr.append(el('td',null,YEARS[e[1]]), el('td','wrap',e[9]), el('td','wrap',e[8]), el('td','wrap',e[7]), el('td','wrap',e[15]||'–'), el('td',null,e[10]||'–'), used,
      el('td','wrap',(e[5]||'–')+', '+CATS[e[4]].label), srcCell(e), el('td',null,fInt(e[6])));
    tb.append(tr); });
  t.append(tb);
  const more=document.getElementById('ev-more'); more.hidden=list.length<=EV.shown; more.textContent=`Show ${Math.min(200,list.length-EV.shown)} more of ${fInt(list.length-EV.shown)} remaining`;
  seg('f-ev',[['value','Largest first'],['row','Workbook order']],()=>EV.sort,v=>{ EV.sort=v; EV.shown=100; renderEntries(); });
  renderJump();
}
document.getElementById('ev-more').addEventListener('click',()=>{ EV.shown+=200; renderEntries(); });
document.getElementById('ev-copy').addEventListener('click',()=>{
  const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
  const lines=[['direction','year','harbour_recorded','country_recorded','article_recorded','quantity','value_as_printed','value_workbook','value_used','sitc_code','sitc_category','source','workbook_sheet','workbook_row'].join(',')];
  entriesNow().forEach(e=>lines.push([DIRS[e[0]],YEARS[e[1]],q(e[9]),q(e[8]),q(e[7]),q(e[15]),q(e[10]),e[11],e[12],q(e[5]),q(CATS[e[4]].label),q(e[14]?'https://www.canadiana.ca/view/'+e[14]:(e[13]?'p. '+e[13]:'')),DIRS[e[0]],e[6]].join(',')));
  const csv=lines.join('\n'), st=document.getElementById('ev-status'), fb=document.getElementById('ev-fallback');
  const fallback=()=>{ fb.value=csv; fb.hidden=false; fb.focus(); fb.select(); st.textContent='Copying is blocked here; the CSV is selected below for you to copy.'; };
  try{ navigator.clipboard.writeText(csv).then(()=>{ fb.hidden=true; st.textContent=`Copied ${fInt(lines.length-1)} entries.`; },fallback); }catch(err){ fallback(); }
});
function renderRecon(){
  const t=document.getElementById('rc'); t.replaceChildren();
  const hr=el('tr'); ['Year','Harbour','Printed total, as transcribed','Workbook row','Sum of entries','Difference'].forEach(h=>hr.append(el('th',null,h))); const th=el('thead'); th.append(hr); t.append(th);
  const tb=el('tbody'); let sp=0, se=0;
  DATA.recon.forEach(([y,p,pv,ev,raw,xr])=>{ sp+=pv; se+=ev; const tr=el('tr'), d=ev-pv;
    tr.append(el('td',null,y), el('td',null,p), el('td',null,raw.startsWith('£')?raw:'£'+raw), el('td',null,'Imports '+fInt(xr)), el('td',null,d3.format(',.2f')(ev)), el('td',null, Math.abs(d)<0.5? 'agrees' : (d>0?'+':'−')+'£'+d3.format(',.2f')(Math.abs(d))+' ('+(d>0?'+':'−')+Math.abs(d/pv*100).toFixed(1)+'%)'));
    tb.append(tr); });
  t.append(tb);
  const tf=el('tfoot'), fr=el('tr'); fr.append(el('td',null,'All'), el('td',null,DATA.recon.length+' port-years'), el('td',null,'£'+d3.format(',.2f')(sp)), el('td',null,''), el('td',null,d3.format(',.2f')(se)), el('td',null,(se-sp>0?'+':'−')+'£'+d3.format(',.2f')(Math.abs(se-sp))+' ('+((se-sp)/sp*100).toFixed(2)+'%)')); tf.append(fr); t.append(tf);
}
function openAppendix(id){ const d=document.getElementById(id); d.open=true; if(id==='entries-view') renderEntries(); d.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'}); d.classList.add('flash'); setTimeout(()=>d.classList.remove('flash'),1400); const s=d.querySelector('summary'); if(s) s.focus({preventScroll:true}); }
function openEntries(){ openAppendix('entries-view'); }
function renderJump(){ const nav=document.getElementById('jump'); if(!nav) return; nav.replaceChildren(document.createTextNode('Appendices:'));
  [['tableview','A','values table'],['entries-view','B',`${fInt(entriesNow().length)} source entries`],['recon-view','C','printed totals']].forEach(([id,l,txt])=>{ const b=el('button'); b.type='button'; b.append(el('b',null,l), document.createTextNode(txt)); b.addEventListener('click',()=>openAppendix(id)); nav.append(b); }); }
function renderNotes(){
  document.getElementById('n-other').textContent=CATS[OTHER].desc; document.getElementById('n-ncat').textContent=String(CATS.length);
  const im=ROWS.filter(r=>r.d===0), ex=ROWS.filter(r=>r.d===1), E=DATA.entries;
  document.getElementById('h1').textContent=`Prince Edward Island Trade Returns, ${YEARS[0]}${YEARS.length>1?'–'+YEARS[YEARS.length-1]:''}`;
  document.getElementById('dek-years').textContent=yearsList();
  document.getElementById('n-file').textContent=DATA.source&&DATA.source.file? DATA.source.file : 'workbook';
  document.getElementById('n-count').textContent=`${fInt(E.filter(e=>e[0]===0).length)} import entries worth ${gbp(sum(im))} and ${fInt(E.filter(e=>e[0]===1).length)} export entries worth ${gbp(sum(ex))}`;
  const src=document.getElementById('n-src'); src.replaceChildren();
  const docs=d3.rollups(E.filter(e=>e[14]),v=>[...new Set(v.map(e=>e[14].split('/')[0]))],e=>e[0],e=>YEARS[e[1]]);
  const linked=[]; docs.forEach(([d,ys])=>ys.sort((a,b)=>a[0]-b[0]).forEach(([y,ds])=>linked.push([d,y,ds])));
  if(linked.length){ src.append(document.createTextNode('Entries with Canadiana page links: '));
    linked.forEach(([d,y,ds],i)=>{ if(i) src.append(document.createTextNode(i===linked.length-1?' and ':', ')); src.append(document.createTextNode(`${DIRS[d].toLowerCase()} for ${y} (`)); ds.forEach((doc,j)=>{ if(j) src.append(document.createTextNode(', ')); const a=el('a',null,doc); a.href='https://www.canadiana.ca/view/'+doc; a.target='_blank'; a.rel='noopener'; src.append(a); }); src.append(document.createTextNode(')')); });
    src.append(document.createTextNode(E.every(e=>e[14])? '; every entry links to its page.' : '. The rest cite page numbers only.')); }
  else src.append(document.createTextNode('No entries carry Canadiana links; they cite page numbers only.'));
  const fx=E.filter(e=>Math.abs(e[11]-e[12])>0.01), fxEl=document.getElementById('n-fixed');
  fxEl.textContent= fx.length? (()=>{ const drop=fx.filter(e=>e[11]<1&&e[12]>=1), rest=fx.filter(e=>!(e[11]<1&&e[12]>=1)), net=d3.sum(fx,e=>e[12]-e[11]);
  const parts=[]; if(drop.length) parts.push(`${drop.length} where the formula dropped the pounds (${drop[0][7]} at ${drop[0][9]} in ${YEARS[drop[0][1]]}, printed “${drop[0][10]}”, reads ${drop[0][11]})`);
  if(rest.length) parts.push(`${rest.length} where the printed value was corrected in checking but Value (£) kept the old figure (${rest[0][7]} at ${rest[0][9]} in ${YEARS[rest[0][1]]}, printed “${rest[0][10]}”, Value (£) ${d3.format(',.2f')(rest[0][11])})`);
  return `For ${fx.length} import ${fx.length===1?'entry':'entries'} the workbook’s Value (£) column disagrees with the printed £ s d: ${parts.join('; and ')}. The printed £ s d is used for all of them, a net change of ${net<0?'−':'+'}${gbp(Math.abs(net))}.`; })() : 'Every import value agrees with its printed £ s d.';
  const R=DATA.recon, sp=d3.sum(R,r=>r[2]), se=d3.sum(R,r=>r[3]); let rt='';
  if(R.length){ const big=R.slice().sort((a,b)=>Math.abs(b[3]-b[2])-Math.abs(a[3]-a[2]))[0], has=new Set(R.map(r=>r[0]+'|'+r[1]));
    const missing=d3.rollups(DATA.entries.filter(e=>e[0]===0),v=>d3.sum(v,e=>e[12]),e=>YEARS[e[1]]+'|'+PORTS[e[3]].name).filter(([k,v])=>!has.has(k)&&v>=20000).sort((a,b)=>b[1]-a[1]);
    rt=`Checked against the returns’ own printed port totals: for the ${R.length} port-years that print an all-countries total, the entries sum to within ${Math.abs((se-sp)/sp*100).toFixed(2)}% (${gbp(se)} against ${gbp(sp)}). The largest gap is ${big[1]} in ${big[0]}, ${gbp(Math.abs(big[3]-big[2]))} ${big[3]<big[2]?'below':'above'} the printed total.`+
      (missing.length? ` ${missing.map(([k])=>k.split('|')[1]+' '+k.split('|')[0]).join(', ')} ${missing.length===1?'prints':'print'} no total to check against.` : ''); }
  document.getElementById('n-recon').textContent=rt;
  const un=d3.rollups(ROWS.filter(r=>!mappable(r.pl)),v=>d3.sum(v,r=>r.v),r=>r.pl);
  const unh=d3.rollups(ROWS.filter(r=>mappable(r.pl)&&!portOK(r.po)),v=>d3.sum(v,r=>r.v),r=>r.po);
  document.getElementById('n-unmapped').textContent=[...un.map(([i,v])=>`${gbp(v)} recorded under “${PLACES[i].name}”, which has no map position`), ...unh.map(([i,v])=>`${gbp(v)} at the harbour “${PORTS[i].name}”, which has no map position yet`)].join('; ')+(un.length||unh.length?'.':'Nothing: every entry has a mapped place and harbour.');
  const dl=document.getElementById('data-line'); dl.textContent=`Data: ${DATA.source&&DATA.source.file||'workbook'}, ${fInt(DATA.entries.length)} entries`;
  const cm=DATA.source&&DATA.source.commit;
  if(cm&&cm.url){ const a=el('a',null,`last changed ${new Date(cm.date).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})} (commit ${cm.sha.slice(0,7)})`); a.href=cm.url; a.target='_blank'; a.rel='noopener'; dl.append(document.createTextNode(', '), a, document.createTextNode('.')); }
  else dl.append(document.createTextNode('.'));
}
/* ---------- goods search: combobox with grouped suggestions ---------- */
const qIn=document.getElementById('q'), qList=document.getElementById('q-list');
let qOpts=[], qAct=-1;
function setGoods(g){ state.search=g; state.hover=null; state.lock=null; qIn.value=g? g.label : ''; closeQ(); renderAll(); }
function closeQ(){ qList.hidden=true; qIn.setAttribute('aria-expanded','false'); qIn.removeAttribute('aria-activedescendant'); qAct=-1; }
function markName(host,name,q){ const i=q? name.toLowerCase().indexOf(q) : -1; if(i<0){ host.append(document.createTextNode(name)); return; }
  host.append(document.createTextNode(name.slice(0,i)), el('mark',null,name.slice(i,i+q.length)), document.createTextNode(name.slice(i+q.length))); }
function suggest(){
  const q=qIn.value.trim().toLowerCase(), B=ROWS.filter(r=>r.d===state.dir);
  const byArt=d3.rollup(B,v=>[d3.sum(v,r=>r.v),v.length,v[0].cat],r=>r.art), byDk=d3.rollup(B,v=>[d3.sum(v,r=>r.v),v.length,v[0].cat],r=>r.dk), byCat=d3.rollup(B,v=>[d3.sum(v,r=>r.v),v.length],r=>r.cat);
  const hit=n=>!q||n.toLowerCase().includes(q), rank=(a,b)=>((b.name.toLowerCase().startsWith(q))-(a.name.toLowerCase().startsWith(q)))||b.v-a.v;
  const cats=CATS.map((c,i)=>({kind:'cat',i,name:c.label,full:c.name,v:(byCat.get(i)||[0])[0],n:(byCat.get(i)||[0,0])[1],cat:i})).filter(o=>o.n&&(hit(o.name)||hit(o.full))).sort(rank);
  const divs=[...byDk].map(([k,[v,n,c]])=>({kind:'div',key:k,name:divName(k),full:divInfo(k).name,v,n,cat:c})).filter(o=>hit(o.name)||hit(o.full)).sort(rank).slice(0,q?6:0);
  const arts=[...byArt].map(([a,[v,n,c]])=>({kind:'art',ids:new Set([a]),name:DATA.arts[a],v,n,cat:c})).filter(o=>q&&hit(o.name)).sort(rank);
  qOpts=[]; const groups=[];
  if(q&&arts.length>1){ const ids=new Set(arts.flatMap(o=>[...o.ids])); groups.push(['Search',[{kind:'text',ids,name:`All goods matching “${qIn.value.trim()}”`,label:`“${qIn.value.trim()}”`,phrase:`goods matching “${qIn.value.trim()}”`,v:d3.sum(arts,o=>o.v),n:d3.sum(arts,o=>o.n),cat:null,count:arts.length}]]); }
  if(cats.length) groups.push(['SITC categories',cats]); if(divs.length) groups.push(['SITC divisions',divs]); if(arts.length) groups.push([`Articles as recorded${arts.length>8?' (top 8 of '+arts.length+')':''}`,arts.slice(0,8)]);
  qList.replaceChildren();
  if(!groups.length){ qList.append(el('li','none',`No goods in the ${dirL()} match “${qIn.value.trim()}”.`)); }
  groups.forEach(([gname,opts])=>{ const gl=el('li','grp',gname); gl.setAttribute('role','presentation'); qList.append(gl);
    opts.forEach(o=>{ const li=el('li'); li.setAttribute('role','option'); li.id='q-opt-'+qOpts.length; li.setAttribute('aria-selected','false');
      const nm=el('span','o-name'); if(o.cat!=null){ const sw=el('span','sw'); sw.style.background=ccol(o.cat); sw.style.width='9px'; sw.style.height='9px'; nm.append(sw); }
      const tx=el('span'); if(o.kind==='text') tx.append(document.createTextNode(o.name)); else markName(tx,o.name,q); nm.append(tx);
      li.append(nm, el('span','m',`${gbpS(o.v)}, ${fInt(o.n)} ${o.n===1?'entry':'entries'}${o.count?' in '+o.count+' articles':''}`));
      const idx=qOpts.length; li.addEventListener('mousedown',e=>e.preventDefault()); li.addEventListener('click',()=>pick(idx)); qOpts.push(o); qList.append(li); }); });
  qList.hidden=false; qIn.setAttribute('aria-expanded','true'); qAct=-1;
}
function activate(i){ const lis=qList.querySelectorAll('[role=option]'); if(!lis.length) return; qAct=(i+lis.length)%lis.length;
  lis.forEach((li,j)=>li.setAttribute('aria-selected',String(j===qAct))); qIn.setAttribute('aria-activedescendant',lis[qAct].id); lis[qAct].scrollIntoView({block:'nearest'}); }
function pick(i){ const o=qOpts[i]; if(!o) return;
  if(o.kind==='cat'){ state.search=null; state.cat=o.i; qIn.value=''; closeQ(); state.lock=null; renderAll(); return; }
  if(o.kind==='div') setGoods({kind:'div',key:o.key,label:o.name,phrase:o.name.toLowerCase()});
  else if(o.kind==='art') setGoods({kind:'art',ids:o.ids,label:o.name,phrase:o.name.toLowerCase()});
  else setGoods({kind:'text',ids:o.ids,label:o.label,phrase:o.phrase}); }
qIn.addEventListener('input',suggest); qIn.addEventListener('focus',suggest);
qIn.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){ e.preventDefault(); if(qList.hidden) suggest(); activate(qAct+1); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); activate(qAct-1); }
  else if(e.key==='Enter'){ e.preventDefault(); if(qAct>=0) pick(qAct); else if(qOpts.length&&qIn.value.trim()) pick(0); }
  else if(e.key==='Escape'){ if(!qList.hidden){ e.stopPropagation(); closeQ(); } else if(state.search){ setGoods(null); } }
});
qIn.addEventListener('search',()=>{ if(!qIn.value&&state.search) setGoods(null); });
qIn.addEventListener('blur',()=>setTimeout(closeQ,120));

/* ---------- view switching ---------- */
const VIEWS=['flow-map','compass','sunburst'];
function updateView(){ if(state.view==='flow-map') updateA(); else if(state.view==='compass') updateB(); else renderSunburst(); }
function setView(v,push){ if(!VIEWS.includes(v)) v='flow-map'; state.view=v; state.hover=null; VIEWS.forEach(x=>{ document.getElementById('view-'+x).hidden=x!==v; });
  if(push){ try{ history.replaceState(null,'','#'+v); }catch(e){} } renderAll(); }
document.querySelectorAll('.contents button').forEach(t=>t.addEventListener('click',()=>setView(t.dataset.view,true)));
document.querySelector('.contents').addEventListener('keydown',e=>{ if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft') return; const i=VIEWS.indexOf(state.view), n=VIEWS[(i+(e.key==='ArrowRight'?1:2))%3]; setView(n,true); document.getElementById('tab-'+n).focus(); });
window.addEventListener('hashchange',()=>{ const h=location.hash.slice(1); if(VIEWS.includes(h)&&h!==state.view) setView(h,false); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&state.lock){ state.lock=null; renderPinned(); updateView(); renderEntries(); } });
function renderView(){ if(state.view==='flow-map') renderA(); else if(state.view==='compass') renderB(); else renderSunburst(); }
function renderAll(){ hideTip(); renderControls(); renderView(); renderTable(); EV.shown=100; renderEntries(); }
let rw=0, rt=null;
new ResizeObserver(()=>{ const w=document.querySelector('.atlas').clientWidth; if(Math.abs(w-rw)<8) return; rw=w; clearTimeout(rt); rt=setTimeout(renderView,120); }).observe(document.querySelector('.atlas'));
renderNotes(); renderRecon();
const h0=location.hash.slice(1); setView(VIEWS.includes(h0)?h0:'flow-map',false);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>renderView());
}

/* ---------- start-up: fetch the data and the map geometry, then draw ---------- */
(function boot(){
  const msg=document.getElementById('loading');
  const get=f=>fetch(f,{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(`${f} returned ${r.status}`); return r.json(); });
  Promise.all([get('data.json'),get('geo.json')])
    .then(([data,geo])=>{ msg.remove(); startAtlas(data,geo); })
    .catch(err=>{ msg.textContent=`The atlas could not load its data (${err.message}). data.json and geo.json must sit next to this page.`; });
})();
