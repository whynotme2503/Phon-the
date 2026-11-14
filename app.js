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
const defaults=()=>({start:isoOf(today()),exam:'',done:{},srs:{},q:{},hist:[],voice:'auto',rate:1,t:0});
let S=defaults();
try{const raw=localStorage.getItem(KEY);if(raw)S=Object.assign(defaults(),JSON.parse(raw))}catch(e){}
let cloud=null,saveTimer=null,writing=false,dirty=false,syncState='local';
function setSync(s){syncState=s;const el=$('#sync');if(el)el.textContent=s==='ok'?'Tiến độ được lưu theo tài khoản của bạn':s==='err'?'Chưa lưu được lên tài khoản, đang giữ trên trình duyệt này':'Tiến độ đang lưu trên trình duyệt này'}
function save(){S.t=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(push,4000)}
async function push(){if(!cloud||writing||!dirty)return;writing=true;dirty=false;try{await cloud.set({json:JSON.stringify(S),t:S.t});setSync('ok')}catch(e){setSync('err')}writing=false;if(dirty){clearTimeout(saveTimer);saveTimer=setTimeout(push,4000)}}
async function initCloud(){try{if(!window.claude||!claude.use)return;const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);if(!db||!user)return;const id=await user.id();if(!id)return;cloud=db.doc('data/users/'+id+'/progress');const snap=await cloud.get();if(snap.exists){const d=snap.data();if(d&&d.json&&d.t>(S.t||0)){S=Object.assign(defaults(),JSON.parse(d.json));try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(!sub)render()}}setSync('ok');if(dirty||!snap.exists&&S.t)push()}catch(e){}}

/* ===== Giọng đọc ===== */
const TTS={cl:null,tok:0};
function voices(){try{return speechSynthesis.getVoices()}catch(e){return[]}}
const twVoice=()=>voices().find(v=>/zh[-_](TW|Hant)/i.test(v.lang))||null;
const zhVoice=()=>voices().find(v=>/^zh/i.test(v.lang))||null;
function stopSpeak(){TTS.tok++;try{speechSynthesis.cancel()}catch(e){}try{TTS.cl&&TTS.cl.stop()}catch(e){}}
function parseLines(l){return l.map(x=>{const m=/^(男|女)：(.*)$/s.exec(x);return m?{t:m[2],s:m[1]==='男'?'m':'f'}:{t:x,s:'n'}})}
function ttsMode(){const tw=twVoice();if(!voices().length&&'speechSynthesis' in window&&!TTS.cl)return 'b';if(S.voice==='browser')return (tw||zhVoice())?'b':TTS.cl?'c':'';if(S.voice==='claude')return TTS.cl?'c':(tw||zhVoice())?'b':'';return tw?'b':TTS.cl?'c':zhVoice()?'b':''}
async function speak(lines){stopSpeak();const my=TTS.tok,mode=ttsMode();
  if(!mode)return false;
  if(mode==='c'){try{await TTS.cl.speak(lines.map(l=>({text:l.t,voice:l.s==='f'?'airy':l.s==='m'?'rounded':'buttery',language:'zh-TW'})),{rate:Math.min(1.5,Math.max(.7,S.rate))});return true}catch(e){return my!==TTS.tok}}
  const v=twVoice()||zhVoice();
  for(const l of lines){for(const part of l.t.match(/[^。！？；]+[。！？；]?/g)||[l.t]){if(my!==TTS.tok)return true;
    await new Promise(res=>{const u=new SpeechSynthesisUtterance(part);u.lang='zh-TW';u.voice=v;u.rate=S.rate;u.pitch=l.s==='f'?1.2:l.s==='m'?.8:1;u.onend=res;u.onerror=res;speechSynthesis.speak(u)})}
    if(my!==TTS.tok)return true;await sleep(400)}
  return true}
const noVoiceMsg='Thiết bị này chưa có giọng đọc tiếng Trung. Hãy mở trang bằng Chrome hoặc Edge trên máy tính, hoặc cài giọng 中文（台灣） trong phần cài đặt giọng nói của máy.';

/* ===== SRS ===== */
const IV=[0,1,2,4,8,16,32];
function grade(id,ok){const c=S.srs[id];const b=ok?Math.min((c?c[0]:0)+1,6):0;S.srs[id]=[b,today()+IV[b]];save()}
const isDue=id=>S.srs[id]&&S.srs[id][1]<=today();
const isKnown=id=>S.srs[id]&&S.srs[id][0]>=1;
const ALLCARDS=()=>[...ALLC,...MULTIC,...VOCABC];
const dueCards=()=>ALLCARDS().filter(c=>isDue(c.id));
const pct=(a,b)=>b?Math.round(a/b*100):0;
const bar=(a,b)=>`<div class="bar" role="img" aria-label="${a} trên ${b}"><i style="width:${pct(a,b)}%"></i></div>`;

/* ===== Lộ trình 70 ngày ===== */
const PH=[
 {n:'Giai đoạn 1',t:'Chuyển sang chữ Phồn và Band A',a:1,b:10,goal:'Đọc trôi chữ Phồn thể ở mức cơ bản, quen giọng Đài Loan, qua bài thi thử Band A.'},
 {n:'Giai đoạn 2',t:'Band B (Level 3–4)',a:11,b:30,goal:'Nghe hội thoại và thông báo tốc độ thường, đọc bài 300–500 chữ, vốn từ khoảng 5.000 từ theo chuẩn Đài Loan.'},
 {n:'Giai đoạn 3',t:'Band C (Level 5–6)',a:31,b:63,goal:'Xã luận, tin kinh tế xã hội, thành ngữ và văn viết. Đây là giai đoạn dài nhất vì khoảng cách từ 5.000 lên 8.000 từ nằm ở đây.'},
 {n:'Giai đoạn 4',t:'Tổng ôn và làm đề',a:64,b:70,goal:'Làm đề đúng giờ, soát lỗi, giữ nhịp trước ngày thi.'}];
const TOPB=['交通與旅遊','購物與消費','工作與職場','健康與醫療','教育與校園','居住與租屋','飲食文化','科技與網路','環境與氣候','銀行、郵局與公共服務','休閒與運動','人際關係','媒體與廣告','節慶與習俗','社區與公共事務','天氣與自然','家庭與世代','藝術與娛樂','求職與面試','總複習'];
const TOPC=['經濟與物價','少子化與高齡社會','教育改革','能源與環保','科技倫理與人工智慧','醫療與公共衛生','都市發展與居住正義','媒體識讀','勞動與職場','文化資產保存','地方創生','國際貿易','法律與人權','心理與行為科學','企業經營','農業與糧食','交通政策','語言與認同','藝術評論','科學新知','災害防救'];
const phaseOf=d=>PH.find(p=>d>=p.a&&d<=p.b)||PH[3];
function tasksFor(d){const T=(x,m,go)=>({x,m,go});
  if(d<=10){const deck=DECKS[d-1];
    if(d===10)return[T('Ôn toàn bộ thẻ đến hạn',45,'chu-phon'),T('Làm bài thi thử Band A đủ 2 phần, không dừng giữa chừng',120,'thi-thu'),T('Xem lại từng câu sai, ghi chữ chưa đọc được vào sổ',60,'thi-thu'),T('Đọc phần cấu trúc đề Band B để chuẩn bị giai đoạn 2',20,'cam-nang')];
    return[T(deck?`Học bộ thẻ mới: ${deck.name} (${deck.cards.length} chữ), sau đó làm trắc nghiệm đến khi đúng từ 90%`:'Học lại các chữ còn sai nhiều',90,'chu-phon'),
      T('Ôn thẻ đến hạn',30,'chu-phon'),
      T(d<=5?'Một Giản, nhiều Phồn: học 12 mục':'Từ dùng khác ở Đài Loan: học 20 từ, đọc bảng phát âm',45,d<=5?'chu-phon':'tu-vung'),
      T('Nghe Band A: làm bài trong mục Luyện nghe, rồi nghe lại và nhại theo từng câu',60,'nghe'),
      T('Đọc Band A: bài trong mục Luyện đọc và một bài báo thiếu nhi 國語日報',50,'doc'),
      T('Gõ lại 15 câu vừa đọc bằng bộ gõ Phồn thể (Pinyin đầu ra 繁體 hoặc 注音)',30,'')]}
  if(d<=30){const tp=TOPB[(d-11)%TOPB.length];
    if(d===20||d===30)return[T('Ôn thẻ đến hạn',30,'chu-phon'),T(`Làm một đề mẫu Band B chính thức (模擬試題) đủ 100 câu, bấm giờ 120 phút`,120,'cam-nang'),T('Soát lỗi: phân loại sai do chữ, do từ hay do nghe không kịp',60,''),T('Học lại nhóm từ gây lỗi nhiều nhất',45,'tu-vung')];
    return[T('Ôn thẻ đến hạn',30,'chu-phon'),
      T(`Từ vựng 進階級 và 高階級 theo chủ đề hôm nay: ${tp}. Lướt danh sách chính thức, chỉ ghi từ lạ và từ có chữ Phồn chưa quen (khoảng 60–80 từ)`,90,'cam-nang'),
      T('Nghe Band B: bài trong web, sau đó 20 phút tin tức hoặc podcast Đài Loan cùng chủ đề',75,'nghe'),
      T('Đọc Band B: một bài trong web và hai bài báo ngắn, tóm tắt mỗi bài bằng 2 câu',75,'doc'),
      T('Chọn từ điền chỗ trống Band B, đọc to câu đúng',20,'doc'),
      T('Ghi sổ lỗi trong ngày',20,'')]}
  if(d<=63){const tp=TOPC[(d-31)%TOPC.length];
    if(d===45||d===55||d===63)return[T('Ôn thẻ đến hạn',30,'chu-phon'),T('Làm một đề mẫu Band C chính thức đủ 100 câu, bấm giờ 120 phút',120,'cam-nang'),T('Soát lỗi và nghe lại các đoạn sai mà không nhìn chữ',75,''),T('Học lại thành ngữ và từ văn viết đã gặp trong đề',45,'')];
    return[T('Ôn thẻ đến hạn',30,'chu-phon'),
      T(`Từ vựng 流利級 theo chủ đề: ${tp}. Khoảng 90–100 từ mỗi ngày, ưu tiên thành ngữ và từ văn viết (書面語)`,90,'cam-nang'),
      T('Đọc sâu: hai bài xã luận hoặc phân tích dài, gạch chân liên từ và câu nêu quan điểm của tác giả',110,'doc'),
      T('Nghe: 30 phút tin tức hoặc phỏng vấn, ghi 5 ý chính bằng chữ Phồn, sau đó làm bài Band C trong web',80,'nghe'),
      T('Chọn từ điền chỗ trống Band C',20,'doc'),
      T('Ghi sổ lỗi trong ngày',20,'')]}
  if(d===69)return[T('Ôn nhẹ: thẻ đến hạn và sổ lỗi',60,'chu-phon'),T('Nghe 30 phút để giữ tai, ngủ sớm',30,'nghe'),T('Kiểm tra giấy tờ, giờ thi, đường đi',15,'cam-nang')];
  if(d>=70)return[T('Ngày thi. Đọc lướt sổ lỗi 15 phút rồi thôi',15,'')];
  return[T('Ôn thẻ đến hạn',30,'chu-phon'),T(`Làm một đề đủ giờ: ${d%2?'phần đọc 50 câu trong 60 phút':'phần nghe 50 câu'}`,70,'cam-nang'),T('Soát lỗi kỹ, viết lại lý do sai của từng câu',90,''),T('Đọc lại 3 bài Band C đã làm, lần này không tra từ',60,'doc'),T('Nghe lại các đoạn từng sai',45,'nghe')]}
const curDay=()=>today()-dayOf(S.start)+1;

/* ===== Điều hướng ===== */
const NAV=[['hom-nay','Hôm nay'],['lo-trinh','Lộ trình'],['chu-phon','Chữ Phồn thể'],['tu-vung','Từ vựng Đài Loan'],['nghe','Luyện nghe'],['doc','Luyện đọc'],['thi-thu','Thi thử'],['cam-nang','Cẩm nang kỳ thi']];
let sub=null;      /* phiên học thẻ, trắc nghiệm hoặc bài thi đang mở */
let ui={band:'A',day:null,gloss:{},shown:{},vq:''};
const ORD={};const ord=(k,n)=>ORD[k]||(ORD[k]=shuffle([...Array(n).keys()]));
const route=()=>{const h=location.hash.slice(1);return NAV.some(n=>n[0]===h)?h:'hom-nay'};
function render(){const r=route();
  $('#nav').innerHTML=NAV.map(([h,t])=>`<a href="#${h}" ${h===r?'aria-current="page"':''}>${t}${h==='chu-phon'&&dueCards().length?`<b>${dueCards().length}</b>`:''}</a>`).join('');
  const m=$('#main');
  m.innerHTML=sub?(sub.type==='mock'?vMock():sub.type==='quiz'?vQuiz():vStudy()):({'hom-nay':vToday,'lo-trinh':vPlan,'chu-phon':vChars,'tu-vung':vVocab,'nghe':vListen,'doc':vRead,'thi-thu':vMockHome,'cam-nang':vGuide})[r]();
  setSync(syncState)}
addEventListener('hashchange',()=>{if(sub&&sub.type==='mock'&&sub.stage!=='done'&&sub.stage!=='intro'){/* giữ bài thi */}else sub=null;stopSpeak();render();scrollTo(0,0)});

/* ===== Hôm nay ===== */
function taskList(d){const ts=tasksFor(d),done=S.done['d'+d]||[];
  return `<ul class="tasks">${ts.map((t,i)=>`<li class="${done.includes(i)?'done':''}"><label><input type="checkbox" id="t-${d}-${i}" data-a="task" data-d="${d}" data-i="${i}" ${done.includes(i)?'checked':''}><span>${esc(t.x).replace(/([㐀-鿿（）、，]+)/g,'<span lang="zh-Hant" class="zh">$1</span>')}</span></label><span class="min">${t.m}′</span>${t.go?`<a class="go" href="#${t.go}">Mở</a>`:''}</li>`).join('')}</ul>
  <p class="muted small">Tổng ${Math.round(ts.reduce((s,t)=>s+t.m,0)/6)/10} giờ. Xong ${done.length}/${ts.length} việc.</p>`}
function vToday(){const d=curDay(),dd=Math.min(Math.max(d,1),70),p=phaseOf(dd),due=dueCards().length,known=ALLC.filter(c=>isKnown(c.id)).length;
  const left=S.exam?dayOf(S.exam)-today():null,last=S.hist.filter(h=>h.k==='A').slice(-1)[0];
  return `<header class="head"><p class="eyebrow">${p.n} · ${esc(p.t)}</p><h1>${d<1?'Chưa đến ngày bắt đầu':d>70?'Đã hết 70 ngày lộ trình':`Ngày ${d} trên 70`}</h1><p class="lead">${esc(p.goal)}</p>${bar(dd,70)}</header>
  <section class="tiles">
   <div class="tile ${due?'attn':''}"><span class="num">${due}</span><span class="lab">thẻ đến hạn ôn</span>${due?'<button class="btn sm" data-a="review">Ôn ngay</button>':''}</div>
   <div class="tile"><span class="num">${known}<small>/${ALLC.length}</small></span><span class="lab">chữ Phồn đã thuộc</span></div>
   <div class="tile"><span class="num">${last?last.L+last.R:'—'}<small>${last?'/100':''}</small></span><span class="lab">thi thử Band A gần nhất</span></div>
   <div class="tile"><span class="num">${left===null?'—':left<0?'0':left}</span><span class="lab">${left===null?'chưa đặt ngày thi':'ngày đến kỳ thi'}</span></div>
  </section>
  <section class="card"><h2>Việc hôm nay</h2>${taskList(dd)}</section>
  <section class="card"><h2>Mốc thời gian</h2><div class="row">
   <label class="fld" for="in-start">Ngày bắt đầu<input type="date" id="in-start" value="${esc(S.start)}" data-c="start"></label>
   <label class="fld" for="in-exam">Ngày thi (nếu đã đăng ký)<input type="date" id="in-exam" value="${esc(S.exam)}" data-c="exam"></label></div>
   <p class="muted small">Lộ trình dài 70 ngày tính từ ngày bắt đầu. Nếu ngày thi sớm hơn, hãy rút bớt giai đoạn 2 trước, giữ nguyên giai đoạn 3.</p></section>`}

/* ===== Lộ trình ===== */
function vPlan(){const d=Math.min(Math.max(curDay(),1),70),sel=ui.day||d;
  return `<header class="head"><h1>Lộ trình 70 ngày</h1><p class="lead">Mỗi ngày 5 đến 6 giờ. Đi lần lượt A, B rồi C, cuối mỗi band có một buổi làm đề đủ giờ.</p></header>
  ${PH.map(p=>`<section class="card"><p class="eyebrow">${p.n} · ngày ${p.a}–${p.b}</p><h2>${esc(p.t)}</h2><p>${esc(p.goal)}</p>
   <div class="days">${Array.from({length:p.b-p.a+1},(_,k)=>{const n=p.a+k,dn=(S.done['d'+n]||[]).length,tt=tasksFor(n).length,test=/đề|thi thử/i.test(tasksFor(n)[1]?.x||'')&&tasksFor(n).length<=4&&n!==69;
     return `<button class="day ${n===d?'now':''} ${n===sel?'sel':''} ${dn>=tt?'full':dn?'part':''} ${test?'test':''}" data-a="day" data-d="${n}" aria-label="Ngày ${n}${test?', ngày làm đề':''}">${n}</button>`}).join('')}</div>
   ${sel>=p.a&&sel<=p.b?`<div class="daybox"><h3>Ngày ${sel}${sel===d?' (hôm nay)':''}</h3>${taskList(sel)}</div>`:''}</section>`).join('')}
  <p class="muted small">Ô viền đậm là ngày làm đề. Ô tô màu là ngày đã xong hết việc.</p>`}

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
  return `<header class="head"><h1>Từ vựng Đài Loan</h1><p class="lead">Cùng một nghĩa nhưng Đài Loan dùng từ khác. Đề TOCFL dùng cách nói của Đài Loan, nên các từ này xuất hiện ngay từ Band A.</p>${bar(k,VOCABC.length)}<p class="small">${k}/${VOCABC.length} từ đã thuộc</p>
   <div class="row"><button class="btn" data-a="study" data-deck="vocab">Học thẻ</button></div></header>
  <section class="card"><h2>Bảng tra</h2><label class="fld" for="vq">Tìm theo chữ hoặc nghĩa<input id="vq" type="search" value="${esc(ui.vq)}" data-c="vq" placeholder="vd: mạng, 捷運"></label>
   <div class="scroll" id="vtab"><table><thead><tr><th>Đài Loan</th><th>Đại lục</th><th>Nghĩa</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${zh(c.f,'b')}</td><td><span lang="zh-Hans" class="zh">${esc(c.bk)}</span></td><td>${esc(c.vi)}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="card"><h2>Phát âm khác với sách HSK</h2><p>Phần nghe đọc theo chuẩn 國語. Ngoài các từ dưới đây, giọng Đài Loan ít thanh nhẹ, gần như không có âm cuốn 兒, và zh ch sh thường nhẹ hơn.</p>
   <div class="scroll"><table><thead><tr><th>Từ</th><th>Đài Loan</th><th>Đại lục</th><th></th></tr></thead><tbody>${PRONL.map(([w,a,b])=>`<tr><td>${zh(w,'b')}</td><td>${esc(a)}</td><td class="muted">${esc(b)}</td><td><button class="btn ghost sm" data-a="say" data-t="${esc(w)}">Nghe</button></td></tr>`).join('')}</tbody></table></div>
   <p class="muted small">Giọng máy không phải lúc nào cũng đọc đúng âm Đài Loan của từng từ. Hãy lấy phiên âm trong bảng làm chuẩn.</p></section>`}

/* ===== Luyện nghe / đọc ===== */
const bandTabs=()=>`<div class="tabs" role="tablist">${['A','B','C'].map(b=>`<button role="tab" aria-selected="${ui.band===b}" data-a="band" data-b="${b}">Band ${b}</button>`).join('')}</div>`;
function voiceBar(){return `<div class="row voice"><label class="fld inl" for="rate">Tốc độ<select id="rate" data-c="rate">${[.7,.85,1,1.15,1.3].map(r=>`<option value="${r}" ${S.rate==r?'selected':''}>${r}×</option>`).join('')}</select></label>
  <label class="fld inl" for="voice">Giọng đọc<select id="voice" data-c="voice"><option value="auto" ${S.voice==='auto'?'selected':''}>Tự chọn</option><option value="browser" ${S.voice==='browser'?'selected':''}>Giọng của trình duyệt</option><option value="claude" ${S.voice==='claude'?'selected':''}>Giọng Claude</option></select></label><button class="btn ghost sm" data-a="stop">Dừng đọc</button></div>`}
function qBlock(id,qi,q,opts,showQ){const key=id+'-'+qi,o=ord(key,opts.length),p=S.q[key+'p'];
  return `<div class="q" id="q-${key}">${showQ||p!=null?`<p class="qt">${zh(q)}</p>`:`<p class="qt muted">Câu ${qi+1}: nghe câu hỏi rồi chọn</p>`}
   <div class="opts">${o.map((oi,n)=>`<button class="opt ${p!=null?(oi===0?'right':oi===p?'wrong':''):''}" data-a="ans" data-k="${key}" data-o="${oi}" ${p!=null?'disabled':''}><b>${LET[n]}</b> ${zh(opts[oi])}</button>`).join('')}</div></div>`}
function bandScore(list,b){const ks=list.filter(x=>x.b===b).flatMap(x=>(x.qs||[0]).map((_,i)=>x.id+'-'+i));const done=ks.filter(k=>S.q[k+'p']!=null),ok=done.filter(k=>S.q[k+'p']===0);return `Đã làm ${done.length}/${ks.length} câu, đúng ${ok.length}.`}
function vListen(){const items=LISTEN.filter(x=>x.b===ui.band);
  return `<header class="head"><h1>Luyện nghe</h1><p class="lead">Bấm nghe, chọn đáp án, rồi mới mở lời thoại. Câu hỏi được đọc sau đoạn hội thoại giống trong phòng thi.</p>${bandTabs()}<p class="small">${bandScore(LISTEN,ui.band)} <button class="link" data-a="resetq" data-p="l">Làm lại từ đầu</button></p>${voiceBar()}<p id="tts-msg" class="warn" hidden></p></header>
  ${items.map((x,n)=>{const all=x.qs.every((_,i)=>S.q[x.id+'-'+i+'p']!=null),open=all||ui.shown[x.id];return `<section class="card item"><div class="row between"><h2>Bài ${n+1}${x.qs.length>1?' · đoạn độc thoại':''}</h2><button class="btn sm" data-a="play" data-id="${x.id}">Nghe</button></div>
   ${x.qs.map(([q,o],i)=>qBlock(x.id,i,q,o,false)).join('')}
   ${open?`<div class="script">${x.l.map(l=>`<p>${zh(l)}</p>`).join('')}</div>`:`<button class="link" data-a="show" data-id="${x.id}">Xem lời thoại</button>`}</section>`}).join('')}
  <section class="card"><h2>Nghe thêm ngoài web</h2><p>Mười mấy bài ở đây đủ để quen dạng câu hỏi, chưa đủ lượng nghe cho Band B và C. Mỗi ngày cần thêm 20 đến 30 phút tin tức, podcast hoặc phỏng vấn của Đài Loan. Xem gợi ý ở mục <a href="#cam-nang">Cẩm nang kỳ thi</a>.</p></section>`}
function passage(x){const g=ui.gloss[x.id];return `<div class="pass">${x.x.split('\n').map(p=>`<p>${zh(p)}</p>${g?`<p class="gloss" lang="zh-Hans">${esc(toSimp(p))}</p>`:''}`).join('')}</div><button class="link" data-a="gloss" data-id="${x.id}">${g?'Ẩn bản Giản thể':'Hiện bản Giản thể để đối chiếu'}</button>`}
function vRead(){const items=READ.filter(x=>x.b===ui.band),gaps=GAPS.filter(x=>x.b===ui.band);
  return `<header class="head"><h1>Luyện đọc</h1><p class="lead">Đọc bằng chữ Phồn trước. Chỉ mở bản Giản thể khi đã thử đoán, để mắt quen dần hình chữ mới.</p>${bandTabs()}<p class="small">${bandScore(READ,ui.band)} <button class="link" data-a="resetq" data-p="r">Làm lại từ đầu</button></p></header>
  ${items.map(x=>`<section class="card item"><h2>${zh(x.t)}</h2>${passage(x)}${x.qs.map(([q,o],i)=>qBlock(x.id,i,q,o,true)).join('')}</section>`).join('')}
  ${gaps.length?`<section class="card item"><h2>選詞填空 · Chọn từ điền chỗ trống</h2>${gaps.map((g,n)=>qBlock(g.id,0,(n+1)+'. '+g.s,g.o,true)).join('')}</section>`:'<section class="card"><p>Dạng chọn từ điền chỗ trống của Band A nằm trong bài thi thử.</p></section>'}`}

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
  <section class="card"><h2>Band B và Band C</h2><p>Hai bài thi thử này chưa có trong web. Ở các ngày làm đề của giai đoạn 2 và 3, hãy dùng đề mẫu chính thức (模擬試題) trên trang của Ủy ban TOCFL, có file nghe do người thật đọc. Đường dẫn ở mục <a href="#cam-nang">Cẩm nang kỳ thi</a>.</p></section>`}
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
  <section class="card"><h2>Từ HSK 6 sang TOCFL: khoảng cách nằm ở đâu</h2><ul class="notes"><li><b>Chữ.</b> Khoảng một phần ba số chữ thường dùng có dạng Phồn khác dạng Giản. Mục Chữ Phồn thể gom ${ALLC.length} chữ hay gặp nhất, đủ cho Band A và B. Lên Band C sẽ gặp thêm chữ hiếm, học qua bài đọc.</li><li><b>Từ.</b> HSK 6 cũ khoảng 5.000 từ, Band C cần khoảng 8.000 từ, lại có nhiều từ riêng của Đài Loan. Web này chưa chứa bảng 8.000 từ. Hãy tải bảng từ chính thức và học theo chủ đề như lộ trình ghi.</li><li><b>Nghe.</b> Giọng, tốc độ và cách dùng từ khác băng HSK. Cần nghe nguồn Đài Loan mỗi ngày.</li><li><b>Thời gian.</b> Hơn hai tháng với 5 đến 6 giờ mỗi ngày là đủ để chắc Band B và có cơ hội thật ở Level 5. Level 6 đòi hỏi vốn đọc rộng, nên coi đó là mục tiêu vươn tới.</li></ul></section>
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
 task(el){const k='d'+el.dataset.d,i=+el.dataset.i,a=S.done[k]||(S.done[k]=[]);el.checked?a.includes(i)||a.push(i):a.splice(a.indexOf(i),1);save();render()},
 day(el){ui.day=+el.dataset.d;render()},
 review(){startStudy(dueCards(),'Ôn thẻ đến hạn')},
 study(el){const d=el.dataset.deck;d==='multi'?startStudy(MULTIC,'Một Giản, nhiều Phồn'):d==='vocab'?startStudy(VOCABC,'Từ vựng Đài Loan'):startStudy(DECKS[+d].cards,DECKS[+d].name)},
 quiz(el){startQuiz(DECKS[+el.dataset.deck])},
 flip(){if(sub&&sub.type==='study'&&sub.i<sub.q.length){sub.flip=!sub.flip;render()}},
 grade(el){const s=sub,c=s.q[s.i],ok=el.dataset.ok==='1';grade(c.id,ok);s.n++;if(ok)s.ok++;else s.q.push(c);s.i++;s.flip=false;render()},
 qpick(el){const s=sub,q=s.qs[s.i];s.pick=el.dataset.o;const ok=s.pick===q.c.bk;if(ok)s.score++;if(S.srs[q.c.id]||!ok)grade(q.c.id,ok);render()},
 qnext(){sub.i++;sub.pick=null;render()},
 close(){if(sub&&sub.type==='mock'){clearInterval(tick);stopSpeak()}sub=null;render();scrollTo(0,0)},
 async say(el){const ok=await speak([{t:el.dataset.t,s:'n'}]);if(!ok)toast(noVoiceMsg)},
 stop(){stopSpeak()},
 band(el){ui.band=el.dataset.b;stopSpeak();render()},
 async play(el){const x=LISTEN.find(i=>i.id===el.dataset.id),L=parseLines(x.l);x.qs.forEach(([q],i)=>L.push({t:(x.qs.length>1?`第${'一二三'[i]}題，`:'問題：')+q,s:'n'}));
   const ok=await speak(L);if(!ok){const m=$('#tts-msg');if(m){m.hidden=false;m.textContent=noVoiceMsg}}},
 show(el){ui.shown[el.dataset.id]=1;render()},
 gloss(el){ui.gloss[el.dataset.id]=!ui.gloss[el.dataset.id];render()},
 ans(el){const k=el.dataset.k;S.q[k+'p']=+el.dataset.o;save();const y=scrollY;render();scrollTo(0,y)},
 resetq(el){Object.keys(S.q).forEach(k=>{if(k[0]===el.dataset.p||(el.dataset.p==='r'&&k[0]==='g'))delete S.q[k]});Object.keys(ORD).forEach(k=>delete ORD[k]);ui.shown={};save();render()},
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
  if(c==='start'){if(el.value){S.start=el.value;ui.day=null}}else if(c==='exam')S.exam=el.value;else if(c==='rate')S.rate=+el.value;else if(c==='voice')S.voice=el.value;save();if(c==='start'||c==='exam')render()});
document.addEventListener('input',e=>{if(e.target.dataset.c==='vq'){ui.vq=e.target.value;const f=ui.vq.trim().toLowerCase();document.querySelectorAll('#vtab tbody tr').forEach(tr=>tr.hidden=!!f&&!tr.textContent.toLowerCase().includes(f))}});
document.addEventListener('keydown',e=>{if(!sub||sub.type!=='study'||sub.i>=sub.q.length)return;if(e.target.closest('input,select,button')&&e.key===' ')return;
  if(e.key===' '||e.key==='Enter'){e.preventDefault();ACT.flip()}else if(sub.flip&&(e.key==='1'||e.key==='2'))ACT.grade({dataset:{ok:e.key==='2'?'1':'0'}})});
try{speechSynthesis.onvoiceschanged=()=>{}}catch(e){}voices();
if(window.claude&&claude.use)claude.use('tts').then(t=>{TTS.cl=t}).catch(()=>{});
render();initCloud();
