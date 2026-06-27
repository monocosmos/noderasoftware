/* =====================================================================
   NODERA HOTELOPS — Reklam animasyon motoru (paylaşımlı)
   window.NODERA_CFG = { canvasId, W, H, portrait, chrome, autoplay, loop }
   ===================================================================== */
(function(){
const CFG = window.NODERA_CFG || {};
const cv = document.getElementById(CFG.canvasId || 'c');
const ctx = cv.getContext('2d', { alpha:false });
const W = CFG.W || 1920, H = CFG.H || 1080;
const P = !!CFG.portrait;
const FPS = 30, DUR = 60;
cv.width = W; cv.height = H;
const CX = W/2;

// ---------- palette ----------
const COL = {
  bg:'#070D18', bg2:'#0A1322', panel:'#101D33', panel2:'#162947', panelHi:'#1E365C',
  line:'rgba(255,255,255,0.085)', lineHi:'rgba(63,233,180,0.32)',
  text:'#EAF1FB', mut:'#90A2C0', mut2:'#5A6D8C',
  g:'#2FE6B0', t:'#27C7C4', b:'#3E78D8',
  red:'#F0786B', blue:'#5CA8F0', gold:'#E8B45C', green:'#46D6A0', purple:'#A98BE6'
};

// ---------- math ----------
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const eOut=t=>1-Math.pow(1-clamp(t,0,1),3);
const eIn=t=>{t=clamp(t,0,1);return t*t*t;};
const eInOut=t=>{t=clamp(t,0,1);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
const eBack=t=>{t=clamp(t,0,1);const c=1.70158,c3=c+1;return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
const rv=(lt,s,d=0.6,e=eOut)=>e(clamp((lt-s)/d,0,1));

// ---------- canvas helpers ----------
function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function accentGrad(x0,y0,x1,y1){const g=ctx.createLinearGradient(x0,y0,x1,y1);
  g.addColorStop(0,COL.g);g.addColorStop(.55,COL.t);g.addColorStop(1,COL.b);return g;}
function T(str,x,y,o){o=o||{};ctx.save();
  ctx.font=`${o.w||500} ${o.s||24}px ${o.f||'Inter'}, sans-serif`;
  ctx.textAlign=o.align||'left';ctx.textBaseline=o.base||'alphabetic';
  if(o.ls!=null)ctx.letterSpacing=o.ls+'px';
  ctx.fillStyle=o.c||COL.text;
  if(o.shadow){ctx.shadowColor=o.shadow;ctx.shadowBlur=o.shadowBlur||18;}
  ctx.fillText(str,x,y);ctx.restore();}
function measure(str,wt,sz,f){ctx.save();ctx.font=`${wt} ${sz}px ${f||'Inter'}, sans-serif`;
  const m=ctx.measureText(str).width;ctx.restore();return m;}
function dot(x,y,r,c){ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fillStyle=c;ctx.fill();}
// centered multi-color line: segs=[{t,c}]
function richLine(segs,cx,y,sz,wt,f,ls){
  let tot=0;segs.forEach(s=>tot+=measure(s.t,wt,sz,f));
  let x=cx-tot/2;
  segs.forEach(s=>{T(s.t,x,y,{s:sz,w:wt,f:f,c:s.c,base:'middle',ls:ls!=null?ls:-0.5});x+=measure(s.t,wt,sz,f);});
}
function wrapRich(words,maxW,sz,wt,f){ // words=[{t,c}]; wraps on spaces between words
  const lines=[[]];let lw=0;
  words.forEach(wd=>{const ww=measure(wd.t+' ',wt,sz,f);
    if(lw+ww>maxW&&lines[lines.length-1].length){lines.push([]);lw=0;}
    lines[lines.length-1].push(wd);lw+=ww;});
  return lines;
}
const STAT={'Açık':{c:COL.red},'Atandı':{c:COL.blue},'Devam':{c:COL.gold},'Tamam':{c:COL.green},'Bekliyor':{c:COL.purple}};
function pill(x,y,label,sz){sz=sz||15;const c=(STAT[label]||STAT['Açık']).c;ctx.save();
  ctx.font=`600 ${sz}px Inter, sans-serif`;const tw=ctx.measureText(label).width;
  const pad=sz*0.8,dotR=sz*0.27,gap=sz*0.45,w=pad*2+dotR*2+gap+tw,h=sz*1.85;
  rr(x,y,w,h,h/2);ctx.fillStyle=c+'26';ctx.fill();
  dot(x+pad+dotR,y+h/2,dotR,c);ctx.fillStyle=c;ctx.textBaseline='middle';
  ctx.fillText(label,x+pad+dotR*2+gap,y+h/2+1);ctx.restore();return w;}

// ---------- assets ----------
let MARK=null;
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}

// ---------- background ----------
function drawBG(t){
  ctx.fillStyle=COL.bg;ctx.fillRect(0,0,W,H);
  const gx=W*(0.5+Math.sin(t*0.16)*0.16),gy=H*(0.42+Math.cos(t*0.13)*0.14);
  let g=ctx.createRadialGradient(gx,gy,0,gx,gy,Math.max(W,H)*0.55);
  g.addColorStop(0,'rgba(47,230,176,0.10)');g.addColorStop(1,'rgba(47,230,176,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const bx=W*(0.5-Math.sin(t*0.16)*0.18),by=H*(0.62+Math.sin(t*0.11)*0.13);
  g=ctx.createRadialGradient(bx,by,0,bx,by,Math.max(W,H)*0.5);
  g.addColorStop(0,'rgba(62,120,216,0.10)');g.addColorStop(1,'rgba(62,120,216,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalAlpha=0.045;ctx.strokeStyle='#9fb6df';ctx.lineWidth=1;
  const step=72;
  for(let x=((-t*8)%step+step)%step;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.restore();
}
function vignette(){const g=ctx.createRadialGradient(CX,H*0.46,Math.min(W,H)*0.3,CX,H*0.5,Math.max(W,H)*0.62);
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.5)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}

function wordmark(cx,cy,sz){ctx.save();ctx.font=`700 ${sz}px Sora, sans-serif`;ctx.textBaseline='middle';
  const n='Nodera ',h='HotelOps';const wn=ctx.measureText(n).width,wh=ctx.measureText(h).width;
  let x=cx-(wn+wh)/2;ctx.textAlign='left';ctx.fillStyle=COL.text;ctx.fillText(n,x,cy);
  ctx.fillStyle=accentGrad(x+wn,cy,x+wn+wh,cy);ctx.fillText(h,x+wn,cy);ctx.restore();}

// =====================================================================
//  S1 — INTRO
// =====================================================================
function sIntro(lt,dur){
  const m=rv(lt,0.1,0.9,eBack),mf=rv(lt,0.1,0.6);
  const base=P?H*0.42:H*0.40;
  const sz=(P?210:200)*(0.55+0.45*m);
  ctx.save();ctx.globalAlpha=mf*0.9;
  for(let i=0;i<7;i++){const a=lt*0.5+i*(Math.PI*2/7);const rad=sz*0.95+Math.sin(lt*1.2+i)*10;
    dot(CX+Math.cos(a)*rad,base+Math.sin(a)*rad*0.62,3.5,i%2?COL.b:COL.g);}
  ctx.restore();
  if(MARK){ctx.save();ctx.globalAlpha=mf;ctx.shadowColor='rgba(47,230,176,0.45)';ctx.shadowBlur=sz*0.4;
    ctx.drawImage(MARK,CX-sz/2,base-sz/2,sz,sz);ctx.restore();}
  const wm=rv(lt,0.9,0.8,eOut);
  if(wm>0){ctx.save();const yb=base+sz/2+(P?96:86);const fs=P?70:80;
    const fw=measure('Nodera HotelOps',700,fs,'Sora');
    ctx.beginPath();ctx.rect(CX-fw/2-10,yb-70,fw*wm+20,140);ctx.clip();wordmark(CX,yb,fs);ctx.restore();}
  const ul=rv(lt,1.3,0.8);
  if(ul>0){const yb=base+sz/2+(P?160:138),uw=(P?340:300)*ul;
    const g=ctx.createLinearGradient(CX-uw/2,0,CX+uw/2,0);
    g.addColorStop(0,'rgba(47,230,176,0)');g.addColorStop(.5,COL.t);g.addColorStop(1,'rgba(62,120,216,0)');
    ctx.fillStyle=g;ctx.fillRect(CX-uw/2,yb,uw,2);}
  const tg=rv(lt,1.7,0.8);
  if(tg>0){ctx.save();ctx.globalAlpha=tg;
    T('Otel operasyonları, tek merkezde.',CX,base+sz/2+(P?212:186),{s:P?34:30,w:500,c:COL.mut,align:'center',base:'middle',ls:.3});ctx.restore();}
}

// =====================================================================
//  S2 — HOOK
// =====================================================================
const TASKS_L=[
  {t:'Oda 412 · Klima arızası',d:'TEKNİK SERVİS',c:COL.red,x:300,y:430,sp:.5,ph:0,urg:true},
  {t:'Kat 3 · Oda temizliği',d:'HOUSEKEEPING',c:COL.blue,x:1320,y:360,sp:.42,ph:1.6},
  {t:'Erken check-in talebi',d:'ÖN BÜRO',c:COL.gold,x:760,y:760,sp:.55,ph:.7},
  {t:'Masaj rezervasyonu',d:'SPA & WELLNESS',c:COL.purple,x:1360,y:720,sp:.47,ph:2.3},
  {t:'Asansör · Periyodik bakım',d:'TEKNİK SERVİS',c:COL.red,x:300,y:740,sp:.46,ph:3,urg:true},
  {t:'Restoran · Stok uyarısı',d:'F&B',c:COL.green,x:1020,y:430,sp:.5,ph:1},
  {t:'Lobi · Güvenlik turu',d:'GÜVENLİK',c:COL.blue,x:560,y:560,sp:.44,ph:2.6},
];
const TASKS_P=[
  {t:'Oda 412 · Klima arızası',d:'TEKNİK SERVİS',c:COL.red,x:90,y:600,sp:.5,ph:0,urg:true},
  {t:'Kat 3 · Oda temizliği',d:'HOUSEKEEPING',c:COL.blue,x:520,y:760,sp:.42,ph:1.6},
  {t:'Erken check-in',d:'ÖN BÜRO',c:COL.gold,x:140,y:920,sp:.55,ph:.7},
  {t:'Masaj rezervasyonu',d:'SPA',c:COL.purple,x:560,y:1080,sp:.47,ph:2.3},
  {t:'Asansör · Bakım',d:'TEKNİK SERVİS',c:COL.red,x:120,y:1240,sp:.46,ph:3,urg:true},
  {t:'Restoran · Stok',d:'F&B',c:COL.green,x:560,y:1380,sp:.5,ph:1},
  {t:'Lobi · Güvenlik turu',d:'GÜVENLİK',c:COL.blue,x:150,y:1520,sp:.44,ph:2.6},
];
function chip(tk,i,lt){
  const ap=rv(lt,0.3+i*0.13,0.5,eBack);if(ap<=0)return;
  const dx=Math.sin(lt*tk.sp+tk.ph)*15,dy=Math.cos(lt*tk.sp*0.9+tk.ph)*12;
  const x=tk.x+dx,y=tk.y+dy-(1-ap)*24;
  ctx.save();ctx.globalAlpha*=clamp(ap,0,1);
  const fs=P?20:19;ctx.font=`600 ${fs}px Inter`;const tw=ctx.measureText(tk.t).width;
  const w=Math.max(P?300:266,tw+(tk.urg?150:64)),h=P?72:66;
  ctx.shadowColor='rgba(0,0,0,0.4)';ctx.shadowBlur=30;ctx.shadowOffsetY=12;
  rr(x,y,w,h,15);ctx.fillStyle='rgba(16,29,51,0.88)';ctx.fill();ctx.shadowColor='transparent';
  const pulse=tk.urg?(0.4+0.6*(0.5+0.5*Math.sin(lt*5+tk.ph))):1;
  rr(x,y,w,h,15);ctx.lineWidth=1.5;ctx.strokeStyle=tk.urg?`rgba(240,120,107,${0.3+0.5*pulse})`:COL.line;ctx.stroke();
  dot(x+24,y+h/2,10,tk.c);
  T(tk.t,x+44,y+h/2-8,{s:fs,w:600,c:COL.text});
  T(tk.d,x+44,y+h/2+13,{s:12,w:600,c:COL.mut2,ls:1});
  if(tk.urg){ctx.save();ctx.globalAlpha=pulse;const bw=58;
    rr(x+w-bw-14,y+h/2-13,bw,26,7);ctx.fillStyle='rgba(240,120,107,0.16)';ctx.fill();
    T('ACİL',x+w-bw-14+bw/2,y+h/2+1,{s:13,w:700,c:COL.red,align:'center',base:'middle',ls:.5});ctx.restore();}
  ctx.restore();
}
function sHook(lt,dur){
  const h1=rv(lt,0.2,0.7);(P?TASKS_P:TASKS_L).forEach((tk,i)=>chip(tk,i,lt));
  ctx.save();ctx.globalAlpha=h1;
  if(P){
    T('Bir otel',CX,300,{s:96,w:800,f:'Sora',c:COL.text,align:'center',base:'middle',ls:-2});
    T('hiç durmaz.',CX,400,{s:96,w:800,f:'Sora',c:COL.text,align:'center',base:'middle',ls:-2});
  }else{
    T('Bir otel hiç durmaz.',CX,210,{s:88,w:800,f:'Sora',c:COL.text,align:'center',base:'middle',ls:-1});
  }
  ctx.restore();
  const h2=rv(lt,2.6,0.8);ctx.save();ctx.globalAlpha=h2;
  if(P){
    T('Onlarca departman.',CX,H-260,{s:34,w:500,c:COL.mut,align:'center',base:'middle'});
    T('Yüzlerce iş emri.',CX,H-210,{s:34,w:500,c:COL.mut,align:'center',base:'middle'});
    T('Tek bir günde.',CX,H-160,{s:34,w:600,c:COL.text,align:'center',base:'middle'});
  }else{
    T('Onlarca departman. Yüzlerce iş emri. Tek bir günde.',CX,H-150,{s:32,w:500,c:COL.mut,align:'center',base:'middle',ls:.2});
  }
  ctx.restore();
}

// =====================================================================
//  S3 — MODÜLLER
// =====================================================================
const MODS=[
  {n:'Ön Büro',c:COL.gold,ic:'desk'},{n:'Housekeeping',c:COL.blue,ic:'bed'},
  {n:'Teknik Servis',c:COL.red,ic:'wrench'},{n:'F&B',c:COL.green,ic:'fork'},
  {n:'SPA & Wellness',c:COL.purple,ic:'drop'},{n:'Güvenlik',c:COL.blue,ic:'shield'},
  {n:'Stok & Satınalma',c:COL.g,ic:'box'},{n:'Raporlama',c:COL.t,ic:'chart'},
  {n:'Personel',c:COL.gold,ic:'user'},
];
function modIcon(ic,x,y,s,c){
  ctx.save();ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=s*0.08;ctx.lineJoin='round';ctx.lineCap='round';
  const cx=x+s/2,cy=y+s/2,u=s*0.5;
  if(ic==='desk'){rr(cx-u*0.9,cy-u*0.2,u*1.8,u*0.55,3);ctx.stroke();ctx.beginPath();ctx.moveTo(cx-u*0.7,cy+u*0.35);ctx.lineTo(cx-u*0.7,cy+u*0.8);ctx.moveTo(cx+u*0.7,cy+u*0.35);ctx.lineTo(cx+u*0.7,cy+u*0.8);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy-u*0.55,u*0.3,0,7);ctx.stroke();}
  else if(ic==='bed'){ctx.beginPath();ctx.moveTo(cx-u*0.95,cy-u*0.1);ctx.lineTo(cx-u*0.95,cy+u*0.7);ctx.moveTo(cx+u*0.95,cy+u*0.2);ctx.lineTo(cx+u*0.95,cy+u*0.7);ctx.moveTo(cx-u*0.95,cy+u*0.2);ctx.lineTo(cx+u*0.95,cy+u*0.2);ctx.stroke();rr(cx-u*0.7,cy-u*0.25,u*0.6,u*0.45,4);ctx.stroke();}
  else if(ic==='wrench'){ctx.beginPath();ctx.arc(cx-u*0.4,cy-u*0.4,u*0.35,0.6,5.2);ctx.lineTo(cx+u*0.5,cy+u*0.5);ctx.lineTo(cx+u*0.75,cy+u*0.25);ctx.stroke();}
  else if(ic==='fork'){ctx.beginPath();ctx.moveTo(cx-u*0.4,cy-u*0.8);ctx.lineTo(cx-u*0.4,cy+u*0.8);ctx.moveTo(cx-u*0.7,cy-u*0.8);ctx.lineTo(cx-u*0.7,cy-u*0.2);ctx.lineTo(cx-u*0.1,cy-u*0.2);ctx.lineTo(cx-u*0.1,cy-u*0.8);ctx.moveTo(cx+u*0.5,cy-u*0.8);ctx.lineTo(cx+u*0.5,cy+u*0.8);ctx.moveTo(cx+u*0.5,cy-u*0.8);ctx.arc(cx+u*0.5,cy-u*0.45,u*0.35,-1.57,1.57);ctx.stroke();}
  else if(ic==='drop'){ctx.beginPath();ctx.moveTo(cx,cy-u*0.85);ctx.bezierCurveTo(cx+u*0.8,cy,cx+u*0.55,cy+u*0.8,cx,cy+u*0.8);ctx.bezierCurveTo(cx-u*0.55,cy+u*0.8,cx-u*0.8,cy,cx,cy-u*0.85);ctx.stroke();}
  else if(ic==='shield'){ctx.beginPath();ctx.moveTo(cx,cy-u*0.85);ctx.lineTo(cx+u*0.75,cy-u*0.5);ctx.lineTo(cx+u*0.75,cy+u*0.1);ctx.bezierCurveTo(cx+u*0.75,cy+u*0.7,cx,cy+u*0.9,cx,cy+u*0.9);ctx.bezierCurveTo(cx,cy+u*0.9,cx-u*0.75,cy+u*0.7,cx-u*0.75,cy+u*0.1);ctx.lineTo(cx-u*0.75,cy-u*0.5);ctx.closePath();ctx.stroke();}
  else if(ic==='box'){rr(cx-u*0.8,cy-u*0.6,u*1.6,u*1.3,4);ctx.stroke();ctx.beginPath();ctx.moveTo(cx-u*0.8,cy-u*0.05);ctx.lineTo(cx+u*0.8,cy-u*0.05);ctx.moveTo(cx,cy-u*0.6);ctx.lineTo(cx,cy-u*0.05);ctx.stroke();}
  else if(ic==='chart'){ctx.beginPath();ctx.moveTo(cx-u*0.8,cy+u*0.7);ctx.lineTo(cx-u*0.8,cy-u*0.7);ctx.lineTo(cx+u*0.8,cy-u*0.7);ctx.stroke();ctx.lineWidth=s*0.13;ctx.beginPath();ctx.moveTo(cx-u*0.4,cy+u*0.5);ctx.lineTo(cx-u*0.4,cy+u*0.0);ctx.moveTo(cx,cy+u*0.5);ctx.lineTo(cx,cy-u*0.3);ctx.moveTo(cx+u*0.4,cy+u*0.5);ctx.lineTo(cx+u*0.4,cy+u*0.2);ctx.stroke();}
  else if(ic==='user'){ctx.beginPath();ctx.arc(cx,cy-u*0.35,u*0.4,0,7);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy+u*0.95,u*0.75,3.4,6.0);ctx.stroke();}
  ctx.restore();
}
function sMods(lt,dur){
  const h1=rv(lt,0.1,0.6);ctx.save();ctx.globalAlpha=h1;
  if(P){richLine([{t:'Tek platform,',c:COL.text}],CX,170,56,800,'Sora');richLine([{t:'tüm ',c:COL.text},{t:'operasyon.',c:COL.g}],CX,238,56,800,'Sora');}
  else{richLine([{t:'Tek platform, tüm ',c:COL.text},{t:'operasyon.',c:COL.g}],CX,150,58,800,'Sora');}
  ctx.restore();
  // grid
  const cols=P?2:3, rows=Math.ceil(MODS.length/cols);
  const gw=P?(W-160):1180, cw=(gw-(cols-1)*24)/cols, ch=P?168:150, gap=24;
  const gx=CX-gw/2, gy=P?340:300;
  MODS.forEach((m,i)=>{
    const r=Math.floor(i/cols),c=i%cols;
    const ap=rv(lt,0.5+i*0.13,0.5,eBack);if(ap<=0)return;
    const lit=lt>0.5+i*0.13+0.4;
    const x=gx+c*(cw+gap),y=gy+r*(ch+gap);
    ctx.save();ctx.globalAlpha*=clamp(ap,0,1);
    const sc=0.85+0.15*clamp(ap,0,1);
    ctx.translate(x+cw/2,y+ch/2);ctx.scale(sc,sc);ctx.translate(-(x+cw/2),-(y+ch/2));
    rr(x,y,cw,ch,18);ctx.fillStyle=COL.panel;ctx.fill();
    rr(x,y,cw,ch,18);ctx.lineWidth=lit?2:1;ctx.strokeStyle=lit?m.c+'88':COL.line;ctx.stroke();
    if(lit){ctx.save();ctx.shadowColor=m.c+'55';ctx.shadowBlur=24;rr(x,y,cw,ch,18);ctx.strokeStyle=m.c+'44';ctx.stroke();ctx.restore();}
    const isz=ch*0.42;
    rr(x+24,y+ch/2-isz/2,isz,isz,12);ctx.fillStyle=m.c+'1f';ctx.fill();
    modIcon(m.ic,x+24,y+ch/2-isz/2,isz,m.c);
    T(m.n,x+24+isz+18,y+ch/2-6,{s:P?22:23,w:600,c:COL.text});
    T('Aktif',x+24+isz+18,y+ch/2+22,{s:14,w:500,c:lit?m.c:COL.mut2});
    ctx.restore();
  });
}

// =====================================================================
//  WIDE DASHBOARD (landscape)
// =====================================================================
const NAV=[['Operasyon Paneli',0],['İş Emirleri',38],['Takvim',0],['Talepler',9],['Raporlar',0],['Personel',0]];
const KPIS=[
  {l:'Açık iş emirleri',v:38,suf:'',d:'+6 bugün',c:COL.g,bars:[5,7,4,8,6,9,7]},
  {l:'Bugün tamamlanan',v:124,suf:'',d:'%92 SLA',c:COL.green,bars:[4,6,8,7,9,8,10]},
  {l:'Bekleyen talepler',v:9,suf:'',d:'3 acil',c:COL.red,bars:[3,4,2,5,4,3,4]},
  {l:'Ort. çözüm',v:2.4,suf:' s',d:'-18 dk',c:COL.blue,bars:[9,8,7,6,5,5,4],dec:1},
];
const ROWS=[
  {code:'İE-2087',t:'Klima soğutmuyor',room:'Oda 412',dept:'Teknik Servis',s:'Devam',pr:COL.red},
  {code:'İE-2086',t:'Havlu & amenities ikmali',room:'Oda 318',dept:'Housekeeping',s:'Atandı',pr:COL.blue},
  {code:'İE-2085',t:'Minibar yenileme',room:'Oda 205',dept:'F&B',s:'Açık',pr:COL.gold},
  {code:'İE-2084',t:'Banyo armatür sızıntısı',room:'Oda 511',dept:'Teknik Servis',s:'Tamam',pr:COL.green},
  {code:'İE-2083',t:'Lobi kamera kontrolü',room:'Lobi',dept:'Güvenlik',s:'Bekliyor',pr:COL.purple},
];
const FEED=[
  {tm:'09:42',tx:'A. Demir İE-2087 işini devraldı',c:COL.g},
  {tm:'09:39',tx:'Ön Büro yeni talep açtı · Oda 207',c:COL.blue},
  {tm:'09:31',tx:'İE-2084 tamamlandı · onaylandı',c:COL.green},
  {tm:'09:24',tx:'Housekeeping Kat 3 turunu bitirdi',c:COL.green},
  {tm:'09:18',tx:'SPA rezervasyon talebi alındı',c:COL.purple},
];
function dashboard(o){o=o||{};const DW=1560,DH=880,t=o.t||0;
  rr(0,0,DW,DH,22);ctx.fillStyle=COL.bg2;ctx.fill();rr(0,0,DW,DH,22);ctx.lineWidth=1;ctx.strokeStyle=COL.line;ctx.stroke();
  ctx.save();rr(0,0,DW,DH,22);ctx.clip();
  const TB=64;ctx.fillStyle='rgba(255,255,255,0.015)';ctx.fillRect(0,0,DW,TB);
  ctx.strokeStyle=COL.line;ctx.beginPath();ctx.moveTo(0,TB);ctx.lineTo(DW,TB);ctx.stroke();
  if(MARK){ctx.drawImage(MARK,22,TB/2-15,30,30);}
  ctx.font='700 18px Sora';ctx.textBaseline='middle';ctx.fillStyle=COL.text;ctx.fillText('Nodera ',60,TB/2);
  const wn=ctx.measureText('Nodera ').width;ctx.fillStyle=COL.g;ctx.fillText('HotelOps',60+wn,TB/2);
  rr(330,TB/2-19,360,38,9);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.stroke();
  ctx.beginPath();ctx.arc(352,TB/2,6,0,7);ctx.strokeStyle=COL.mut2;ctx.lineWidth=2;ctx.stroke();
  T('İş emri, oda veya personel ara…',372,TB/2+1,{s:14,c:COL.mut2,base:'middle'});
  const blink=0.5+0.5*Math.sin(t*3);dot(DW-250,TB/2,5,COL.green);ctx.save();ctx.globalAlpha=blink;dot(DW-250,TB/2,5,COL.green);ctx.restore();
  T('Canlı',DW-238,TB/2+1,{s:14,w:600,c:COL.green,base:'middle'});
  rr(DW-150,TB/2-19,38,38,9);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.stroke();dot(DW-150+27,TB/2-9,5,COL.red);
  const ax=DW-60;ctx.save();ctx.beginPath();ctx.arc(ax,TB/2,19,0,7);ctx.fillStyle=accentGrad(ax-19,TB/2-19,ax+19,TB/2+19);ctx.fill();ctx.restore();
  T('GM',ax,TB/2+1,{s:14,w:700,f:'Sora',c:'#08111f',align:'center',base:'middle'});
  const SB=232;ctx.strokeStyle=COL.line;ctx.beginPath();ctx.moveTo(SB,TB);ctx.lineTo(SB,DH);ctx.stroke();
  T('OPERASYON',18,TB+34,{s:12,w:600,c:COL.mut2,ls:1.4});
  let ny=TB+54;NAV.forEach((it,i)=>{const act=i===(o.nav||0);
    if(act){rr(12,ny,SB-24,42,10);ctx.fillStyle='rgba(47,230,176,0.10)';ctx.fill();ctx.fillStyle=COL.g;ctx.fillRect(12,ny+6,3,30);}
    dot(34,ny+21,4.5,act?COL.g:COL.mut2);T(it[0],50,ny+21+1,{s:15,w:act?600:500,c:act?COL.text:COL.mut,base:'middle'});
    if(it[1]){ctx.font='700 12px Inter';const bw=Math.max(22,ctx.measureText(''+it[1]).width+14);
      rr(SB-12-bw,ny+12,bw,18,9);ctx.fillStyle=act?COL.g:COL.mut2;ctx.fill();
      T(''+it[1],SB-12-bw/2,ny+21+1,{s:12,w:700,c:'#0a1322',align:'center',base:'middle'});}ny+=48;});
  rr(14,DH-86,SB-28,68,12);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.stroke();
  T('AKTİF ROL',28,DH-58,{s:11,w:600,c:COL.mut2,ls:1});T(o.role||'Genel Müdür',28,DH-34,{s:16,w:600,c:COL.g});
  const MX=SB+30,MW=DW-MX-30;
  T('Operasyon Paneli',MX,TB+50,{s:30,w:700,f:'Sora',c:COL.text,ls:-.5});
  T('18 Haziran 2026 · Tüm departmanlar',MX,TB+78,{s:15,w:500,c:COL.mut});
  const bw2=178;rr(MX+MW-bw2,TB+30,bw2,42,10);ctx.fillStyle=COL.g;ctx.fill();
  T('+  Yeni iş emri',MX+MW-bw2+bw2/2,TB+30+22,{s:15,w:600,c:'#0a1322',align:'center',base:'middle'});
  const ky=TB+108,kh=118,kgap=16,kw=(MW-kgap*3)/4;
  KPIS.forEach((k,i)=>{const kx=MX+i*(kw+kgap),glow=o.kpiGlow===i;
    rr(kx,ky,kw,kh,16);ctx.fillStyle=COL.panel;ctx.fill();rr(kx,ky,kw,kh,16);ctx.lineWidth=glow?2:1;ctx.strokeStyle=glow?COL.lineHi:COL.line;ctx.stroke();
    T(k.l,kx+20,ky+30,{s:15,w:500,c:COL.mut});const cu=o.count!=null?o.count:1;let val=k.v*clamp(cu,0,1);
    let vs=k.dec?val.toFixed(1):Math.round(val).toString();T(vs+k.suf,kx+20,ky+78,{s:40,w:700,f:'Sora',c:COL.text,ls:-1});
    const bx=kx+kw-20,by=ky+78,bn=k.bars.length;k.bars.forEach((v,j)=>{const hh=v*3.0,x=bx-(bn-1-j)*11-7;rr(x,by-hh,7,hh,2);ctx.fillStyle=j===bn-1?k.c:'rgba(255,255,255,0.14)';ctx.fill();});
    T(k.d,kx+20,ky+kh-18,{s:13,w:600,c:k.c});});
  const ly=ky+kh+22,lh=DH-ly-26,lw1=MW*0.62-9,lw2=MW*0.38-9;
  rr(MX,ly,lw1,lh,16);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();
  T('Aktif iş emirleri',MX+22,ly+34,{s:17,w:600,c:COL.text});
  T(o.role&&o.role!=='Genel Müdür'?o.role+' kapsamı':'Tümü',MX+lw1-22,ly+34,{s:14,w:500,c:COL.mut2,align:'right'});
  let rows=ROWS;if(o.newRow)rows=[{code:'İE-2088',t:'Klima arızası bildirimi',room:'Oda 207',dept:'Teknik Servis',s:'Açık',pr:COL.red,_new:true},...ROWS];
  if(o.scope)rows=rows.filter(r=>r.dept===o.scope);
  let ry2=ly+58;rows.slice(0,o.scope?4:5).forEach((r)=>{const rh=50;
    if(r._new){rr(MX+10,ry2,lw1-20,rh-6,10);ctx.fillStyle='rgba(47,230,176,0.10)';ctx.fill();rr(MX+10,ry2,lw1-20,rh-6,10);ctx.strokeStyle=COL.lineHi;ctx.lineWidth=1;ctx.stroke();}
    const cy=ry2+(rh-6)/2;T(r.code,MX+22,cy+1,{s:13,w:600,f:'JetBrains Mono',c:COL.mut,base:'middle'});
    dot(MX+110,cy,4.5,r.pr);T(r.t,MX+126,cy+1,{s:16,w:600,c:COL.text,base:'middle'});
    T(r.room,MX+lw1-340,cy+1,{s:14,c:COL.mut,base:'middle'});T(r.dept,MX+lw1-235,cy+1,{s:14,c:COL.mut,base:'middle'});
    ctx.save();ctx.textBaseline='alphabetic';pill(MX+lw1-110,cy-14,r.s);ctx.restore();ry2+=rh;});
  const fx=MX+lw1+18;rr(fx,ly,lw2,lh,16);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();
  T('Canlı akış',fx+22,ly+34,{s:17,w:600,c:COL.text});
  let fy=ly+62;const fsc=o.feedScroll||0;
  FEED.forEach((f,i)=>{const yy=fy-fsc;if(yy>ly+44&&yy<ly+lh-10){dot(fx+28,yy+8,5,f.c);
    if(i<FEED.length-1){ctx.strokeStyle=COL.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(fx+28,yy+16);ctx.lineTo(fx+28,yy+46);ctx.stroke();}
    T(f.tx,fx+46,yy+10,{s:14.5,w:500,c:COL.text});T(f.tm,fx+46,yy+30,{s:12,w:500,f:'JetBrains Mono',c:COL.mut2});}fy+=52;});
  ctx.restore();
}

// =====================================================================
//  MOBILE APP (portrait)
// =====================================================================
function mobileApp(o){o=o||{};const t=o.t||0;const AW=760,AH=1480;
  rr(0,0,AW,AH,46);ctx.fillStyle='#05101f';ctx.fill();
  rr(0,0,AW,AH,46);ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.stroke();
  ctx.save();rr(14,14,AW-28,AH-28,36);ctx.clip();
  ctx.fillStyle=COL.bg2;ctx.fillRect(14,14,AW-28,AH-28);
  const PADX=44;
  // status bar
  T('9:41',PADX,70,{s:24,w:600,c:COL.text});
  T('5G',AW-PADX-70,70,{s:22,w:600,c:COL.text});dot(AW-PADX-18,62,9,COL.green);
  // header
  if(MARK)ctx.drawImage(MARK,PADX,108,40,40);
  ctx.font='700 26px Sora';ctx.textBaseline='middle';ctx.fillStyle=COL.text;ctx.fillText('Nodera ',PADX+52,130);
  const wn=ctx.measureText('Nodera ').width;ctx.fillStyle=COL.g;ctx.fillText('HotelOps',PADX+52+wn,130);
  const blink=0.5+0.5*Math.sin(t*3);rr(AW-PADX-110,110,110,40,20);ctx.fillStyle='rgba(70,214,160,0.14)';ctx.fill();
  ctx.save();ctx.globalAlpha=blink;dot(AW-PADX-92,130,6,COL.green);ctx.restore();
  T('Canlı',AW-PADX-78,131,{s:18,w:600,c:COL.green,base:'middle'});
  T('Operasyon Paneli',PADX,210,{s:42,w:700,f:'Sora',c:COL.text,ls:-1});
  T(o.role||'Genel Müdür'+' · 18 Haz',PADX,252,{s:20,w:500,c:COL.mut});
  // KPI 2x2
  const kpis=[['Açık iş',38,'',COL.g],['Tamamlanan',124,'',COL.green],['Bekleyen',9,'',COL.red],['Ort. çözüm',2.4,' s',COL.blue]];
  const gx=PADX,gy=300,cw=(AW-PADX*2-20)/2,ch=150,gap=20;
  kpis.forEach((k,i)=>{const c=i%2,r=Math.floor(i/2),x=gx+c*(cw+gap),y=gy+r*(ch+gap);
    rr(x,y,cw,ch,18);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();
    T(k[0],x+24,y+38,{s:19,w:500,c:COL.mut});const cu=o.count!=null?o.count:1;let val=k[1]*clamp(cu,0,1);
    T((k[1]===2.4?val.toFixed(1):Math.round(val))+k[2],x+24,y+98,{s:46,w:700,f:'Sora',c:COL.text,ls:-1});
    dot(x+cw-30,y+38,6,k[3]);});
  // list
  const ly=gy+2*ch+gap+30;
  T('Aktif iş emirleri',PADX,ly,{s:24,w:600,c:COL.text});
  T(o.scope?o.scope:'Tümü',AW-PADX,ly,{s:19,w:500,c:COL.mut2,align:'right'});
  let rows=ROWS;if(o.newRow)rows=[{code:'İE-2088',t:'Klima arızası bildirimi',room:'Oda 207',dept:'Teknik Servis',s:'Açık',pr:COL.red,_new:true},...ROWS];
  if(o.scope)rows=rows.filter(r=>r.dept===o.scope);
  let yy=ly+34;rows.slice(0,o.scope?4:5).forEach(r=>{const rh=130;
    rr(PADX,yy,AW-PADX*2,rh-16,18);ctx.fillStyle=r._new?'rgba(47,230,176,0.10)':COL.panel;ctx.fill();
    ctx.strokeStyle=r._new?COL.lineHi:COL.line;ctx.lineWidth=1;ctx.stroke();
    T(r.code,PADX+26,yy+38,{s:18,w:600,f:'JetBrains Mono',c:COL.mut});
    ctx.save();ctx.textBaseline='alphabetic';pill(PADX+(AW-PADX*2)-150,yy+20,r.s,18);ctx.restore();
    dot(PADX+30,yy+76,6,r.pr);T(r.t,PADX+48,yy+82,{s:24,w:600,c:COL.text});
    T(r.room+' · '+r.dept,PADX+26,yy+rh-30,{s:18,w:500,c:COL.mut});yy+=rh;});
  ctx.restore();
}

// =====================================================================
//  S4 — DASHBOARD (live)
// =====================================================================
function sDashboard(lt,dur){
  const count=eOut(clamp((lt-0.5)/1.6,0,1));
  const kpiGlow=(lt>2.2&&lt<3.8)?0:-1;
  const newRow=lt>4.2;
  const feedScroll=Math.max(0,(lt-6.0))*22;
  if(P){
    const sc=0.96;const AW=760,AH=1480;
    ctx.save();ctx.translate(CX,H*0.5+30);ctx.scale(sc,sc);ctx.translate(-AW/2,-AH/2);
    mobileApp({t:lt,count,newRow,nav:0});ctx.restore();
    // toast
    const notif=clamp((lt-3.2)/0.5,0,1)-clamp((lt-6.0)/0.4,0,1);const no=eOut(clamp(notif,0,1));
    if(no>0){ctx.save();ctx.globalAlpha=no;const tw=W-160,th=110,tx=80,ty=80-(1-no)*24;
      ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=40;rr(tx,ty,tw,th,20);ctx.fillStyle='rgba(20,34,60,0.97)';ctx.fill();ctx.shadowColor='transparent';
      rr(tx,ty,tw,th,20);ctx.strokeStyle=COL.lineHi;ctx.lineWidth=1;ctx.stroke();
      rr(tx+24,ty+26,58,58,16);ctx.fillStyle='rgba(240,120,107,0.16)';ctx.fill();dot(tx+53,ty+55,9,COL.red);
      T('Yeni arıza bildirimi',tx+104,ty+44,{s:26,w:600,c:COL.text});T('Oda 207 · Teknik Servis’e iletildi',tx+104,ty+78,{s:20,c:COL.mut});ctx.restore();}
    const cap=rv(lt,0.4,0.6)*(1-rv(lt,dur-0.5,0.5));ctx.save();ctx.globalAlpha=cap;
    richLine([{t:'Tüm operasyon ',c:COL.text},{t:'tek panelde.',c:COL.g}],CX,H-90,30,600,'Inter',0);ctx.restore();
    return;
  }
  const scale=lerp(0.84,0.97,eInOut(clamp(lt/dur,0,1)));const DW=1560,DH=880;
  ctx.save();ctx.translate(CX,H/2-26);ctx.scale(scale,scale);ctx.translate(-DW/2,-DH/2);
  dashboard({t:lt,count,kpiGlow,newRow,nav:0,feedScroll});
  // cursor
  const cur=clamp((lt-1.8)/2.2,0,1);
  if(cur>0&&cur<1){const path=[[1180,150],[1180,150],[820,360]];
    const px=lerp(1300,1160,eInOut(cur)),py=lerp(700,150,eInOut(cur));
    drawCursor(px,py);}
  ctx.restore();
  const notif=clamp((lt-3.0)/0.5,0,1)-clamp((lt-5.6)/0.4,0,1);const no=eOut(clamp(notif,0,1));
  if(no>0){ctx.save();ctx.globalAlpha=no;const tw=420,th=78,tx=W-tw-80,ty=120-(1-no)*24;
    ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=40;rr(tx,ty,tw,th,16);ctx.fillStyle='rgba(20,34,60,0.97)';ctx.fill();ctx.shadowColor='transparent';
    rr(tx,ty,tw,th,16);ctx.strokeStyle=COL.lineHi;ctx.lineWidth=1;ctx.stroke();
    rr(tx+16,ty+17,44,44,12);ctx.fillStyle='rgba(240,120,107,0.16)';ctx.fill();dot(tx+38,ty+39,7,COL.red);
    T('Yeni arıza bildirimi',tx+76,ty+32,{s:17,w:600,c:COL.text});T('Oda 207 · Teknik Servis’e iletildi',tx+76,ty+56,{s:14,c:COL.mut});
    T('şimdi',tx+tw-20,ty+32,{s:12,f:'JetBrains Mono',c:COL.mut2,align:'right'});ctx.restore();}
  const cap=rv(lt,0.4,0.6)*(1-rv(lt,dur-0.5,0.5));ctx.save();ctx.globalAlpha=cap;
  richLine([{t:'Tüm operasyon ',c:COL.text},{t:'tek panelde',c:COL.g},{t:' — canlı ve izlenebilir.',c:COL.text}],CX,H-46,28,600,'Inter',0);ctx.restore();
}
function drawCursor(x,y){ctx.save();ctx.translate(x,y);ctx.beginPath();
  ctx.moveTo(0,0);ctx.lineTo(0,22);ctx.lineTo(6,17);ctx.lineTo(11,27);ctx.lineTo(15,25);ctx.lineTo(10,15);ctx.lineTo(18,15);ctx.closePath();
  ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#0a1322';ctx.stroke();ctx.restore();}

// =====================================================================
//  S5 — WORKFLOW
// =====================================================================
const STEPS=[['Açıldı',COL.red,'Açık'],['Atandı',COL.blue,'Atandı'],['Devam ediyor',COL.gold,'Devam'],['Tamamlandı',COL.green,'Tamam']];
const TL=[['09:42','İş emri açıldı · Ön Büro',COL.red],['09:44','A. Demir’e atandı',COL.blue],['10:01','Parça değişimi başladı',COL.gold],['10:36','Tamamlandı · fotoğraf eklendi',COL.green]];
function sWorkflow(lt,dur){
  const h1=rv(lt,0.1,0.6);ctx.save();ctx.globalAlpha=h1;
  if(P)richLine([{t:'Açılıştan kapanışa',c:COL.text}],CX,150,46,800,'Sora'),richLine([{t:'tam takip.',c:COL.g}],CX,210,46,800,'Sora');
  else richLine([{t:'Açılıştan kapanışa ',c:COL.text},{t:'tam takip.',c:COL.g}],CX,150,58,800,'Sora');
  ctx.restore();
  const step=clamp(Math.floor((lt-0.7)/0.95),0,3);
  const card=rv(lt,0.4,0.7,eOut);
  if(P){
    ctx.save();ctx.globalAlpha=card;ctx.translate(0,(1-card)*20);
    const CW=W-140,cx=70,cy=288,CH=640;
    rr(cx,cy,CW,CH,24);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();
    T('İE-2087',cx+44,cy+62,{s:22,w:600,f:'JetBrains Mono',c:COL.g});
    ctx.save();ctx.textBaseline='alphabetic';pill(cx+CW-210,cy+40,STEPS[step][2],22);ctx.restore();
    T('Klima soğutmuyor',cx+44,cy+128,{s:46,w:700,f:'Sora',c:COL.text});
    T('Oda 412 · Teknik Servis · Öncelik: Yüksek',cx+44,cy+172,{s:24,c:COL.mut});
    // vertical stepper
    let sy=cy+250;STEPS.forEach((st,i)=>{const on=i<=step;
      ctx.beginPath();ctx.arc(cx+66,sy,20,0,7);ctx.fillStyle=on?st[1]:COL.panel2;ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle=on?st[1]:COL.line;ctx.stroke();
      if(i<step)T('✓',cx+66,sy+1,{s:20,w:700,c:'#0a1322',align:'center',base:'middle'});
      if(i<3){ctx.strokeStyle=i<step?STEPS[i+1][1]:COL.line;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx+66,sy+22);ctx.lineTo(cx+66,sy+68);ctx.stroke();}
      T(st[0],cx+108,sy-8,{s:28,w:on?600:500,c:on?COL.text:COL.mut2,base:'middle'});
      const dsc=['Talep oluşturuldu','Tekniker görevlendirildi','Müdahale sürüyor','Onaylanıp kapatıldı'][i];
      T(dsc,cx+108,sy+22,{s:19,w:500,c:on?COL.mut:COL.mut2,base:'middle'});sy+=90;});
    ctx.restore();
    // timeline card
    ctx.save();ctx.globalAlpha=card;ctx.translate(0,(1-card)*20);
    const TY=288+640+30,TH=H-TY-130;
    rr(cx,TY,CW,TH,24);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();
    T('Zaman çizelgesi',cx+44,TY+58,{s:26,w:600,c:COL.text});
    const shownP=clamp(Math.floor((lt-0.9)/0.95)+1,0,4);let yy=TY+118;
    TL.forEach((e,i)=>{const on=i<shownP;ctx.save();ctx.globalAlpha=card*(on?1:0.22);
      dot(cx+62,yy,9,e[2]);if(i<TL.length-1){ctx.strokeStyle=COL.line;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(cx+62,yy+13);ctx.lineTo(cx+62,yy+62);ctx.stroke();}
      T(e[1],cx+92,yy-4,{s:24,w:500,c:COL.text,base:'middle'});
      T(e[0],cx+92,yy+24,{s:19,f:'JetBrains Mono',c:COL.mut2,base:'middle'});ctx.restore();yy+=75;});
    ctx.restore();
    return;
  }
  ctx.save();ctx.globalAlpha=card;const CW=760,CH=460,cx=CX-CW-15,cy=250;ctx.translate(0,(1-card)*20);
  rr(cx,cy,CW,CH,20);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();
  T('İE-2087',cx+34,cy+48,{s:14,w:600,f:'JetBrains Mono',c:COL.g});
  T('Klima soğutmuyor',cx+34,cy+92,{s:30,w:700,f:'Sora',c:COL.text});
  T('Oda 412 · Teknik Servis · Öncelik: Yüksek',cx+34,cy+124,{s:16,c:COL.mut});
  ctx.save();ctx.textBaseline='alphabetic';pill(cx+CW-150,cy+34,STEPS[step][2]);ctx.restore();
  const sy=cy+210,n=4,segW=(CW-120)/(n-1),sx=cx+60;
  for(let i=0;i<n-1;i++){ctx.strokeStyle=i<step?STEPS[i+1][1]:COL.line;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx+i*segW+18,sy);ctx.lineTo(sx+(i+1)*segW-18,sy);ctx.stroke();}
  STEPS.forEach((st,i)=>{const px=sx+i*segW,on=i<=step,r2=i===step?15:13;
    ctx.beginPath();ctx.arc(px,sy,r2,0,7);ctx.fillStyle=on?st[1]:COL.panel2;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=on?st[1]:COL.line;ctx.stroke();
    if(i<step)T('✓',px,sy+1,{s:14,w:700,c:'#0a1322',align:'center',base:'middle'});
    T(st[0],px,sy+38,{s:14,w:600,c:on?COL.text:COL.mut2,align:'center',base:'middle'});});
  T('İlerleme',cx+34,cy+CH-40,{s:14,w:500,c:COL.mut2});const pw=CW-68,pp=step/(n-1);
  rr(cx+34,cy+CH-30,pw,8,4);ctx.fillStyle=COL.panel2;ctx.fill();rr(cx+34,cy+CH-30,pw*pp,8,4);ctx.fillStyle=accentGrad(cx+34,0,cx+34+pw,0);ctx.fill();
  ctx.restore();
  ctx.save();ctx.globalAlpha=card;ctx.translate(0,(1-card)*20);
  const TX=CX+15,TW=440,TH=460,TY=250;rr(TX,TY,TW,TH,20);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();
  T('Zaman çizelgesi',TX+30,TY+44,{s:18,w:600,c:COL.text});
  const shown=clamp(Math.floor((lt-0.9)/0.95)+1,0,4);let yy=TY+92;
  TL.forEach((e,i)=>{const on=i<shown;ctx.save();ctx.globalAlpha=card*(on?1:0.2);
    dot(TX+40,yy,7,e[2]);if(i<TL.length-1){ctx.strokeStyle=COL.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(TX+40,yy+10);ctx.lineTo(TX+40,yy+58);ctx.stroke();}
    T(e[1],TX+62,yy+5,{s:16,w:500,c:COL.text});T(e[0],TX+62,yy+28,{s:13,f:'JetBrains Mono',c:COL.mut2});ctx.restore();yy+=68;});
  ctx.restore();
}

// =====================================================================
//  S6 — ROLES
// =====================================================================
const ROLES=[['Genel Müdür',null],['Teknik Müdür','Teknik Servis'],['Housekeeping','Housekeeping']];
function sRoles(lt,dur){
  const h1=rv(lt,0.1,0.6);ctx.save();ctx.globalAlpha=h1;
  if(P){richLine([{t:'Herkes ',c:COL.text},{t:'kendi',c:COL.g}],CX,140,48,800,'Sora');richLine([{t:'alanını',c:COL.g},{t:' görür.',c:COL.text}],CX,200,48,800,'Sora');
    T('Rol bazlı yetki — API katmanında garanti.',CX,256,{s:22,w:500,c:COL.mut,align:'center'});}
  else{richLine([{t:'Herkes ',c:COL.text},{t:'yalnızca kendi alanını',c:COL.g},{t:' görür.',c:COL.text}],CX,116,54,800,'Sora');
    T('Rol bazlı yetki ve departman kapsamı — API katmanında garanti altında.',CX,162,{s:23,w:500,c:COL.mut,align:'center'});}
  ctx.restore();
  const idx=clamp(Math.floor((lt-0.6)/1.05),0,2);
  const chipsY=P?300:232;
  let totalW=0;const cw=[];ROLES.forEach(r=>{const w=measure(r[0],600,P?22:19)+(P?64:58);cw.push(w);totalW+=w+(P?16:14);});
  totalW-=(P?16:14);let cx2=CX-totalW/2;
  ROLES.forEach((r,i)=>{const act=i===idx,w=cw[i],h=P?52:46;
    rr(cx2,chipsY,w,h,h/2);ctx.fillStyle=act?COL.g:COL.panel;ctx.fill();if(!act){ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();}
    dot(cx2+(P?28:24),chipsY+h/2,5,act?'#0a1322':COL.mut2);
    T(r[0],cx2+(P?44:38),chipsY+h/2+1,{s:P?22:19,w:600,c:act?'#0a1322':COL.mut,base:'middle'});cx2+=w+(P?16:14);});
  const role=ROLES[idx];
  if(P){const sc=0.84,AW=760,AH=1480;ctx.save();ctx.translate(CX,chipsY+90+AH*sc/2);ctx.scale(sc,sc);ctx.translate(-AW/2,-AH/2);
    mobileApp({t:lt,count:1,scope:role[1],role:role[0]});ctx.restore();return;}
  const sc=0.74,DW=1560,DH=880;ctx.save();ctx.translate(CX,318+DH*sc/2);ctx.scale(sc,sc);ctx.translate(-DW/2,-DH/2);
  dashboard({t:lt,count:1,nav:1,scope:role[1],role:role[0]});ctx.restore();
}

// =====================================================================
//  S7 — DEVICES
// =====================================================================
function miniUI(x,y,w,h,accent){ctx.save();rr(x,y,w,h,8);ctx.clip();ctx.fillStyle=COL.bg2;ctx.fillRect(x,y,w,h);
  ctx.fillStyle='rgba(255,255,255,0.02)';ctx.fillRect(x,y,w,h*0.12);dot(x+w*0.06,y+h*0.06,h*0.018,accent);
  const sbw=w*0.16;ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+sbw,y+h*0.12);ctx.lineTo(x+sbw,y+h);ctx.stroke();
  for(let i=0;i<4;i++){rr(x+w*0.04,y+h*0.2+i*h*0.13,sbw-w*0.07,h*0.05,3);ctx.fillStyle=i===0?accent:COL.panel2;ctx.fill();}
  const mx=x+sbw+w*0.04,mw=w-sbw-w*0.08;
  for(let i=0;i<3;i++){const cw=(mw-w*0.04)/3;rr(mx+i*(cw+w*0.02),y+h*0.2,cw,h*0.18,5);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.stroke();
    rr(mx+i*(cw+w*0.02)+6,y+h*0.2+h*0.1,cw*0.5,h*0.04,2);ctx.fillStyle=[COL.g,COL.green,COL.red][i];ctx.fill();}
  for(let i=0;i<3;i++){rr(mx,y+h*0.46+i*h*0.16,mw,h*0.11,4);ctx.fillStyle=COL.panel;ctx.fill();ctx.strokeStyle=COL.line;ctx.stroke();
    dot(mx+h*0.05,y+h*0.46+i*h*0.16+h*0.055,h*0.014,[COL.red,COL.blue,COL.green][i]);}ctx.restore();}
function drawWindow(x,y,w,h,op,kind,accent,label){if(op<=0)return;ctx.save();ctx.globalAlpha=clamp(op,0,1);
  const sc=0.92+0.08*clamp(op,0,1);ctx.translate(x+w/2,y+h/2);ctx.scale(sc,sc);ctx.translate(-w/2,-h/2);ctx.translate(x,y);
  // note: above translate stacking handled below
  ctx.restore();ctx.save();ctx.globalAlpha=clamp(op,0,1);
  const sc2=0.92+0.08*clamp(op,0,1);ctx.translate(x+w/2,y+h/2);ctx.scale(sc2,sc2);ctx.translate(-(x+w/2),-(y+h/2));
  ctx.shadowColor='rgba(0,0,0,0.55)';ctx.shadowBlur=50;ctx.shadowOffsetY=24;
  rr(x,y,w,h,14);ctx.fillStyle=COL.panel;ctx.fill();ctx.shadowColor='transparent';rr(x,y,w,h,14);ctx.strokeStyle=COL.line;ctx.lineWidth=1;ctx.stroke();
  const bh=36;ctx.save();rr(x,y,w,h,14);ctx.clip();ctx.fillStyle='#0a1322';ctx.fillRect(x,y,w,bh);
  ctx.strokeStyle=COL.line;ctx.beginPath();ctx.moveTo(x,y+bh);ctx.lineTo(x+w,y+bh);ctx.stroke();
  if(kind==='browser'){[COL.red,COL.gold,COL.green].forEach((c,i)=>dot(x+18+i*18,y+bh/2,5.5,c));
    rr(x+80,y+bh/2-10,w-160,20,6);ctx.fillStyle=COL.bg;ctx.fill();ctx.strokeStyle=COL.line;ctx.stroke();
    T('noderasoftware.com/hotel',x+92,y+bh/2+1,{s:11,f:'JetBrains Mono',c:COL.mut2,base:'middle'});}
  else{T('Nodera HotelOps — Masaüstü',x+16,y+bh/2+1,{s:12,w:600,c:COL.mut,base:'middle'});
    ['—','▢','✕'].forEach((g,i)=>T(g,x+w-60+i*20,y+bh/2+1,{s:12,c:COL.mut2,base:'middle'}));}
  ctx.restore();miniUI(x,y+bh,w,h-bh,accent);ctx.restore();
  ctx.save();ctx.globalAlpha=clamp(op,0,1);T(label,x+w/2,y+h+34,{s:18,w:600,c:COL.mut,align:'center',ls:1.5});ctx.restore();}
function drawPhone(cx,topY,op,scale){scale=scale||1;if(op<=0)return;const w=234*scale,h=474*scale,x=cx-w/2,y=topY;
  ctx.save();ctx.globalAlpha=clamp(op,0,1);const sc=0.92+0.08*clamp(op,0,1);ctx.translate(cx,y+h/2);ctx.scale(sc,sc);ctx.translate(-cx,-(y+h/2));
  ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=60;ctx.shadowOffsetY=30;rr(x,y,w,h,38*scale);ctx.fillStyle='#060d1a';ctx.fill();ctx.shadowColor='transparent';
  rr(x,y,w,h,38*scale);ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=2;ctx.stroke();
  ctx.save();rr(x+11*scale,y+11*scale,w-22*scale,h-22*scale,28*scale);ctx.clip();miniUI(x+11*scale,y+11*scale,w-22*scale,h-22*scale,COL.t);
  rr(cx-44*scale,y+11*scale,88*scale,22*scale,11*scale);ctx.fillStyle='#060d1a';ctx.fill();ctx.restore();ctx.restore();
  ctx.save();ctx.globalAlpha=clamp(op,0,1);T('MOBİL',cx,y+h+34,{s:18,w:600,c:COL.mut,align:'center',ls:1.5});ctx.restore();}
function sDevices(lt,dur){
  const h1=rv(lt,0.1,0.6);ctx.save();ctx.globalAlpha=h1;
  if(P){richLine([{t:'Web. Masaüstü.',c:COL.text}],CX,150,52,800,'Sora');richLine([{t:'Mobil.',c:COL.g}],CX,212,52,800,'Sora');
    T('Tek sistem — her cihazdan, her yerden.',CX,268,{s:23,w:500,c:COL.mut,align:'center'});}
  else{richLine([{t:'Web. Masaüstü. ',c:COL.text},{t:'Mobil.',c:COL.g}],CX,148,58,800,'Sora');
    T('Tek sistem — her cihazdan, her yerden.',CX,200,{s:25,w:500,c:COL.mut,align:'center'});}
  ctx.restore();
  if(P){
    const d0=rv(lt,0.5,0.6,eBack);drawWindow(CX-275,420+(1-d0)*30,550,350,d0,'browser',COL.g,'WEB');
    const d1=rv(lt,0.72,0.6,eBack);drawPhone(CX,880+(1-d1)*30,d1,1.5);
    return;
  }
  const baseY=300;
  const d0=rv(lt,0.5,0.6,eBack);drawWindow(CX-640,baseY+(1-d0)*30,560,360,d0,'browser',COL.g,'WEB');
  const d1=rv(lt,0.72,0.6,eBack);drawPhone(CX,baseY-20+(1-d1)*30,d1,1);
  const d2=rv(lt,0.94,0.6,eBack);drawWindow(CX+80,baseY+(1-d2)*30,560,360,d2,'desktop',COL.b,'MASAÜSTÜ');
}

// =====================================================================
//  S8 — BENEFITS / STATS
// =====================================================================
const BENS=[
  {ic:'eye',l:'Anında görünürlük',sub:'Tüm operasyon canlı, tek ekranda',c:COL.g},
  {ic:'check',l:'Eksiksiz takip',sub:'Hiçbir iş emri kaybolmaz',c:COL.green},
  {ic:'lock',l:'Net yetkilendirme',sub:'Herkes yalnızca kendi alanında',c:COL.blue},
  {ic:'bolt',l:'Hızlı çözüm',sub:'Talepler anında doğru ekibe',c:COL.gold},
];
function wrapPlain(str,maxW,wt,sz,f){const words=str.split(' ');const lines=[];let cur='';
  words.forEach(w=>{const test=cur?cur+' '+w:w;if(measure(test,wt,sz,f)>maxW&&cur){lines.push(cur);cur=w;}else cur=test;});
  if(cur)lines.push(cur);return lines;}
function benIcon(ic,x,y,s,c){ctx.save();ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=s*0.09;ctx.lineJoin='round';ctx.lineCap='round';
  const cx=x+s/2,cy=y+s/2,u=s*0.5;
  if(ic==='eye'){ctx.beginPath();ctx.ellipse(cx,cy,u*0.88,u*0.55,0,0,7);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,u*0.3,0,7);ctx.fill();}
  else if(ic==='check'){ctx.beginPath();ctx.arc(cx,cy,u*0.82,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(cx-u*0.38,cy+u*0.02);ctx.lineTo(cx-u*0.08,cy+u*0.34);ctx.lineTo(cx+u*0.42,cy-u*0.34);ctx.stroke();}
  else if(ic==='lock'){rr(cx-u*0.6,cy-u*0.08,u*1.2,u*0.85,5);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy-u*0.08,u*0.38,Math.PI,2*Math.PI);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy+u*0.28,u*0.1,0,7);ctx.fill();}
  else if(ic==='bolt'){ctx.beginPath();ctx.moveTo(cx+u*0.18,cy-u*0.82);ctx.lineTo(cx-u*0.5,cy+u*0.12);ctx.lineTo(cx-u*0.08,cy+u*0.12);ctx.lineTo(cx-u*0.18,cy+u*0.82);ctx.lineTo(cx+u*0.52,cy-u*0.18);ctx.lineTo(cx+u*0.08,cy-u*0.18);ctx.closePath();ctx.stroke();}
  ctx.restore();}
function sStats(lt,dur){
  const h1=rv(lt,0.1,0.6);ctx.save();ctx.globalAlpha=h1;
  if(P){richLine([{t:'Tek sistemle,',c:COL.text}],CX,160,52,800,'Sora');richLine([{t:'tam kontrol.',c:COL.g}],CX,222,52,800,'Sora');}
  else richLine([{t:'Tek sistemle, ',c:COL.text},{t:'tam kontrol.',c:COL.g}],CX,150,58,800,'Sora');
  ctx.restore();
  if(P){const cw=W-160,ch=210,gx=80,gy=330,gap=24;
    BENS.forEach((s,i)=>{const y=gy+i*(ch+gap);const ap=rv(lt,0.4+i*0.12,0.5,eBack);if(ap<=0)return;
      ctx.save();ctx.globalAlpha*=clamp(ap,0,1);const sc=0.9+0.1*clamp(ap,0,1);ctx.translate(gx+cw/2,y+ch/2);ctx.scale(sc,sc);ctx.translate(-(gx+cw/2),-(y+ch/2));
      rr(gx,y,cw,ch,22);ctx.fillStyle=COL.panel;ctx.fill();rr(gx,y,cw,ch,22);ctx.lineWidth=1;ctx.strokeStyle=COL.line;ctx.stroke();
      const isz=104;rr(gx+40,y+ch/2-isz/2,isz,isz,24);ctx.fillStyle=s.c+'1f';ctx.fill();benIcon(s.ic,gx+40+isz*0.22,y+ch/2-isz*0.28,isz*0.56,s.c);
      T(s.l,gx+40+isz+34,y+ch/2-18,{s:34,w:700,f:'Sora',c:COL.text,base:'middle'});
      T(s.sub,gx+40+isz+34,y+ch/2+30,{s:24,w:500,c:COL.mut,base:'middle'});ctx.restore();});
    return;}
  const cw=410,ch=320,gap=24,gx=CX-(cw*4+gap*3)/2,gy=330;
  BENS.forEach((s,i)=>{const x=gx+i*(cw+gap);const ap=rv(lt,0.4+i*0.12,0.5,eBack);if(ap<=0)return;
    ctx.save();ctx.globalAlpha*=clamp(ap,0,1);const sc=0.9+0.1*clamp(ap,0,1);ctx.translate(x+cw/2,gy+ch/2);ctx.scale(sc,sc);ctx.translate(-(x+cw/2),-(gy+ch/2));
    rr(x,gy,cw,ch,22);ctx.fillStyle=COL.panel;ctx.fill();rr(x,gy,cw,ch,22);ctx.lineWidth=1;ctx.strokeStyle=COL.line;ctx.stroke();
    const isz=92;rr(x+38,gy+40,isz,isz,22);ctx.fillStyle=s.c+'1f';ctx.fill();benIcon(s.ic,x+38+isz*0.22,gy+40+isz*0.22,isz*0.56,s.c);
    T(s.l,x+38,gy+200,{s:28,w:700,f:'Sora',c:COL.text});
    const lines=wrapPlain(s.sub,cw-76,500,19,'Inter');lines.forEach((ln,j)=>T(ln,x+38,gy+238+j*28,{s:19,w:500,c:COL.mut}));
    ctx.restore();});
}

// =====================================================================
//  S9 — CTA
// =====================================================================
function sCTA(lt,dur){
  const base=P?H*0.40:H*0.30;
  const m=rv(lt,0.1,0.8,eBack),mf=rv(lt,0.1,0.6);const sz=150*(0.7+0.3*m);
  if(MARK){ctx.save();ctx.globalAlpha=mf;ctx.shadowColor='rgba(47,230,176,0.5)';ctx.shadowBlur=70;ctx.drawImage(MARK,CX-sz/2,base-sz/2,sz,sz);ctx.restore();}
  const tx=rv(lt,0.45,0.7);if(tx>0){ctx.save();ctx.globalAlpha=tx;ctx.translate(0,(1-tx)*16);wordmark(CX,base+sz/2+72,P?64:76);ctx.restore();}
  const tg=rv(lt,0.85,0.7);if(tg>0){ctx.save();ctx.globalAlpha=tg;
    T('Otel operasyonlarınız, tek merkezde.',CX,base+sz/2+(P?142:138),{s:P?28:30,w:500,c:COL.mut,align:'center',base:'middle'});ctx.restore();}
  const u=rv(lt,1.25,0.7,eBack);if(u>0){ctx.save();ctx.globalAlpha=clamp(u,0,1);
    const label='noderasoftware.com';ctx.font='700 24px Inter';const tw=ctx.measureText(label).width;
    const pw=tw+64,ph=58,px=CX-pw/2,py=base+sz/2+(P?196:182),sc=0.9+0.1*clamp(u,0,1);
    ctx.translate(CX,py+ph/2);ctx.scale(sc,sc);ctx.translate(-CX,-(py+ph/2));
    ctx.shadowColor='rgba(47,230,176,0.35)';ctx.shadowBlur=40;ctx.shadowOffsetY=10;
    rr(px,py,pw,ph,ph/2);ctx.fillStyle=accentGrad(px,py,px+pw,py);ctx.fill();ctx.shadowColor='transparent';
    T(label,CX,py+ph/2+1,{s:24,w:700,c:'#08111f',align:'center',base:'middle'});ctx.restore();}
}

// =====================================================================
//  SCENE MANAGER
// =====================================================================
const SCENES=[
  {s:0,    e:5.5,  f:sIntro},
  {s:5.0,  e:12.0, f:sHook},
  {s:11.5, e:18.0, f:sMods},
  {s:17.5, e:28.5, f:sDashboard},
  {s:28.0, e:35.5, f:sWorkflow},
  {s:35.0, e:42.5, f:sRoles},
  {s:42.0, e:48.5, f:sDevices},
  {s:48.0, e:54.5, f:sStats},
  {s:54.0, e:60.0, f:sCTA},
];
function env(lt,dur,inD,outD){inD=inD||0.5;outD=outD||0.5;let a=1;
  if(lt<inD)a=eOut(lt/inD);if(lt>dur-outD)a*=eOut((dur-lt)/outD);return clamp(a,0,1);}
function render(t){drawBG(t);
  SCENES.forEach(sc=>{if(t>=sc.s&&t<=sc.e){const lt=t-sc.s,dur=sc.e-sc.s,a=env(lt,dur);
    ctx.save();ctx.globalAlpha=a;sc.f(lt,dur);ctx.restore();}});
  vignette();}
window.NODERA_render=render;

// =====================================================================
//  PLAYBACK + CONTROLS + EXPORT
// =====================================================================
let playing=CFG.autoplay!==false, time=0, lastTs=null;
window.NODERA_seek=function(t){time=clamp(t,0,DUR);playing=false;render(time);};
const tlabel=document.getElementById('tlabel');
const playBtn=document.getElementById('play');
function loop(ts){if(lastTs==null)lastTs=ts;const dt=(ts-lastTs)/1000;lastTs=ts;
  if(playing){time+=dt;if(time>=DUR)time=(CFG.loop!==false)?time%DUR:DUR;}
  render(time);if(tlabel)tlabel.textContent=time.toFixed(1)+' / 60.0s';
  requestAnimationFrame(loop);}
if(playBtn)playBtn.onclick=()=>{playing=!playing;playBtn.innerHTML=playing?'❚❚ Duraklat':'▶ Oynat';};
const rb=document.getElementById('restart');if(rb)rb.onclick=()=>{time=0;};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&playBtn){e.preventDefault();playBtn.click();}});

// export
const ov=document.getElementById('ov');
const dlBtn=document.getElementById('dl');
function setProg(p,msg){if(!ov)return;ov.querySelector('.pct').textContent=Math.round(p*100)+'%';
  ov.querySelector('.pbar i').style.width=(p*100)+'%';if(msg)ov.querySelector('.msg').textContent=msg;}
function download(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);}
async function exportVideo(){const wasPlaying=playing;playing=false;dlBtn.disabled=true;if(ov)ov.classList.add('show');setProg(0,'Hazırlanıyor…');
  const total=FPS*DUR;let ok=false;
  if('VideoEncoder' in window){try{await exportWebCodecs(total);ok=true;}catch(err){console.warn('WebCodecs hata, webm:',err);}}
  if(!ok){await exportMediaRecorder();}
  if(ov)ov.classList.remove('show');dlBtn.disabled=false;playing=wasPlaying;lastTs=null;}
async function exportWebCodecs(total){setProg(0,'MP4 kodlayıcı yükleniyor…');
  const mod=await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.5/+esm');const {Muxer,ArrayBufferTarget}=mod;
  const codecs=['avc1.640028','avc1.4d0028','avc1.42E01E'];let chosen=null;
  const cfgBase={width:W,height:H,bitrate:P?7000000:9000000,framerate:FPS};
  for(const c of codecs){try{const s=await VideoEncoder.isConfigSupported({codec:c,...cfgBase});if(s&&s.supported){chosen=c;break;}}catch(e){}}
  if(!chosen)throw new Error('H.264 yok');
  const muxer=new Muxer({target:new ArrayBufferTarget(),video:{codec:'avc',width:W,height:H},fastStart:'in-memory'});
  const enc=new VideoEncoder({output:(ch,m)=>muxer.addVideoChunk(ch,m),error:e=>console.error(e)});
  enc.configure({codec:chosen,...cfgBase});setProg(0,'Kareler kodlanıyor…');
  for(let i=0;i<total;i++){render(i/FPS);const frame=new VideoFrame(cv,{timestamp:Math.round(i*1e6/FPS),duration:Math.round(1e6/FPS)});
    enc.encode(frame,{keyFrame:i%60===0});frame.close();
    if(enc.encodeQueueSize>8)await new Promise(r=>setTimeout(r,4));
    if(i%6===0)setProg(i/total,'Kareler kodlanıyor… '+i+' / '+total);}
  setProg(0.98,'Sonlandırılıyor…');await enc.flush();muxer.finalize();
  download(new Blob([muxer.target.buffer],{type:'video/mp4'}),'Nodera-HotelOps-'+(P?'9x16':'16x9')+'.mp4');}
async function exportMediaRecorder(){setProg(0,'Gerçek zamanlı kayıt (webm)…');const stream=cv.captureStream(FPS);
  let mime='video/mp4;codecs=avc1.640028';if(!MediaRecorder.isTypeSupported(mime))mime='video/webm;codecs=vp9';
  if(!MediaRecorder.isTypeSupported(mime))mime='video/webm';
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:P?7000000:9000000});
  const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const done=new Promise(res=>rec.onstop=res);
  rec.start();const t0=performance.now();
  await new Promise(resolve=>{function tick(){const el=(performance.now()-t0)/1000;render(el%DUR);
    setProg(Math.min(el/DUR,1),'Kaydediliyor… '+el.toFixed(0)+'s / 60s');if(el>=DUR){resolve();return;}requestAnimationFrame(tick);}tick();});
  rec.stop();await done;const ext=mime.indexOf('mp4')>=0?'mp4':'webm';
  download(new Blob(chunks,{type:mime}),'Nodera-HotelOps-'+(P?'9x16':'16x9')+'.'+ext);}
if(dlBtn)dlBtn.onclick=exportVideo;

// boot
(async function(){
  try{await Promise.all([document.fonts.load('800 80px Sora'),document.fonts.load('700 40px Sora'),
    document.fonts.load('600 24px Inter'),document.fonts.load('500 24px Inter'),document.fonts.load('700 24px Inter'),
    document.fonts.load('600 14px "JetBrains Mono"')]);}catch(e){}
  try{MARK=await loadImg('nodera-mark.png');}catch(e){console.warn('logo yok',e);}
  requestAnimationFrame(loop);
})();
})();
