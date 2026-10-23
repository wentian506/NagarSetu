/* NagarSetu app: engine, dashboard and landing behaviour. Prototype, simulated data. */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
window.tx=window.tx||(s=>s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastT;const toast=m=>{const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3500)};
/* palettes */
const TH=[['studio','Studio','#0A0A0A','#FFFFFF'],['setu','Setu blue','#0E5C9A','#6FB942'],['teal','Fresh Teal','#0F766E','#14B8A6'],['violet','Violet','#6D28D9','#8B83FF'],['amber','Warm Amber','#B45309','#F59E0B']];
$('#sw').innerHTML=TH.map(t=>`<button data-t="${t[0]}" aria-label="${t[1]} palette" title="${t[1]}" style="--a:${t[2]};--b:${t[3]}"></button>`).join('');
let on3d=()=>{};
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('ns-theme',t)}catch(e){}$$('#sw button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t))}
$$('#sw button').forEach(b=>b.onclick=()=>setTheme(b.dataset.t));
let st0='studio';try{st0=localStorage.getItem('ns-theme')||'studio'}catch(e){}setTheme(st0);
/* Google Maps (optional, needs a key in config.js) */
const CFG=window.NS_CONFIG||{};let GMOK=false;
const SERVER=!!CFG.USE_API,API=(CFG.API_BASE_URL||'')+'/api';let TOKEN='';
async function http(method,path,body){const h={'Content-Type':'application/json'};if(TOKEN)h.Authorization='Bearer '+TOKEN;let r;
 try{r=await fetch(API+path,{method,headers:h,body:body?JSON.stringify(body):undefined})}catch(e){throw Error('Cannot reach the server. Check your connection.')}
 let d=null;try{d=await r.json()}catch(e){}
 if(!r.ok){let m=d&&d.detail;if(Array.isArray(m))m='Check the form fields and try again.';throw Error(r.status+': '+(m||'Request failed'))}
 return d}
async function sync(){if(!SERVER||!S.user)return;const d=await http('GET','/sync');VT.b=d.now;VT.r=Date.now();VT.k=1;S.tk=d.tickets;S.pub=d.public;S.cfg=d.config;if(d.staff)STAFF=d.staff;if(d.audit){S.audit=d.audit;feed.length=0;feed.push(...d.audit.slice(0,40))}S.fresh=true;refresh()}
async function restore(){if(!SERVER||S.user)return;try{TOKEN=sessionStorage.getItem('ns-token')||''}catch(e){}if(!TOKEN)return;try{const r=await http('GET','/me');S.user=r.user;await sync()}catch(e){TOKEN='';try{sessionStorage.removeItem('ns-token')}catch(x){}}}
const SV={create:async p=>{const k=await http('POST','/tickets',{key:p.key,cat:p.cat,desc:p.desc,land:p.land,pin:p.pin,photos:p.photos||[],consent:p.consent});await sync();return k},
 track:async p=>{try{return await http('GET','/tickets/track/'+norm(p.id))}catch(e){if(/^404/.test(e.message))return null;throw e}},
 reopen:async p=>{await http('POST','/tickets/'+norm(p.id)+'/reopen',{reason:p.reason||''});await sync()},public:()=>S.pub,follow:async p=>{await http('POST','/tickets/'+norm(p.id)+'/follow')},mine:()=>S.tk,queue:()=>S.tk,audit:()=>S.audit,
 status:async p=>{await http('PATCH','/tickets/'+norm(p.id)+'/status',{to:p.to,pub:p.pub});await sync()},
 note:async p=>{await http('POST','/tickets/'+norm(p.id)+'/notes',{text:p.x});await sync()},
 reassign:async p=>{await http('PATCH','/tickets/'+norm(p.id)+'/assign',{staff:p.staff});await sync()},
 cfg:async p=>{await http('PUT','/config/'+p.cat,{team:p.team,sla_hours:+p.sla});await sync()}};
const CH={info:'#1D4ED8',warn:'#B45309',err:'#B91C1C',ok:'#15803D'};
const CHS={received:CH.info,triaged:CH.info,assigned:CH.warn,in_progress:CH.warn,needs_info:CH.err,resolved:CH.ok};
const DS=[{elementType:'geometry',stylers:[{color:'#1c1c1c'}]},{elementType:'labels.text.fill',stylers:[{color:'#a3a39e'}]},{elementType:'labels.text.stroke',stylers:[{color:'#0a0a0a'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#0a0a0a'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#2c2c2c'}]}];
function loadGM(){const k=CFG.GOOGLE_MAPS_API_KEY;if(!k||window.google||document.getElementById('gmjs'))return;
 const redo=()=>{if(S.user){if(S.user.role==='resident')wz();refresh()}};
 window.nsMapReady=()=>{GMOK=true;redo()};
 window.gm_authFailure=()=>{GMOK=false;toast('Google Maps rejected the key. Showing the built-in map.');$$('.gmap').forEach(e=>{e._gm=null});redo()};
 const s=document.createElement('script');s.id='gmjs';s.async=true;s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(k)+'&callback=nsMapReady';s.onerror=()=>toast('Could not load Google Maps. Showing the built-in map.');document.head.appendChild(s)}
function drawMap(id,o){const el=document.getElementById(id);if(!el)return;const pins=(o.pins||[]).filter(x=>x.p);
 if(GMOK&&window.google&&google.maps){let m=el._gm;
  if(!m){el.classList.add('gmap');el.style.height=o.h||'340px';el.innerHTML='';
   m=el._gm=new google.maps.Map(el,{center:{lat:30.7333,lng:76.7794},zoom:12,minZoom:11,restriction:{latLngBounds:{north:30.80,south:30.66,west:76.68,east:76.86},strictBounds:false},styles:document.documentElement.dataset.mode==='dark'?DS:null,mapTypeControl:false,streetViewControl:false,fullscreenControl:false});
   if(o.pick)m.addListener('click',e=>el._onPick&&el._onPick({lat:+e.latLng.lat().toFixed(5),lng:+e.latLng.lng().toFixed(5)}));
   el._mk=[];if(o.lm)LM.forEach(l=>{const k=new google.maps.Marker({map:m,position:{lat:l.lat,lng:l.lng},title:l.n+' (approximate)',icon:{path:google.maps.SymbolPath.CIRCLE,scale:4,fillColor:'#777',fillOpacity:.9,strokeColor:'#fff',strokeWeight:1}});k.addListener('click',()=>el._onPick&&el._onPick({lat:l.lat,lng:l.lng,landmark:l.n}))})}
  el._onPick=o.onPick;el._mk.forEach(k=>k.setMap(null));
  el._mk=pins.map(x=>new google.maps.Marker({map:m,position:{lat:x.p.lat,lng:x.p.lng},title:x.l,icon:{path:google.maps.SymbolPath.CIRCLE,scale:8,fillColor:x.c,fillOpacity:1,strokeColor:'#fff',strokeWeight:2}}));
  if(pins.length){if(o.pick){m.panTo({lat:pins[0].p.lat,lng:pins[0].p.lng});if(m.getZoom()<14)m.setZoom(14)}else if(pins.length===1&&!el._c){el._c=1;m.setCenter({lat:pins[0].p.lat,lng:pins[0].p.lng});m.setZoom(15)}}
 }else{el._gm=null;el.classList.remove('gmap');el.style.height='';
  el.innerHTML=MAP(pins.map(x=>pinSvg(x.p,x.v,x.l)).join(''),!o.pick,o.lm);
  const sv=el.querySelector('svg');if(o.pick&&sv)sv.onclick=e=>{const r=sv.getBoundingClientRect();o.onPick({lat:+(BB.b-(e.clientY-r.top)/r.height*(BB.b-BB.a)).toFixed(5),lng:+(BB.c+(e.clientX-r.left)/r.width*(BB.d-BB.c)).toFixed(5)})}}}
const gl=k=>k.pin?`<a class="link" href="https://www.google.com/maps/search/?api=1&query=${k.pin.lat},${k.pin.lng}" target="_blank" rel="noopener">Open in Google Maps</a>`:'';
function clock(){const n=new Date(),o={timeZone:'Asia/Kolkata'};$('#clk').innerHTML='<b>'+n.toLocaleTimeString('en-IN',{...o,hour12:true})+' IST</b> · '+n.toLocaleDateString('en-IN',{...o,day:'2-digit',month:'short',year:'numeric'})+(VT.k!==1?' · <span class="warn">Demo clock ×'+VT.k+': '+fmt(S.t)+'</span>':'')}

/* ---------- engine (deterministic rules; simulated clock in hours) ---------- */
const LM=[['Sector 17 Plaza',30.7405,76.7830],['Sector 22 Market',30.7333,76.7680],['Sector 35 Market',30.7220,76.7570],['Sector 8 Market',30.7510,76.7850],['Rock Garden',30.7525,76.8100],['Sukhna Lake',30.7421,76.8188],['PGIMER',30.7646,76.7761],['Panjab University',30.7600,76.7680],['Capitol Complex',30.7585,76.8040],['ISBT Sector 43',30.7195,76.7480]].map(a=>({n:a[0],lat:a[1],lng:a[2]}));
const BB={a:30.66,b:30.80,c:76.68,d:76.86};
const inB=p=>p.lat>=BB.a&&p.lat<=BB.b&&p.lng>=BB.c&&p.lng<=BB.d;
const px=p=>({x:(p.lng-BB.c)/(BB.d-BB.c)*300,y:(BB.b-p.lat)/(BB.b-BB.a)*250});
const km=(a,b)=>Math.hypot((a.lat-b.lat)*111,(a.lng-b.lng)*96);
const S={user:null,n:0,pub:[],tc:0,fresh:false,tk:[],audit:[],keys:{},sel:null,dg:'',cfg:{waste:{n:'Uncollected waste',team:'Sanitation team',sla:24},light:{n:'Broken streetlight',team:'Electrical team',sla:48},road:{n:'Pothole or road damage',team:'Roads team',sla:72}}};
const VT={b:Date.now(),r:Date.now(),k:1};
Object.defineProperty(S,'t',{get:()=>(VT.b+(Date.now()-VT.r)*VT.k)/3.6e6});
function setSpeed(k){VT.b=VT.b+(Date.now()-VT.r)*VT.k;VT.r=Date.now();VT.k=k}
let STAFF=[['san01','Ravi (Sanitation)','waste'],['san02','Meena (Sanitation)','waste'],['ele01','Anil (Electrical)','light'],['ele02','Kiran (Electrical)','light'],['rod01','Harpreet (Roads)','road'],['rod02','Simran (Roads)','road']].map(a=>({id:a[0],name:a[1],cat:a[2]}));
const DEMOPW={staff:'staff123',admin:'admin123'};
const NEXT={received:['triaged'],triaged:['assigned'],assigned:['in_progress','needs_info'],in_progress:['resolved','needs_info'],needs_info:['in_progress'],resolved:[]};
const LBL={received:'Received',triaged:'Triaged',assigned:'Assigned',in_progress:'In progress',needs_info:'Needs more information',resolved:'Resolved'};
const PERM={guest:['track','public'],resident:['track','public','create','follow','mine','reopen'],staff:['track','public','queue','status','note'],admin:['track','public','queue','reassign','cfg','audit']};
const ESC=[[1,'Reminder sent to the assigned staff member'],[1.25,'Supervisor notified'],[1.5,'Department head notified']];
const fmt=t=>new Date(t*3.6e6).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})+' IST';
const feed=[];
function log(actor,msg){const r=fmt(S.t)+' · '+actor+' · '+msg;S.audit.unshift(r);feed.unshift(r);S.audit.length=Math.min(S.audit.length,80);feed.length=Math.min(feed.length,40)}
const ratio=k=>(S.t-k.t0)/k.sla;
const sla=k=>k.status==='resolved'?'done':ratio(k)>=1?'over':ratio(k)>=.75?'amber':'ok';
const norm=s=>{const m=String(s).match(/\d+/);return m?'ticket'+String(+m[0]).padStart(3,'0'):''};
const find=id=>S.tk.find(k=>k.id===norm(id));
const load=id=>S.tk.filter(k=>k.staff===id&&k.status!=='resolved').length;
const sfn=id=>(STAFF.find(s=>s.id===id)||{name:'Unassigned'}).name;
const loc=k=>[k.land,k.pin?k.pin.lat.toFixed(4)+', '+k.pin.lng.toFixed(4):''].filter(Boolean).join(' · ');
const H={
create(p,u){if(S.keys[p.key])return S.keys[p.key];const c=S.cfg[p.cat];
 if(!c)throw Error('422: unknown category');if(!p.consent)throw Error('422: consent is required');if((p.desc||'').trim().length<5)throw Error('422: add a few words of detail');
 if(!p.pin&&!(p.land||'').trim())throw Error('422: add a live location, a map pin or a landmark');if(p.pin&&!inB(p.pin))throw Error('422: location is outside the Chandigarh demo area');
 const sf=STAFF.filter(s=>s.cat===p.cat).sort((a,b)=>load(a.id)-load(b.id))[0];
 const k={id:'ticket'+String(++S.n).padStart(3,'0'),cat:p.cat,desc:p.desc.trim(),land:(p.land||'').trim(),pin:p.pin||null,owner:u.id,team:c.team,staff:sf.id,sla:c.sla,t0:S.t,status:'assigned',ev:[],notes:[],esc:0,fol:0,photos:(p.photos||[]).slice(0,3)};
 k.ev.push({t:S.t,s:'received',pub:'Report confirmed by the resident and added to the department console.',a:'system'},{t:S.t,s:'triaged',pub:'Category checked against department rules. Routed to '+c.team+'.',a:'system'},{t:S.t,s:'assigned',pub:'Assigned to a '+c.team+' staff member.',a:'system'});
 S.tk.push(k);S.keys[p.key]=k;log('system',k.id+' → department console → '+c.team+' → '+sf.name+' · deadline '+c.sla+' h');return k},
track:p=>find(p.id)||null,public:()=>S.tk,
follow(p){const k=find(p.id);if(k){k.fol++;log('resident',k.id+' followed')}return k},
mine:(p,u)=>S.tk.filter(k=>k.owner===u.id),
reopen(p,u){const k=find(p.id);if(!k||k.owner!==u.id)throw Error('403: this is not your ticket');if(k.status!=='resolved')throw Error('409: only resolved tickets can be reopened');k.status='assigned';k.t0=S.t;k.esc=0;k.tr=null;k.ev.push({t:S.t,s:'assigned',pub:'Reopened by the resident: '+((p.reason||'').trim()||'not fixed'),a:u.name});log(u.name,k.id+' reopened by resident');return k},
queue:(p,u)=>u.role==='staff'?S.tk.filter(k=>k.staff===u.id):S.tk,
status(p,u){const k=find(p.id);if(!k)throw Error('404: ticket not found');if(u.role==='staff'&&k.staff!==u.id)throw Error('403: this ticket is assigned to another staff member');
 if(!NEXT[k.status].includes(p.to))throw Error('409: invalid transition '+k.status+' to '+p.to);k.status=p.to;k.ev.push({t:S.t,s:p.to,pub:p.pub||('Status: '+LBL[p.to]),a:u.name});if(p.to==='resolved')k.tr=S.t;log(u.name,k.id+' → '+LBL[p.to]);return k},
note(p,u){const k=find(p.id);if(u.role==='staff'&&k.staff!==u.id)throw Error('403: not your ticket');k.notes.push({t:S.t,a:u.name,x:p.x});log(u.name,k.id+' internal note added');return k},
reassign(p,u){const k=find(p.id),sf=STAFF.find(s=>s.id===p.staff);if(!k||!sf||sf.cat!==k.cat)throw Error('422: choose a staff member from the same team');if(k.status==='resolved')throw Error('409: ticket is resolved');
 k.staff=sf.id;k.ev.push({t:S.t,s:k.status,pub:'Ticket reassigned within '+k.team+'.',a:u.name});log(u.name,k.id+' reassigned to '+sf.name);return k},
cfg(p,u){const c=S.cfg[p.cat];if(!(p.sla>0)||!p.team.trim())throw Error('422: team and deadline hours are required');c.team=p.team.trim();c.sla=+p.sla;log(u.name,'routing for '+c.n+' set to '+c.team+', '+c.sla+' h');return c},
audit:()=>S.audit};
const role=()=>S.user?S.user.role:'guest';
const AIURL=CFG.aiAssignUrl===undefined?'/.netlify/functions/assign':CFG.aiAssignUrl;
function aiWrap(a,k){if(a==='create'&&k&&!k._ai){k._ai=1;setTimeout(()=>aiAssign(k),80)}return k}
async function aiAssign(k){if(SERVER||!AIURL||location.protocol==='file:')return;const was=k.staff,
 st=STAFF.filter(s=>s.cat===k.cat).map(s=>({id:s.id,name:s.name,open:S.tk.filter(x=>x!==k&&x.staff===s.id&&x.status!=='resolved').length,overdue:S.tk.filter(x=>x!==k&&x.staff===s.id&&x.status!=='resolved'&&S.t-x.t0>x.sla).length}));
 if(st.length<2)return;const c=new AbortController(),tm=setTimeout(()=>c.abort(),8000);
 try{const r=await fetch(AIURL,{method:'POST',signal:c.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({cat:k.cat,desc:k.desc,land:k.land,staff:st})});if(!r.ok)return;const j=await r.json();
  if(!st.some(s=>s.id===j.staff_id)||k.staff!==was||k.status!=='assigned')return;k.staff=j.staff_id;
  k.notes.push({t:S.t,a:'AI assistant (Gemini)',x:'Assigned to '+sfn(j.staff_id)+'. '+(j.reason||'')});log('AI assistant (Gemini)',k.id+' assigned to '+sfn(j.staff_id));refresh()}catch(e){}finally{clearTimeout(tm)}}
const aiTag=k=>{const n=(k.notes||[]).slice().reverse().find(x=>/^AI assistant/.test(x.a));return n?`<br><small class="ai"><span class="aipill">AI</span> ${esc(n.x)}</small>`:''};
function api(a,p){const r=role();if(!PERM[r].includes(a))throw Error('403: '+r+' cannot call '+a);return SERVER?SV[a](p||{}):aiWrap(a,H[a](p||{},S.user||{role:'guest',name:'guest'}))}
function tick(){if(SERVER){if(++S.tc%5===0)sync().catch(x=>{if(/^401/.test(x.message)){$('#so').click();toast('Your session ended. Sign in again.')}});refresh();return}S.tk.forEach(k=>{if(k.status==='resolved')return;const r=ratio(k);while(k.esc<3&&r>=ESC[k.esc][0]){log('system',k.id+' · escalation: '+ESC[k.esc][1]+' (ticket stays open)');k.esc++}});refresh()}
let timer;const run=()=>{clearInterval(timer);timer=setInterval(tick,1000)};
function suggest(t){const m={waste:/garbage|waste|dustbin|trash|kachra|litter|bin/i,light:/light|lamp|dark|bulb/i,road:/pothole|road|crack|pit|asphalt/i};for(const c in m)if(m[c].test(t))return c;return null}
/* synthetic demo tickets */
const SYS={role:'system',id:'seed',name:'Demo data'};
if(!SERVER)[['road','Deep pothole on service road','Sector 17 Plaza',80,1],['waste','Bins not emptied for days','Sector 22 Market',20,0],['light','Streetlight out on footpath','Sector 35 Market',30,1],['road','Cracked road edge','Sector 8 Market',5,0]].forEach((s,i)=>{const l=LM.find(x=>x.n===s[2]),k=H.create({key:'seed'+i,cat:s[0],desc:s[1],land:s[2],pin:{lat:l.lat,lng:l.lng},consent:true},SYS);k.t0=S.t-s[3];if(s[4])H.status({id:k.id,to:'in_progress'},{role:'system',name:sfn(k.staff)})});
S.audit=[];feed.length=0;if(!SERVER)log('system','Engine started with 4 simulated demo tickets');

/* ---------- reviewed sources ---------- */
const SRC=[{id:'S1',t:'How NagarSetu reports work',kw:'report file create ticket how make sign',a:'Sign in as a resident, choose a category, add details, share your live location or type a landmark, then review and confirm. No ticket exists until you tap Confirm.'},
{id:'S2',t:'Tracking a ticket',kw:'track status number id follow progress ticket',a:'Enter your ticket number, for example ticket001, under Track a ticket. You see the status and the public notes from staff.'},
{id:'S3',t:'Deadlines and escalation',kw:'deadline sla escalate overdue long time late staff assigned',a:'Every confirmed ticket goes to the department console, then to a staff member in the matching team. The department sets the deadline. If it runs late, a human supervisor is notified. Nothing is closed or rejected automatically.'},
{id:'S4',t:'Emergencies',kw:'emergency urgent fire accident ambulance',a:'NagarSetu is not an emergency service. In an emergency, contact the official emergency services directly.'}];
$('#ask').onclick=()=>{const q=$('#q').value.toLowerCase().split(/\W+/).filter(w=>w.length>2);let best=null,bs=0;SRC.forEach(s=>{const n=q.filter(w=>s.kw.includes(w)).length;if(n>bs){bs=n;best=s}});
$('#ans').innerHTML=best?`<p style="margin:0 0 8px">${esc(best.a)}</p><div class="card" style="padding:10px;font-size:13px"><b>Source ${best.id}: ${esc(best.t)}</b><br>Owner: NagarSetu team · Last verified 5 Oct 2026 · <span class="demo">Prototype content</span></div>`:`<p class="warn" style="margin:0">I cannot verify an answer from the reviewed sources. You can still use Report an issue and staff will see it.</p>`};

/* ---------- map ---------- */
const COL={received:'var(--info)',triaged:'var(--info)',assigned:'var(--warn)',in_progress:'var(--warn)',needs_info:'var(--err)',resolved:'var(--ok)'};
function MAP(pins,ro,lm){let b='';for(let r=0;r<3;r++)for(let c=0;c<4;c++)b+=`<rect x="${12+c*72}" y="${12+r*80}" width="60" height="68" rx="6" fill="var(--sf)" stroke="var(--bd)"/>`;
if(lm)b+=LM.map(l=>{const p=px(l);return `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--mu)"><title>${esc(l.n)} (approximate)</title></circle>`}).join('');
return `<svg class="map" viewBox="0 0 300 250" ${ro?'':'id="mapc"'} role="img" aria-label="Map of Chandigarh demo area">${b}${pins}</svg>`}
const pinSvg=(p,col,l)=>{if(!p)return '';const q=px(p);return `<circle cx="${q.x}" cy="${q.y}" r="7" fill="${col}" stroke="#fff" stroke-width="2"><title>${esc(l||'')}</title></circle>`};

/* ---------- resident wizard ---------- */
const W={step:1,cat:'',desc:'',land:'',pin:null,photos:[],consent:false,key:Math.random().toString(36).slice(2)+Date.now()};
const ptxt=()=>W.pin?(inB(W.pin)?'Pin at '+W.pin.lat.toFixed(5)+', '+W.pin.lng.toFixed(5)+(W.src?' ('+W.src+')':''):'<span class="err">This location is outside the Chandigarh demo area. Pick a point on the map.</span>'):'No pin yet.';
function upd3(){const p=$('#pt');if(p)p.innerHTML=ptxt();drawMap('mb',{pins:[{p:W.pin,c:CH.err,v:'var(--err)',l:'Your pin'}],pick:true,lm:true,h:'320px',onPick:q=>{W.pin={lat:q.lat,lng:q.lng};W.src=q.landmark?'landmark, approximate':'map tap';if(q.landmark){W.land=q.landmark;const i=$('#lm');if(i)i.value=q.landmark}upd3()}})}
let REC=null;
const ICO={mic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'};
const SPL={en:'en-IN',hi:'hi-IN',pa:'pa-IN'},SPN={en:'English',hi:'Hindi',pa:'Punjabi'};
function photoBlock(){const full=W.photos.length>=3;return `<div class="ph"><div class="phh"><b>Photos of the problem</b><span class="mu" id="pc" style="font-size:14px">${W.photos.length} of 3 added</span></div><label class="dz${full?' full':''}" id="dz" tabindex="0">${ICO.cam}<span class="dzt">Tap to take or choose photos</span><span class="dzs">or drag and drop here. JPG or PNG, up to 3.</span><input type="file" id="pf" accept="image/*" multiple hidden></label><div class="thumbs" id="th">${thumbsHTML()}</div><p class="mu pn">Optional. Photos are shrunk on your device, hidden location data is removed, and only the assigned team can see them.</p></div>`}
function thumbsHTML(){return W.photos.map((s,i)=>`<figure class="tn"><img src="${s}" alt="Photo ${i+1} of the problem"><button type="button" class="x" data-rm="${i}" aria-label="Remove photo ${i+1}">&times;</button></figure>`).join('')}
function shrink(f){return new Promise((ok,no)=>{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>{const s=Math.min(1,1280/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*s);c.height=Math.round(i.height*s);c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);ok(c.toDataURL('image/jpeg',.72))};i.onerror=()=>{URL.revokeObjectURL(u);no(Error('bad'))};i.src=u})}
function drawThumbs(){const th=$('#th');if(!th)return;th.innerHTML=thumbsHTML();$('#pc').textContent=W.photos.length+' of 3 added';$('#dz').classList.toggle('full',W.photos.length>=3);$$('[data-rm]').forEach(b=>b.onclick=()=>{W.photos.splice(+b.dataset.rm,1);drawThumbs()})}
async function addPhotos(files){const imgs=[...files].filter(f=>/^image\//.test(f.type)),room=3-W.photos.length;if(!imgs.length)return toast(tx('Please choose image files only.'));if(imgs.length>room)toast(tx('Only 3 photos can be added.'));for(const f of imgs.slice(0,room)){try{const d=await shrink(f);if(d.length>450000)toast(tx('That photo is too large.'));else W.photos.push(d)}catch(e){toast(tx('Could not read that photo.'))}}drawThumbs()}
function setMic(on){const m=$('#mic');if(!m)return;m.classList.toggle('on',on);m.setAttribute('aria-pressed',on);$('#mict').textContent=tx(on?'Listening... tap to stop':'Speak instead');const v=$('#vs');if(v)v.textContent=on?tx('Listening in')+' '+SPN[window.NSI.lang]+'. '+tx('Speak now.'):''}
function voice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(REC){REC.stop();return}const r=new SR(),d=$('#d'),base=d.value.trim();let fin='';REC=r;r.lang=SPL[window.NSI.lang]||'en-IN';r.interimResults=true;r.continuous=true;
 r.onstart=()=>setMic(true);
 r.onresult=e=>{let it='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)fin+=t+' ';else it+=t}const x=$('#d');if(!x)return;x.value=(base?base+' ':'')+fin+it;W.desc=x.value;$('#sg').innerHTML=sgt(suggest(W.desc))};
 r.onerror=e=>{const v=$('#vs');if(v)v.textContent=tx(e.error==='not-allowed'||e.error==='service-not-allowed'?'Microphone access is blocked. Allow it in your browser settings.':e.error==='no-speech'?'No speech heard. Tap the button and try again.':'Voice typing stopped. You can type instead.')};
 r.onend=()=>{REC=null;const x=$('#d');if(x){x.value=x.value.trim();W.desc=x.value}const m=$('#mic');if(m){m.classList.remove('on');m.setAttribute('aria-pressed','false');$('#mict').textContent=tx('Speak instead')}};
 try{r.start()}catch(e){REC=null}}
function bindStep2(){const m=$('#mic');if(!m)return;const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){m.disabled=true;$('#vs').textContent=tx('Voice typing is not available in this browser. Try Chrome or Edge, or type instead.')}else{m.onclick=voice;$('#vs').textContent=tx('Voice typing uses your browser speech service and may send audio to it.')}
 const dz=$('#dz'),pf=$('#pf');dz.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pf.click()}};pf.onchange=()=>{addPhotos(pf.files);pf.value=''};
 ['dragenter','dragover'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>addPhotos(e.dataTransfer.files));drawThumbs()}
function lightbox(s){const o=document.createElement('div');o.className='lb';o.innerHTML=`<img src="${s}" alt="Full size photo"><button class="x" aria-label="Close">&times;</button>`;o.onclick=()=>o.remove();document.body.appendChild(o)}
async function loadPh(k){const box=$('#phs');if(!box)return;let l=k.photos||[];if(SERVER&&!l.length&&k.np){try{l=(await http('GET','/tickets/'+k.id+'/photos')).photos}catch(e){}}if(!l.length||$('#phs')!==box)return;box.innerHTML='<b class="phl">Photos from the resident</b><div class="thumbs">'+l.map((s,i)=>`<button type="button" class="tn" data-lb="${i}" aria-label="Open photo ${i+1}"><img src="${s}" alt="Photo ${i+1} of the problem"></button>`).join('')+'</div>';box.querySelectorAll('[data-lb]').forEach(b=>b.onclick=()=>lightbox(l[b.dataset.lb]))}
function wz(){if(REC){try{REC.stop()}catch(e){}}const st=['Category','Details','Place','Review'];let h=`<div class="step">${st.map((s,i)=>`<b class="${W.step===i+1?'on':''}">${i+1}. ${s}</b>`).join('')}</div>`;
if(W.step===1)h+=Object.keys(S.cfg).map(c=>`<button class="opt" data-cat="${c}" aria-pressed="${W.cat===c}">${S.cfg[c].n}</button>`).join('');
if(W.step===2){const sg=suggest(W.desc);h+=`<div class="fh"><label for="d">What is the issue?</label><button type="button" class="mic" id="mic" aria-pressed="false">${ICO.mic}<span id="mict">Speak instead</span></button></div><textarea id="d">${esc(W.desc)}</textarea><div id="vs" class="vs" aria-live="polite"></div><div id="sg" class="mu" style="font-size:14px;margin-top:6px">${sgt(sg)}</div>${photoBlock()}`}
if(W.step===3)h+=`<button class="btn sm" id="loc">📍 Use my live location</button><label for="lm" style="display:block;margin-top:10px">Or type a landmark</label><input type="text" id="lm" list="lml" autocomplete="off" value="${esc(W.land)}" placeholder="e.g. Sector 22 Market"><datalist id="lml">${LM.map(l=>`<option value="${l.n}">`).join('')}</datalist><p class="mu" id="pt" style="margin:8px 0 6px;font-size:14px">${ptxt()}</p><div id="mb"></div><small class="mu">Tap the map to move the pin. Grey dots are landmarks, with approximate positions. Check them before real use.</small>`;
if(W.step===4){const dup=(SERVER?S.pub:S.tk).find(k=>k.cat===W.cat&&k.status!=='resolved'&&S.t-k.t0<72&&((W.pin&&k.pin&&km(W.pin,k.pin)<.3)||(W.land&&k.land&&k.land.toLowerCase()===W.land.toLowerCase())));
 h+=`<div class="card" style="background:var(--s2)"><b>${S.cfg[W.cat].n}</b><p>${esc(W.desc)}</p><small>${esc(loc(W))}</small>${W.photos.length?`<div class="thumbs sm">${W.photos.map((s,i)=>`<figure class="tn"><img src="${s}" alt="Photo ${i+1}"></figure>`).join('')}</div>`:''}</div>${dup?`<p class="warn">A similar issue may already be reported: <b>${dup.id}</b>. <button class="btn sm" id="fol" data-id="${dup.id}">Follow it instead</button> You can still continue. Nothing is merged automatically.</p>`:''}<label style="display:flex;gap:8px;margin:10px 0"><input type="checkbox" id="cs" ${W.consent?'checked':''}> I confirm this report. I understand this is a simulated demo ticket.</label>`}
h+=`<div style="display:flex;gap:8px;margin-top:12px">${W.step>1?'<button class="btn" id="bk">Back</button>':''}${W.step<4?'<button class="btn p" id="nx">Next</button>':'<button class="btn p" id="cf">Confirm</button>'}</div>`;$('#wz').innerHTML=h;
$$('[data-cat]').forEach(b=>b.onclick=()=>{W.cat=b.dataset.cat;wz()});if($('#mb'))upd3();
bindStep2();if($('#d'))$('#d').oninput=e=>{W.desc=e.target.value;$('#sg').innerHTML=sgt(suggest(W.desc))};
if($('#use'))$('#use').onclick=()=>{W.cat=suggest($('#d').value);W.desc=$('#d').value;wz()};
if($('#lm'))$('#lm').oninput=e=>{W.land=e.target.value;const m=LM.find(l=>l.n.toLowerCase()===W.land.trim().toLowerCase());if(m){W.pin={lat:m.lat,lng:m.lng};W.src='landmark, approximate';upd3()}};
if($('#loc'))$('#loc').onclick=()=>{if(!navigator.geolocation)return toast('Live location is not available. Use the map or type a landmark.');$('#loc').textContent='Locating…';navigator.geolocation.getCurrentPosition(p=>{W.pin={lat:+p.coords.latitude.toFixed(5),lng:+p.coords.longitude.toFixed(5)};W.src='live location';$('#loc').textContent='📍 Use my live location';upd3();if(!inB(W.pin))toast('You appear to be outside the Chandigarh demo area.')},()=>{$('#loc').textContent='📍 Use my live location';toast('Location is blocked or unavailable. Use the map or type a landmark.')},{enableHighAccuracy:true,timeout:10000})};
if($('#fol'))$('#fol').onclick=async e=>{try{await api('follow',{id:e.target.dataset.id});toast('You are following '+e.target.dataset.id);$('#tid').value=e.target.dataset.id}catch(x){toast(x.message)}};
if($('#cs'))$('#cs').onchange=e=>W.consent=e.target.checked;
if($('#bk'))$('#bk').onclick=()=>{keep();W.step--;wz()};
if($('#nx'))$('#nx').onclick=()=>{keep();if(W.step===1&&!W.cat)return toast('Choose a category first');if(W.step===2&&W.desc.trim().length<5)return toast('Add a few words of detail');if(W.step===3&&!W.pin&&!W.land.trim())return toast('Share your location, drop a pin or type a landmark');if(W.step===3&&W.pin&&!inB(W.pin))return toast('Pick a point inside the Chandigarh demo area');W.step++;wz()};
if($('#cf'))$('#cf').onclick=async()=>{try{const k=await api('create',{key:W.key,cat:W.cat,desc:W.desc,land:W.land,pin:W.pin,photos:W.photos,consent:W.consent});$('#wz').innerHTML=`<p class="ok"><b>Ticket ${k.id} created.</b></p><p>It is now in the department console and assigned to the ${esc(k.team)}. Deadline: ${k.sla} hours. Track it with the number <b>${k.id}</b>. This record is simulated.</p><button class="btn p" id="nw">Report another issue</button>`;$('#tid').value=k.id;$('#nw').onclick=()=>{Object.assign(W,{step:1,cat:'',desc:'',land:'',pin:null,photos:[],src:'',consent:false,key:Math.random().toString(36).slice(2)+Date.now()});wz()};showTrack();refresh()}catch(x){toast(x.message)}}}
const sgt=sg=>sg?`AI suggests: <b>${S.cfg[sg].n}</b> ${sg!==W.cat?'<button class="btn sm" id="use">Use suggestion</button>':'(matches your choice)'}`:'AI has no confident suggestion. Your choice stays as it is.';
function keep(){if($('#d'))W.desc=$('#d').value;if($('#lm'))W.land=$('#lm').value}
const slaPill=k=>({done:'<span class="pill ok">✔ Resolved</span>',ok:'<span class="pill ok">✔ On track</span>',amber:'<span class="pill warn">⚠ Due soon</span>',over:'<span class="pill err">⛔ Overdue</span>'}[sla(k)]);
const left=k=>{if(k.status==='resolved')return '';const x=k.t0+k.sla-S.t,a=Math.abs(x)*3600,d=Math.floor(a/86400),h=Math.floor(a%86400/3600),m=Math.floor(a%3600/60),sc=Math.floor(a%60);return (d?d+'d ':'')+h+'h '+String(m).padStart(2,'0')+'m '+String(sc).padStart(2,'0')+'s '+(x>=0?'left':'late')};
async function showTrack(){let k;try{k=await api('track',{id:$('#tid').value})}catch(x){return toast(x.message)}$('#tout').innerHTML=k?`<p style="margin:0"><b>${k.id}</b> · ${S.cfg[k.cat].n} · ${LBL[k.status]} ${slaPill(k)} <span class="mu">${left(k)}</span></p><ul class="tl">${k.ev.slice().reverse().map(e=>`<li><b>${LBL[e.s]}</b> <small>${fmt(e.t)}</small><br>${esc(e.pub)}</li>`).join('')}</ul>${k.status==='resolved'&&role()==='resident'&&api('mine').some(x=>x.id===k.id)?'<button class="btn sm" id="rop" style="margin-top:8px">Not fixed? Reopen this ticket</button>':''}`:'<p class="warn">No ticket found with that number. Try a number like ticket001.</p>';
const rb=$('#rop');if(rb)rb.onclick=async()=>{try{const why=prompt(tx('Why is it not fixed? (optional)'))||'';await api('reopen',{id:k.id,reason:why});toast(tx('Ticket reopened. The deadline clock has restarted.'));showTrack();refresh()}catch(x){toast(x.message)}}}
$('#trk').onclick=showTrack;
$('#try').onclick=async()=>{try{if(SERVER)await http('GET','/queue');else api('queue');toast('Not blocked. This should not happen.')}catch(x){toast(x.message+' (blocked as expected)')}};
function mine(){const l=api('mine');$('#mine').innerHTML=l.length?l.map(k=>`<button class="opt" data-tk="${k.id}">${k.id} · ${S.cfg[k.cat].n} · ${LBL[k.status]}</button>`).join(''):'<p class="mu" style="margin:0">You have not reported anything yet.</p>';$$('[data-tk]').forEach(b=>b.onclick=()=>{$('#tid').value=b.dataset.tk;showTrack()})}

/* ---------- staff console (own tickets only) ---------- */
const stOrder=k=>k.status==='resolved'?-1:ratio(k);
const sig=k=>k.status+k.ev.length+k.notes.length+k.staff;
function staff(){$('#sh').textContent=S.user.name+' · '+S.cfg[S.user.cat].team;const rows=api('queue').sort((a,b)=>stOrder(b)-stOrder(a));
$('#qt').innerHTML='<tr><th>Ticket</th><th>Issue</th><th>Location</th><th>Status</th><th>Deadline</th></tr>'+(rows.map(k=>`<tr class="row" tabindex="0" data-id="${k.id}" aria-selected="${S.sel===k.id}"><td>${k.id}</td><td>${esc(k.desc)}</td><td>${esc(loc(k))}</td><td>${LBL[k.status]}</td><td>${slaPill(k)}<br><small class="mu">${left(k)}${k.esc?' · escalation level '+k.esc:''}</small></td></tr>`).join('')||'<tr><td colspan="5" class="mu">No tickets assigned to you right now.</td></tr>');
$$('#qt .row').forEach(r=>{r.onclick=()=>{S.sel=r.dataset.id;detail();staff()};r.onkeydown=e=>{if(e.key==='Enter')r.onclick()}})}
function detail(){const k=find(S.sel);if(!k)return;S.dg=sig(k);const nx=NEXT[k.status];
$('#det').innerHTML=`<h3>${k.id} <span class="demo">simulated</span></h3><p style="margin:0">${esc(k.desc)}</p><p class="mu" style="margin:4px 0">${esc(loc(k))||'No location'} · ${k.fol} follower(s)</p><div id=\"phs\"></div>${gl(k)}${k.pin?'<div id="dm"></div>':''}
${nx.length?`<label for="pn" style="display:block;margin-top:10px">Public note (residents see this)</label><input type="text" id="pn"><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${nx.map(n=>`<button class="btn sm p" data-to="${n}">${LBL[n]}</button>`).join('')}</div>`:'<p class="ok">Resolved. No further transitions.</p>'}
<label for="inn" style="display:block;margin-top:10px">Internal note (staff only)</label><input type="text" id="inn"><button class="btn sm" id="adn" style="margin-top:6px">Add note</button>
<ul class="tl">${k.ev.slice().reverse().map(e=>`<li><b>${LBL[e.s]}</b> <small>${fmt(e.t)} · ${esc(e.a)}</small><br>${esc(e.pub)}</li>`).join('')}${k.notes.map(n=>`<li class="mu">🔒 ${esc(n.x)} <small>${fmt(n.t)} · ${esc(n.a)}</small></li>`).join('')}</ul>`;
loadPh(k);if(k.pin)drawMap('dm',{pins:[{p:k.pin,c:CH.err,v:'var(--err)',l:k.id}],h:'220px'});$$('[data-to]').forEach(b=>b.onclick=async()=>{try{await api('status',{id:k.id,to:b.dataset.to,pub:$('#pn').value});detail();refresh()}catch(x){toast(x.message)}});
$('#adn').onclick=async()=>{if($('#inn').value.trim()){try{await api('note',{id:k.id,x:$('#inn').value});detail();refresh()}catch(x){toast(x.message)}}}}

/* ---------- department console ---------- */
function dept(){const rows=api('queue').slice().sort((a,b)=>stOrder(b)-stOrder(a));
$('#dt').innerHTML='<tr><th>Ticket</th><th>Issue</th><th>Location</th><th>Status</th><th>Deadline</th><th>Assigned staff</th></tr>'+rows.map(k=>`<tr><td>${k.id}</td><td>${S.cfg[k.cat].n}<br><small class="mu">${esc(k.desc)}</small></td><td>${esc(loc(k))}<br>${gl(k)}</td><td>${LBL[k.status]}</td><td>${slaPill(k)}<br><small class="mu">${left(k)}${k.esc?' · escalation level '+k.esc:''}</small></td><td><select data-rs="${k.id}" aria-label="Assign ${k.id}" ${k.status==='resolved'?'disabled':''}>${STAFF.filter(s=>s.cat===k.cat).map(s=>`<option value="${s.id}" ${s.id===k.staff?'selected':''}>${s.name}</option>`).join('')}</select>${aiTag(k)}</td></tr>`).join('');
$$('[data-rs]').forEach(s=>s.onchange=async()=>{try{await api('reassign',{id:s.dataset.rs,staff:s.value});toast('Reassigned')}catch(x){toast(x.message)}refresh()});
$('#wl').innerHTML='<table>'+STAFF.map(s=>`<tr><td>${s.name}</td><td>${load(s.id)} open</td><td class="${S.tk.some(k=>k.staff===s.id&&sla(k)==='over')?'err':'mu'}">${S.tk.filter(k=>k.staff===s.id&&sla(k)==='over').length} overdue</td></tr>`).join('')+'</table>';
drawMap('am',{pins:S.tk.map(k=>({p:k.pin,c:CHS[k.status],v:COL[k.status],l:k.id+' · '+S.cfg[k.cat].n+' · '+LBL[k.status]})),h:'380px'});const a=S.tk,res=a.filter(k=>k.status==='resolved');
$('#mt').innerHTML=`<table><tr><td>Tickets (simulated)</td><td><b>${a.length}</b></td></tr><tr><td>Open</td><td><b>${a.length-res.length}</b></td></tr><tr><td>Overdue</td><td><b class="err">${a.filter(k=>sla(k)==='over').length}</b></td></tr><tr><td>Escalated</td><td><b>${a.filter(k=>k.esc).length}</b></td></tr><tr><td>Resolved</td><td><b>${res.length}</b></td></tr><tr><td>Average time to resolve</td><td><b>${res.length?Math.round(res.reduce((s,k)=>s+k.tr-k.t0,0)/res.length)+' h':'n/a'}</b></td></tr></table><small class="mu">Computed from demo tickets only. Not evidence of real-world performance.</small>`;
$('#au').innerHTML=api('audit').map(f=>`<div>${esc(f)}</div>`).join('')}
function admin(){$('#rt').innerHTML=Object.keys(S.cfg).map(c=>`<div style="margin-bottom:12px"><b>${S.cfg[c].n}</b><br><input type="text" id="t_${c}" value="${esc(S.cfg[c].team)}" aria-label="Team for ${S.cfg[c].n}" style="width:55%"> <input type="number" id="s_${c}" value="${S.cfg[c].sla}" min="1" style="width:80px" aria-label="Deadline hours"> h <button class="btn sm" data-sv="${c}">Save</button></div>`).join('');
$$('[data-sv]').forEach(b=>b.onclick=async()=>{try{await api('cfg',{cat:b.dataset.sv,team:$('#t_'+b.dataset.sv).value,sla:$('#s_'+b.dataset.sv).value});toast('Rule saved for new tickets')}catch(x){toast(x.message)}refresh()});dept()}
function pubmap(){drawMap('pm',{pins:api('public').map(k=>({p:k.pin,c:CHS[k.status],v:COL[k.status],l:S.cfg[k.cat].n+' · '+LBL[k.status]})),h:'340px'})}
function refresh(){if($('#app').hidden||!S.user)return;clock();$('#fd').innerHTML=feed.map(f=>`<div>${esc(f)}</div>`).join('');const r=S.user.role;
if(r==='resident'){pubmap();mine();if($('#tout').innerHTML&&(!SERVER||S.fresh)){S.fresh=false;showTrack()}}
if(r==='staff'){staff();const k=find(S.sel);if(k&&sig(k)!==S.dg)detail()}
if(r==='admin'&&!(document.activeElement&&document.activeElement.closest('#dt')))dept()}
$('#spd').onchange=e=>{setSpeed(+e.target.value);refresh()};

/* ---------- sign in ---------- */
let AT='resident';
function authView(){$('#v-auth').hidden=false;$('#dash').hidden=true;
$('#atabs').innerHTML=[['resident','Resident'],['staff','Staff'],['admin','Department admin']].map(t=>`<button data-at="${t[0]}" aria-pressed="${AT===t[0]}">${t[1]}</button>`).join('');
const L=(i,t,x)=>`<label for="${i}" style="display:block;margin-top:8px">${t}</label>${x}`;
const f=SERVER?{resident:L('a1','Mobile number (10 digits)','<input type="text" id="a1" inputmode="numeric" maxlength="10" autocomplete="tel">')+L('a3','Your name (for a new account)','<input type="text" id="a3" autocomplete="name">')+L('a2','Password (8 or more characters)','<input type="password" id="a2" autocomplete="current-password">'),
 staff:L('a1','Staff ID','<input type="text" id="a1" autocapitalize="off">')+L('a2','Password','<input type="password" id="a2">'),
 admin:L('a1','Username','<input type="text" id="a1" autocapitalize="off">')+L('a2','Password','<input type="password" id="a2">')}[AT]
:{resident:`<label for="a1">Your name</label><input type="text" id="a1" autocomplete="name"><label for="a2" style="display:block;margin-top:8px">Mobile number (10 digits)</label><input type="text" id="a2" inputmode="numeric" maxlength="10"><p class="mu" style="font-size:13px">Demo sign-in with no real OTP. Use a made-up number.</p>`,
staff:`<label for="a1">Staff ID</label><input type="text" id="a1" autocapitalize="off"><label for="a2" style="display:block;margin-top:8px">Password</label><input type="password" id="a2"><p class="mu" style="font-size:13px">Demo IDs: san01, san02 (waste) · ele01, ele02 (streetlights) · rod01, rod02 (roads). Password: staff123</p>`,
admin:`<label for="a1">Username</label><input type="text" id="a1" autocapitalize="off"><label for="a2" style="display:block;margin-top:8px">Password</label><input type="password" id="a2"><p class="mu" style="font-size:13px">Demo account: admin / admin123</p>`}[AT];
$('#af').innerHTML=f;$('#ae').textContent='';$('#rg').hidden=!(SERVER&&AT==='resident');$('#go').textContent=SERVER&&AT==='resident'?'Sign in':'Sign in';
$$('[data-at]').forEach(b=>b.onclick=()=>{AT=b.dataset.at;authView()});$('#a2').onkeydown=e=>{if(e.key==='Enter')signIn()}}
async function signIn(reg){const a=$('#a1').value.trim(),b=$('#a2').value,bad=m=>$('#ae').textContent=m;
if(SERVER){try{const r=reg===true?await http('POST','/auth/register',{name:$('#a3').value.trim(),mobile:a,password:b}):await http('POST','/auth/login',{role:AT,identifier:a,password:b});
 TOKEN=r.token;try{sessionStorage.setItem('ns-token',TOKEN)}catch(e){}S.user=r.user;await sync();enter()}catch(x){bad(x.message.replace(/^\d+: /,''))}return}
let u;
if(AT==='resident'){if(a.length<2||!/^\d{10}$/.test(b))return bad('Enter your name and a 10-digit mobile number.');u={role:'resident',id:'r'+b,name:a}}
if(AT==='staff'){const s=STAFF.find(x=>x.id===a.toLowerCase());if(!s||b!==DEMOPW.staff)return bad('Staff ID or password is not right.');u={role:'staff',id:s.id,name:s.name,cat:s.cat}}
if(AT==='admin'){if(a.toLowerCase()!=='admin'||b!==DEMOPW.admin)return bad('Username or password is not right.');u={role:'admin',id:'admin',name:'Department admin'}}
S.user=u;log(u.role,u.name+' signed in');enter()}
$('#go').onclick=()=>signIn();$('#rg').onclick=()=>signIn(true);
function enter(){$('#v-auth').hidden=true;$('#dash').hidden=false;const u=S.user,r=u.role;['resident','staff','admin'].forEach(x=>$('#v-'+x).hidden=x!==r);
$('#who').hidden=$('#so').hidden=false;{const rn={resident:'Resident',staff:'Staff',admin:'Department admin'}[r];$('#who').textContent=u.name===rn?rn:u.name+' · '+rn}S.sel=null;S.dg='';$('#spd').disabled=SERVER;
if(r==='resident')wz();if(r==='admin')admin();run();refresh()}
$('#so').onclick=()=>{S.user=null;TOKEN='';try{sessionStorage.removeItem('ns-token')}catch(e){}if(SERVER){S.tk=[];S.pub=[]}$('#who').hidden=$('#so').hidden=true;clearInterval(timer);authView()};
function openApp(){$('#landing').hidden=true;$('#app').hidden=false;document.body.dataset.view='app';scrollTo(0,0);loadGM();restore().then(()=>S.user?enter():authView())}
$$('[data-start]').forEach(b=>b.onclick=openApp);
$('#home').onclick=()=>{$('#app').hidden=true;$('#landing').hidden=false;document.body.dataset.view='landing';clearInterval(timer);scrollTo(0,0)};
$('#back').onclick=$('#back2').onclick=$('#home').onclick;

/* ---------- dark mode ---------- */
function setMode(m){document.documentElement.dataset.mode=m;try{localStorage.setItem('ns-mode',m)}catch(e){}$('#mode').textContent=m==='dark'?'☀ Light':'🌙 Dark';$('#mode').setAttribute('aria-pressed',m==='dark');$$('.gmap').forEach(e=>e._gm&&e._gm.setOptions({styles:m==='dark'?DS:null}));on3d()}
$('#mode').onclick=()=>setMode(document.documentElement.dataset.mode==='dark'?'light':'dark');
setMode(document.documentElement.dataset.mode||'light');


/* ---------- landing: how to use, 3D tilt cards, staggered reveal ---------- */
const HTU={resident:[['Sign in','Choose Resident, then enter your name and a 10-digit mobile number.'],['Report','Pick a category, describe the issue, then share your live location, tap the map or type a landmark.'],['Confirm','Review the summary and tick the confirm box. You get a ticket number like ticket001.'],['Track','Enter the number under Track a ticket, or open My tickets, and read the status and staff notes.']],
staff:[['Sign in','Use your staff ID and password. Your team comes from your ID.'],['Open your queue','You see only tickets assigned to you, sorted by how close each is to its deadline.'],['Update the ticket','Move it to In progress, add a public note for the resident, or ask for more information.'],['Resolve','Mark it Resolved with a note. The resident sees it on the timeline.']],
admin:[['Sign in','Use the department admin account.'],['Watch the console','Every confirmed ticket lands here with its deadline clock, location and assigned staff member.'],['Balance the work','Check staff workload and reassign a ticket to another person on the same team.'],['Set rules, review','Edit routing and deadlines for new tickets, and read the audit log.']]};
let HR='resident';const COLS=['c1','c2','c3','c4'];
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
function tilt(){if(reduce)return;$$('.t3').forEach(el=>{if(el._t)return;el._t=1;
 el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.setProperty('--ry',(x*16)+'deg');el.style.setProperty('--rx',(-y*16)+'deg')});
 el.addEventListener('pointerleave',()=>{el.style.setProperty('--ry','0deg');el.style.setProperty('--rx','0deg')})})}
function htu(){$('#htab').innerHTML=[['resident','Resident'],['staff','Staff'],['admin','Department admin']].map(t=>`<button data-h="${t[0]}" aria-pressed="${HR===t[0]}">${t[1]}</button>`).join('');
 $('#htu').innerHTML=HTU[HR].map((s,i)=>`<div class="rv in" style="--i:${i}"><div class="t3 ${COLS[i]}"><span class="num">${i+1}</span><h3>${s[0]}</h3><p>${s[1]}</p></div></div>`).join('');
 $$('[data-h]').forEach(b=>b.onclick=()=>{HR=b.dataset.h;htu()});tilt()}
htu();
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
$$('.rv:not(.in)').forEach(el=>io.observe(el));
