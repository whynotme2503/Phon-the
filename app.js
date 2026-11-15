/* ===== Tiện ích ===== */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const zh=(s,cls='')=>`<span lang="zh-Hant" class="zh ${cls}">${esc(s).replace(/\n/g,'<br>')}</span>`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const today=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);
const isoOf=d=>new Date(d*864e5).toISOString().slice(0,10);
const dayOf=iso=>Math.floor(Date.parse(iso+'T00:00:00Z')/864e5);
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const toSimp=s=>Array.from(s).map(c=>T2S[c]||c).join('');
const LET='ABCDEF';

/* ===== Dữ liệu đã xử lý ===== */
const seenT=new Set();
const DECKS=RAW_DECKS.map(([name,note,str],i)=>({i,name,note,cards:str.split(' ').filter(t=>{const k=t[1];if(seenT.has(k))return false;seenT.add(k);return true}).map(t=>({id:'c'+t[1],k:'c',f:t[1],bk:t[0]}))}));
const ALLC=DECKS.flatMap(d=>d.cards);
const MULTIC=MULTI.map(([s,r])=>({id:'m'+s,k:'m',f:s,list:r.split(';').map(x=>x.split('|'))}));
const VOCABC=VOCAB.split('\n').map(l=>{const [cn,tw,vi]=l.split('|');return{id:'w'+tw,k:'w',f:tw,bk:cn,vi}});
const PRONL=PRON.split('\n').map(l=>l.split('|'));
LISTEN.forEach((x,i)=>x.id='l'+i);READ.forEach((x,i)=>x.id='r'+i);GAPS.forEach((x,i)=>x.id='g'+i);

/* ===== Trạng thái, lưu trữ ===== */
const KEY='tocfl-on-thi-v1';
const defaults=()=>({start:isoOf(today()),exam:'',done:{},srs:{},w:{},rt:{},ex:{},dr:{},q:{},hist:[],voice:'auto',rate:1,t:0});
let S=defaults();
/* Đổi tiến độ của cách chia đơn vị cũ sang cách chia hiện tại */
function normalize(o){const s=Object.assign(defaults(),o);if(s.wv!==WV){if((s.wv||1)===1&&Object.keys(s.w).length){const nw={};for(const k in s.w)if(MIG[k]!=null)nw[MIG[k]]=s.w[k];s.w=nw;const r0=s.rt[0];s.rt=r0!=null?{0:r0}:{};const d1=s.dr.d1;s.dr=d1!=null?{d1}:{}}s.wv=WV}return s}
try{const raw=localStorage.getItem(KEY);if(raw)S=normalize(JSON.parse(raw));else S.wv=WV}catch(e){}
let cloud=null,saveTimer=null,writing=false,dirty=false,syncState='local';
function setSync(s){syncState=s;const el=$('#sync');if(el)el.textContent=s==='ok'?'Tiến độ được lưu theo tài khoản của bạn':s==='err'?'Chưa lưu được lên tài khoản, đang giữ trên trình duyệt này':'Tiến độ đang lưu trên trình duyệt này'}
function save(){S.t=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(push,4000)}
async function push(){if(!cloud||writing||!dirty)return;writing=true;dirty=false;try{await cloud.set({json:JSON.stringify(S),t:S.t});setSync('ok')}catch(e){setSync('err')}writing=false;if(dirty){clearTimeout(saveTimer);saveTimer=setTimeout(push,4000)}}
async function initCloud(){try{if(!window.claude||!claude.use)return;const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);if(!db||!user)return;const id=await user.id();if(!id)return;cloud=db.doc('data/users/'+id+'/progress');const snap=await cloud.get();if(snap.exists){const d=snap.data();if(d&&d.json&&d.t>(S.t||0)){S=normalize(JSON.parse(d.json));try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(!sub)render()}}setSync('ok');if(dirty||!snap.exists&&S.t)push()}catch(e){}}

/* ===== Giọng đọc ===== */
const TTS={cl:null,tok:0};
/* Giọng của iPhone bị méo khi đổi cao độ, nên trên iOS giữ nguyên cao độ */
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function voices(){try{return speechSynthesis.getVoices()}catch(e){return[]}}
const twVoice=()=>voices().find(v=>/zh[-_](TW|Hant)/i.test(v.lang))||null;
const zhVoice=()=>voices().find(v=>/^zh/i.test(v.lang))||null;
/* Safari trên iPhone nuốt mất câu đọc nếu vừa cancel() xong đã speak() ngay, nên chỉ huỷ khi thật sự đang đọc */
function stopSpeak(){TTS.tok++;let was=false;try{was=speechSynthesis.speaking||speechSynthesis.pending;if(was)speechSynthesis.cancel()}catch(e){}try{TTS.cl&&TTS.cl.stop()}catch(e){}return was}
function parseLines(l){return l.map(x=>{const m=/^(男|女)：(.*)$/s.exec(x);return m?{t:m[2],s:m[1]==='男'?'m':'f'}:{t:x,s:'n'}})}
function ttsMode(){const tw=twVoice();if(!voices().length&&'speechSynthesis' in window&&!TTS.cl)return 'b';if(S.voice==='browser')return (tw||zhVoice())?'b':TTS.cl?'c':'';if(S.voice==='claude')return TTS.cl?'c':(tw||zhVoice())?'b':'';return tw?'b':TTS.cl?'c':zhVoice()?'b':''}
async function speak(lines){const was=stopSpeak();const my=TTS.tok,mode=ttsMode();
  if(!mode)return false;
  if(mode==='c'){try{await TTS.cl.speak(lines.map(l=>({text:l.t,voice:l.s==='f'?'airy':l.s==='m'?'rounded':'buttery',language:'zh-TW'})),{rate:Math.min(1.5,Math.max(.7,S.rate))});return true}catch(e){return my!==TTS.tok}}
  const v=twVoice()||zhVoice();
  if(was)await sleep(250);
  try{speechSynthesis.resume()}catch(e){}
  for(const l of lines){for(const part of l.t.match(/[^。！？；]+[。！？；]?/g)||[l.t]){if(my!==TTS.tok)return true;
    await new Promise(res=>{const u=new SpeechSynthesisUtterance(part);u.lang=v?v.lang:'zh-TW';if(v)u.voice=v;u.volume=1;u.rate=S.rate;u.pitch=IOS?1:l.s==='f'?1.2:l.s==='m'?.8:1;u.onend=res;u.onerror=res;speechSynthesis.speak(u)})}
    if(my!==TTS.tok)return true;await sleep(400)}
  return true}
const noVoiceMsg='Thiết bị này chưa có giọng đọc tiếng Trung. Hãy mở trang bằng Chrome hoặc Edge trên máy tính, hoặc cài giọng 中文（台灣） trong phần cài đặt giọng nói của máy.';

/* ===== File nghe của sách: nằm trên máy người học, web không chứa sẵn ===== */
const ADB={db:null,keys:new Set(),ready:false};
function adbOpen(){return new Promise(res=>{try{const r=indexedDB.open('hoc-phon-audio',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>{ADB.db=r.result;const q=ADB.db.transaction('f').objectStore('f').getAllKeys();q.onsuccess=()=>{ADB.keys=new Set(q.result);ADB.ready=true;res()};q.onerror=()=>res()};r.onerror=()=>res()}catch(e){res()}})}
const adbPut=(k,blob)=>new Promise((res,rej)=>{const t=ADB.db.transaction('f','readwrite');t.objectStore('f').put(blob,k);t.oncomplete=()=>{ADB.keys.add(k);res()};t.onerror=()=>rej(t.error)});
const adbGet=k=>new Promise(res=>{if(!ADB.db)return res(null);const q=ADB.db.transaction('f').objectStore('f').get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)});
const adbClear=()=>new Promise(res=>{const t=ADB.db.transaction('f','readwrite');t.objectStore('f').clear();t.oncomplete=()=>{ADB.keys=new Set();res()}});
/* Chỉ giữ track bài khoá của sách giáo khoa và track nghe hiểu của sách bài tập */
function audKey(name){let m;if((m=/B(\d)-L(\d\d)-1-Text\.mp3$/i.exec(name)))return `B${m[1]}-L${m[2]}-T`;if((m=/B2-L(\d\d)-6-Listen[^/]*\.mp3$/i.exec(name)))return `W2-L${m[1]}`;if((m=/B3-L(\d\d)-(\d)-workbook[^/]*\.mp3$/i.exec(name)))return `W3-L${m[1]}-${m[2]}`;return null}
async function audImport(files,onMsg){let n=0;
  for(const f of files){
    if(/\.mp3$/i.test(f.name)){const k=audKey(f.name);if(k){await adbPut(k,f.slice(0,f.size,'audio/mpeg'));n++;onMsg(`Đã nạp ${n} file…`)}continue}
    if(!/\.zip$/i.test(f.name))continue;
    await new Promise((res,rej)=>{const jobs=[];const uz=new fflate.Unzip();uz.register(fflate.UnzipInflate);
      uz.onfile=e=>{const k=audKey(e.name);if(!k)return;const parts=[];e.ondata=(err,d,fin)=>{if(err)return rej(err);parts.push(d);if(fin)jobs.push(adbPut(k,new Blob(parts,{type:'audio/mpeg'})).then(()=>{n++;onMsg(`Đã nạp ${n} file…`)}))};e.start()};
      const rd=f.stream().getReader();(async()=>{try{for(;;){const {done,value}=await rd.read();if(done){uz.push(new Uint8Array(0),true);break}uz.push(value)}await Promise.all(jobs);res()}catch(e){rej(e)}})()})}
  return n}
const PL={url:null,end:0};
async function playTrack(x){const blob=await adbGet(x.src);if(!blob)return false;stopSpeak();const box=$('#player'),au=$('#pl-audio');
  if(PL.url)URL.revokeObjectURL(PL.url);PL.url=URL.createObjectURL(blob);PL.end=x.t1||0;au.src=PL.url;$('#pl-title').textContent=x.bk;box.hidden=false;
  au.onloadedmetadata=()=>{au.currentTime=x.t0||0;au.playbackRate=S.rate;au.play().catch(()=>{})};
  au.ontimeupdate=()=>{if(PL.end&&au.currentTime>=PL.end){au.pause();PL.end=0}};return true}
function stopTrack(){const au=$('#pl-audio');if(au){au.pause()}const b=$('#player');if(b)b.hidden=true}

/* ===== SRS ===== */
const IV=[0,1,2,4,8,16,32];
function grade(id,ok){const c=S.srs[id];const b=ok?Math.min((c?c[0]:0)+1,6):0;S.srs[id]=[b,today()+IV[b]];save()}
const isDue=id=>S.srs[id]&&S.srs[id][1]<=today();
const isKnown=id=>S.srs[id]&&S.srs[id][0]>=1;
const ALLCARDS=()=>[...ALLC,...MULTIC,...VOCABC];
const dueCards=()=>ALLCARDS().filter(c=>isDue(c.id));
const pct=(a,b)=>b?Math.round(a/b*100):0;
const bar=(a,b)=>`<div class="bar" role="img" aria-label="${a} trên ${b}"><i style="width:${pct(a,b)}%"></i></div>`;

/* ===== Từ vựng theo đơn vị (khoảng 300 từ mỗi ngày) ===== */
/* S.w[i] = [hộp, ngày đến hạn]. Đúng ngay lần đầu vào hộp 3, sai về hộp 0. "Đã nắm" là hộp từ 1 trở lên. */
const unitOf=i=>UNITS.findIndex(u=>i>=u.a&&i<u.z);
function unitStat(u){let k=0,t=0;for(let i=u.a;i<u.z;i++){const r=S.w[i];if(r){t++;if(r[0]>=1)k++}}return{n:u.z-u.a,known:k,tested:t,need:Math.ceil((u.z-u.a)*.95)}}
const unitDone=u=>{const s=unitStat(u);return s.known>=s.need};
function dueWords(){const a=[],t=today();for(const k in S.w)if(S.w[k][1]<=t)a.push(+k);return a}
const knownWords=()=>{let n=0;for(const k in S.w)if(S.w[k][0]>=1)n++;return n};
function gradeW(i,ok){const r=S.w[i];const b=!r?(ok?3:0):ok?Math.min(r[0]+1,6):0;S.w[i]=[b,today()+IV[b]];save()}
const showW=w=>w[0].replace(/\//g,' / ');

/* ===== Lộ trình: mỗi ngày một đơn vị, xong hay chưa do web tự chấm ===== */
const DAYS=[];
(()=>{const last={};UNITS.forEach((u,i)=>last[u.b]=i);
  UNITS.forEach((u,i)=>{DAYS.push({k:'unit',u:i,b:u.b});
    if(i===last.A)DAYS.push({k:'mock',b:'A'});
    if(i===last.B)DAYS.push({k:'exam',b:'B',id:'B1'});
    if(i===last.C)DAYS.push({k:'exam',b:'C',id:'C1'})});
  UNITS.forEach((u,i)=>{DAYS.push({k:'retest',u:i,b:u.b});if((i+1)%8===0||i===UNITS.length-1)DAYS.push({k:'exam',b:'C',id:'C'+(2+Math.floor(i/8))})})})();
const ND=DAYS.length;
/* Gắn bài nghe, bài đọc cũ (theo band) vào các ngày học từ của band đó */
(()=>{['B','C'].forEach(b=>{const ds=DAYS.map((x,i)=>x.k==='unit'&&x.b===b?i+1:0).filter(Boolean);let n=0;
    [LISTEN,READ,GAPS].forEach(arr=>arr.filter(x=>!x.d&&x.b===b).forEach(x=>{x.d=ds[n++%ds.length]}))});
  const oldA=LISTEN.filter(x=>!x.d&&x.b==='A');oldA.forEach((x,i)=>{x.d=2+Math.floor(i/2);x.t='對話理解'});
  READ.filter(x=>!x.d&&x.b==='A').forEach((x,i)=>{x.d=3+i})})();
const setItems=(kind,d)=>kind==='l'?LISTEN.filter(x=>x.d===d):[...READ.filter(x=>x.d===d),...GAPS.filter(x=>x.d===d)];
/* Bài dùng file nghe của sách chỉ tính vào mốc hoàn thành khi thiết bị đã có file đó */
const usable=x=>!x.src||ADB.keys.has(x.src);
function setStat(kind,d){const ks=setItems(kind,d).filter(usable).flatMap(x=>(x.qs||[0]).map((_,i)=>x.id+'-'+i+'p'));const done=ks.filter(k=>S.q[k]!=null),ok=done.filter(k=>S.q[k]===0);
  return{n:ks.length,done:done.length,ok:ok.length,pass:ks.length>0&&done.length===ks.length&&ok.length>=Math.ceil(ks.length*.8)}}
const bestMock=()=>S.hist.filter(h=>h.k==='A').reduce((b,h)=>!b||Math.min(h.L,h.R)>Math.min(b.L,b.R)?h:b,null);
function dayTitle(i){const x=DAYS[i];return x.k==='unit'?UNITS[x.u].t:x.k==='mock'?'Thi thử Band A':x.k==='exam'?`Làm đề mẫu chính thức Band ${x.b}`:`Vòng 2 · kiểm tra lại: ${UNITS[x.u].t}`}
function dayTasks(i){const x=DAYS[i],d=i+1,T=[];
  if(x.k==='unit'){const u=UNITS[x.u],s=unitStat(u);
    T.push({x:`Từ vựng: kiểm tra ${s.n} từ`,done:s.known>=s.need,p:`${s.known}/${s.n} từ đã nắm, cần ${s.need}`,pc:pct(s.known,s.need),a:'wt',arg:x.u,btn:s.tested?'Làm tiếp':'Bắt đầu'});
    const dr=S.dr['d'+d];T.push({x:'Nghe từ, chọn chữ: 30 từ của hôm nay',done:dr>=80,p:dr==null?'Chưa làm, cần đúng từ 80%':`Lần gần nhất đúng ${dr}%, cần 80%`,pc:dr||0,a:'drill',arg:d,btn:dr==null?'Bắt đầu':'Làm lại'});
    [['l','Nghe theo dạng đề'],['r','Đọc theo dạng đề']].forEach(([k,name])=>{const st=setStat(k,d);if(st.n)T.push({x:`${name}: ${st.n} câu`,done:st.pass,p:`Đã làm ${st.done}/${st.n}, đúng ${st.ok}, cần đúng ${Math.ceil(st.n*.8)}`,pc:pct(st.ok,Math.ceil(st.n*.8)),a:'set',arg:k+d,btn:st.done?'Làm tiếp':'Bắt đầu'})})}
  else if(x.k==='mock'){const b=bestMock();T.push({x:'Thi thử Band A: 50 câu nghe, 50 câu đọc',done:!!b&&b.L>=38&&b.R>=38,p:b?`Kết quả tốt nhất: nghe ${b.L}/50, đọc ${b.R}/50. Cần mỗi phần từ 38`:'Chưa thi. Cần mỗi phần từ 38/50',pc:b?pct(Math.min(b.L,b.R),38):0,a:'mock',btn:b?'Thi lại':'Vào thi'})}
  else if(x.k==='exam'){const e=S.ex[x.id]||{};const ok=e.L!=null&&e.R!=null;T.push({x:`Làm đề mẫu Band ${x.b} trên trang TOCFL, rồi nhập số câu đúng`,done:ok&&e.L>=35&&e.R>=35,p:ok?`Nghe ${e.L}/50, đọc ${e.R}/50. Cần mỗi phần từ 35`:'Chưa nhập điểm. Cần mỗi phần từ 35/50',pc:ok?pct(Math.min(e.L,e.R),35):0,exam:x.id})}
  else{const r=S.rt[x.u];T.push({x:`Kiểm tra lại cả ${UNITS[x.u].z-UNITS[x.u].a} từ, không học trước`,done:r>=90,p:r==null?'Chưa làm. Cần đúng ngay lần đầu từ 90%':`Lần gần nhất đúng ${r}%, cần 90%`,pc:r||0,a:'retest',arg:x.u,btn:r==null?'Bắt đầu':'Làm lại'})}
  return T}
const dayDone=i=>dayTasks(i).every(t=>t.done);
const dayStarted=i=>dayTasks(i).some(t=>t.pc>0);
const curIdx=()=>{for(let i=0;i<ND;i++)if(!dayDone(i))return i;return ND-1};
const calDay=()=>today()-dayOf(S.start)+1;
/* ===== Điều hướng ===== */
const NAV=[['hom-nay','Hôm nay'],['lo-trinh','Lộ trình'],['tu-vung','Từ vựng TOCFL'],['chu-phon','Chữ Phồn thể'],['dai-loan','Từ riêng Đài Loan'],['thi-thu','Thi thử'],['cam-nang','Cẩm nang kỳ thi']];
let sub=null;      /* phiên học thẻ, trắc nghiệm hoặc bài thi đang mở */
let ui={day:null,unit:null,gloss:{},shown:{},vq:''};
const ORD={};const ord=(k,n)=>ORD[k]||(ORD[k]=shuffle([...Array(n).keys()]));
const route=()=>{const h=location.hash.slice(1);return NAV.some(n=>n[0]===h)?h:'hom-nay'};
function render(){const r=route();
  const dw=dueWords().length,dc=dueCards().length;
  $('#nav').innerHTML=NAV.map(([h,t])=>{const n=h==='tu-vung'?dw:h==='chu-phon'?dc:0;return `<a href="#${h}" ${h===r?'aria-current="page"':''}>${t}${n?`<b>${n}</b>`:''}</a>`}).join('');
  const m=$('#main');
  m.innerHTML=sub?({mock:vMock,quiz:vQuiz,study:vStudy,wt:vWT,set:vSet})[sub.type]():({'hom-nay':vToday,'lo-trinh':vPlan,'tu-vung':vUnits,'chu-phon':vChars,'dai-loan':vVocab,'thi-thu':vMockHome,'cam-nang':vGuide})[r]();
  setSync(syncState)}
addEventListener('hashchange',()=>{if(sub&&sub.type==='mock'&&sub.stage!=='done'&&sub.stage!=='intro'){/* giữ bài thi */}else sub=null;ui.unit=null;stopSpeak();render();scrollTo(0,0)});

/* ===== Hôm nay ===== */
const chip=t=>t.done?'<span class="chip ok">Hoàn thành</span>':t.pc>0?`<span class="chip mid">Đang làm ${Math.min(99,t.pc)}%</span>`:'<span class="chip">Chưa làm</span>';
function taskList(i){return `<ul class="tasks">${dayTasks(i).map(t=>`<li class="${t.done?'done':''}"><div class="tk"><b>${esc(t.x)}</b><span class="muted small">${esc(t.p)}</span>${bar(Math.min(t.pc,100),100)}
   ${t.exam?`<div class="row"><label class="fld inl" for="ex-${t.exam}-L">Nghe<input type="number" min="0" max="50" id="ex-${t.exam}-L" data-c="ex" data-id="${t.exam}" data-f="L" value="${(S.ex[t.exam]||{}).L??''}"></label><label class="fld inl" for="ex-${t.exam}-R">Đọc<input type="number" min="0" max="50" id="ex-${t.exam}-R" data-c="ex" data-id="${t.exam}" data-f="R" value="${(S.ex[t.exam]||{}).R??''}"></label><a href="#cam-nang">Lấy đề ở đâu</a></div>`:''}</div>
   <div class="tkr">${chip(t)}${t.a?`<button class="btn sm ${t.done?'ghost':''}" data-a="${t.a}" data-arg="${t.arg??''}">${t.done?'Xem lại':t.btn}</button>`:''}</div></li>`).join('')}</ul>`}
function vToday(){const i=curIdx(),x=DAYS[i],due=dueWords().length,kn=knownWords(),cal=calDay(),doneDays=DAYS.filter((_,k)=>dayDone(k)).length,gap=cal-(i+1);
  return `<header class="head"><p class="eyebrow">Chặng ${x.k==='retest'?'vòng 2':'Band '+x.b} · ngày ${i+1} trên ${ND}</p><h1>${zh(dayTitle(i))}</h1>
   <p class="lead">Web tự đánh dấu hoàn thành khi bạn đạt mốc của từng việc. Xong hết các việc của ngày thì ngày kế tiếp tự mở.</p>${bar(doneDays,ND)}</header>
  <section class="tiles">
   <div class="tile"><span class="num">${kn}<small>/${WORDS.length}</small></span><span class="lab">từ TOCFL đã nắm</span></div>
   <div class="tile ${due?'attn':''}"><span class="num">${due}</span><span class="lab">từ đến hạn ôn</span>${due?'<button class="btn sm" data-a="wreview">Ôn ngay</button>':''}</div>
   <div class="tile"><span class="num">${doneDays}<small>/${ND}</small></span><span class="lab">ngày đã hoàn thành</span></div>
   <div class="tile ${gap>0?'attn':''}"><span class="num">${gap>0?'−'+gap:gap<0?'+'+(-gap):'0'}</span><span class="lab">${gap>0?'ngày chậm so với lịch':gap<0?'ngày nhanh hơn lịch':'đúng lịch'}</span></div>
  </section>
  <section class="card"><h2>Việc của ngày ${i+1}</h2>${taskList(i)}</section>
  ${x.k==='unit'&&UNITS[x.u].les?`<section class="card"><h2>Học kèm sách</h2><p>Hôm nay đi cùng ${zh(UNITS[x.u].t)}. Từ vựng được xếp theo đúng thứ tự bài 1 đến bài 10 của sách. Phần nghe có các bài "giọng thật" phát thẳng file nghe của sách: bài khoá của từng bài và các track nghe hiểu trong sách bài tập. Nên làm phần nghe trước khi mở sách đọc bài khoá, để đúng là nghe hiểu.</p></section>`:''}
  <section class="card"><h2>File nghe của sách</h2><p>Các bài nghe có nhãn "giọng thật" dùng file nghe của bộ sách ${zh('來學華語')}. File nằm trên máy của bạn, web không chứa sẵn. Mỗi thiết bị nạp một lần: chọn file zip mình gửi (hoặc các file zip gốc của sách), web chỉ lấy track bài khoá và track nghe hiểu.</p>
   <p><b>${ADB.keys.size}</b> track đang có trên thiết bị này. <span id="aud-msg" class="muted"></span></p>
   <div class="row"><label class="btn sm" for="in-aud">Nạp file nghe<input type="file" id="in-aud" accept=".zip,.mp3,audio/mpeg,application/zip" multiple data-c="aud" hidden></label>${ADB.keys.size?'<button class="btn sm ghost" data-a="audclear">Xoá file nghe khỏi máy này</button>':''}</div></section>
  <section class="card"><h2>Mốc thời gian</h2><div class="row">
   <label class="fld" for="in-start">Ngày bắt đầu<input type="date" id="in-start" value="${esc(S.start)}" data-c="start"></label>
   <label class="fld" for="in-exam">Ngày thi (nếu đã đăng ký)<input type="date" id="in-exam" value="${esc(S.exam)}" data-c="exam"></label></div>
   <p class="muted small">${S.exam?`Còn ${Math.max(0,dayOf(S.exam)-today())} ngày đến kỳ thi. `:''}Lịch tính mỗi ngày một đơn vị kể từ ngày bắt đầu. Ô "chậm so với lịch" so ngày theo lịch với ngày bạn thật sự đã hoàn thành.</p></section>
  <section class="card"><h2>Sao lưu tiến độ</h2><p>Tiến độ lưu riêng trên từng thiết bị. Tải file sao lưu về rồi nhập ở máy khác để học tiếp, hoặc giữ lại phòng khi xoá dữ liệu trình duyệt.</p>
   <div class="row"><button class="btn sm" data-a="export">Tải file sao lưu</button><label class="btn sm ghost" for="in-import">Nhập file sao lưu<input type="file" id="in-import" accept="application/json,.json" data-c="import" hidden></label></div>
   <p class="muted small">Nhập file sẽ thay toàn bộ tiến độ đang có trên thiết bị này.</p></section>`}

/* ===== Lộ trình ===== */
function vPlan(){const cur=curIdx(),sel=ui.day??cur;
  const groups=[['Chặng A · Band A','Sách 來學華語 第一冊, rồi phần còn lại của bảng từ 入門級 và 基礎級. Kết thúc bằng bài thi thử Band A.',i=>DAYS[i].k!=='retest'&&DAYS[i].b==='A'&&i<UNITS.length+3],
    ['Chặng B · Band B','Bảng từ 進階級 và 高階級, mỗi ngày khoảng 290 từ. Kết thúc bằng đề mẫu chính thức Band B.',i=>DAYS[i].k!=='retest'&&DAYS[i].b==='B'],
    ['Chặng C · Band C','Bảng từ 流利級, mỗi ngày khoảng 310 từ. Kết thúc bằng đề mẫu chính thức Band C.',i=>DAYS[i].k!=='retest'&&DAYS[i].b==='C'&&i<UNITS.length+3],
    ['Vòng 2 · kiểm tra lại và làm đề','Mỗi ngày kiểm tra lại một đơn vị từ mà không học trước, xen các buổi làm đề Band C.',i=>i>=UNITS.length+3]];
  return `<header class="head"><h1>Lộ trình ${ND} ngày</h1><p class="lead">Quy tắc: mỗi ngày một đơn vị khoảng 300 từ, đi theo thứ tự của bảng từ TOCFL chính thức từ cấp thấp lên cấp cao. Một ngày chỉ tính là xong khi bạn qua được bài kiểm tra từ, bài nghe và bài đọc của ngày đó.</p></header>
  ${groups.map(([t,note,f])=>{const idx=DAYS.map((_,i)=>i).filter(f);if(!idx.length)return'';return `<section class="card"><p class="eyebrow">Ngày ${idx[0]+1}–${idx[idx.length-1]+1}</p><h2>${zh(t)}</h2><p>${zh(note)}</p>
   <div class="days">${idx.map(i=>`<button class="day ${i===cur?'now':''} ${i===sel?'sel':''} ${dayDone(i)?'full':dayStarted(i)?'part':''} ${DAYS[i].k==='mock'||DAYS[i].k==='exam'?'test':''}" data-a="day" data-d="${i}" aria-label="Ngày ${i+1}">${i+1}</button>`).join('')}</div>
   ${idx.includes(sel)?`<div class="daybox"><h3>Ngày ${sel+1}${sel===cur?' (đang học)':''} · ${zh(dayTitle(sel))}</h3>${taskList(sel)}</div>`:''}</section>`}).join('')}
  <p class="muted small">Ô tô đậm là ngày đã xong, ô tô nhạt là ngày đang làm dở, ô viền đậm là ngày làm đề. Bạn có thể bấm vào ngày bất kỳ để làm trước.</p>`}

/* ===== Từ vựng ===== */
function vUnits(){if(ui.unit!=null)return vUnitList(ui.unit);const due=dueWords().length;
  return `<header class="head"><h1>Từ vựng TOCFL</h1><p class="lead">${WORDS.length} từ của bảng từ chính thức, chia thành ${UNITS.length} đơn vị. Bài kiểm tra cho bạn xem từ bằng chữ Phồn và chọn nghĩa. Từ nào đúng ngay lần đầu được tính là đã nắm, từ nào sai sẽ quay lại cho đến khi đúng.</p>
   ${due?`<button class="btn" data-a="wreview">Ôn ${due} từ đến hạn</button>`:''}</header>
  <section class="decks">${UNITS.map((u,i)=>{const s=unitStat(u),day=DAYS.findIndex(x=>x.k==='unit'&&x.u===i)+1;return `<article class="card deck"><p class="eyebrow">Ngày ${day} · Band ${u.b}</p><h2>${zh(u.t)}</h2>${bar(s.known,s.n)}<p class="small">${s.known}/${s.n} từ đã nắm${s.tested-s.known?`, ${s.tested-s.known} từ còn yếu`:''} ${s.known>=s.need?'<span class="chip ok">Hoàn thành</span>':''}</p>
   <div class="row"><button class="btn sm" data-a="wt" data-arg="${i}">${s.tested?'Kiểm tra tiếp':'Kiểm tra'}</button><button class="btn sm ghost" data-a="ulist" data-arg="${i}">Xem danh sách</button></div></article>`}).join('')}</section>
  <p class="muted small">Bảng từ: TOCFL bản 2023. Nghĩa tiếng Việt lấy tự động từ từ điển mở CVDICT nên đôi chỗ chưa sát nghĩa dùng trong đề.</p>`}
function vUnitList(ui_){const u=UNITS[ui_],rows=[];
  for(let i=u.a;i<u.z;i++){const le=u.les&&u.les.findIndex(r=>r[0]===i-u.a);if(u.les&&le>=0)rows.push(`<tr><th colspan="4">Bài ${le+1}</th></tr>`);const w=WORDS[i],r=S.w[i];
    rows.push(`<tr><td>${zh(showW(w),'b')}</td><td>${esc(w[2])}</td><td>${esc(w[3])}</td><td>${!r?'':r[0]>=1?'<span class="chip ok">đã nắm</span>':'<span class="chip bad">còn yếu</span>'}</td></tr>`)}
  return `<header class="head"><p class="eyebrow">Band ${u.b}</p><h1>${zh(u.t)}</h1><div class="row"><button class="btn" data-a="wt" data-arg="${ui_}">Kiểm tra</button><button class="btn ghost" data-a="ulist" data-arg="">Quay lại</button></div></header>
  <section class="card"><div class="scroll"><table><thead><tr><th>Từ</th><th>Phiên âm</th><th>Nghĩa</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`}
/* Phiên kiểm tra từ. mode: unit (học đơn vị), review (ôn đến hạn), retest (vòng 2), drill (nghe từ chọn chữ) */
function startWT(ids,title,mode,u,extra){if(!ids.length){toast('Không còn từ nào cần làm ở mục này.');return}
  sub=Object.assign({type:'wt',q:ids.slice(),i:0,title,mode,u,first:{},ok:0,n:0,ans:null,total:ids.length},extra||{});nextW();render();scrollTo(0,0);if(mode==='drill')sayW()}
function nextW(){const s=sub;s.ans=null;if(s.i>=s.q.length)return;const i=s.q[s.i],w=WORDS[i],pool=UNITS[s.u!=null?s.u:unitOf(i)],f=s.mode==='drill'?0:3,seen=new Set([w[f]]),o=[i];let g=0;
  while(o.length<4&&g++<300){const j=pool.a+Math.floor(Math.random()*(pool.z-pool.a));if(!seen.has(WORDS[j][f])&&WORDS[j][0]!==w[0]){seen.add(WORDS[j][f]);o.push(j)}}s.opts=shuffle(o)}
function sayW(){const s=sub;if(s&&s.type==='wt'&&s.i<s.q.length)speak([{t:WORDS[s.q[s.i]][0].split('/')[0].replace(/[（(].*?[)）]/g,''),s:'n'}]).then(ok=>{if(!ok)toast(noVoiceMsg)})}
function vWT(){const s=sub;
  if(s.i>=s.q.length){const p=pct(s.ok,s.n);
    return `<header class="head"><p class="eyebrow">${esc(s.title)}</p><h1>Đúng ngay lần đầu ${s.ok}/${s.n} từ (${p}%)</h1><p class="lead">${s.mode==='drill'?(p>=80?'Đạt mốc 80%. Việc này đã được đánh dấu hoàn thành.':'Chưa tới 80%. Làm lại để hoàn thành việc này.'):s.mode==='retest'?(p>=90?'Đạt mốc 90%. Đơn vị này đã vững.':'Chưa tới 90%. Các từ sai đã vào danh sách ôn, hãy ôn rồi kiểm tra lại.'):'Các từ sai lúc đầu đã được hỏi lại đến khi đúng, và sẽ quay lại vào ngày mai để chắc là bạn nhớ.'}</p><div class="row"><button class="btn" data-a="close">Quay lại</button></div></header>`}
  const i=s.q[s.i],w=WORDS[i],dr=s.mode==='drill',a=s.ans;
  return `<div class="study"><p class="eyebrow">${esc(s.title)} · còn ${s.q.length-s.i} từ · đúng lần đầu ${s.ok}/${s.n}</p>
   <div class="fc static">${dr?(a==null?`<p class="muted">Nghe rồi chọn đúng từ</p><button class="btn" data-a="wsay">Nghe lại</button>`:`<div class="face word" lang="zh-Hant">${esc(showW(w))}</div>`):`<div class="face word" lang="zh-Hant">${esc(showW(w))}</div>`}
    ${a!=null?`<div class="ans col"><span>${esc(w[2])}${w[1]!==w[0]?` · <span lang="zh-Hans" class="zh muted">${esc(w[1])}</span>`:''}</span><span>${esc(w[3])}</span></div>`:''}</div>
   <div class="opts ${dr?'four':''}">${s.opts.map((j,n)=>`<button class="opt ${dr?'big wd':''} ${a!=null?(j===i?'right':j===a?'wrong':''):''}" data-a="wpick" data-j="${j}" ${a!=null?'disabled':''} ${dr?'lang="zh-Hant"':''}>${dr?esc(WORDS[j][0].split('/')[0]):`<b>${n+1}</b> ${esc(WORDS[j][3])}`}</button>`).join('')}</div>
   <div class="row center">${a==null?`<button class="btn ghost" data-a="wpick" data-j="-1">Chưa biết từ này <kbd>0</kbd></button>`:`<button class="btn" data-a="wnext">Từ tiếp <kbd>Enter</kbd></button>`}${dr?'':`<button class="btn ghost sm" data-a="wsay">Nghe đọc</button>`}<button class="btn ghost sm" data-a="close">Tạm dừng</button></div>
   ${bar(s.i,s.q.length)}</div>`}
/* ===== Chữ Phồn thể ===== */
function vChars(){const due=dueCards().length,mk=MULTIC.filter(c=>isKnown(c.id)).length;
  return `<header class="head"><h1>Chữ Phồn thể</h1><p class="lead">${ALLC.length} chữ có dạng khác chữ Giản, chia theo quy tắc bộ thủ rồi theo chủ đề. Mặt trước là chữ Phồn, bạn đọc thầm rồi lật để kiểm tra.</p>
   ${due?`<button class="btn" data-a="review">Ôn ${due} thẻ đến hạn</button>`:'<p class="muted">Hôm nay chưa có thẻ nào đến hạn.</p>'}</header>
  <section class="decks">${DECKS.map(d=>{const k=d.cards.filter(c=>isKnown(c.id)).length;return `<article class="card deck"><h2>${d.i+1}. ${esc(d.name)}</h2><p class="muted small">${esc(d.note)}</p><p class="sample" lang="zh-Hant">${d.cards.slice(0,9).map(c=>c.f).join(' ')}</p>${bar(k,d.cards.length)}<p class="small">${k}/${d.cards.length} chữ đã thuộc</p>
   <div class="row"><button class="btn sm" data-a="study" data-deck="${d.i}">Học thẻ</button><button class="btn sm ghost" data-a="quiz" data-deck="${d.i}">Trắc nghiệm</button></div></article>`}).join('')}</section>
  <section class="card"><h2>Một chữ Giản, nhiều chữ Phồn</h2><p>Đây là chỗ người chuyển từ Giản sang hay sai nhất, vì không đoán được từ hình chữ. ${mk}/${MULTIC.length} mục đã thuộc.</p>
   <div class="row"><button class="btn sm" data-a="study" data-deck="multi">Học thẻ</button></div>
   <div class="scroll"><table><thead><tr><th>Giản</th><th>Phồn và ví dụ</th></tr></thead><tbody>${MULTIC.map(c=>`<tr><td class="big" lang="zh-Hans">${c.f}</td><td>${c.list.map(([t,e])=>`<span class="pair"><b lang="zh-Hant" class="zh">${t}</b> ${zh(e)}</span>`).join('')}</td></tr>`).join('')}</tbody></table></div></section>`}

function startStudy(cards,title,back){const q=cards.filter(c=>isDue(c.id)).concat(cards.filter(c=>!S.srs[c.id])).slice(0,40);
  sub={type:'study',q:q.length?q:cards.slice(0,40),i:0,flip:false,title,back,ok:0,n:0};render()}
function cardFace(c,flip){
  if(c.k==='c')return `<div class="face" lang="zh-Hant">${c.f}</div>${flip?`<div class="ans"><span lang="zh-Hans" class="big">${c.bk}</span><span class="muted">chữ Giản</span></div>`:''}`;
  if(c.k==='m')return `<div class="face" lang="zh-Hans">${c.f}</div><p class="muted">Chữ Giản này ứng với những chữ Phồn nào?</p>${flip?`<div class="ans col">${c.list.map(([t,e])=>`<span class="pair"><b lang="zh-Hant" class="zh big">${t}</b> ${zh(e)}</span>`).join('')}</div>`:''}`;
  return `<div class="face word" lang="zh-Hant">${esc(c.f)}</div>${flip?`<div class="ans col"><span><span class="muted">Đại lục:</span> <span lang="zh-Hans" class="zh big">${esc(c.bk)}</span></span><span>${esc(c.vi)}</span></div>`:''}`}
function vStudy(){const s=sub;if(s.i>=s.q.length)return `<header class="head"><h1>Xong lượt này</h1><p class="lead">Nhớ ${s.ok}/${s.n} lần lật. Thẻ chưa nhớ sẽ quay lại trong ngày, thẻ đã nhớ giãn dần 1, 2, 4, 8, 16 ngày.</p><div class="row"><button class="btn" data-a="close">Quay lại</button></div></header>`;
  const c=s.q[s.i];
  return `<div class="study"><p class="eyebrow">${esc(s.title)} · còn ${s.q.length-s.i} thẻ</p>
   <div class="fc" data-a="flip" tabindex="0" role="button" aria-label="Lật thẻ">${cardFace(c,s.flip)}</div>
   ${s.flip?`<div class="row center"><button class="btn bad" data-a="grade" data-ok="0">Chưa nhớ <kbd>1</kbd></button><button class="btn good" data-a="grade" data-ok="1">Nhớ rồi <kbd>2</kbd></button></div>`:`<div class="row center"><button class="btn" data-a="flip">Lật thẻ <kbd>Space</kbd></button></div>`}
   <div class="row center"><button class="btn ghost sm" data-a="say" data-t="${esc(c.k==='m'?c.list.map(x=>x[1]).join('。'):c.f)}">Nghe đọc</button><button class="btn ghost sm" data-a="close">Thoát</button></div></div>`}
function startQuiz(deck){const pool=deck.cards,qs=shuffle(pool).slice(0,20).map(c=>({c,opts:shuffle([c.bk,...shuffle(pool.filter(x=>x.bk!==c.bk)).slice(0,3).map(x=>x.bk)])}));
  sub={type:'quiz',qs,i:0,score:0,pick:null,title:deck.name};render()}
function vQuiz(){const s=sub;if(s.i>=s.qs.length)return `<header class="head"><h1>${s.score}/${s.qs.length} câu đúng</h1><p class="lead">${s.score/s.qs.length>=.9?'Đạt mốc 90%. Chuyển sang bộ thẻ kế tiếp được rồi.':'Chưa tới 90%. Học lại thẻ của bộ này rồi làm lại.'}</p><div class="row"><button class="btn" data-a="close">Quay lại</button></div></header>`;
  const q=s.qs[s.i];
  return `<div class="study"><p class="eyebrow">${esc(s.title)} · câu ${s.i+1}/${s.qs.length}</p><div class="fc static"><div class="face" lang="zh-Hant">${q.c.f}</div><p class="muted">Chữ Giản tương ứng là chữ nào?</p></div>
   <div class="opts four">${q.opts.map(o=>`<button class="opt big ${s.pick?(o===q.c.bk?'right':o===s.pick?'wrong':''):''}" lang="zh-Hans" data-a="qpick" data-o="${o}" ${s.pick?'disabled':''}>${o}</button>`).join('')}</div>
   <div class="row center">${s.pick?'<button class="btn" data-a="qnext">Câu tiếp</button>':''}<button class="btn ghost sm" data-a="close">Thoát</button></div></div>`}

/* ===== Từ vựng Đài Loan ===== */
function vVocab(){const k=VOCABC.filter(c=>isKnown(c.id)).length,f=ui.vq.trim().toLowerCase();
  const rows=VOCABC.filter(c=>!f||(c.f+c.bk+c.vi).toLowerCase().includes(f));
  return `<header class="head"><h1>Từ riêng Đài Loan</h1><p class="lead">Cùng một nghĩa nhưng Đài Loan dùng từ khác. Đề TOCFL dùng cách nói của Đài Loan, nên các từ này xuất hiện ngay từ Band A.</p>${bar(k,VOCABC.length)}<p class="small">${k}/${VOCABC.length} từ đã thuộc</p>
   <div class="row"><button class="btn" data-a="study" data-deck="vocab">Học thẻ</button></div></header>
  <section class="card"><h2>Bảng tra</h2><label class="fld" for="vq">Tìm theo chữ hoặc nghĩa<input id="vq" type="search" value="${esc(ui.vq)}" data-c="vq" placeholder="vd: mạng, 捷運"></label>
   <div class="scroll" id="vtab"><table><thead><tr><th>Đài Loan</th><th>Đại lục</th><th>Nghĩa</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${zh(c.f,'b')}</td><td><span lang="zh-Hans" class="zh">${esc(c.bk)}</span></td><td>${esc(c.vi)}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="card"><h2>Phát âm khác với sách HSK</h2><p>Phần nghe đọc theo chuẩn 國語. Ngoài các từ dưới đây, giọng Đài Loan ít thanh nhẹ, gần như không có âm cuốn 兒, và zh ch sh thường nhẹ hơn.</p>
   <div class="scroll"><table><thead><tr><th>Từ</th><th>Đài Loan</th><th>Đại lục</th><th></th></tr></thead><tbody>${PRONL.map(([w,a,b])=>`<tr><td>${zh(w,'b')}</td><td>${esc(a)}</td><td class="muted">${esc(b)}</td><td><button class="btn ghost sm" data-a="say" data-t="${esc(w)}">Nghe</button></td></tr>`).join('')}</tbody></table></div>
   <p class="muted small">Giọng máy không phải lúc nào cũng đọc đúng âm Đài Loan của từng từ. Hãy lấy phiên âm trong bảng làm chuẩn.</p></section>`}

/* ===== Bài nghe, bài đọc của từng ngày ===== */
function voiceBar(){return `<div class="row voice"><label class="fld inl" for="rate">Tốc độ<select id="rate" data-c="rate">${[.7,.85,1,1.15,1.3].map(r=>`<option value="${r}" ${S.rate==r?'selected':''}>${r}×</option>`).join('')}</select></label><button class="btn ghost sm" data-a="stop">Dừng đọc</button></div>`}
function qBlock(id,qi,q,opts,showQ){const key=id+'-'+qi,o=ord(key,opts.length),p=S.q[key+'p'];
  return `<div class="q" id="q-${key}">${showQ||p!=null?`<p class="qt">${zh(q)}</p>`:`<p class="qt muted">Nghe câu hỏi rồi chọn</p>`}
   <div class="opts">${o.map((oi,n)=>`<button class="opt ${p!=null?(oi===0?'right':oi===p?'wrong':''):''}" data-a="ans" data-k="${key}" data-o="${oi}" ${p!=null?'disabled':''}><b>${LET[n]}</b> ${zh(opts[oi])}</button>`).join('')}</div></div>`}
function passage(x){const g=ui.gloss[x.id];return `<div class="${x.k==='g'?'sign':'pass'}">${x.x.split('\n').map(p=>`<p>${zh(p)}</p>${g?`<p class="gloss" lang="zh-Hans">${esc(toSimp(p))}</p>`:''}`).join('')}</div><button class="link" data-a="gloss" data-id="${x.id}">${g?'Ẩn bản Giản thể':'Hiện bản Giản thể để đối chiếu'}</button>`}
function vSet(){const {kind,d}=sub,st=setStat(kind,d),items=setItems(kind,d),L=kind==='l';
  const head=`<header class="head"><p class="eyebrow">Ngày ${d} · ${L?'nghe':'đọc'} theo dạng đề</p><h1>${L?'Bài nghe':'Bài đọc'} ngày ${d}</h1>
   <p class="lead">${L?'Bấm Nghe, chọn đáp án rồi mới mở lời thoại. Câu hỏi được đọc sau đoạn hội thoại, giống trong phòng thi.':'Đọc bằng chữ Phồn trước. Chỉ mở bản Giản thể sau khi đã chọn đáp án.'}</p>
   <p>${st.pass?'<span class="chip ok">Hoàn thành</span> ':''}Đã làm ${st.done}/${st.n} câu, đúng ${st.ok}. Cần đúng từ ${Math.ceil(st.n*.8)} câu.</p>
   <div class="row">${st.done>st.ok?`<button class="btn sm" data-a="redo" data-arg="${kind+d}">Làm lại ${st.done-st.ok} câu sai</button>`:''}<button class="btn sm ghost" data-a="close">Quay lại</button></div>${L?voiceBar()+'<p id="tts-msg" class="warn" hidden></p>':''}</header>`;
  if(L)return head+items.map((x,n)=>{const all=x.qs.every((_,i)=>S.q[x.id+'-'+i+'p']!=null),open=all||ui.shown[x.id];return `<section class="card item"><div class="row between"><h2>${n+1}. ${zh(x.t||(x.qs.length>1?'段落':'對話'))}${x.src?' <span class="chip mid">giọng thật</span>':''}</h2><button class="btn sm" data-a="play" data-id="${x.id}">Nghe</button></div>
   ${x.qs.map(([q,o],i)=>qBlock(x.id,i,q,o,!!x.src&&!x.sq)).join('')}
   ${x.src?`<p class="muted small">File nghe thật của sách: ${zh(x.bk)}. ${usable(x)?'Lời thoại xem trong sách.':'Thiết bị này chưa có file nghe, nên bài này chưa tính vào mốc hoàn thành. Nạp file ở trang Hôm nay.'}</p>`:open?`<div class="script">${x.l.map(l=>`<p>${zh(l)}</p>`).join('')}</div>`:`<button class="link" data-a="show" data-id="${x.id}">Xem lời thoại</button>`}</section>`}).join('');
  return head+items.map((x,n)=>x.s?`<section class="card item"><h2>${n+1}. ${zh('選詞填空')}</h2>${qBlock(x.id,0,x.s,x.o,true)}</section>`:`<section class="card item"><h2>${n+1}. ${zh(x.t)}</h2>${passage(x)}${x.qs.map(([q,o],i)=>qBlock(x.id,i,q,o,true)).join('')}</section>`).join('')}

/* ===== Thi thử Band A ===== */
const PARTS_L=[['看圖回答','Nhìn hình, nghe câu hỏi và ba đáp án'],['問答理解','Nghe một câu, chọn câu đáp phù hợp'],['對話理解（圖片）','Nghe hội thoại, chọn hình'],['對話理解（文字）','Nghe hội thoại, chọn câu']];
const PARTS_R=[['單句理解','Đọc một câu, trả lời câu hỏi'],['看圖釋義','Đọc bảng hiệu, thông báo'],['選詞填空','Chọn từ điền chỗ trống'],['完成段落','Chọn câu điền vào đoạn văn'],['閱讀理解','Đọc hiểu']];
function buildMock(){const L=[],R=[],sp=s=>s.split('|');
  MOCK_A.L1.forEach(([pic,q,o])=>L.push({p:0,pic,q,o:sp(o),aud:true}));
  MOCK_A.L2.forEach(([q,o])=>L.push({p:1,q,o:sp(o),aud:true,stmt:true}));
  MOCK_A.L3.forEach(([l,q,o])=>L.push({p:2,l,q,o:sp(o),emoji:true}));
  MOCK_A.L4.forEach(([l,q,o])=>L.push({p:3,l,q,o:sp(o)}));
  MOCK_A.R1.forEach(([s,q,o])=>R.push({p:0,s,q,o:sp(o)}));
  MOCK_A.R2.forEach(([s,o])=>R.push({p:1,sign:s,q:'下面哪一個是對的？',o:sp(o)}));
  MOCK_A.R3.forEach(([s,o])=>R.push({p:2,s,o:sp(o)}));
  MOCK_A.R4.a.forEach((a,i)=>R.push({p:3,match:i,a,o:MOCK_A.R4.o,first:i===0}));
  MOCK_A.R5.forEach(([x,qs])=>qs.forEach(([q,o],i)=>R.push({p:4,text:i===0?x:null,q,o:sp(o)})));
  [...L,...R].forEach(it=>{it.ord=it.match!=null?[...it.o.keys()]:shuffle([...it.o.keys()]);it.ans=it.match!=null?it.a:0});
  return{type:'mock',stage:'intro',L,R,i:0,aL:{},aR:{},plays:{},end:0,playing:false}}
function vMockHome(){const h=S.hist.filter(x=>x.k==='A');
  return `<header class="head"><h1>Thi thử</h1><p class="lead">Bài thi thử Band A theo đúng khung đề thi trên máy: 50 câu nghe và 50 câu đọc, mỗi phần 60 phút, toàn bộ bằng chữ Phồn thể.</p></header>
  <section class="card"><h2>Band A · 入門基礎級</h2>
   <div class="cols"><div><h3>Nghe · 50 câu</h3><ol class="plain">${PARTS_L.map((p,i)=>`<li>${zh(p[0])} <span class="muted">${[15,15,10,10][i]} câu. ${p[1]}</span></li>`).join('')}</ol></div>
   <div><h3>Đọc · 50 câu</h3><ol class="plain">${PARTS_R.map((p,i)=>`<li>${zh(p[0])} <span class="muted">${[20,15,5,5,5][i]} câu. ${p[1]}</span></li>`).join('')}</ol></div></div>
   <ul class="notes"><li>Phần nghe đi một chiều, không quay lại câu trước. Mỗi câu được nghe tối đa 2 lần.</li><li>Ở hai phần nghe đầu, đáp án chỉ được đọc lên, không hiện chữ, giống đề thật.</li><li>Hình trong đề thật là tranh vẽ. Ở đây dùng biểu tượng thay cho tranh, và giọng đọc là giọng máy.</li><li>Đề do Claude soạn theo khung đề chính thức, không phải đề của Ủy ban TOCFL. Số câu từng phần có thể lệch đôi chút so với đề thật.</li></ul>
   <div class="row"><button class="btn" data-a="mock">Bắt đầu thi thử Band A</button></div></section>
  ${h.length?`<section class="card"><h2>Kết quả đã làm</h2><div class="scroll"><table><thead><tr><th>Ngày</th><th>Nghe</th><th>Đọc</th><th>Tổng</th></tr></thead><tbody>${h.slice().reverse().map(x=>`<tr><td>${esc(x.d)}</td><td>${x.L}/50</td><td>${x.R}/50</td><td><b>${x.L+x.R}/100</b></td></tr>`).join('')}</tbody></table></div></section>`:''}
  <section class="card"><h2>Band B và Band C</h2><p>Hai bài thi thử này chưa có trong web. Ở các ngày làm đề của chặng B và C, hãy dùng đề mẫu chính thức (模擬試題) trên trang của Ủy ban TOCFL, có file nghe do người thật đọc. Đường dẫn ở mục <a href="#cam-nang">Cẩm nang kỳ thi</a>.</p></section>`}
const fmt=s=>{s=Math.max(0,s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
let tick=null;
function startTimer(){clearInterval(tick);tick=setInterval(()=>{if(!sub||sub.type!=='mock'){clearInterval(tick);return}const left=Math.round((sub.end-Date.now())/1000),el=$('#timer');if(el)el.textContent=fmt(left);if(left<=0){if(sub.stage==='L'){stopSpeak();sub.stage='mid';render()}else if(sub.stage==='R')finishMock()}},500)}
function optBtn(it,idx,n,sel,review,ua){const cls=review?(idx===it.ans?'right':idx===ua?'wrong':''):(sel===idx?'sel':'');const hide=it.aud&&!review;
  return `<button class="opt ${it.emoji?'emo':''} ${cls}" data-a="${review?'':'mpick'}" data-o="${idx}" ${review?'disabled':''}><b>${LET[n]}</b> ${hide?'':it.emoji?`<span class="em">${it.o[idx]}</span>`:zh(it.o[idx])}</button>`}
function vMock(){const m=sub;
  if(m.stage==='intro')return `<header class="head"><h1>Thi thử Band A · Phần nghe</h1><p class="lead">50 câu, 60 phút. Hãy dùng tai nghe và ngồi chỗ yên tĩnh. Đồng hồ chạy ngay khi bạn bấm bắt đầu.</p>${voiceBar()}<div class="row"><button class="btn" data-a="mtest">Thử giọng đọc</button><button class="btn" data-a="mstartL">Bắt đầu phần nghe</button><button class="btn ghost" data-a="close">Thoát</button></div><p id="tts-msg" class="warn" hidden></p></header>`;
  if(m.stage==='mid')return `<header class="head"><h1>Xong phần nghe</h1><p class="lead">Tiếp theo là phần đọc: 50 câu, 60 phút. Ở phần này bạn được làm theo thứ tự tuỳ ý và sửa đáp án.</p><div class="row"><button class="btn" data-a="mstartR">Bắt đầu phần đọc</button></div></header>`;
  if(m.stage==='L'){const it=m.L[m.i],sel=m.aL[m.i],pl=m.plays[m.i]||0,first=m.i===0||m.L[m.i-1].p!==it.p;
   return `<div class="exam"><div class="exbar"><span>Nghe · câu ${m.i+1}/50</span><span id="timer" class="timer">${fmt(Math.round((m.end-Date.now())/1000))}</span></div>
    <p class="eyebrow">Phần ${it.p+1} · ${zh(PARTS_L[it.p][0])}</p>${first?`<p class="muted">${PARTS_L[it.p][1]}.</p>`:''}
    ${it.pic?`<div class="pic" aria-hidden="true">${esc(it.pic)}</div>`:''}
    <div class="row center"><button class="btn" data-a="mplay" ${pl>=2||m.playing?'disabled':''}>${m.playing?'Đang đọc…':pl===0?'Nghe':pl===1?'Nghe lần 2':'Đã nghe 2 lần'}</button></div>
    <div class="opts ${it.emoji||it.aud?'three':''}">${it.ord.map((idx,n)=>optBtn(it,idx,n,sel)).join('')}</div>
    <div class="row between"><span class="muted small">${sel==null?'Chưa chọn đáp án':''}</span><button class="btn" data-a="mnext">${m.i===49?'Nộp phần nghe':'Câu tiếp'}</button></div></div>`}
  if(m.stage==='R'){let n=0;
   return `<div class="exam"><div class="exbar sticky"><span>Đọc · đã làm <b id="rdone">${Object.keys(m.aR).length}</b>/50</span><span id="timer" class="timer">${fmt(Math.round((m.end-Date.now())/1000))}</span></div>
    ${PARTS_R.map((p,pi)=>`<section class="card"><p class="eyebrow">Phần ${pi+1} · ${zh(p[0])}</p><p class="muted">${p[1]}.</p>${m.R.map((it,qi)=>it.p!==pi?'':rItem(it,qi,++n,m.aR[qi],false)).join('')}</section>`).join('')}
    <div class="row"><button class="btn" data-a="mfinish">Nộp bài</button></div></div>`}
  return mockResult()}
function rItem(it,qi,n,sel,review){const ua=sel;
  let head='';
  if(it.text)head+=`<div class="pass">${it.text.split('\n').map(p=>`<p>${zh(p)}</p>`).join('')}</div>`;
  if(it.first)head+=`<div class="pass"><p>${zh(MOCK_A.R4.x)}</p></div><ol class="bank" type="A">${it.o.map(o=>`<li>${zh(o)}</li>`).join('')}</ol>`;
  if(it.sign)head+=`<div class="sign">${zh(it.sign)}</div>`;
  const stem=it.match!=null?`<p class="qt">${n}. Chỗ trống (${it.match+1})</p>`:`<p class="qt">${n}. ${it.s?zh(it.s):''}${it.s&&it.q?'<br>':''}${it.q?zh(it.q):''}</p>`;
  return `${head}<div class="q" data-qi="${qi}">${stem}<div class="opts ${it.match!=null?'six':''}">${it.ord.map((idx,k)=>it.match!=null?`<button class="opt ${review?(idx===it.ans?'right':idx===ua?'wrong':''):(sel===idx?'sel':'')}" data-a="${review?'':'mpick'}" data-o="${idx}" ${review?'disabled':''}><b>${LET[k]}</b></button>`:optBtn(it,idx,k,sel,review,ua)).join('')}</div></div>`}
function finishMock(){const m=sub;clearInterval(tick);stopSpeak();
  m.sL=m.L.filter((it,i)=>m.aL[i]===it.ans).length;m.sR=m.R.filter((it,i)=>m.aR[i]===it.ans).length;m.stage='done';
  S.hist.push({k:'A',d:isoOf(today()),L:m.sL,R:m.sR});save();render();scrollTo(0,0)}
function mockResult(){const m=sub,tot=m.sL+m.sR;
  const part=(arr,ans,names)=>names.map((p,pi)=>{const idx=arr.map((it,i)=>it.p===pi?i:-1).filter(i=>i>=0),ok=idx.filter(i=>ans[i]===arr[i].ans).length;return `<tr><td>${zh(p[0])}</td><td>${ok}/${idx.length}</td><td>${bar(ok,idx.length)}</td></tr>`}).join('');
  const verdict=m.sL>=45&&m.sR>=45?'Vững Band A cả hai kỹ năng. Chuyển sang giai đoạn Band B.':m.sL>=38&&m.sR>=38?'Qua được Band A nhưng còn hở. Xem lại từng câu sai bên dưới, học lại các chữ chưa đọc được rồi mới sang Band B.':'Chưa nên sang Band B. Với nền HSK 6, sai nhiều ở Band A thường là do chữ Phồn hoặc giọng đọc, không phải do ngữ pháp. Ôn lại thẻ chữ và nghe lại các câu sai.';
  let n=0;
  return `<header class="head"><p class="eyebrow">Kết quả thi thử Band A</p><h1>${tot}/100 câu đúng</h1><p class="lead">${verdict}</p></header>
  <section class="tiles"><div class="tile"><span class="num">${m.sL}<small>/50</small></span><span class="lab">Nghe</span></div><div class="tile"><span class="num">${m.sR}<small>/50</small></span><span class="lab">Đọc</span></div></section>
  <section class="card"><h2>Theo từng phần</h2><div class="scroll"><table class="parts"><tbody><tr><th colspan="3">Nghe</th></tr>${part(m.L,m.aL,PARTS_L)}<tr><th colspan="3">Đọc</th></tr>${part(m.R,m.aR,PARTS_R)}</tbody></table></div>
   <p class="muted small">Đề thật chấm theo thang 80 điểm quy đổi theo độ khó từng câu, nên số câu đúng ở đây chỉ để tự đánh giá, không đổi thẳng ra điểm thi.</p></section>
  <section class="card"><h2>Xem lại phần nghe</h2>${m.L.map((it,i)=>`<div class="q rev ${m.aL[i]===it.ans?'':'miss'}"><p class="qt">${i+1}. ${it.pic?`<span class="em">${esc(it.pic)}</span> `:''}</p><div class="script">${(it.l||[]).map(l=>`<p>${zh(l)}</p>`).join('')}<p>${zh((it.stmt?'':'問：')+it.q)}</p></div><div class="opts">${it.ord.map((idx,k)=>optBtn({...it,aud:false},idx,k,null,true,m.aL[i])).join('')}</div>${m.aL[i]==null?'<p class="muted small">Bạn chưa chọn.</p>':''}<button class="link" data-a="replay" data-i="${i}">Nghe lại</button></div>`).join('')}</section>
  <section class="card"><h2>Xem lại phần đọc</h2>${m.R.map((it,qi)=>`<div class="rev ${m.aR[qi]===it.ans?'':'miss'}">${rItem(it,qi,++n,m.aR[qi],true)}</div>`).join('')}</section>
  <div class="row"><button class="btn" data-a="close">Đóng</button></div>`}
function mockLines(it){const L=[];if(it.l)L.push(...parseLines(it.l));
  L.push({t:(it.l?'問題：':'')+it.q,s:'n'});
  if(it.aud)it.ord.forEach((idx,n)=>L.push({t:LET[n]+'，'+it.o[idx],s:'n'}));return L}

/* ===== Cẩm nang ===== */
function vGuide(){const A=(u,t)=>`<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
  return `<header class="head"><h1>Cẩm nang kỳ thi</h1><p class="lead">Những điều cần biết về TOCFL nghe và đọc, và các nguồn nên dùng song song với web này.</p></header>
  <section class="card"><h2>Ba band, sáu cấp</h2><div class="scroll"><table><thead><tr><th>Band</th><th>Cấp</th><th>CEFR</th><th>Vốn từ</th><th>Chứng chỉ: tổng, nghe, đọc tối thiểu</th></tr></thead><tbody>
   <tr><td rowspan="2">A ${zh('入門基礎級')}</td><td>1 ${zh('入門級')}</td><td>A1</td><td>500</td><td>83 · 37 · 38</td></tr><tr><td>2 ${zh('基礎級')}</td><td>A2</td><td>1.000</td><td>120 · 51 · 53</td></tr>
   <tr><td rowspan="2">B ${zh('進階高階級')}</td><td>3 ${zh('進階級')}</td><td>B1</td><td>2.500</td><td>94 · 42 · 44</td></tr><tr><td>4 ${zh('高階級')}</td><td>B2</td><td>5.000</td><td>125 · 53 · 56</td></tr>
   <tr><td rowspan="2">C ${zh('流利精通級')}</td><td>5 ${zh('流利級')}</td><td>C1</td><td>8.000</td><td>102 · 46 · 47</td></tr><tr><td>6 ${zh('精通級')}</td><td>C2</td><td>8.000</td><td>130 · 54 · 61</td></tr></tbody></table></div>
   <p class="muted small">Mỗi kỹ năng tối đa 80 điểm. Mốc điểm cấp chứng chỉ theo thông báo áp dụng từ năm 2020 cho bài thi theo band. Hãy xem lại trên trang chính thức trước khi đăng ký vì quy định có thể đổi.</p></section>
  <section class="card"><h2>Cấu trúc đề</h2><div class="scroll"><table><thead><tr><th>Band</th><th>Nghe · 50 câu · khoảng 60 phút</th><th>Đọc · 50 câu · 60 phút</th></tr></thead><tbody>
   <tr><td>A</td><td>${zh('看圖回答、問答理解、對話理解')}</td><td>${zh('單句理解、看圖釋義、選詞填空、完成段落、閱讀理解')}</td></tr>
   <tr><td>B</td><td>${zh('對話、段落')}</td><td>${zh('選詞填空、閱讀理解')}</td></tr>
   <tr><td>C</td><td>${zh('對話、段落')}</td><td>${zh('選詞填空、閱讀理解')}</td></tr></tbody></table></div>
   <ul class="notes"><li>Thi một band, kết quả xếp vào một trong hai cấp của band đó. Mục tiêu C1 hoặc C2 nghĩa là đăng ký Band C.</li><li>Ở Việt Nam, bài thi tổ chức trên máy tính và thí sinh được chọn đề chữ Phồn hoặc chữ Giản. Bạn đã chọn Phồn thể, nên khi đăng ký nhớ chọn đúng.</li><li>Ở Đài Loan, bài nghe đọc hiện là dạng thích ứng (CAT): không chọn band, câu sau khó hay dễ tuỳ câu trước.</li><li>Lịch thi và điểm thi tại Việt Nam do Phòng Giáo dục, Văn phòng Kinh tế và Văn hoá Đài Bắc công bố theo từng năm. Đăng ký trực tuyến, chọn khu vực VIET NAM.</li></ul></section>
  <section class="card"><h2>Từ HSK 6 sang TOCFL: khoảng cách nằm ở đâu</h2><ul class="notes"><li><b>Chữ.</b> Khoảng một phần ba số chữ thường dùng có dạng Phồn khác dạng Giản. Mục Chữ Phồn thể gom ${ALLC.length} chữ hay gặp nhất, đủ cho Band A và B. Lên Band C sẽ gặp thêm chữ hiếm, học qua bài đọc.</li><li><b>Từ.</b> HSK 6 cũ khoảng 5.000 từ, Band C cần khoảng 8.000 từ, lại có nhiều từ riêng của Đài Loan. Mục Từ vựng TOCFL chứa toàn bộ ${WORDS.length} từ của bảng từ chính thức bản 2023, chia theo ngày.</li><li><b>Nghe.</b> Giọng, tốc độ và cách dùng từ khác băng HSK. Cần nghe nguồn Đài Loan mỗi ngày.</li><li><b>Thời gian.</b> Hơn hai tháng với 5 đến 6 giờ mỗi ngày là đủ để chắc Band B và có cơ hội thật ở Level 5. Level 6 đòi hỏi vốn đọc rộng, nên coi đó là mục tiêu vươn tới.</li></ul></section>
  <section class="card"><h2>Nguồn dữ liệu của web</h2><ul class="notes"><li>Bảng từ: bảng từ TOCFL bản 2023 của Ủy ban TOCFL, lấy qua kho ${A('https://github.com/ivankra/tocfl','ivankra/tocfl')}.</li><li>Nghĩa tiếng Việt: từ điển mở ${A('https://github.com/ph0ngp/CVDICT','CVDICT')} của Phong Phan, giấy phép CC BY-SA 4.0, được chọn nghĩa tự động.</li><li>Ngày 1 đến 4 đi theo bộ sách ${zh('來學華語')} quyển 1 đến 3 của Ủy ban Sự vụ Cộng đồng người Hoa hải ngoại. Web không chứa bài khoá hay file nghe của sách: file nghe do bạn tự nạp vào máy, câu hỏi do Claude soạn.</li></ul></section>
  <section class="card"><h2>Nguồn chính thức</h2><ul class="links">
   <li>${A('https://tocfl.edu.tw/','Ủy ban TOCFL (華測會)')}<span>Vào 學習資源 để tải đề mẫu 模擬試題 từng band kèm file nghe, và bảng từ vựng theo cấp.</span></li>
   <li>${A('https://tocfl.edu.tw/OS/','Hệ thống đăng ký thi')}<span>Chọn Test area là VIET NAM để xem các đợt thi trong nước.</span></li>
   <li>${A('https://coct.naer.edu.tw/','COCT, 國家教育研究院')}<span>Chuẩn năng lực tiếng Hoa của Đài Loan (TBCL): bảng chữ, bảng từ, điểm ngữ pháp theo cấp.</span></li></ul></section>
  <section class="card"><h2>Từ điển và tài liệu đọc, nghe</h2><ul class="links">
   <li>${A('https://www.moedict.tw/','萌典')}<span>Từ điển Bộ Giáo dục Đài Loan, có chú âm, phát âm chuẩn 國語 và thứ tự nét.</span></li>
   <li>${A('https://dict.revised.moe.edu.tw/','教育部重編國語辭典')}<span>Tra thành ngữ và từ văn viết cho Band C.</span></li>
   <li>${A('https://www.mdnkids.com/','國語日報')}<span>Báo thiếu nhi, câu ngắn, hợp với mười ngày đầu làm quen chữ.</span></li>
   <li>${A('https://news.pts.org.tw/','公視新聞網')}<span>Tin tức truyền hình công, có bài viết kèm video. Dùng cho Band B và C.</span></li>
   <li>${A('https://www.twreporter.org/','報導者')}<span>Phóng sự điều tra dài, văn phong gần với bài đọc Band C.</span></li>
   <li>${A('https://www.cw.com.tw/','天下雜誌')}<span>Kinh tế, xã hội, giáo dục. Đọc phần bình luận để quen cách lập luận.</span></li></ul></section>`}

/* ===== Sự kiện ===== */
const ACT={
 day(el){ui.day=+el.dataset.d;render()},
 wt(el){const k=+el.dataset.arg,u=UNITS[k],ids=[];for(let i=u.a;i<u.z;i++){const r=S.w[i];if(!r||r[0]<1)ids.push(i)}
   if(!ids.length){ui.unit=k;location.hash='tu-vung';render();toast('Bạn đã nắm hết từ của đơn vị này. Đây là danh sách để xem lại.');return}startWT(ids,u.t,'unit',k)},
 wreview(){startWT(shuffle(dueWords()).slice(0,100),'Ôn từ đến hạn','review',null)},
 retest(el){const k=+el.dataset.arg,u=UNITS[k];startWT(shuffle([...Array(u.z-u.a).keys()].map(i=>i+u.a)),'Vòng 2 · '+u.t,'retest',k)},
 drill(el){const d=+el.dataset.arg,x=DAYS[d-1],u=UNITS[x.u];startWT(shuffle([...Array(u.z-u.a).keys()].map(i=>i+u.a)).slice(0,30),'Nghe từ, chọn chữ · ngày '+d,'drill',x.u,{day:d})},
 ulist(el){ui.unit=el.dataset.arg===''?null:+el.dataset.arg;if(sub)sub=null;if(route()!=='tu-vung')location.hash='tu-vung';render();scrollTo(0,0)},
 wsay(){sayW()},
 wpick(el){const s=sub;if(!s||s.type!=='wt'||s.ans!=null)return;const cur=s.q[s.i],j=+el.dataset.j,ok=j===cur;
   if(s.first[cur]===undefined){s.first[cur]=ok;s.n++;if(ok)s.ok++}
   if(s.mode!=='drill'){gradeW(cur,ok);if(!ok)s.q.push(cur)}
   s.ans=j;render();if(ok)setTimeout(()=>{if(sub===s&&s.ans===j&&s.q[s.i]===cur)ACT.wnext()},s.mode==='drill'?900:600)},
 wnext(){const s=sub;if(!s||s.type!=='wt'||s.ans==null)return;s.i++;nextW();
   if(s.i>=s.q.length){const p=pct(s.ok,s.n);if(s.mode==='retest'){S.rt[s.u]=p;save()}if(s.mode==='drill'){S.dr['d'+s.day]=Math.max(p,S.dr['d'+s.day]||0);save()}}
   render();if(s.mode==='drill'&&s.i<s.q.length)sayW()},
 set(el){const a=el.dataset.arg;sub={type:'set',kind:a[0],d:+a.slice(1)};render();scrollTo(0,0)},
 redo(el){const a=el.dataset.arg;setItems(a[0],+a.slice(1)).forEach(x=>(x.qs||[0]).forEach((_,i)=>{const k=x.id+'-'+i;if(S.q[k+'p']!=null&&S.q[k+'p']!==0){delete S.q[k+'p'];delete ORD[k]}}));save();render()},
 review(){startStudy(dueCards(),'Ôn thẻ đến hạn')},
 study(el){const d=el.dataset.deck;d==='multi'?startStudy(MULTIC,'Một Giản, nhiều Phồn'):d==='vocab'?startStudy(VOCABC,'Từ riêng Đài Loan'):startStudy(DECKS[+d].cards,DECKS[+d].name)},
 quiz(el){startQuiz(DECKS[+el.dataset.deck])},
 flip(){if(sub&&sub.type==='study'&&sub.i<sub.q.length){sub.flip=!sub.flip;render()}},
 grade(el){const s=sub,c=s.q[s.i],ok=el.dataset.ok==='1';grade(c.id,ok);s.n++;if(ok)s.ok++;else s.q.push(c);s.i++;s.flip=false;render()},
 qpick(el){const s=sub,q=s.qs[s.i];s.pick=el.dataset.o;const ok=s.pick===q.c.bk;if(ok)s.score++;if(S.srs[q.c.id]||!ok)grade(q.c.id,ok);render()},
 qnext(){sub.i++;sub.pick=null;render()},
 pclose(){stopTrack()},
 async audclear(){await adbClear();render();toast('Đã xoá file nghe của sách khỏi thiết bị này.')},
 close(){stopTrack();if(sub&&sub.type==='mock'){clearInterval(tick);stopSpeak()}sub=null;render();scrollTo(0,0)},
 async say(el){const ok=await speak([{t:el.dataset.t,s:'n'}]);if(!ok)toast(noVoiceMsg)},
 stop(){stopSpeak()},
 export(){const blob=new Blob([JSON.stringify(S)],{type:'application/json'}),u=URL.createObjectURL(blob),l=document.createElement('a');l.href=u;l.download='hoc-phon-tien-do-'+isoOf(today())+'.json';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('Đã tạo file sao lưu. Xem trong thư mục tải về.')},
 async install(){if(!installEvt)return;installEvt.prompt();try{await installEvt.userChoice}catch(e){}installEvt=null;showInstall()},
 async play(el){const x=LISTEN.find(i=>i.id===el.dataset.id);
   if(x.src){const ok=await playTrack(x);if(!ok)toast('Chưa có file nghe của sách trên thiết bị này. Vào trang Hôm nay, mục File nghe của sách, để nạp.');return}
   stopTrack();const L=parseLines(x.l);x.qs.forEach(([q],i)=>L.push({t:(x.qs.length>1?`第${'一二三'[i]}題，`:'問題：')+q,s:'n'}));
   const ok=await speak(L);if(!ok){const m=$('#tts-msg');if(m){m.hidden=false;m.textContent=noVoiceMsg}}},
 show(el){ui.shown[el.dataset.id]=1;render()},
 gloss(el){ui.gloss[el.dataset.id]=!ui.gloss[el.dataset.id];render()},
 ans(el){const k=el.dataset.k;S.q[k+'p']=+el.dataset.o;save();const y=scrollY;render();scrollTo(0,y)},
 mock(){sub=buildMock();render();scrollTo(0,0)},
 async mtest(){const ok=await speak([{t:'歡迎參加華語文能力測驗。',s:'n'},{t:'你好，今天天氣很好。',s:'f'},{t:'是啊，我們出去走走吧。',s:'m'}]);const m=$('#tts-msg');if(m&&!ok){m.hidden=false;m.textContent=noVoiceMsg}},
 mstartL(){sub.stage='L';sub.i=0;sub.end=Date.now()+60*60e3;startTimer();render();scrollTo(0,0)},
 mstartR(){sub.stage='R';sub.end=Date.now()+60*60e3;startTimer();render();scrollTo(0,0)},
 async mplay(){const m=sub,i=m.i;m.plays[i]=(m.plays[i]||0)+1;m.playing=true;render();const ok=await speak(mockLines(m.L[i]));if(sub===m&&m.stage==='L'){m.playing=false;if(!ok){m.plays[i]--;toast(noVoiceMsg)}if(m.i===i)render()}},
 mpick(el){const m=sub,o=+el.dataset.o;if(m.stage==='L'){m.aL[m.i]=o;render()}else{const q=el.closest('.q'),qi=+q.dataset.qi;m.aR[qi]=o;q.querySelectorAll('.opt').forEach(b=>b.classList.toggle('sel',b===el));$('#rdone').textContent=Object.keys(m.aR).length}},
 mnext(){const m=sub;stopSpeak();m.playing=false;if(m.i>=49){m.stage='mid';clearInterval(tick)}else m.i++;render();scrollTo(0,0)},
 mfinish(){const left=50-Object.keys(sub.aR).length;if(left&&!sub.confirm){sub.confirm=true;toast(`Còn ${left} câu chưa chọn. Bấm Nộp bài lần nữa để nộp.`);return}finishMock()},
 async replay(el){const ok=await speak(mockLines(sub.L[+el.dataset.i]));if(!ok)toast(noVoiceMsg)}
};
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,6000)}
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el||!el.dataset.a||el.disabled)return;if(el.tagName==='INPUT')return;const f=ACT[el.dataset.a];if(f)f(el)});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.a==='task')return ACT.task(el);const c=el.dataset.c;if(!c||c==='vq')return;
  if(c==='aud'){const fs=[...el.files];if(!fs.length)return;const msg=t=>{const m=$('#aud-msg');if(m)m.textContent=t};msg('Đang đọc file, đừng tắt trang…');
    audImport(fs,msg).then(n=>{render();toast(n?`Đã nạp ${n} track nghe của sách.`:'Không tìm thấy track phù hợp trong file đã chọn.')}).catch(()=>{render();toast('Không đọc được file này. Hãy thử lại với file zip mình gửi.')});return}
  if(c==='import'){const f=el.files&&el.files[0];if(!f)return;f.text().then(t=>{const d=JSON.parse(t);if(!d||typeof d!=='object'||typeof d.srs!=='object'||!d.start)throw 0;S=normalize(d);save();render();toast('Đã nhập tiến độ từ file sao lưu.')}).catch(()=>toast('File này không phải file sao lưu của web. Hãy chọn file .json đã tải từ nút Tải file sao lưu.'));return}
  if(c==='ex'){const v=el.value===''?null:Math.max(0,Math.min(50,+el.value)),e=S.ex[el.dataset.id]||(S.ex[el.dataset.id]={});if(v==null)delete e[el.dataset.f];else e[el.dataset.f]=v;save();render();return}
  if(c==='start'){if(el.value){S.start=el.value;ui.day=null}}else if(c==='exam')S.exam=el.value;else if(c==='rate'){S.rate=+el.value;const au=$('#pl-audio');if(au)au.playbackRate=S.rate}else if(c==='voice')S.voice=el.value;save();if(c==='start'||c==='exam')render()});
document.addEventListener('input',e=>{if(e.target.dataset.c==='vq'){ui.vq=e.target.value;const f=ui.vq.trim().toLowerCase();document.querySelectorAll('#vtab tbody tr').forEach(tr=>tr.hidden=!!f&&!tr.textContent.toLowerCase().includes(f))}});
document.addEventListener('keydown',e=>{if(sub&&sub.type==='wt'&&sub.i<sub.q.length&&!e.target.closest('input,select')){const s=sub;
    if(s.ans==null&&/^[1-4]$/.test(e.key)&&s.opts[+e.key-1]!=null){e.preventDefault();ACT.wpick({dataset:{j:s.opts[+e.key-1]}})}
    else if(s.ans==null&&e.key==='0'){e.preventDefault();ACT.wpick({dataset:{j:-1}})}
    else if(s.ans!=null&&(e.key==='Enter'||e.key===' ')){e.preventDefault();ACT.wnext()}return}
  if(!sub||sub.type!=='study'||sub.i>=sub.q.length)return;if(e.target.closest('input,select,button')&&e.key===' ')return;
  if(e.key===' '||e.key==='Enter'){e.preventDefault();ACT.flip()}else if(sub.flip&&(e.key==='1'||e.key==='2'))ACT.grade({dataset:{ok:e.key==='2'?'1':'0'}})});
try{speechSynthesis.onvoiceschanged=()=>{}}catch(e){}voices();
if(window.claude&&claude.use)claude.use('tts').then(t=>{TTS.cl=t}).catch(()=>{});
let installEvt=null;
function showInstall(){const b=$('#install');if(b)b.hidden=!installEvt}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;showInstall()});
addEventListener('appinstalled',()=>{installEvt=null;showInstall()});
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
adbOpen().then(()=>{if(!sub)render()});
render();initCloud();
