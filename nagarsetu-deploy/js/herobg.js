/* Animated landing background: a dot grid that ripples in waves, with drifting brand-colour glows */
(function(){const cv=document.getElementById('bg'),hero=document.getElementById('hero');if(!cv||!hero)return;
const g=cv.getContext('2d'),rm=matchMedia('(prefers-reduced-motion:reduce)').matches,GAP=22;
let W=0,H=0,dpr=1,vis=true,mx=-1e4,my=-1e4;
const blobs=[['#FF5A1F',.18,.35,.0007,.0011],['#6C7BF5',.8,.3,.0009,.0006],['#D4F43A',.5,.75,.0006,.0010],['#AEE7FF',.3,.8,.0010,.0008]];
function sz(){dpr=Math.min(devicePixelRatio||1,1.5);W=hero.clientWidth;H=hero.clientHeight;cv.width=W*dpr;cv.height=H*dpr;g.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',sz);sz();
hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top});
hero.addEventListener('pointerleave',()=>{mx=my=-1e4});
new IntersectionObserver(e=>vis=e[0].isIntersecting).observe(hero);
function draw(now){
 g.clearRect(0,0,W,H);
 const cs=getComputedStyle(document.documentElement),dot=cs.getPropertyValue('--dot').trim()||'#D9D9D5',dark=document.documentElement.dataset.mode==='dark';
 /* soft drifting glows */
 g.globalAlpha=dark?.16:.2;
 blobs.forEach(b=>{const x=W*(b[1]+Math.sin(now*b[3])*.16),y=H*(b[2]+Math.cos(now*b[4])*.14),r=Math.max(W,H)*.22;
  const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,b[0]);gr.addColorStop(1,'transparent');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r)});
 g.globalAlpha=1;
 /* rippling dots */
 g.fillStyle=dot;
 for(let y=GAP/2;y<H;y+=GAP)for(let x=GAP/2;x<W;x+=GAP){
  const w=Math.sin(x*.012+now*.0016)+Math.cos(y*.015-now*.0013);
  let s=1+w*.55;
  const dx=x-mx,dy=y-my,d=dx*dx+dy*dy;if(d<14400)s+=(1-d/14400)*2.4;
  g.globalAlpha=Math.min(1,.45+.3*(w+2)/2+(s>2?.3:0));
  g.beginPath();g.arc(x,y,Math.max(.4,s),0,6.2832);g.fill()}
 g.globalAlpha=1}
if(rm){draw(0);return}
(function f(now){requestAnimationFrame(f);if(!vis||document.getElementById('landing').hidden)return;draw(now)})(0)})();
