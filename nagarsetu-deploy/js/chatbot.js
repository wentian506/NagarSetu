/* NagarSetu help assistant. Rule-based (no AI model, no data leaves the browser): answers from a reviewed knowledge list
   in English, Hindi and Punjabi, and looks up a ticket by number. Appears bottom-right on the dashboard pages. */
(function(){
const U={
en:{t:'NagarSetu assistant',sub:'Prototype help. Answers come from a reviewed list.',ph:'Ask how to apply, track or more…',send:'Send',hi:'Hello! I can explain how to report an issue, track a ticket, or how long it takes. Type a ticket number like ticket001 to check it.',
 chips:['How do I apply?','How do I track my ticket?','How long will it take?','It is not fixed'],nf:'I do not have a reviewed answer for that. You can still use Report an issue, and staff will see it. Try asking about applying, tracking or deadlines.',
 none:'I could not find that ticket. Check the number, for example ticket001.',tk:(id,s,d,n)=>`${id}: ${s}.${d?' '+d+'.':''}${n?' Latest update: '+n:''}`},
hi:{t:'NagarSetu सहायक',sub:'प्रोटोटाइप सहायता। उत्तर जाँची हुई सूची से आते हैं।',ph:'आवेदन, ट्रैकिंग आदि के बारे में पूछें…',send:'भेजें',hi:'नमस्ते! मैं बता सकता हूँ कि समस्या कैसे दर्ज करें, टिकट कैसे ट्रैक करें और कितना समय लगेगा। जाँचने के लिए ticket001 जैसा नंबर लिखें।',
 chips:['आवेदन कैसे करूँ?','टिकट कैसे ट्रैक करूँ?','कितना समय लगेगा?','समस्या ठीक नहीं हुई'],nf:'इसका जाँचा हुआ उत्तर मेरे पास नहीं है। आप फिर भी "समस्या दर्ज करें" इस्तेमाल कर सकते हैं, स्टाफ़ उसे देखेगा। आवेदन, ट्रैकिंग या डेडलाइन के बारे में पूछें।',
 none:'वह टिकट नहीं मिला। नंबर जाँचें, जैसे ticket001।',tk:(id,s,d,n)=>`${id}: ${s}।${d?' '+d+'।':''}${n?' ताज़ा अपडेट: '+n:''}`},
pa:{t:'NagarSetu ਸਹਾਇਕ',sub:'ਪ੍ਰੋਟੋਟਾਈਪ ਮਦਦ। ਜਵਾਬ ਜਾਂਚੀ ਹੋਈ ਸੂਚੀ ਤੋਂ ਆਉਂਦੇ ਹਨ।',ph:'ਅਰਜ਼ੀ, ਟ੍ਰੈਕਿੰਗ ਆਦਿ ਬਾਰੇ ਪੁੱਛੋ…',send:'ਭੇਜੋ',hi:'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਦੱਸ ਸਕਦਾ ਹਾਂ ਕਿ ਸਮੱਸਿਆ ਕਿਵੇਂ ਦਰਜ ਕਰੀਏ, ਟਿਕਟ ਕਿਵੇਂ ਟ੍ਰੈਕ ਕਰੀਏ ਅਤੇ ਕਿੰਨਾ ਸਮਾਂ ਲੱਗੇਗਾ। ਜਾਂਚਣ ਲਈ ticket001 ਵਰਗਾ ਨੰਬਰ ਲਿਖੋ।',
 chips:['ਅਰਜ਼ੀ ਕਿਵੇਂ ਦੇਵਾਂ?','ਟਿਕਟ ਕਿਵੇਂ ਟ੍ਰੈਕ ਕਰਾਂ?','ਕਿੰਨਾ ਸਮਾਂ ਲੱਗੇਗਾ?','ਸਮੱਸਿਆ ਠੀਕ ਨਹੀਂ ਹੋਈ'],nf:'ਇਸਦਾ ਜਾਂਚਿਆ ਜਵਾਬ ਮੇਰੇ ਕੋਲ ਨਹੀਂ ਹੈ। ਤੁਸੀਂ ਫਿਰ ਵੀ "ਸਮੱਸਿਆ ਦਰਜ ਕਰੋ" ਵਰਤ ਸਕਦੇ ਹੋ, ਸਟਾਫ਼ ਉਸਨੂੰ ਵੇਖੇਗਾ। ਅਰਜ਼ੀ, ਟ੍ਰੈਕਿੰਗ ਜਾਂ ਡੈੱਡਲਾਈਨ ਬਾਰੇ ਪੁੱਛੋ।',
 none:'ਉਹ ਟਿਕਟ ਨਹੀਂ ਮਿਲੀ। ਨੰਬਰ ਜਾਂਚੋ, ਜਿਵੇਂ ticket001।',tk:(id,s,d,n)=>`${id}: ${s}।${d?' '+d+'।':''}${n?' ਤਾਜ਼ਾ ਅੱਪਡੇਟ: '+n:''}`}};
const K=[
{k:/emergency|ambulance|fire|accident|police|आपात|एम्बुलेंस|आग|दुर्घटना|ਐਮਰਜੈਂਸੀ|ਐਂਬੂਲੈਂਸ|ਅੱਗ|ਹਾਦਸਾ/i,
 a:{en:'NagarSetu is not an emergency service. In an emergency call 112 right away.',hi:'NagarSetu आपातकालीन सेवा नहीं है। आपात स्थिति में तुरंत 112 पर कॉल करें।',pa:'NagarSetu ਐਮਰਜੈਂਸੀ ਸੇਵਾ ਨਹੀਂ ਹੈ। ਐਮਰਜੈਂਸੀ ਵਿੱਚ ਤੁਰੰਤ 112 ਤੇ ਕਾਲ ਕਰੋ।'}},
{k:/reopen|not fixed|still (broken|there|not|dark)|again|दोबारा|फिर से|ठीक नहीं|ਦੁਬਾਰਾ|ਠੀਕ ਨਹੀਂ/i,
 a:{en:'If a resolved ticket is not really fixed: Track a ticket, enter its number, then tap "Not fixed? Reopen this ticket". The deadline clock restarts and staff are told.',hi:'अगर हल हुआ टिकट असल में ठीक नहीं हुआ: "टिकट ट्रैक करें" में नंबर डालें, फिर "ठीक नहीं हुआ? टिकट दोबारा खोलें" दबाएँ। डेडलाइन घड़ी फिर शुरू होती है और स्टाफ़ को सूचना जाती है।',pa:'ਜੇ ਹੱਲ ਹੋਈ ਟਿਕਟ ਅਸਲ ਵਿੱਚ ਠੀਕ ਨਹੀਂ ਹੋਈ: "ਟਿਕਟ ਟ੍ਰੈਕ ਕਰੋ" ਵਿੱਚ ਨੰਬਰ ਪਾਓ, ਫਿਰ "ਠੀਕ ਨਹੀਂ ਹੋਇਆ? ਟਿਕਟ ਦੁਬਾਰਾ ਖੋਲ੍ਹੋ" ਦਬਾਓ। ਡੈੱਡਲਾਈਨ ਘੜੀ ਫਿਰ ਸ਼ੁਰੂ ਹੁੰਦੀ ਹੈ ਅਤੇ ਸਟਾਫ਼ ਨੂੰ ਸੂਚਨਾ ਜਾਂਦੀ ਹੈ।'}},
{k:/track|status|progress|check|update|स्थिति|ट्रैक|जाँच|जांच|प्रगति|ਸਥਿਤੀ|ਟ੍ਰੈਕ|ਜਾਂਚ|ਪ੍ਰਗਤੀ/i,
 a:{en:'To track: open "Track a ticket", type your number (for example ticket001) and press Track. You see the status, the deadline clock and public notes. "My tickets" lists all your reports.',hi:'ट्रैक करने के लिए: "टिकट ट्रैक करें" खोलें, अपना नंबर (जैसे ticket001) डालें और "ट्रैक करें" दबाएँ। स्थिति, डेडलाइन घड़ी और सार्वजनिक नोट दिखते हैं। "मेरे टिकट" में आपकी सभी रिपोर्ट हैं।',pa:'ਟ੍ਰੈਕ ਕਰਨ ਲਈ: "ਟਿਕਟ ਟ੍ਰੈਕ ਕਰੋ" ਖੋਲ੍ਹੋ, ਆਪਣਾ ਨੰਬਰ (ਜਿਵੇਂ ticket001) ਪਾਓ ਅਤੇ "ਟ੍ਰੈਕ ਕਰੋ" ਦਬਾਓ। ਸਥਿਤੀ, ਡੈੱਡਲਾਈਨ ਘੜੀ ਅਤੇ ਜਨਤਕ ਨੋਟ ਦਿਸਦੇ ਹਨ। "ਮੇਰੇ ਟਿਕਟ" ਵਿੱਚ ਤੁਹਾਡੀਆਂ ਸਾਰੀਆਂ ਰਿਪੋਰਟਾਂ ਹਨ।'}},
{k:/how long|how much time|deadline|sla|days|late|delay|overdue|escalat|कितना|समय|देर|डेडलाइन|ਕਿੰਨਾ|ਸਮਾਂ|ਦੇਰੀ|ਡੈੱਡਲਾਈਨ/i,
 a:{en:'Each category has a deadline set by the department (prototype values: waste 24 h, streetlights 48 h, roads 72 h). If it runs late, a supervisor and then the department head are alerted. Nothing is closed automatically.',hi:'हर श्रेणी की डेडलाइन विभाग तय करता है (प्रोटोटाइप मान: कचरा 24 घंटे, स्ट्रीटलाइट 48 घंटे, सड़क 72 घंटे)। देरी होने पर सुपरवाइज़र और फिर विभाग प्रमुख को सूचना जाती है। कुछ भी अपने आप बंद नहीं होता।',pa:'ਹਰ ਸ਼੍ਰੇਣੀ ਦੀ ਡੈੱਡਲਾਈਨ ਵਿਭਾਗ ਤੈਅ ਕਰਦਾ ਹੈ (ਪ੍ਰੋਟੋਟਾਈਪ ਮੁੱਲ: ਕੂੜਾ 24 ਘੰਟੇ, ਸਟਰੀਟ ਲਾਈਟ 48 ਘੰਟੇ, ਸੜਕ 72 ਘੰਟੇ)। ਦੇਰੀ ਹੋਣ ਤੇ ਸੁਪਰਵਾਈਜ਼ਰ ਅਤੇ ਫਿਰ ਵਿਭਾਗ ਮੁਖੀ ਨੂੰ ਸੂਚਨਾ ਜਾਂਦੀ ਹੈ। ਕੁਝ ਵੀ ਆਪਣੇ-ਆਪ ਬੰਦ ਨਹੀਂ ਹੁੰਦਾ।'}},
{k:/apply|report|file|raise|lodge|complain|register|new issue|shikayat|दर्ज|शिकायत|रिपोर्ट|आवेदन|ਦਰਜ|ਸ਼ਿਕਾਇਤ|ਰਿਪੋਰਟ|ਅਰਜ਼ੀ/i,
 a:{en:'To apply: sign in as a Resident, open "Report an issue", then 1) pick a category, 2) describe the problem, 3) share your live location, tap the map or type a landmark, 4) review and tick the confirm box. You then get a ticket number.',hi:'आवेदन के लिए: निवासी के रूप में साइन इन करें, "समस्या दर्ज करें" खोलें, फिर 1) श्रेणी चुनें, 2) समस्या बताएँ, 3) लाइव लोकेशन दें, नक्शे पर टैप करें या लैंडमार्क लिखें, 4) समीक्षा करके पुष्टि बॉक्स पर टिक करें। फिर आपको टिकट नंबर मिलता है।',pa:'ਅਰਜ਼ੀ ਲਈ: ਵਸਨੀਕ ਵਜੋਂ ਸਾਈਨ ਇਨ ਕਰੋ, "ਸਮੱਸਿਆ ਦਰਜ ਕਰੋ" ਖੋਲ੍ਹੋ, ਫਿਰ 1) ਸ਼੍ਰੇਣੀ ਚੁਣੋ, 2) ਸਮੱਸਿਆ ਦੱਸੋ, 3) ਲਾਈਵ ਲੋਕੇਸ਼ਨ ਦਿਓ, ਨਕਸ਼ੇ ਉੱਤੇ ਟੈਪ ਕਰੋ ਜਾਂ ਲੈਂਡਮਾਰਕ ਲਿਖੋ, 4) ਸਮੀਖਿਆ ਕਰਕੇ ਪੁਸ਼ਟੀ ਬਾਕਸ ਉੱਤੇ ਟਿਕ ਕਰੋ। ਫਿਰ ਤੁਹਾਨੂੰ ਟਿਕਟ ਨੰਬਰ ਮਿਲਦਾ ਹੈ।'}},
{k:/categor|what can i|types|which issues|श्रेणी|कौन.*समस्या|ਸ਼੍ਰੇਣੀ|ਕਿਹੜੀ/i,
 a:{en:'Three categories for now: uncollected waste (sanitation team), broken streetlight (electrical team) and potholes or road damage (roads team).',hi:'अभी तीन श्रेणियाँ हैं: न उठाया गया कचरा (सफ़ाई टीम), ख़राब स्ट्रीटलाइट (बिजली टीम) और गड्ढे या सड़क की टूट-फूट (सड़क टीम)।',pa:'ਹੁਣ ਤਿੰਨ ਸ਼੍ਰੇਣੀਆਂ ਹਨ: ਨਾ ਚੁੱਕਿਆ ਕੂੜਾ (ਸਫ਼ਾਈ ਟੀਮ), ਖ਼ਰਾਬ ਸਟਰੀਟ ਲਾਈਟ (ਬਿਜਲੀ ਟੀਮ) ਅਤੇ ਟੋਏ ਜਾਂ ਸੜਕ ਦੀ ਟੁੱਟ-ਭੱਜ (ਸੜਕ ਟੀਮ)।'}},
{k:/log ?in|sign ?in|account|password|otp|लॉग|साइन|खाता|पासवर्ड|ਲੌਗ|ਸਾਈਨ|ਖਾਤਾ|ਪਾਸਵਰਡ/i,
 a:{en:'Press Start, choose Resident and sign in with your mobile number. Staff and department admins use the ID and password given by their department.',hi:'"शुरू करें" दबाएँ, निवासी चुनें और मोबाइल नंबर से साइन इन करें। स्टाफ़ और विभाग प्रशासक विभाग से मिली आईडी और पासवर्ड इस्तेमाल करते हैं।',pa:'"ਸ਼ੁਰੂ ਕਰੋ" ਦਬਾਓ, ਵਸਨੀਕ ਚੁਣੋ ਅਤੇ ਮੋਬਾਈਲ ਨੰਬਰ ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ। ਸਟਾਫ਼ ਅਤੇ ਵਿਭਾਗ ਪ੍ਰਸ਼ਾਸਕ ਵਿਭਾਗ ਤੋਂ ਮਿਲੀ ਆਈਡੀ ਅਤੇ ਪਾਸਵਰਡ ਵਰਤਦੇ ਹਨ।'}},
{k:/location|map|pin|landmark|लोकेशन|नक्शा|स्थान|जगह|ਲੋਕੇਸ਼ਨ|ਨਕਸ਼ਾ|ਥਾਂ/i,
 a:{en:'In step 3 you can share your live location, tap the map or pick a landmark such as Sector 22 Market. The pin must be inside Chandigarh.',hi:'चरण 3 में आप लाइव लोकेशन दे सकते हैं, नक्शे पर टैप कर सकते हैं या सेक्टर 22 मार्केट जैसा लैंडमार्क चुन सकते हैं। पिन चंडीगढ़ के अंदर होना चाहिए।',pa:'ਪੜਾਅ 3 ਵਿੱਚ ਤੁਸੀਂ ਲਾਈਵ ਲੋਕੇਸ਼ਨ ਦੇ ਸਕਦੇ ਹੋ, ਨਕਸ਼ੇ ਉੱਤੇ ਟੈਪ ਕਰ ਸਕਦੇ ਹੋ ਜਾਂ ਸੈਕਟਰ 22 ਮਾਰਕੀਟ ਵਰਗਾ ਲੈਂਡਮਾਰਕ ਚੁਣ ਸਕਦੇ ਹੋ। ਪਿੰਨ ਚੰਡੀਗੜ੍ਹ ਦੇ ਅੰਦਰ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।'}},
{k:/language|hindi|punjabi|भाषा|हिन्दी|हिंदी|पंजाबी|ਭਾਸ਼ਾ|ਹਿੰਦੀ|ਪੰਜਾਬੀ/i,
 a:{en:'Use the language box at the top: English, हिन्दी or ਪੰਜਾਬੀ. The whole site changes.',hi:'ऊपर भाषा बॉक्स इस्तेमाल करें: English, हिन्दी या ਪੰਜਾਬੀ। पूरी साइट बदल जाती है।',pa:'ਉੱਪਰ ਭਾਸ਼ਾ ਬਾਕਸ ਵਰਤੋ: English, हिन्दी ਜਾਂ ਪੰਜਾਬੀ। ਸਾਰੀ ਸਾਈਟ ਬਦਲ ਜਾਂਦੀ ਹੈ।'}}];
const $=s=>document.querySelector(s),lang=()=>window.NSI?NSI.lang:'en';
const det=t=>/[\u0900-\u097F]/.test(t)?'hi':/[\u0A00-\u0A7F]/.test(t)?'pa':lang();
const root=document.createElement('div');root.id='bot';root.className='notr';
root.innerHTML='<button id="botb" aria-expanded="false">💬</button><section id="botp" role="dialog" hidden><header><div><b id="bott"></b><small id="bots"></small></div><button id="botx" aria-label="Close">✕</button></header><div id="botm" aria-live="polite"></div><div id="botc"></div><div id="botf"><input id="boti" autocomplete="off" maxlength="200"><button id="botn" class="btn p sm"></button></div></section>';
document.body.appendChild(root);
const msg=(who,t)=>{const d=document.createElement('div');d.className='bm '+who;d.textContent=t;$('#botm').appendChild(d);$('#botm').scrollTop=1e9};
function paint(){const u=U[lang()];$('#bott').textContent=u.t;$('#bots').textContent=u.sub;$('#boti').placeholder=u.ph;$('#botn').textContent=u.send;$('#botb').setAttribute('aria-label',u.t);$('#botp').setAttribute('aria-label',u.t);
 $('#botc').innerHTML='';u.chips.forEach(c=>{const b=document.createElement('button');b.className='chip';b.textContent=c;b.onclick=()=>ask(c);$('#botc').appendChild(b)})}
function greet(){$('#botm').innerHTML='';msg('b',U[lang()].hi);paint()}
async function ticket(id,l){const u=U[l];let k=null;try{k=await api('track',{id})}catch(e){}if(!k)return u.none;
 const last=k.ev&&k.ev.length?k.ev[k.ev.length-1].pub:'';return u.tk(k.id,NSI.t(LBL[k.status],l),NSI.t(left(k),l),last?NSI.t(last,l):'')}
async function reply(text){const l=det(text),m=text.match(/(?:ticket|टिकट|ਟਿਕਟ)\s*0*(\d+)/i);
 if(K[0].k.test(text))return K[0].a[l];if(m)return ticket('ticket'+m[1],l);
 for(const x of K)if(x.k.test(text))return x.a[l];return U[l].nf}
async function ask(text){text=(text||'').trim();if(!text)return;msg('u',text);$('#boti').value='';msg('b','…');const r=await reply(text);const a=$('#botm');a.lastChild.textContent=r;a.scrollTop=1e9}
$('#botb').onclick=()=>{const o=$('#botp').hidden;$('#botp').hidden=!o;$('#botb').setAttribute('aria-expanded',o);if(o)$('#boti').focus()};
$('#botx').onclick=()=>{$('#botp').hidden=true;$('#botb').setAttribute('aria-expanded',false);$('#botb').focus()};
$('#botn').onclick=()=>ask($('#boti').value);$('#boti').onkeydown=e=>{if(e.key==='Enter')ask(e.target.value)};
document.addEventListener('nslang',greet);greet();
})();
