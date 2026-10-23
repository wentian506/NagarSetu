/* 3D showcase: a fan of NagarSetu screens with the NagarSetu pin in front */
(function(){const cv=document.getElementById('c');if(!window.THREE||!cv)return;
const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
const ren=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true}),sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(32,1,.1,100);
ren.setPixelRatio(Math.min(devicePixelRatio,1.5));
sc.add(new THREE.AmbientLight(0xffffff,.85));const dl=new THREE.DirectionalLight(0xffffff,.7);dl.position.set(3,6,8);sc.add(dl);
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function tex(bg,title,tabs){const c=document.createElement('canvas');c.width=512;c.height=700;const g=c.getContext('2d');
 g.fillStyle=bg;rr(g,0,0,512,700,34);g.fill();g.fillStyle='#0A0A0A';g.beginPath();g.arc(52,56,15,0,7);g.fill();
 g.font='500 17px sans-serif';tabs.forEach((t,i)=>g.fillText(t,100+i*92,62));g.fillRect(36,98,440,2);
 g.fillStyle='rgba(10,10,10,.14)';rr(g,36,130,440,220,26);g.fill();g.fillStyle='rgba(10,10,10,.1)';rr(g,36,370,210,34,17);g.fill();rr(g,262,370,120,34,17);g.fill();
 g.fillStyle='#0A0A0A';g.font='500 46px sans-serif';title.split('\n').forEach((l,i)=>g.fillText(l,36,520+i*54));
 const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t}
const grp=new THREE.Group();sc.add(grp);const cards=[];
const P=[['#FF5A1F','Waste\nreports',-11.4,.62,-3,.3,['WASTE','LIGHTS']],['#6C7BF5','Streetlight\nfaults',-7.9,.74,-1.8,.2,['LIGHTS','ROADS']],['#D4F43A','Road\nrepairs',-4.4,.88,-.7,.1,['ROADS','MAP']],['#AEE7FF','Report.\nAssign. Track.',0,1.25,.8,0,['REPORT','TRACK','QUEUE','MAP']],['#D4F43A','Staff\nqueue',4.4,.88,-.7,-.1,['QUEUE','NOTES']],['#FF5A1F','Department\nconsole',7.9,.74,-1.8,-.2,['TICKETS','RULES']],['#6C7BF5','Audit\nlog',11.4,.62,-3,-.3,['AUDIT','LOG']]];
P.forEach(p=>{const w=4.1*p[3]*1.0,h=w/.731;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex(p[0],p[1],p[6]),transparent:true}));
 m.position.set(p[2]*1.0,-2.3+(p[3]>1?.7:0)-(1-p[3])*0.2,p[4]);m.rotation.y=p[5];m.userData={y:m.position.y,r:p[5],x:m.position.x,z:m.position.z,k:p[3]};cards.push(m);grp.add(m)});
const mG=new THREE.MeshLambertMaterial({color:0x6FB942}),mB=new THREE.MeshLambertMaterial({color:0x0E5C9A}),mW=new THREE.MeshLambertMaterial({color:0xffffff}),ln=new THREE.LineBasicMaterial({color:0x6FB942});
const pin=new THREE.Group(),sph=(r,m,x,y,z,sy)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,24,18),m);o.position.set(x,y,z);o.scale.y=sy||1;return o};
pin.add(sph(1,mG,0,1.7,0));const cone=new THREE.Mesh(new THREE.ConeGeometry(.88,2.3,28),mG);cone.rotation.x=Math.PI;cone.position.y=.55;pin.add(cone);
const disc=sph(.66,mW,0,1.7,0);disc.scale.z=.45;pin.add(disc);
[1,-1].forEach(s=>{const z=.3*s;pin.add(sph(.13,mB,0,1.95,z),sph(.22,mB,0,1.62,z,.8),sph(.1,mB,-.38,1.75,z),sph(.17,mB,-.38,1.5,z,.8),sph(.1,mB,.38,1.75,z),sph(.17,mB,.38,1.5,z,.8));
 pin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([[-.6,1.38],[-.28,1.38],[-.16,1.18],[-.04,1.68],[.08,1.1],[.2,1.38],[.6,1.38]].map(a=>new THREE.Vector3(a[0],a[1],z+.02*s))),ln))});
pin.scale.setScalar(.8);pin.position.set(0,-.7,3);sc.add(pin);
let mx=0;document.getElementById('showcase').addEventListener('pointermove',e=>{const r=e.currentTarget.getBoundingClientRect();mx=(e.clientX-r.left)/r.width-.5});
function sz(){const w=cv.clientWidth,h=cv.clientHeight;ren.setSize(w,h,false);const a=w/h;cam.aspect=a;cam.position.set(0,.7,15+Math.max(0,1.6-a)*14);cam.lookAt(0,-.5,0);cam.updateProjectionMatrix()}
addEventListener('resize',sz);sz();let vis=true;new IntersectionObserver(e=>vis=e[0].isIntersecting).observe(cv);
(function f(){requestAnimationFrame(f);if(!vis||document.getElementById('landing').hidden)return;const t=Date.now()/1000;
 if(!rm){
  /* whole fan sweeps slowly left/right, and still follows the pointer */
  const sway=Math.sin(t*.45)*.2;
  grp.rotation.y+=(mx*.22+sway-grp.rotation.y)*.06;
  grp.position.x=Math.sin(t*.3)*.5;
  /* each card floats on its own phase: bob, drift, tilt */
  cards.forEach((m,i)=>{const d=m.userData,ph=i*1.1;
   m.position.y=d.y+Math.sin(t*1.1+ph)*(.16+.1*d.k);
   m.position.x=d.x+Math.sin(t*.6+ph)*.22;
   m.position.z=d.z+Math.cos(t*.7+ph)*.35;
   m.rotation.y=d.r+Math.sin(t*.8+ph)*.09;
   m.rotation.z=Math.sin(t*.9+ph*1.3)*.035});
  pin.rotation.y=Math.sin(t*.7)*.5+mx*.4;pin.rotation.z=Math.sin(t*.9)*.06;pin.position.y=-.7+Math.sin(t*1.2)*.16}
 ren.render(sc,cam)})()})();
