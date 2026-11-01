/* ============ 玄鉴志 · app ============ */
(function(){
"use strict";
const D = window.XJ_DATA;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const COLORS = ['#6e858c','#87989d','#a6b5b9','#536970','#76999e','#5f747b','#8da3a8','#70868c'];
let docsPromise=null;
function loadDocs(){
  if(D.docs&&D.docs.length)return Promise.resolve(D.docs);
  if(window.XJ_DOCS&&window.XJ_DOCS.length){D.docs=window.XJ_DOCS;return Promise.resolve(D.docs);}
  if(docsPromise)return docsPromise;
  docsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='assets/js/data-docs.js?v=20261102b';
    script.onload=()=>{
      if(!window.XJ_DOCS||!window.XJ_DOCS.length){reject(new Error('典籍数据为空'));return;}
      D.docs=window.XJ_DOCS;
      resolve(D.docs);
    };
    script.onerror=()=>reject(new Error('典籍数据加载失败'));
    document.head.appendChild(script);
  });
  return docsPromise;
}
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h);}
function colorFor(s){return COLORS[hash(s||'')%COLORS.length];}
function avatar(name){return name.length<=3?name.slice(-2):name.slice(0,2);}
function fmt(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function roleLabel(c){return c&&c.role&&c.role!=='人物志'?c.role:'';}
const VIEW_META = {
  home:['总览','OVERVIEW'],xuan:['三玄','THREE XUAN'],dao:['道统谱系','DAO SYSTEM'],factions:['势力门派','FACTIONS'],
  characters:['人物志','CHARACTERS'],cultivation:['修炼体系','CULTIVATION'],items:['器物志','ARTIFACTS'],terms:['名词词典','GLOSSARY'],
  genealogy:['李氏宗谱','GENEALOGY'],timeline:['大事记','CHRONICLE'],library:['典籍库','LIBRARY']
};
const state={view:'home',factionType:'全部',factionQ:'',charFilter:'全部人物',charQ:'',charShown:60,termCat:'全部',termQ:'',libCat:'全部',libQ:'',libSort:'cat',libLimit:80,kinScale:1,daoCat:'五德',daoSub:'',daoLeaf:'',itemCat:'全部',itemGrade:'全部',itemQ:'',itemShown:60};

/* ---------- router ---------- */
function showView(name,opts={}){
  if(!VIEW_META[name]) name='home';
  state.view=name;
  $$('.view').forEach(v=>v.classList.toggle('on',v.id==='view-'+name));
  $$('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.view===name));
  $('#crumbMain').textContent=VIEW_META[name][0];
  $('#crumbSub').textContent=VIEW_META[name][1];
  document.title=VIEW_META[name][0]+' · 玄鉴志';
  history.replaceState(null,'','#'+name);
  closeSidebar();
  window.scrollTo({top:0,behavior:'instant'});
  if(name==='home') renderHome();
  if(name==='xuan') renderXuan();
  if(name==='dao') renderDao();
  if(name==='factions') renderFactions();
  if(name==='characters') renderChars();
  if(name==='cultivation') renderCultivation();
  if(name==='items') renderItems();
  if(name==='terms') renderTerms();
  if(name==='genealogy') renderKin();
  if(name==='timeline') renderTimeline();
  if(name==='library') renderLibrary();
  observeReveal();
  if(opts.anchor) setTimeout(()=>{const n=$(opts.anchor);if(n)n.scrollIntoView({behavior:'smooth',block:'center'});},120);
}
window.addEventListener('hashchange',()=>showView(location.hash.slice(1)||'home'));
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-view]');
  if(a){e.preventDefault();showView(a.dataset.view);}
  const jump=e.target.closest('[data-sheet-jump]');
  if(jump){
    const target=$('#reference-'+jump.dataset.sheetJump);
    if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
  }
});

/* ---------- home ---------- */
let homeDone=false;
function renderHome(){
  if(homeDone) return; homeDone=true;
  const st=D.stats;
  $('#heroStats').innerHTML=[
    [fmt(st.chapters),'正文章节'],[fmt(st.chars),'人物条目'],[fmt(st.factions),'势力门派'],[fmt(st.items||232),'器物条目'],[fmt(st.kin),'族谱节点']
  ].map(x=>`<div><b data-count="${x[0]}">${x[0]}</b><span>${x[1]}</span></div>`).join('');
  const axis=[
    ['00','三玄','青玄、兜玄、通玄，先从这里认道统的来路','源头'],
    ['01','诸道','阴阳、五德、十二炁、三雷、虹霞与并古法','道法'],
    ['02','五德','金、木、水、火、土各有五现，也能继续往下分','谱系'],
    ['03','阴阳','三阳三阴各有果位，明阳便在其中','果位'],
    ['04','十二府邸','三玄留在人间的古道统座席','座席'],
    ['05','人间','宗门、世家、王朝、释门、龙属与阴司','落点']
  ];
  $('#homeAxis').innerHTML=axis.map(r=>`<div class="axis-row"><div class="ix">${r[0]}</div><div class="nm">${r[1]}</div><div class="ds">${r[2]}</div><div class="tag">${r[3]}</div></div>`).join('');
  $('#pathGrid').innerHTML=D.paths.map((p,i)=>`<div class="path-card reveal" data-view="${p.view}"><div class="top"><b>0${i+1}</b><span>${p.tag}</span></div><h3>${p.title}</h3><p>${p.desc}</p><div class="ch">${p.chapters}</div></div>`).join('');
  const feat=['李木田','李通崖','李玄锋','李曦明','李周巍','李绛迁','陆江仙','李遂宁'];
  $('#featuredChars').innerHTML=feat.map(n=>charCard(findChar(n))).join('');
  const ff=['青池宗','望月湖李家','宋廷','燕国','释土/慈悲道','阴司'];
  $('#featuredFactions').innerHTML=ff.map(n=>factionCard(findFaction(n))).join('');
  const q=D.quotes[0]||{t:'毋忘家仇族恨。',from:'李通崖→李渊蛟'};
  $('#homeQuote').textContent='“'+q.t+'”';$('#homeQuoteFrom').textContent='—— '+q.from;
  $$('#featuredChars .char-card').forEach(c=>c.onclick=()=>openChar(c.dataset.name));
  $$('#featuredFactions .faction-card').forEach(c=>c.onclick=()=>openFaction(c.dataset.name));
  $$('#pathGrid .path-card').forEach(c=>c.onclick=()=>showView(c.dataset.view));
  animateStats();
}

function animateStats(){
  $$('#heroStats b').forEach(el=>{
    const target=parseInt((el.dataset.count||'0').replace(/,/g,''),10);
    if(!target)return;
    const start=performance.now(),dur=900;
    const tick=now=>{
      const p=Math.min(1,(now-start)/dur);
      const v=Math.floor(target*(1-Math.pow(1-p,3)));
      el.textContent=fmt(v);
      if(p<1)requestAnimationFrame(tick);else el.textContent=fmt(target);
    };
    requestAnimationFrame(tick);
  });
}

function findChar(n){return D.chars.find(c=>c.name===n)||{name:n,one:'',desc:'',faction:'',realm:'',role:'',tags:[]};}
function findFaction(n){return D.factions.find(f=>f.name===n||(f.aliases||[]).includes(n))||{name:n,type:'',region:'',tradition:'',leader:'',status:'',summary:''};}
function charCard(c){
  if(!c) return '';
  const col=colorFor(c.faction||c.name);
  const role=roleLabel(c);
  return `<article class="char-card" data-name="${esc(c.name)}"><div class="ch-top"><div class="avatar" style="background:linear-gradient(150deg,${col},${col}55)">${esc(avatar(c.name))}</div><div><h3>${esc(c.name)}</h3><div class="role">${esc(c.faction||'')}${role?' · '+esc(role):''}</div></div></div><div class="desc">${esc(c.desc||c.one||'')}</div>${c.realm&&c.realm!=='—'?`<span class="realm-badge">${esc(c.realm)}</span>`:''}${c.secs&&c.secs.length?`<span class="evt-badge">事件 ${c.secs.length}</span>`:''}<div class="tags">${(c.tags||[]).slice(0,3).map(t=>`<span>${esc(t)}</span>`).join('')}</div></article>`;
}
function factionCard(f){
  if(!f) return '';
  return `<article class="faction-card" data-name="${esc(f.name)}"><div class="fl"><div class="emblem">${esc(f.name[0])}</div><div><div class="tp">${esc(f.type)} · ${esc(f.region||'')}</div><h3>${esc(f.name)}</h3></div></div><div class="meta">${f.tradition?`<span>${esc(f.tradition)}</span>`:''}${f.leader?`<span>${esc(f.leader)}</span>`:''}${(D.factionHistory||{})[f.name]?'<span>沿革</span>':''}</div><p>${esc(f.summary)}</p></article>`;
}

/* ---------- normalized reference data ---------- */
function groupReference(items,key){
  const groups=[];
  items.forEach(item=>{
    const name=item[key]||'待考';
    let group=groups.find(x=>x.name===name);
    if(!group){group={name,items:[]};groups.push(group);}
    group.items.push(item);
  });
  return groups;
}
function referenceSearch(section){
  return `<label class="reference-search"><span>筛选</span><input data-reference-search="${section}" placeholder="输入人物、道统、位次或关系…" autocomplete="off"></label>`;
}
function daoReferenceBlock(){
  const groups=groupReference(D.daoReference||[],'system');
  let h=`<section class="reference-block" id="reference-dao"><div class="reference-head"><div><span>REFERENCE TABLE</span><h2>道统关系总表</h2></div><div><p>以原文与公开资料交叉复核的 ${D.daoReference.length} 处核心关系，按位次列出仙基、神通、持位者与能力关系。</p>${referenceSearch('dao')}</div></div>`;
  groups.forEach(group=>{
    h+=`<details class="reference-group" open><summary><b>${esc(group.name)}</b><span>${group.items.length} 条</span></summary><div class="reference-grid">`;
    group.items.forEach(x=>{
      h+=`<article class="reference-card" data-reference-record>
        <div class="reference-card-head"><span>${esc(x.system)}</span><h3>${esc(x.position)}</h3></div>
        <dl><dt>仙基</dt><dd>${esc(x.base)}</dd><dt>神通</dt><dd>${esc(x.power)}</dd><dt>持位</dt><dd>${esc(x.holder)}</dd><dt>特性</dt><dd>${esc(x.note)}</dd><dt>关系</dt><dd>${esc(x.relations)}</dd></dl>
      </article>`;
    });
    h+='</div></details>';
  });
  return h+'</section>';
}
function xuanReferenceBlock(){
  const groups=groupReference(D.xuanReference||[],'root');
  let h=`<section class="reference-block" id="reference-xuan"><div class="reference-head"><div><span>REFERENCE TABLE</span><h2>三玄传承与座席</h2></div><div><p>${D.xuanReference.length} 组传承节点，按“三玄 → 道统/座席 → 代表人物”排开；旧写、别称与现世立场分开记录。</p>${referenceSearch('xuan')}</div></div><div class="reference-grid xuan-reference-grid">`;
  groups.forEach(group=>{
    h+=`<section class="reference-cluster"><h3>${esc(group.name)}</h3>`;
    group.items.forEach(x=>{
      h+=`<article class="reference-card" data-reference-record><div class="reference-card-head"><span>${esc(group.name)}</span><h4>${esc(x.branch)}</h4></div><dl><dt>人物/分支</dt><dd>${esc(x.members)}</dd><dt>关系</dt><dd>${esc(x.relation)}</dd><dt>现状</dt><dd>${esc(x.status)}</dd></dl></article>`;
    });
    h+='</section>';
  });
  return h+'</div></section>';
}
function factionReferenceBlock(){
  const groups=groupReference(D.factionReference||[],'region');
  let h=`<section class="reference-block" id="reference-factions"><div class="reference-head"><div><span>REFERENCE TABLE</span><h2>势力关系补录</h2></div><div><p>按地域收拢 ${D.factionReference.length} 个核心势力，列出层级、代表人物和传承来源。</p>${referenceSearch('factions')}</div></div><div class="reference-grid faction-reference-grid">`;
  groups.forEach(group=>{
    h+=`<section class="reference-cluster"><h3>${esc(group.name)}</h3>`;
    group.items.forEach(x=>{
      h+=`<article class="reference-card" data-reference-record><div class="reference-card-head"><span>${esc(x.level)}</span><h4>${esc(x.name)}</h4></div><dl><dt>传承</dt><dd>${esc(x.lineage)}</dd><dt>关系</dt><dd>${esc(x.note)}</dd></dl></article>`;
    });
    h+='</section>';
  });
  return h+'</div></section>';
}

/* ---------- xuan ---------- */
let xuanDone=false;
function renderXuan(){
  if(xuanDone) return; xuanDone=true;
  const stack=[
    ['00','三玄','青玄 · 兜玄 · 通玄','总源头'],
    ['01','十二府邸','密樊宗等十二席；三玄之下','古道统座席'],
    ['02','人间','宗门 · 世家 · 王朝 · 释门 · 龙属 · 阴司','道统落地']
  ];
  let h='<div class="xuan-wrap">';
  h+='<div class="stack">'+stack.map(r=>`<div class="stack-row"><div class="lv">${r[0]}</div><div class="nm">${r[1]}</div><div class="ds">${r[2]} <span style="color:var(--dim)">· ${r[3]}</span></div></div>`).join('')+'</div>';
  h+='<div class="subhead"><h3>三玄</h3><span>THREE XUAN · 层不是派</span></div><div class="xuan-cards">';
  h+=D.xuan.map(x=>`<article class="xuan-card"><div class="big">${esc(x.name[0])}</div><h3>${esc(x.name)}</h3><div class="motto">${esc(x.motto)}</div><p>${esc(x.desc)}</p><ul>${x.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><div class="xrel">${x.related.map(r=>`<span>${esc(r)}</span>`).join('')}</div></article>`).join('');
  h+='</div>';
  // 三玄对照
  h+='<div class="subhead"><h3>三玄对照</h3><span>COMPARISON · 判词、权柄、道场、门下</span></div>';
  const rows=[
    ['判词','阴阳和生者，青玄也','使役万神者，兜玄也','自尊极贵者，通玄也'],
    ['权柄','太阴、太阳','万神、天道','仙道、宫阙'],
    ['道场','滁仪天 / 青松观','一座山 / 密樊宗','通玄宫'],
    ['主','青玄子','名讳未载','半妖血'],
    ['门下','重明六子；张元禹、上元等','谢家、北寰、王家三金、姜氏','摩都、西晏、落霞戊土、真璀'],
    ['行风','道高和寡，质量极高','相保守序，循守古制','自尊极贵，争闰余，行动激进'],
    ['现状','太阳支脉仍在，青玄隐于太阴','最古老，亲传凋零','门徒最盛，金羽/落霞归此']
  ];
  h+='<div class="compare-table"><div class="ch">条目</div><div class="ch">青玄</div><div class="ch">兜玄</div><div class="ch">通玄</div>';
  rows.forEach(r=>{h+=`<div class="cl">${esc(r[0])}</div><div>${esc(r[1])}</div><div>${esc(r[2])}</div><div>${esc(r[3])}</div>`;});
  h+='</div>';
  // 三玄谱系
  h+='<div class="subhead"><h3>三玄传承谱系</h3><span>ROOT → LINEAGE → PEOPLE · 传承溯源不等于现时立场</span></div>';
  h+=xuanReferenceBlock();
  // 位阶
  h+='<div class="subhead"><h3>三玄位阶</h3><span>TIERS · 玄主 → 四弟子 → 门下 → 人间 → 修士</span></div><div class="tier-list">';
  h+=D.xuanTiers.map(t=>`<div class="tier"><b>${esc(t.tier)}</b><p>${esc(t.desc)}</p></div>`).join('');
  h+='</div>';
  // 三玄史
  h+='<div class="subhead"><h3>三玄史</h3><span>EVENTS · 从同列一殿到三柱断</span></div><div class="xhist">';
  h+=D.xuanEvents.map(x=>`<div class="hist-item"><div class="hy">${esc(x[0])}</div><b>${esc(x[1])}</b><p>${esc(x[2])}</p></div>`).join('');
  h+='</div>';
  // 十二府邸
  h+='<div class="subhead"><h3>十二府邸与人间接口</h3><span>SEATS · 原文未列全，仅列可考</span></div><div class="kin-note" style="padding:0;margin:0 0 16px">十二府邸中，原文仅明确“密樊一宗，上承兜玄”；青松观、通玄宫、道率殿是三玄在人间的接口/象征，不等同于十二席。其余座席不代补。</div><div class="seat-list">';
  h+=D.seats.map(s=>`<div class="seat"><b>${esc(s.name)}</b><span>${esc(s.note)}</span></div>`).join('');
  h+='</div>';
  // 阋墙
  h+='<div class="subhead"><h3>三玄阋墙</h3><span>THE STRIFE</span></div><div class="formula"><div class="formula-card"><div class="lab">判词</div><h4>三玄是“层”，不是“派”</h4><p>三玄之间不是“谁灭了谁”，而是“谁排前面”的争衡。青玄道高和寡，兜玄使役万神，通玄自尊极贵；三根柱子先后断裂，才有了后世诸道统的各自为政。</p></div><div class="formula-card"><div class="lab">人间接口</div><h4>没有“青玄宗”</h4><p>人间没有“青玄宗”这种组织；所谓某玄的道统，多通过宗门、世家、道观与传承落地。青松观、密樊宗、通玄宫，都是不同层面的接口。</p></div></div>';
  h+='<div class="dao-link"><span>阴阳 / 五德 / 十二炁 / 三雷 / 虹霞 / 并古的逐层谱系已单开</span><a data-view="dao">进入道统谱系 →</a></div>';
  h+='</div>';
  $('#xuanBody').innerHTML=h;
}

/* ---------- factions ---------- */
let facDone=false;
function renderFactions(){
  const preferred=['全部','有沿革','三玄','道统','宗门','世家','王朝','释门','龙属','阴司','古国','组织','势力','秘境'];
  const types=preferred.filter(t=>t==='全部'||t==='有沿革'||D.factions.some(f=>f.type===t));
  if(!facDone){
    facDone=true;
    $('#factionChips').innerHTML=types.map(t=>`<button class="chip${t===state.factionType?' on':''}" data-type="${t}">${t}</button>`).join('');
    $('#factionChips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;state.factionType=b.dataset.type;$$('#factionChips .chip').forEach(x=>x.classList.toggle('on',x===b));paintFactions();};
    $('#factionSearch').oninput=e=>{state.factionQ=e.target.value.trim();paintFactions();};
  }
  paintFactions();
}
function paintFactions(){
  let arr=D.factions.filter(f=>state.factionType==='全部'||(state.factionType==='有沿革'?(D.factionHistory||{})[f.name]:f.type===state.factionType));
  if(state.factionQ){const q=state.factionQ;arr=arr.filter(f=>(f.name+f.type+f.region+f.tradition+f.leader+f.summary).includes(q));}
  $('#factionCount').textContent=`共 ${arr.length} 个势力 / 门派`;
  $('#factionGrid').innerHTML=arr.map(factionCard).join('');
  $$('#factionGrid .faction-card').forEach(c=>c.onclick=()=>openFaction(c.dataset.name));
  $('#factionSheets').innerHTML=factionReferenceBlock();
}

/* ---------- characters ---------- */
let charDone=false;
function renderChars(){
  const filters=['全部人物','核心人物','望月湖李家','李家姻亲/附属','青池宗','萧家','宋廷','燕国','释门','阴司','其他'];
  if(!charDone){
    charDone=true;
    $('#charChips').innerHTML=filters.map(t=>`<button class="chip${t===state.charFilter?' on':''}" data-f="${t}">${t}</button>`).join('');
    $('#charChips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;state.charFilter=b.dataset.f;state.charShown=60;$$('#charChips .chip').forEach(x=>x.classList.toggle('on',x===b));paintChars();};
    $('#charSearch').oninput=e=>{state.charQ=e.target.value.trim();state.charShown=60;paintChars();};
    $('#charMore').onclick=()=>{state.charShown+=60;paintChars();};
  }
  paintChars();
}
function charMatch(c){
  const f=state.charFilter;
  const faction=c.faction||'';
  if(f==='核心人物') return c.core;
  if(f==='全部人物') return true;
  if(f==='望月湖李家') return faction.includes('望月湖李家');
  if(f==='李家姻亲/附属') return faction.includes('李家姻亲')||faction.includes('李家附属');
  if(f==='青池宗') return faction.includes('青池');
  if(f==='萧家') return faction.includes('萧家');
  if(f==='宋廷') return faction.includes('宋廷')||faction.includes('杨');
  if(f==='燕国') return faction.includes('燕国')||faction.includes('慕容');
  if(f==='释门') return faction.includes('释')||faction.includes('佛');
  if(f==='阴司') return faction.includes('阴司');
  return !faction||faction==='其他';
}
function paintChars(){
  let arr=D.chars.filter(charMatch);
  if(state.charFilter==='核心人物') arr=arr.slice().sort((a,b)=>(a.coreRank??999)-(b.coreRank??999));
  if(state.charFilter==='全部人物') arr=arr.slice().sort((a,b)=>(a.core?0:1)-(b.core?0:1)||(a.coreRank??999)-(b.coreRank??999)||a.name.localeCompare(b.name,'zh'));
  if(state.charQ){const q=state.charQ;arr=arr.filter(c=>(c.name+(c.faction||'')+(c.role||'')+(c.realm||'')+(c.one||'')+(c.desc||'')+(c.tags||[]).join('')).includes(q));}
  const total=arr.length;
  const show=arr.slice(0,state.charShown);
  $('#charCount').textContent=`共 ${total} 位人物 · 当前显示 ${show.length} 位`;
  $('#charGrid').innerHTML=show.map(charCard).join('');
  $$('#charGrid .char-card').forEach(c=>c.onclick=()=>openChar(c.dataset.name));
  $('#charMore').parentElement.style.display=show.length<total?'flex':'none';
}

/* ---------- terms ---------- */
let termDone=false;
function renderTerms(){
  const cats=['全部','境界','道统','释门','势力','器物','概念'];
  if(!termDone){
    termDone=true;
    $('#termChips').innerHTML=cats.map(t=>`<button class="chip${t===state.termCat?' on':''}" data-c="${t}">${t}</button>`).join('');
    $('#termChips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;state.termCat=b.dataset.c;$$('#termChips .chip').forEach(x=>x.classList.toggle('on',x===b));paintTerms();};
    $('#termSearch').oninput=e=>{state.termQ=e.target.value.trim();paintTerms();};
  }
  paintTerms();
}
function paintTerms(){
  let arr=D.terms.filter(t=>state.termCat==='全部'||t.cat===state.termCat);
  if(state.termQ){const q=state.termQ;arr=arr.filter(t=>(t.name+t.cat+t.desc).includes(q));}
  $('#termCount').textContent=`共 ${arr.length} 个名词`;
  $('#termGrid').innerHTML=arr.map(t=>`<article class="term" data-name="${esc(t.name)}"><div class="th"><h4>${esc(t.name)}</h4><span class="c">${esc(t.cat)}</span></div><p>${esc(t.desc)}</p></article>`).join('');
  $$('#termGrid .term').forEach(c=>c.onclick=()=>openTerm(c.dataset.name));
}

/* ---------- cultivation ---------- */
let cultDone=false;
function renderCultivation(){
  if(cultDone) return; cultDone=true;
  const mainNames=['胎息','练气','筑基','紫府','金丹','道胎'];
  const mains=D.realms.filter(r=>mainNames.includes(r.name));
  const branches=D.realms.filter(r=>['魔修','释修','龙属','阴司'].includes(r.name));
  let h='<div class="cult-wrap">';
  h+='<div class="subhead"><h3>主梯</h3><span>THE LADDER</span></div><div class="ladder">';
  h+=mains.map((r,i)=>`<div class="realm"><div class="rh"><div class="rn">0${i}</div><div><h3>${esc(r.name)}</h3><div class="ess">${esc(r.essence)}</div></div><div class="sub">${esc(r.sub)}</div></div><p>${esc(r.detail)}</p><div class="subs">${r.subs.map(s=>`<span>${esc(s)}</span>`).join('')}</div></div>`).join('');
  h+='</div>';
  h+='<div class="subhead"><h3>四条岔路</h3><span>FOUR BRANCHES</span></div><div class="branch-grid">';
  h+=branches.map(r=>`<div class="branch"><div class="t">${esc(r.name)}</div><h4>${esc(r.essence)}</h4><p>${esc(r.detail)}</p></div>`).join('');
  h+='</div>';
  h+='<div class="subhead"><h3>两套骨架</h3><span>TWO SKELETONS</span></div><div class="formula">';
  h+=`<div class="formula-card"><div class="lab">神通配置</div><h4>三术 · 一身 · 一命</h4><div class="flow"><b>术</b><i>×3</i><b>身</b><b>命</b><i>= 五法</i></div><p>紫府以一至五道神通分初、中、后、巅峰；五法俱全为圆满。明阳的谒天门、赤断镞、帝观元为三术，君蹈危为身，另有命神通。</p></div>`;
  h+=`<div class="formula-card"><div class="lab">求金流程</div><h4>位 → 道 → 法 → 人</h4><div class="flow"><b>位</b><i>→</i><b>道</b><i>→</i><b>法</b><i>→</i><b>人</b></div><p>求金法不是功法，是脚本；先有位（果/闰/余），再有道，再有法，最后才是人。位定了道的正邪，法的效力也挂在位上。</p></div>`;
  h+='</div>';
  h+='<div class="subhead"><h3>符种与箓气</h3><span>BINDING</span></div><div class="formula">';
  h+=`<div class="formula-card"><div class="lab">两级绑定</div><h4>祭祀 → 箓气 → 符种 → 授箓</h4><div class="flow"><b>祭</b><i>→</i><b>箓</b><i>→</i><b>种</b><i>→</i><b>授</b></div><p>《玄珠祀灵术》以活祭炼出箓气；符种是玄鉴孕出的白丸，可替代灵窍；授箓是发一张有名字的凭证，符种是它唯一能插的插座。</p></div>`;
  h+=`<div class="formula-card"><div class="lab">李家国本</div><h4>一代一枚，由鉴不由人</h4><div class="flow"><b>六枚</b><i>→</i><b>九枚</b><i>→</i><b>更多</b></div><p>符种数量随鉴身境界上涨；给谁不给谁，本身就是家族政治。李家本无灵窍，全靠符种起家。</p></div>`;
  h+='</div></div>';
  $('#cultivationBody').innerHTML=h;
}


/* ---------- dao system ---------- */
let daoDone=false;
function renderDao(){
  if(!daoDone){daoDone=true;}
  paintDao();
}
function daoCard(x,kind){
  return `<div class="dao-card" data-dao-${kind}="${esc(x.name)}"><div class="pos">${esc(x.pos||(kind==='sub'?'五德之一':''))}</div><h4>${esc(x.name)}</h4><div class="short">${esc(x.short||'')}</div><p>${esc(x.nature||'')}</p></div>`;
}
function paintDao(){
  const cat=state.daoCat,node=D.dao[cat];
  const hasSubs=Array.isArray(node.subs)&&node.subs.length>0;
  const sub=hasSubs?node.subs.find(x=>x.name===state.daoSub):null;
  const leaves=hasSubs?(sub?sub.leaves:[]):(node.leaves||[]);
  const leaf=leaves.find(x=>x.name===state.daoLeaf);
  let h='<div class="dao-wrap">';
  h+='<div class="dao-tabs">'+Object.keys(D.dao).map(c=>`<button class="dao-tab${c===cat?' on':''}" data-dao-cat="${c}">${c}</button>`).join('')+'</div>';
  h+='<div class="dao-bread"><span>诸道</span><i>/</i><b data-dao-cat="'+cat+'">'+cat+'</b>';
  if(hasSubs&&sub) h+='<i>/</i><b data-dao-sub="'+esc(sub.name)+'">'+esc(sub.name)+'</b>';
  if(leaf) h+='<i>/</i><b>'+esc(leaf.name)+'</b>';
  h+='</div>';
  if(leaf){
    const sts=(leaf.shentong||[]).filter(x=>x.n&&x.n!=='—');
    h+='<div class="dao-detail"><div class="dh"><h3>'+esc(leaf.name)+'</h3><span class="pos">'+esc(leaf.pos)+'</span><div class="nat">'+esc(leaf.nature)+'</div></div>';
    h+='<div class="dao-cols"><div>';
    h+='<div class="dao-box"><h4>仙基 / 代表</h4><div class="xianji">'+(leaf.xianji&&leaf.xianji.length?leaf.xianji.map(x=>`<span>${esc(x)}</span>`).join(''):'<span>原文未列全</span>')+'</div></div>';
    h+='<div class="dao-box" style="margin-top:12px"><h4>相关人物 / 势力</h4><div class="dao-rel">'+(leaf.people||[]).map(x=>`<span><b>人</b> ${esc(x)}</span>`).join('')+(leaf.factions||[]).map(x=>`<span><b>势</b> ${esc(x)}</span>`).join('')+'</div></div>';
    h+='</div><div class="dao-box"><h4>神通 · 功能特性</h4><div class="st-list">'+(sts.length?sts.map(x=>`<div class="st-item"><b>${esc(x.n)}</b><em>${esc(x.t)}</em><p>${esc(x.f)}</p></div>`).join(''):'<p style="font-size:12px;color:var(--dim)">原文未列全，不代补。</p>')+'</div></div></div></div>';
  }else{
    const intro=sub||node;
    h+='<div class="dao-intro"><h3>'+esc(intro.name||cat)+'</h3><p>'+esc(intro.nature||intro.desc||'')+'</p>'+(intro.note?`<div class="note">${esc(intro.note)}</div>`:'')+'</div>';
    h+='<div class="dao-grid">';
    if(hasSubs&&!sub){ h+=node.subs.map(x=>daoCard(x,'sub')).join(''); }
    else { h+=leaves.map(x=>daoCard(x,'leaf')).join(''); }
    h+='</div>';
  }
  h+='</div>';
  $('#daoBody').innerHTML=h;
  $('#daoBody').insertAdjacentHTML('beforeend',daoReferenceBlock());
}
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-dao-cat]');
  if(c){state.daoCat=c.dataset.daoCat;state.daoSub='';state.daoLeaf='';paintDao();return;}
  const s=e.target.closest('[data-dao-sub]');
  if(s){state.daoSub=s.dataset.daoSub;state.daoLeaf='';paintDao();return;}
  const l=e.target.closest('[data-dao-leaf]');
  if(l){state.daoLeaf=l.dataset.daoLeaf;paintDao();return;}
});
/* ---------- items ---------- */
let itemsDone=false;
function renderItems(){
  if(itemsDone){paintItems();return;}
  itemsDone=true;
  const cats=['全部'].concat(Array.from(new Set(D.items.map(x=>x.cat))));
  const grades=['全部','仙器','法宝','灵宝','灵器','灵胚','法器','原文未载'];
  let h='<div class="items-wrap">';
  h+='<div class="layer-grid">'+D.itemLayers.map(x=>`<div class="layer"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('')+'</div>';
  h+='<div class="item-toolbar"><div class="chips" id="itemChips">'+cats.map(c=>`<button class="chip${c===state.itemCat?' on':''}" data-c="${c}">${c}</button>`).join('')+'</div>';
  h+='<div class="chips" id="itemGrades">'+grades.map(c=>`<button class="chip${c===state.itemGrade?' on':''}" data-g="${c}">${c}</button>`).join('')+'</div>';
  h+='<div class="mini-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="itemSearch" placeholder="搜索器物、类别、品阶…"></div></div>';
  h+='<div class="count-line" id="itemCount"></div><div class="item-grid" id="itemGrid"></div><div class="load-more-wrap"><button class="btn ghost" id="itemMore">加载更多</button></div></div>';
  $('#itemsBody').innerHTML=h;
  $('#itemChips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;state.itemCat=b.dataset.c;state.itemShown=60;$$('#itemChips .chip').forEach(x=>x.classList.toggle('on',x===b));paintItems();};
  $('#itemGrades').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;state.itemGrade=b.dataset.g;state.itemShown=60;$$('#itemGrades .chip').forEach(x=>x.classList.toggle('on',x===b));paintItems();};
  $('#itemSearch').oninput=e=>{state.itemQ=e.target.value.trim();state.itemShown=60;paintItems();};
  $('#itemMore').onclick=()=>{state.itemShown+=60;paintItems();};
  paintItems();
}
function itemCard(x){
  return `<article class="item-card" data-name="${esc(x.name)}"><div class="ih"><h4>${esc(x.name)}</h4><span class="grade">${esc(x.grade||'原文未载')}</span></div><div class="ty">${esc(x.type||x.cat||'')}</div><p>${esc(x.desc||'')}</p><div class="rl">${esc(x.rel||'—')}</div></article>`;
}
function paintItems(){
  let arr=D.items.filter(x=>state.itemCat==='全部'||x.cat===state.itemCat);
  if(state.itemGrade!=='全部') arr=arr.filter(x=>(x.grade||'原文未载').includes(state.itemGrade));
  if(state.itemQ){const q=state.itemQ;arr=arr.filter(x=>(x.name+x.type+x.grade+x.desc+x.rel).includes(q));}
  const total=arr.length;const show=arr.slice(0,state.itemShown);
  $('#itemCount').textContent=`共 ${total} 件器物 · 当前显示 ${show.length} 件`;
  $('#itemGrid').innerHTML=show.map(itemCard).join('');
  $$('#itemGrid .item-card').forEach(c=>c.onclick=()=>openItem(c.dataset.name));
  $('#itemMore').parentElement.style.display=show.length<total?'flex':'none';
}
function openItem(name){
  const x=D.items.find(y=>y.name===name);if(!x)return;
  let h=`<div class="dr-head"><div class="avatar" style="background:linear-gradient(150deg,${colorFor(x.cat)},#223)">${esc(x.name.slice(0,2))}</div><div><h2>${esc(x.name)}</h2><div class="sub">${esc(x.type)} · ${esc(x.grade)}</div></div></div>`;
  h+=`<div class="dr-lead">${esc(x.desc)}</div>`;
  h+=`<div class="dr-meta"><div><span>类别</span><b>${esc(x.cat)}</b></div><div><span>品阶</span><b>${esc(x.grade)}</b></div><div><span>形制</span><b>${esc(x.type)}</b></div><div><span>相关</span><b>${esc(x.rel)}</b></div></div>`;
  if(x.quote) h+=`<div class="dr-sec"><h3>原文摘录</h3><p style="font-size:12px;color:var(--dim);line-height:1.9">${esc(x.quote)}</p></div>`;
  openDrawer(h);
}

/* ---------- timeline ---------- */
let tlDone=false;
function causalOverview(){
  const threads=D.causalThreads||[];
  if(!threads.length)return '';
  let h='<section class="causal-board" id="reference-timeline"><div class="causal-head"><span>CAUSAL THREADS · 因果主线</span><h2>先看因果，再看纪年</h2><p>同一条主线内，前一步改变资源、身份或敌我关系，后一步才有发生条件。不是把相邻年份直接当成因果。</p></div><div class="causal-grid">';
  threads.forEach((t,i)=>{
    h+=`<details class="causal-card tone-${esc(t.tone)}"${i<2?' open':''}><summary><b>${String(i+1).padStart(2,'0')}</b><span>${esc(t.title)}</span><i>＋</i></summary><div class="causal-body"><p class="causal-cause"><b>起点</b>${esc(t.cause)}</p><ol>${t.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="causal-effect"><b>结果</b>${esc(t.effect)}</p></div></details>`;
  });
  return h+'</div></section>';
}
function renderTimeline(){
  if(tlDone) return; tlDone=true;
  let h=causalOverview();
  h+='<div class="subhead chapter-timeline-head"><h3>大事件总纲</h3><span>CHAPTER & YEARBOOK · 正文节点与图像纪年合览</span></div><div class="chapter-timeline">';
  let last='';
  D.timeline.forEach(e=>{
    if(e.era!==last){
      if(last)h+='</div>';
      last=e.era;
      const era=D.eras.find(x=>x.name===e.era)||{sub:'',range:'',desc:''};
      h+=`<div class="era"><h3>${esc(e.era)}</h3><span>${esc(era.sub)} · ${esc(era.range)}</span><p>${esc(era.desc)}</p></div><div class="era-block">`;
    }
    const src=e.date?`纪年：${esc(e.date)}`:(e.chapter&&e.chapter!=='—'?`第 ${esc(e.chapter)} 章`:'章号未定');
    h+=`<div class="ev${e.date?' ev-yearbook':''}"><div class="y">${esc(e.tag)}</div><h4>${esc(e.title)}</h4><p>${esc(e.desc)}</p>${e.cause?`<div class="event-cause"><b>因</b>${esc(e.cause)}</div>`:''}${e.effect?`<div class="event-effect"><b>果</b>${esc(e.effect)}</div>`:''}<div class="ch">${src}${e.thread?` · ${esc(e.thread)}`:''}</div></div>`;
  });
  if(last)h+='</div>';
  $('#timelineBody').innerHTML=h;
}

/* ---------- library ---------- */
let libDone=false;
const LIB_CATS=['全部','总览','人物志','势力志','神通志','法器灵物台账','考据'];
const LIB_DESC={'总览':'全书结构、时间锚点与总表','人物志':'人物小传与事件索引','势力志':'宗门、世家、王朝的沿革','神通志':'十八册神通谱系与修士索引','法器灵物台账':'兵器、甲衣、印信、丹药与灵材','考据':'专题考据、战役、制度与地理'};
function renderLibrary(){
  if(!libDone){
    if(!D.docs||!D.docs.length){
      $('#libCats').innerHTML='';
      $('#libCount').textContent='';
      $('#libList').innerHTML='<div class="sr-empty">正在载入典籍库…</div>';
      loadDocs().then(()=>renderLibrary()).catch(()=>{$('#libList').innerHTML='<div class="sr-empty">典籍库载入失败，请刷新页面重试。</div>';});
      return;
    }
    libDone=true;
    $('#libCats').innerHTML=LIB_CATS.map(c=>`<button class="lib-cat${c===state.libCat?' on':''}" data-c="${c}"><span>${c}<small>${esc(LIB_DESC[c]||'')}</small></span><b>${c==='全部'?D.docs.length:D.docs.filter(d=>d.cat===c).length}</b></button>`).join('');
    $('#libCats').onclick=e=>{const b=e.target.closest('.lib-cat');if(!b)return;state.libCat=b.dataset.c;state.libLimit=80;$$('#libCats .lib-cat').forEach(x=>x.classList.toggle('on',x===b));paintLib();};
    $('#libSearch').oninput=e=>{state.libQ=e.target.value.trim();state.libLimit=80;paintLib();};
    $('#libSort').onchange=e=>{state.libSort=e.target.value;paintLib();};
  }
  paintLib();
}
function libSorted(arr){
  if(state.libSort==='title') return arr.slice().sort((a,b)=>a.title.localeCompare(b.title,'zh'));
  if(state.libSort==='size') return arr.slice().sort((a,b)=>b.secs.length-a.secs.length);
  return arr;
}
function libItem(d){
  return `<div class="lib-item" data-id="${d.id}"><div class="lt"><b>${esc(d.title)}</b><span class="lc">${esc(d.cat)}</span></div><p>${esc(docSummary(d))}</p></div>`;
}
function paintLib(){
  let arr=D.docs.filter(d=>state.libCat==='全部'||d.cat===state.libCat);
  if(state.libQ){const q=state.libQ;arr=arr.filter(d=>(d.title+d.cat+docSummary(d)+d.secs.map(s=>s.t).join('')).includes(q));}
  $('#libCount').textContent=`共 ${arr.length} 篇`;
  if(state.libCat==='全部'&&!state.libQ){
    let h='';
    LIB_CATS.filter(c=>c!=='全部').forEach(cat=>{
      const list=libSorted(D.docs.filter(d=>d.cat===cat));
      if(!list.length)return;
      h+=`<div class="lib-group"><div class="lib-group-head"><div><b>${cat}</b><span>${esc(LIB_DESC[cat]||'')}</span></div><em>${list.length} 篇</em></div><div class="lib-list">`+list.slice(0,8).map(libItem).join('')+`</div>`;
      if(list.length>8) h+=`<button class="lib-more" data-cat="${cat}">查看全部 ${list.length} 篇 →</button>`;
      h+='</div>';
    });
    $('#libList').innerHTML=h;
    $$('#libList .lib-more').forEach(b=>b.onclick=()=>{state.libCat=b.dataset.cat;state.libLimit=80;$$('#libCats .lib-cat').forEach(x=>x.classList.toggle('on',x.dataset.c===state.libCat));paintLib();});
  }else{
    arr=libSorted(arr);
    const show=arr.slice(0,state.libLimit);
    $('#libList').innerHTML=show.map(libItem).join('');
    if(arr.length>show.length) $('#libList').innerHTML+=`<button class="lib-more" id="libMore">加载更多（${show.length}/${arr.length}）</button>`;
    const more=$('#libMore'); if(more) more.onclick=()=>{state.libLimit+=80;paintLib();};
  }
  $$('#libList .lib-item').forEach(x=>x.onclick=()=>openDoc(+x.dataset.id));
}
/* ---------- genealogy ---------- */
let kinDone=false;
function renderKin(){
  if(kinDone){return;}
  kinDone=true;
  const nodes=D.kin.nodes;
  const gens={};
  nodes.forEach((n,i)=>{n._i=i;(gens[n.gen]=gens[n.gen]||[]).push(n);});
  const order={b:0,z:1,s:2,j:3,'':4};
  const maxCount=Math.max(...Object.values(gens).map(a=>a.length));
  const W=Math.max(1380,maxCount*150+230), GAPX=150, GAPY=132, TOP=54, LEFT=118;
  Object.keys(gens).forEach(g=>{gens[g].sort((a,b)=>(order[a.branch]??9)-(order[b.branch]??9)||a._i-b._i);});
  const pos={};
  Object.keys(gens).forEach(g=>{gens[g].forEach((n,i)=>{n._x=LEFT+i*GAPX;n._y=TOP+(+g-1)*GAPY;pos[n.name]=n;});});
  const canvas=$('#kinCanvas');
  canvas.style.width=W+'px';canvas.style.height=(TOP+11*GAPY+80)+'px';
  const mainChain=['李木田','李通崖','李玄岭','李渊云','李曦峸','李承辽','李周巍'];
  const altChain=['李木田','李长湖','李玄宣','李渊平','李曦明'];
  const isMain=n=>mainChain.includes(n),isAlt=n=>altChain.includes(n)&&!isMain(n);
  let svg='<svg class="kin-svg" width="'+W+'" height="'+(TOP+11*GAPY+80)+'">';
  nodes.forEach(n=>{
    const p=pos[n.parent];
    if(p){
      const x1=p._x+59,y1=p._y+52,x2=n._x+59,y2=n._y;
      const mid=(y1+y2)/2;
      const cls=isMain(n)&&isMain(p)?'line-main':(isAlt(n)&&isAlt(p)?'line-alt':'');
      svg+=`<path class="${cls}" d="M${x1} ${y1} C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}"/>`;
    }
  });
  svg+='</svg>';
  let html=svg;
  for(let g=1;g<=11;g++){
    html+=`<div class="kin-gen-label" style="top:${TOP+(g-1)*GAPY+18}px">${esc(D.kin.generations[String(g)]||g+'世')}</div>`;
  }
  nodes.forEach(n=>{
    const ghost=(n.flags||[]).some(f=>['nr','ob','og'].includes(f));
    html+=`<div class="kin-node${isMain(n.name)?' line-main':''}${isAlt(n.name)?' line-alt':''}${ghost?' ghost':''}" style="left:${n._x}px;top:${n._y}px" data-name="${esc(n.name)}"><b>${esc(n.name)}</b><small>${esc(n.branchName||'')}${n.parent?' · '+esc(n.parent):''}</small></div>`;
  });
  canvas.innerHTML=html;
  $$('#kinCanvas .kin-node').forEach(x=>x.onclick=()=>openKin(x.dataset.name));
  $('#kinLegend').innerHTML=[['伯脉','var(--gold)'],['仲脉','var(--teal)'],['叔脉','var(--red)'],['季脉','var(--violet)'],['过继/名残','var(--dim)']].map(x=>`<span><i style="background:${x[1]}"></i>${x[0]}</span>`).join('');
  $('#kinNote').textContent=D.kin.note;
  $('#kinZoomIn').onclick=()=>{state.kinScale=Math.min(1.6,state.kinScale+0.1);canvas.style.zoom=state.kinScale;};
  $('#kinZoomOut').onclick=()=>{state.kinScale=Math.max(0.6,state.kinScale-0.1);canvas.style.zoom=state.kinScale;};
  $('#kinZoomReset').onclick=()=>{state.kinScale=1;canvas.style.zoom=1;};
  $('#kinLocate').onclick=()=>{const n=pos['李周巍'];if(!n)return;const vp=$('#kinViewport');vp.scrollTo({left:Math.max(0,n._x*state.kinScale-260),top:Math.max(0,n._y*state.kinScale-180),behavior:'smooth'});};
}
function openKin(name){
  if(name.startsWith('承明辈')){openDrawer(`<div class="dr-head"><div class="avatar" style="background:linear-gradient(150deg,#6f7b8a,#333b47)">名残</div><div><h2>${esc(name)}</h2><div class="sub">原文未载其名的一代</div></div></div><div class="dr-lead">这一格是族谱上的“留白”：原文没有记下这一代的名字，只留下后辈的连线。资料不代补。</div>`);return;}
  const c=D.chars.find(x=>x.name===name);
  if(c){openChar(name);return;}
  const n=D.kin.nodes.find(x=>x.name===name);
  if(n){
    openDrawer(`<div class="dr-head"><div class="avatar" style="background:linear-gradient(150deg,${colorFor(name)},#333)">${esc(avatar(name))}</div><div><h2>${esc(name)}</h2><div class="sub">${esc(n.branchName||'')} · ${esc(D.kin.generations[String(n.gen)]||n.gen+'世')}</div></div></div><div class="dr-lead">族谱中的人物，人物志暂无独立条目。</div><div class="dr-meta"><div><span>世代</span><b>${esc(D.kin.generations[String(n.gen)]||n.gen)}</b></div><div><span>房支</span><b>${esc(n.branchName||'—')}</b></div><div><span>父</span><b>${esc(n.parent||'—')}</b></div><div><span>标记</span><b>${esc((n.flags||[]).join(' / ')||'—')}</b></div></div>`);
  }
}

/* ---------- drawer ---------- */
function openDrawer(html){
  $('#drawerBody').innerHTML=html;
  $('#drawer').classList.add('on');$('#drawerScrim').classList.add('on');
  $('#drawer').setAttribute('aria-hidden','false');
  $('#drawer').scrollTop=0;
}
function closeDrawer(){
  $('#drawer').classList.remove('on');$('#drawerScrim').classList.remove('on');
  $('#drawer').setAttribute('aria-hidden','true');
}
function openChar(name){
  const c=D.chars.find(x=>x.name===name);
  if(!c){openKin(name);return;}
  const col=colorFor(c.faction||c.name);
  const role=roleLabel(c);
  const secs=(c.secs||[]).filter(s=>!(s.t||'').includes('一句话')&&!(s.t||'').includes('基本信息'));
  const rel=D.chars.filter(x=>x.name!==c.name&&(c.one+c.desc+secs.map(s=>s.x).join('')).includes(x.name)).slice(0,8);
  let h=`<div class="dr-head"><div class="avatar" style="background:linear-gradient(150deg,${col},${col}55)">${esc(avatar(c.name))}</div><div><h2>${esc(c.name)}</h2><div class="sub">${esc(c.faction||'')}${c.realm&&c.realm!=='—'?' · '+esc(c.realm):''}</div><div class="dr-tags">${(c.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div></div></div>`;
  h+=`<div class="dr-lead">${esc(c.desc||c.one||'')}</div>`;
  h+=`<div class="dr-meta"><div><span>势力</span><b>${esc(c.faction||'—')}</b></div><div><span>境界</span><b>${esc(c.realm||'—')}</b></div><div><span>身份</span><b>${esc(role||'—')}</b></div><div><span>世代</span><b>${esc(c.gen||'—')}</b></div></div>`;
  if(c.basic&&c.basic.length>12){h+=`<div class="dr-sec"><h3>基本信息</h3><p>${esc(c.basic)}</p></div>`;}
  if(rel.length){h+=`<div class="dr-sec"><h3>相关人物</h3><div class="dr-rel">${rel.map(x=>`<button data-rel="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div></div>`;}
  const quoted=secs.filter(s=>s.q&&s.q.length>=12);
  if(c.bio&&c.bio.length){h+=`<div class="dr-sec"><h3>正文相关原文 · 节选</h3><div class="bio-list">`+c.bio.map(b=>`<div class="bio-item"><span class="bio-ch">第 ${esc(b.ch)} 章</span><p>${esc(b.t)}</p></div>`).join('')+`</div></div>`;}
  if(secs.length){h+=`<div class="dr-sec"><h3>事件索引</h3><p class="event-index-hint">点击事件可查看对应资料段落。</p><div class="evt-index">`+secs.map((s,i)=>`<button data-evt-index="${i}"><span>${esc(s.t)}</span><i>→</i></button>`).join('')+`</div></div>`;}
  if(quoted.length){h+=`<div class="dr-sec dr-doc"><div class="di">原文事件 · ${quoted.length} 处</div><div class="evt-list">`+quoted.map(s=>`<div class="evt"><h4>${esc(s.t)}</h4><p class="qex">${esc(s.q)}</p></div>`).join('')+`</div></div>`;}
  openDrawer(h);
  $$('#drawerBody [data-rel]').forEach(b=>b.onclick=()=>openChar(b.dataset.rel));
  $$('#drawerBody [data-evt-index]').forEach(b=>b.onclick=()=>openCharEvent(c,+b.dataset.evtIndex));
}
function openCharEvent(c,eventIndex){
  const event=(c.secs||[]).filter(s=>!(s.t||'').includes('一句话')&&!(s.t||'').includes('基本信息'))[eventIndex];
  if(!event)return;
  const doc=D.docs.find(x=>x.id===c.docId);
  const sourceIndex=doc?doc.secs.findIndex(s=>s.t===event.t):-1;
  let body='',label=event.t;
  if(doc&&sourceIndex>=0){
    const section=docSectionText(doc,doc.secs[sourceIndex],sourceIndex);
    body=`<div class="event-detail-text">${section.text.split(/\n+/).filter(Boolean).map(p=>`<p>${linkify(p)}</p>`).join('')}</div>`;
  }
  let h=`<div class="dr-head"><div class="avatar" style="background:linear-gradient(150deg,${colorFor(c.faction||c.name)},${colorFor(c.faction||c.name)}55)">${esc(avatar(c.name))}</div><div><h2>${esc(c.name)}</h2><div class="sub">事件索引 · ${esc(label)}</div></div></div>`;
  if(event.q)h+=`<blockquote class="event-quote">${esc(event.q)}</blockquote>`;
  h+=body||`<div class="dr-lead">该事件条目没有可单独截出的完整段落，可返回人物页查看全部原文索引。</div>`;
  h+=`<div class="event-detail-actions"><button class="btn ghost" data-back-char="${esc(c.name)}">← 返回人物</button>${doc?`<button class="btn primary" data-open-doc="${doc.id}">查看人物志全文 →</button>`:''}</div>`;
  openDrawer(h);
  $$('#drawerBody [data-back-char]').forEach(b=>b.onclick=()=>openChar(b.dataset.backChar));
  $$('#drawerBody [data-open-doc]').forEach(b=>b.onclick=()=>openDoc(+b.dataset.openDoc));
}
function openFaction(name){
  const f=findFaction(name);if(!f)return;
  const rel=D.chars.filter(c=>c.faction&&(c.faction.includes(f.name)||f.name.includes(c.faction.split('/')[0]))).slice(0,10);
  let h=`<div class="dr-head"><div class="avatar" style="background:linear-gradient(150deg,${colorFor(f.name)},#333)">${esc(f.name[0])}</div><div><h2>${esc(f.name)}</h2><div class="sub">${esc(f.type)} · ${esc(f.region||'—')}</div></div></div>`;
  h+=`<div class="dr-lead">${esc(f.summary)}</div>`;
  h+=`<div class="dr-meta"><div><span>类型</span><b>${esc(f.type)}</b></div><div><span>地域</span><b>${esc(f.region||'—')}</b></div><div><span>道统</span><b>${esc(f.tradition||'—')}</b></div><div><span>首领</span><b>${esc(f.leader||'—')}</b></div></div>`;
  if(f.aliases&&f.aliases.length)h+=`<div class="dr-sec"><h3>同指异名</h3><p>${f.aliases.map(esc).join('、')}与“${esc(f.name)}”为同指异名，不另拆为独立势力。</p></div>`;
  h+=`<div class="dr-sec"><h3>状态</h3><p>${esc(f.status||'—')}</p></div>`;
  const hist=(D.factionHistory||{})[f.name];
  if(hist){
    h+='<div class="hist"><h3>沿革</h3>'+hist.map(x=>`<div class="hist-item"><div class="hy">${esc(x[0])}</div><b>${esc(x[1])}</b><p>${esc(x[2])}</p></div>`).join('')+'</div>';
  }else{
    const doc=D.docs.find(d=>d.cat==='势力志'&&(d.title===f.name||f.name.includes(d.title)||d.title.includes(f.name)));
    if(doc){h+='<div class="hist"><h3>沿革 · '+esc(doc.title)+'</h3>'+doc.secs.filter(x=>!x.t.includes('一句话')).map(x=>`<div class="hist-item"><b>${esc(x.t)}</b><p>${esc(x.x)}</p></div>`).join('')+'</div>';}
  }
  if(rel.length){h+=`<div class="dr-sec"><h3>相关人物</h3><div class="dr-rel">${rel.map(c=>`<button data-rel="${esc(c.name)}">${esc(c.name)}</button>`).join('')}</div></div>`;}
  openDrawer(h);
  $$('#drawerBody [data-rel]').forEach(b=>b.onclick=()=>openChar(b.dataset.rel));
}
function openTerm(name){
  const t=D.terms.find(x=>x.name===name);if(!t)return;
  const rel=D.terms.filter(x=>x.name!==t.name&&x.cat===t.cat).slice(0,8);
  let h=`<div class="dr-head"><div class="avatar" style="background:linear-gradient(150deg,${colorFor(t.cat)},#333)">${esc(t.name.slice(0,2))}</div><div><h2>${esc(t.name)}</h2><div class="sub">${esc(t.cat)}</div></div></div>`;
  h+=`<div class="dr-lead">${esc(t.desc)}</div>`;
  if(rel.length){h+=`<div class="dr-sec"><h3>同类名词</h3><div class="dr-rel">${rel.map(x=>`<button data-term="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div></div>`;}
  openDrawer(h);
  $$('#drawerBody [data-term]').forEach(b=>b.onclick=()=>openTerm(b.dataset.term));
}

function findDao(name){
  for(const cat of Object.keys(D.dao)){
    const node=D.dao[cat];
    const subs=node.subs||[];
    for(const sub of subs){
      for(const leaf of (sub.leaves||[])){
        if(leaf.name===name) return {cat,sub:sub.name,leaf:leaf.name};
      }
    }
    for(const leaf of (node.leaves||[])){
      if(leaf.name===name) return {cat,sub:'',leaf:leaf.name};
    }
  }
  return null;
}
function openDaoDetail(name){
  const p=findDao(name);if(!p)return;
  state.daoCat=p.cat;state.daoSub=p.sub;state.daoLeaf=p.leaf;showView('dao');
}

const DOC_SUMMARIES={
'世界观骨架':'《世界观骨架》把全书设定压成九节：核心设定、修行体系、果位/位格/余位/闰位/结璘等关键词、地理与势力，是进入本书世界观的索引。',
'修行体系':'《修行体系》以十二炁总表为骨架，先拆三个误解，再列六轮、练气、筑基、紫府、求金等阶段，是全书的修行总纲。',
'求金原理':'《求金原理》先拆三个误解，再给出一句话骨架与三位（龙/凤/虎）结构，解释证金、登位与果位/闰位/余位的差别。',
'术语表':'《术语表》是全书术语的统计口径与索引，包含果位、位格、余位、闰位、结璘等关键词，方便统一用法。',
'地理志':'《地理志》先列史料等级与三条红线，再按州郡、海域、秘境整理全书地理，是查找地名与势力范围的索引。',
'势力总述':'《势力总述》先说明证据等级，再按宗门、世家、王朝、释门、龙属、阴司等整理全书势力，是势力关系的总索引。',
'时间线':'《时间线》解释全书为何没有统一年表，给出史料分级与判断规则，并整理可用的时间锚点。',
'远古史':'《远古史》按史料分级梳理太古、上古、古魏的远古事件，重点处理雷宫、天变、三玄与王朝链。',
'人物名册':'《人物名册》按家族、势力与辈分整理人物，附李家字辈十二对与世系索引。',
'神通志 · 总表':'本册把神通分为三层：五个“位”、五德×五现、并古法；并讨论命名法、古籍溯源与数字账。',
'神通志 · 修士索引（甲）':'本册按修士索引神通归属，便于从人物反查道统与神通。',
'神通志 · 修士索引（乙）':'本册按修士索引神通归属，便于从人物反查道统与神通。',
'神通志 · 待考与补遗（甲）':'本册收录归属待考、名单外补入与形近字辨正的神通条目。',
'神通志 · 待考与补遗（乙）':'本册收录归属待考、名单外补入与形近字辨正的神通条目。',
'神通志 · 古籍溯源':'本册考订神通名的古籍来源与异名，列出三档证据与易混字。',
};
function cleanTitle(t){return (t||'').replace(/^[〇零一二三四五六七八九十百]+、\s*/,'').replace(/^\d+(\.\d+)*[、.\s]+/,'').replace(/^[⚠△]\s*/,'').trim();}
function findCharDoc(d){return D.chars.find(x=>x.name===d.title)||D.chars.find(x=>d.title.includes(x.name));}
function findFactionDoc(d){return D.factions.find(x=>x.name===d.title)||D.factions.find(x=>d.title.includes(x.name)||x.name.includes(d.title));}
function findItemDoc(d){return D.items.find(x=>x.name===d.title)||D.items.find(x=>d.title.includes(x.name));}
function findLeafDoc(d){
  if(d.cat!=='神通志')return null;
  const key=d.title.split('·').pop().trim();
  const p=findDao(key);if(!p)return null;
  return (D.dao[p.cat].subs||[]).flatMap(s=>s.leaves||[]).concat(D.dao[p.cat].leaves||[]).find(x=>x.name===p.leaf)||null;
}
function completeSentence(x){return x&&/[。！？]$/.test(x.trim())&&x.trim().length>=12?x.trim():'';}
function docSummary(d){
  let s=DOC_SUMMARIES[d.title]||'';
  const c=findCharDoc(d), f=findFactionDoc(d), it=findItemDoc(d), lf=findLeafDoc(d);
  if(!s&&d.cat==='人物志'&&c) s=c.desc||c.one||'';
  if(!s&&d.cat==='势力志'&&f) s=f.summary||'';
  if(!s&&d.cat.indexOf('法器')===0&&it) s=it.desc||'';
  if(d.cat==='神通志'&&lf){
    s=lf.nature;
    const xj=(lf.xianji||[]).filter(x=>x&&x!=='—').slice(0,3);
    const st=(lf.shentong||[]).filter(x=>x.n&&x.n!=='—').slice(0,3).map(x=>x.n);
    if(xj.length||st.length) s+='（'+(xj.length?'仙基/代表：'+xj.join('、'):'')+(st.length?(xj.length?'；':'')+'神通：'+st.join('、'):'')+'）';
  }
  if(d.cat==='考据'){
    const key=d.title.replace(/考|志|补考|补编|全表|总表/g,'');
    const ev=D.timeline.find(e=>e.title.includes(key)||key.includes(e.title));
    if(ev) s=ev.desc;
  }
  if(!s){
    const titles=d.secs.slice(0,5).map(x=>cleanTitle(x.t)).filter(Boolean);
    s=`《${d.title}》为${d.cat}条目，共 ${d.secs.length} 节`+(titles.length?`，涵盖${titles.join('、')}等`:'')+'。';
  }
  if(!/[。！？]$/.test(s)) s+='。';
  return s;
}
function docPoints(d){
  let pts=[];
  const c=findCharDoc(d), f=findFactionDoc(d), it=findItemDoc(d), lf=findLeafDoc(d);
  if(d.cat==='人物志'&&c){
    pts=(c.bio||[]).slice(0,6).map(b=>b.t);
    if(!pts.length&&c.desc) pts=[c.desc];
  }
  if(d.cat==='势力志'&&f){
    const h=(D.factionHistory||{})[f.name];
    if(h) pts=h.slice(0,6).map(x=>`${x[1]}：${x[2]}`);
  }
  if(d.cat.indexOf('法器')===0&&it){
    if(it.desc) pts.push(it.desc);
    if(it.quote&&it.quote!==it.desc) pts.push('原文：'+it.quote);
  }
  if(d.cat==='神通志'&&lf){
    pts=(lf.shentong||[]).filter(x=>x.n&&x.n!=='—').slice(0,6).map(x=>`${x.n}（${x.t}）：${x.f}`);
  }
  if(d.cat==='考据'){
    const key=d.title.replace(/考|志|补考|补编|全表|总表/g,'');
    const ev=D.timeline.find(e=>e.title.includes(key)||key.includes(e.title));
    if(ev) pts.push(ev.desc);
  }
  if(!pts.length) pts=d.secs.map(x=>completeSentence(x.x)).filter(Boolean).slice(0,6);
  if(!pts.length) pts=d.secs.slice(0,6).map(x=>cleanTitle(x.t)).filter(Boolean);
  pts=Array.from(new Set(pts.filter(Boolean)));
  return pts.slice(0,6);
}
function docLinks(d){
  const out=[],c=findCharDoc(d),f=findFactionDoc(d),it=findItemDoc(d),lf=findLeafDoc(d);
  if(c&&d.cat==='人物志') out.push(`<button data-rel="${esc(c.name)}">人物传 · ${esc(c.name)}</button>`);
  if(f&&d.cat==='势力志') out.push(`<button data-fac="${esc(f.name)}">势力页 · ${esc(f.name)}</button>`);
  if(it&&d.cat.indexOf('法器')===0) out.push(`<button data-item="${esc(it.name)}">器物页 · ${esc(it.name)}</button>`);
  if(lf) out.push(`<button data-dao="${esc(lf.name)}">道统谱系 · ${esc(lf.name)}</button>`);
  return out;
}
let LINK_MAP=null,LINK_RE=null;
function buildLinks(){
  if(LINK_MAP)return;
  LINK_MAP={};
  D.chars.forEach(c=>{if(c.name.length>=2)LINK_MAP[c.name]={k:'char',n:c.name};});
  D.factions.forEach(f=>{if(f.name.length>=2&&!LINK_MAP[f.name])LINK_MAP[f.name]={k:'faction',n:f.name};});
  D.terms.forEach(t=>{if(t.name.length>=2&&!LINK_MAP[t.name])LINK_MAP[t.name]={k:'term',n:t.name};});
  const names=Object.keys(LINK_MAP).sort((a,b)=>b.length-a.length);
  LINK_RE=new RegExp(names.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
}
function linkify(text){
  buildLinks();
  let used=new Set();
  return esc(text).replace(LINK_RE,m=>{
    if(used.has(m)||used.size>=8)return m;
    used.add(m);const it=LINK_MAP[m];if(!it)return m;
    return `<button class="inl" data-kind="${it.k}" data-name="${esc(it.n)}">${m}</button>`;
  });
}
function docSectionText(d,s,i){
  let txt='',raw=(s.x||'').trim();
  const c=findCharDoc(d),f=findFactionDoc(d),it=findItemDoc(d),lf=findLeafDoc(d);
  if(s.full) return {text:raw,raw:''};
  if(completeSentence(raw)) return {text:raw,raw:''};
  if(d.cat==='人物志'&&c){
    const m=(s.t+' '+raw).match(/第\s*([0-9,]+)\s*章/);
    if(m){const ch=+m[1].replace(/,/g,'');const b=(c.bio||[]).find(x=>x.ch===ch);if(b)return {text:b.t,raw:''};}
  }
  if(d.cat==='势力志'&&f){
    const h=(D.factionHistory||{})[f.name]||[];
    const key=cleanTitle(s.t);
    const hit=h.find(x=>key.includes(x[1])||x[1].includes(key)||key.includes(x[0]));
    if(hit)return {text:`${hit[1]}：${hit[2]}`,raw:''};
  }
  if(d.cat.indexOf('法器')===0&&it){
    let t=it.desc||'';
    if(it.quote&&it.quote!==it.desc)t+='原文：'+it.quote;
    if(t)return {text:t,raw:''};
  }
  if(d.cat==='神通志'&&lf){
    const key=cleanTitle(s.t);
    const st=(lf.shentong||[]).find(x=>x.n&&key.includes(x.n)||x.f&&key.includes(x.f));
    if(st)return {text:`${st.n}（${st.t}）：${st.f}`,raw:''};
  }
  if(d.cat==='考据'){
    const key=d.title.replace(/考|志|补考|补编|全表|总表/g,'');
    const ev=D.timeline.find(e=>e.title.includes(key)||key.includes(e.title));
    if(ev&&i===0)return {text:ev.desc,raw:raw};
  }
  txt=`本节围绕「${cleanTitle(s.t)}」展开。`;
  if(!/[。！？]$/.test(txt))txt+='。';
  return {text:txt,raw:raw};
}
function openDoc(id){
  const d=D.docs.find(x=>x.id===id);if(!d)return;
  const sum=docSummary(d);
  let h=`<div class="dr-head"><div class="avatar" style="background:linear-gradient(150deg,${colorFor(d.cat)},#333)">${esc(d.cat.slice(0,1))}</div><div><h2>${esc(d.title)}</h2><div class="sub">${esc(d.cat)} · ${d.secs.length} 节</div></div></div>`;
  h+=`<div class="dr-lead">${esc(sum)}</div>`;
  const links=docLinks(d);
  if(links.length){h+=`<div class="dr-sec"><h3>相关入口</h3><div class="dr-rel">`+links.join('')+`</div></div>`;}
  h+=`<div class="doc-tools"><button id="docExpand">展开全部</button><button id="docCollapse">收起全部</button></div>`;
  const hasLater=d.secs.some(s=>/(?:第\s*)?(?:1,[5-9][0-9]{2}|[2-9],[0-9]{3})(?:\s*章|\s*[—–\-、,，])/.test((s.t||'')+' '+(s.x||'')));
  if(hasLater)h+=`<div class="kin-note" style="padding:10px;margin:10px 0">此条目含有第 1,581 章后的语料库补记，不属于本次 1—1,580 章底本校订范围；涉及后续情节的内容请另作版本核对。</div>`;
  h+=`<nav class="doc-nav">`+d.secs.map((s,i)=>`<button data-sec="${i}"><span>${String(i+1).padStart(2,'0')}</span><b>${esc(s.t)}</b></button>`).join('')+`</nav>`;
  h+=`<div class="doc-body">`+d.secs.map((s,i)=>{
    const sec=docSectionText(d,s,i);
    const rawBox=sec.raw?`<blockquote class="doc-quote"><b>语料提要</b>${esc(sec.raw)}</blockquote>`:'';
    const prose=sec.text.split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>`<p>${linkify(x)}</p>`).join('');
    return `<section class="doc-sec${i<2?' open':''}" id="docsec-${i}"><button class="doc-sec-head" data-toggle="${i}"><span>${String(i+1).padStart(2,'0')}</span><b>${esc(s.t)}</b><i>＋</i></button><div class="doc-sec-body">${prose}${rawBox}</div></section>`;
  }).join('')+`</div>`;
  h+=`<div class="kin-note" style="padding:0;margin-top:10px">点击目录跳到对应章节；点击章节标题展开/收起；正文中的青色人名、势力、名词可以继续点开。</div>`;
  openDrawer(h);
  $$('#drawerBody [data-sec]').forEach(b=>b.onclick=()=>{const sec=$('#docsec-'+b.dataset.sec);if(!sec)return;sec.classList.add('open');sec.scrollIntoView({behavior:'smooth',block:'center'});});
  $$('#drawerBody [data-toggle]').forEach(b=>b.onclick=()=>b.parentElement.classList.toggle('open'));
  $('#docExpand').onclick=()=>$$('#drawerBody .doc-sec').forEach(x=>x.classList.add('open'));
  $('#docCollapse').onclick=()=>$$('#drawerBody .doc-sec').forEach(x=>x.classList.remove('open'));
  $$('#drawerBody [data-rel]').forEach(b=>b.onclick=()=>openChar(b.dataset.rel));
  $$('#drawerBody [data-fac]').forEach(b=>b.onclick=()=>openFaction(b.dataset.fac));
  $$('#drawerBody [data-item]').forEach(b=>b.onclick=()=>openItem(b.dataset.item));
  $$('#drawerBody [data-dao]').forEach(b=>b.onclick=()=>openDaoDetail(b.dataset.dao));
  $$('#drawerBody .inl').forEach(b=>b.onclick=()=>{const k=b.dataset.kind,n=b.dataset.name;if(k==='char')openChar(n);else if(k==='faction')openFaction(n);else openTerm(n);});
}
/* ---------- search ---------- */
let searchIndex=null;
function buildIndex(){
  if(searchIndex)return searchIndex;
  const idx=[];
  D.chars.forEach(c=>idx.push({k:'人物',t:c.name,d:(c.faction||'')+' · '+(c.one||c.desc||''),f:()=>openChar(c.name)}));
  D.factions.forEach(f=>idx.push({k:'势力',t:f.name,d:f.type+' · '+(f.summary||'')+' · '+(f.aliases||[]).join('、'),f:()=>openFaction(f.name)}));
  D.terms.forEach(t=>idx.push({k:'名词',t:t.name,d:t.cat+' · '+t.desc,f:()=>openTerm(t.name)}));
  D.timeline.forEach(e=>idx.push({k:'事件',t:e.title,d:e.desc,f:()=>{showView('timeline');}}));
  D.docs.forEach(d=>idx.push({k:'典籍',t:d.title,d:d.cat+' · '+docSummary(d),f:()=>openDoc(d.id)}));
  D.items.forEach(x=>idx.push({k:'器物',t:x.name,d:(x.grade||'')+' · '+(x.type||''),f:()=>openItem(x.name)}));
  (D.daoReference||[]).forEach(e=>idx.push({k:'道统总表',t:e.position,d:`${e.system} · ${e.base} · ${e.note}`,f:()=>{showView('dao');setTimeout(()=>$('#reference-dao')?.scrollIntoView({behavior:'smooth',block:'start'}),80);}}));
  (D.xuanReference||[]).forEach(e=>idx.push({k:'三玄谱系',t:e.branch,d:`${e.root} · ${e.members}`,f:()=>{showView('xuan');setTimeout(()=>$('#reference-xuan')?.scrollIntoView({behavior:'smooth',block:'start'}),80);}}));
  (D.factionReference||[]).forEach(e=>idx.push({k:'势力谱系',t:e.name,d:`${e.region} · ${e.lineage}`,f:()=>{showView('factions');setTimeout(()=>$('#reference-factions')?.scrollIntoView({behavior:'smooth',block:'start'}),80);}}));
  Object.keys(D.dao).forEach(cat=>{const node=D.dao[cat];(node.leaves||[]).forEach(l=>idx.push({k:'道统',t:l.name,d:l.pos+' · '+l.nature,f:()=>openDaoDetail(l.name)}));(node.subs||[]).forEach(sub=>(sub.leaves||[]).forEach(l=>idx.push({k:'道统',t:l.name,d:l.pos+' · '+l.nature,f:()=>openDaoDetail(l.name)})))});
  searchIndex=idx;return idx;
}
function openSearch(){
  $('#searchPanel').classList.add('on');$('#searchPanel').setAttribute('aria-hidden','false');
  setTimeout(()=>$('#globalSearch').focus(),60);
  paintSearch('');
  if(!D.docs||!D.docs.length)loadDocs().then(()=>{if($('#searchPanel').classList.contains('on'))paintSearch($('#globalSearch').value);}).catch(()=>{});
}
function closeSearch(){$('#searchPanel').classList.remove('on');$('#searchPanel').setAttribute('aria-hidden','true');}
function paintSearch(q){
  const box=$('#searchResults');
  q=(q||'').trim();
  if(!q){
    const picks=[['人物','李周巍'],['人物','陆江仙'],['势力','青池宗'],['名词','明阳四义'],['典籍','三玄道统志']];
    box.innerHTML='<div class="sr-group">建议从这些开始</div>'+picks.map(p=>{const it=buildIndex().find(x=>x.k===p[0]&&x.t===p[1]);return it?`<div class="sr" data-i="${buildIndex().indexOf(it)}"><span class="st">${esc(it.t)}</span><span class="sd">${esc(it.d)}</span><span class="sk">${it.k}</span></div>`:'';}).join('');
    bindSearchItems();return;
  }
  const idx=buildIndex();
  const res=idx.filter(x=>x.t.includes(q)||x.d.includes(q)).sort((a,b)=>(b.t===q)-(a.t===q)||(b.t.startsWith(q)?1:0)-(a.t.startsWith(q)?1:0)).slice(0,40);
  if(!res.length){box.innerHTML='<div class="sr-empty">没有找到「'+esc(q)+'」</div>';return;}
  let h='';let last='';
  res.forEach(x=>{if(x.k!==last){last=x.k;h+=`<div class="sr-group">${x.k}</div>`;}h+=`<div class="sr" data-i="${idx.indexOf(x)}"><span class="st">${esc(x.t)}</span><span class="sd">${esc(x.d)}</span><span class="sk">${x.k}</span></div>`;});
  box.innerHTML=h;bindSearchItems();
}
function bindSearchItems(){
  $$('#searchResults .sr').forEach(el=>{el.onclick=()=>{const it=buildIndex()[+el.dataset.i];if(it){closeSearch();it.f();}};});
}
function focusExtract(sheetId,recordIndex){
  const sheet=document.querySelector(`[data-sheet-id="${sheetId}"]`);if(!sheet)return;
  sheet.open=true;
  const row=$('#record-'+sheetId+'-'+recordIndex);if(!row)return;
  sheet.scrollIntoView({behavior:'smooth',block:'start'});
  row.classList.remove('flash');void row.offsetWidth;row.classList.add('flash');
}

/* ---------- theme / sidebar / init ---------- */
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  try{localStorage.setItem('xj-theme',t);}catch(e){}
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='light'?'#eef3ea':'#041012');
}
function closeSidebar(){$('#sidebar').classList.remove('on');$('#scrim').classList.remove('on');}
function observeReveal(){
  const obs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');obs.unobserve(e.target);}}),{threshold:.08});
  $$('.reveal').forEach(x=>obs.observe(x));
}
document.addEventListener('DOMContentLoaded',()=>{
  let saved='light';try{saved=localStorage.getItem('xj-theme')||'light';}catch(e){}
  setTheme(saved);
  try{$('#sideCounts').textContent=`${D.stats.chars} 人物 · ${D.stats.factions} 势力 · ${D.stats.items} 器物`;}catch(e){}
  $('#themeBtn').onclick=()=>setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
  $('#menuBtn').onclick=()=>{$('#sidebar').classList.toggle('on');$('#scrim').classList.toggle('on');};
  $('#scrim').onclick=closeSidebar;
  $('#toTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
  window.addEventListener('scroll',()=>{$('#toTop').classList.toggle('on',window.scrollY>720);},{passive:true});
  document.addEventListener('input',e=>{
    const input=e.target.closest('[data-reference-search]');if(!input)return;
    const block=input.closest('.reference-block'),q=input.value.trim();
    block.querySelectorAll('.reference-group,.reference-cluster').forEach(group=>{
      let visible=0;
      group.querySelectorAll('[data-reference-record]').forEach(row=>{
        const match=!q||row.textContent.includes(q);row.hidden=!match;if(match)visible++;
      });
      group.hidden=q&&visible===0;if(q&&visible&&group.tagName==='DETAILS')group.open=true;
    });
  });
  $('#searchBtn').onclick=openSearch;
  $('#globalSearch').oninput=e=>paintSearch(e.target.value);
  $('#searchPanel').onclick=e=>{if(e.target===$('#searchPanel'))closeSearch();};
  $('#drawerClose').onclick=closeDrawer;
  $('#drawerScrim').onclick=closeDrawer;
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}
    if(e.key==='Escape'){closeSearch();closeDrawer();closeSidebar();}
    if(e.key==='Enter'&&$('#searchPanel').classList.contains('on')){const first=$('#searchResults .sr');if(first)first.click();}
  });
  showView((location.hash||'#home').slice(1));
  setTimeout(()=>loadDocs().catch(()=>{}),2500);
});
})();











