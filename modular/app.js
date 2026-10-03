/* DATA는 data.js에서 로드됨 */

// ── 데이터 정규화: arrayItems(전두환/김영삼) -> items 객체형으로 통일 ──
const ARR_FIELDS = ["id","title","subtitle","year","문서철번호","문서건번호","면수","원본페이지"];
DATA.collections.forEach(c=>{
  if(c.arrayItems){
    c.items = c.arrayItems.map(a=>{
      const o = {};
      ARR_FIELDS.forEach((f,i)=>o[f]=a[i]);
      return {
        id:o.id, title:o.title, subtitle:o.subtitle, year:o.year, type:"문서",
        detail:{ 생산기관:o.subtitle, 생산년도:o.year, 문서철번호:o.문서철번호, 문서건번호:o.문서건번호, 면수:o.면수, 원본페이지:o.원본페이지 },
        haeje:{summary:"",itemList:[],subRecords:[],raw:""},
      };
    });
    delete c.arrayItems;
  }
  c.items.forEach(it=>{ it._collId = c.id; it._collName = c.shortName; });
});

const collById = Object.fromEntries(DATA.collections.map(c=>[c.id,c]));
let allItems = [];
DATA.collections.forEach(c=> allItems.push(...c.items));

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function formatListText(raw){
  if(!raw) return '';
  // 본문 중간에 붙어서 이어지는 목록 마커(1) 2) / (1) (2) / 가. 나. / ① ②) 앞에 줄바꿈을 넣어
  // 각 항목이 별도 문단으로 보이도록 정리한다. 문장 종결어미(됨./함./임.)는 매치되지 않도록
  // 순서용 한글 글자만 명시적으로 제한.
  const MARKER = /\s(?=(\(\d{1,2}\)|\d{1,2}\)|[가나다라마바사아자차카타파하]\.|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])\s)/g;
  const withBreaks = raw.replace(MARKER, '\n');
  const paras = withBreaks.split('\n').map(p=>p.trim()).filter(Boolean);
  if(paras.length<=1) return `<p class="haeje-p">${escapeHtml(raw)}</p>`;
  return paras.map(p=>`<p class="haeje-p list-line">${escapeHtml(p)}</p>`).join('');
}
function normalize(s){ return String(s||'').toLowerCase(); }

// ── 본문 HTML 안의 텍스트 노드만 하이라이트(태그는 건드리지 않음) ──
function highlightInHtml(html, q){
  const qq = (q||'').trim();
  if(!qq) return html;
  const ql = qq.toLowerCase();
  return String(html).split(/(<[^>]+>)/g).map(seg=>{
    if(seg.charAt(0)==='<') return seg;
    const lower = seg.toLowerCase();
    let out=''; let i=0;
    while(true){
      const idx = lower.indexOf(ql, i);
      if(idx===-1){ out += seg.slice(i); break; }
      out += seg.slice(i, idx) + '<mark>' + seg.slice(idx, idx+qq.length) + '</mark>';
      i = idx + qq.length;
    }
    return out;
  }).join('');
}

// ── 클립보드 복사(실패 시 prompt로 대체) ──
function copyToClipboard(text, btn, successLabel){
  const original = btn ? btn.textContent : '';
  const onDone = ()=>{ if(btn){ btn.textContent = successLabel||'✓ 복사됨'; setTimeout(()=>{ btn.textContent = original; }, 1600); } };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(onDone).catch(()=>{ try{ window.prompt('아래 내용을 복사하세요', text); }catch(e){} });
      return;
    }
  }catch(e){}
  try{ window.prompt('아래 내용을 복사하세요', text); }catch(e){}
}

// ── 영구링크: 특정 자료 상세화면 주소 ──
function itemPermalink(it, c){
  return location.origin + location.pathname + location.search + '#i/' + encodeURIComponent(c.id) + '/' + encodeURIComponent(it.id);
}

// ── 생산처 정보: 자료집마다 필드명이 달라 우선순위대로 탐색 ──
function itemOrg(it){
  if(!it.detail) return '';
  return it.detail.대통령도서관 || it.detail.상위계층명 || '';
}

// ── 인용문 생성 ──
function buildCitation(it, c){
  const org = itemOrg(it);
  const year = (it.detail && it.detail.생산년도) || it.year || '';
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;
  const parts = [`대통령기록관 해외수집기록물 온라인 아카이브, 「${c.shortName}」`, `"${it.title}"`];
  if(org) parts.push(org);
  if(year) parts.push(String(year));
  parts.push(`(접속일: ${dateStr})`);
  parts.push(itemPermalink(it, c));
  return parts.join(', ');
}

// ── 관심자료 담기(북마크, 로컬저장소) ──
const BOOKMARK_KEY = 'paArchiveBookmarks_v1';
function loadBookmarks(){
  try{ return JSON.parse(localStorage.getItem(BOOKMARK_KEY)||'[]'); }catch(e){ return []; }
}
function saveBookmarks(list){
  try{ localStorage.setItem(BOOKMARK_KEY, JSON.stringify(list)); }catch(e){}
}
function isBookmarked(collId, itemId){
  return loadBookmarks().some(b=>b.collId===collId && b.itemId===itemId);
}
function toggleBookmark(it, c){
  const list = loadBookmarks();
  const idx = list.findIndex(b=>b.collId===c.id && b.itemId===it.id);
  if(idx>=0){ list.splice(idx,1); } else {
    list.push({ collId:c.id, itemId:it.id, title:it.title, collName:c.shortName,
      type:it.type||'', year:String((it.detail&&it.detail.생산년도)||it.year||''), savedAt:new Date().toISOString() });
  }
  saveBookmarks(list);
  return idx<0; // true면 지금 막 담긴 상태
}

// ── 관련 자료 추천: 같은 자료집 내 생산처/연도/유형이 겹치는 항목 ──
function relatedItems(it, c, limit){
  limit = limit || 5;
  const org = itemOrg(it);
  const yr = itemYear(it);
  const scored = [];
  c.items.forEach(x=>{
    if(x.id===it.id) return;
    let score = 0;
    if(org && itemOrg(x)===org) score += 2;
    const xy = itemYear(x);
    if(yr!==null && xy===yr) score += 1;
    if(it.type && x.type===it.type) score += 1;
    if(score>0) scored.push({x, score});
  });
  scored.sort((a,b)=>b.score-a.score);
  return scored.slice(0, limit).map(e=>e.x);
}

// ── 오늘의 기록: 날짜 시드 기반 결정적 랜덤 선택 ──
function seededIndex(seedStr, max){
  let h = 0;
  for(let i=0;i<seedStr.length;i++){ h = (h*31 + seedStr.charCodeAt(i)) >>> 0; }
  return max>0 ? h % max : 0;
}
function getTodayRecord(){
  if(allItems.length===0) return null;
  const today = new Date();
  const seed = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
  return allItems[seededIndex(seed, allItems.length)];
}
function haejeSearchText(it){
  const h = it.haeje;
  if(!h) return '';
  let parts = [h.summary||'', h.raw||''];
  if(h.itemList) parts.push(h.itemList.join(' '));
  if(h.subRecords) parts.push(h.subRecords.map(s=>(s.번역제목||'')+' '+(s.주요내용||'')).join(' '));
  return parts.join(' ');
}
function highlightRaw(text, q){
  const s = String(text||'');
  if(!q) return escapeHtml(s);
  const lower = s.toLowerCase(); const ql = q.toLowerCase();
  let out=''; let i=0;
  while(i<s.length){
    const idx = lower.indexOf(ql, i);
    if(idx===-1){ out += escapeHtml(s.slice(i)); break; }
    out += escapeHtml(s.slice(i, idx)) + '<mark>' + escapeHtml(s.slice(idx, idx+ql.length)) + '</mark>';
    i = idx + ql.length;
  }
  return out;
}

// ── 라우팅 상태 ──
const view = { mode:'home', collId:null, tab:'items', q:'', page:1, pageSize:40, typeFilter:'all', treeIndex:0, section:null, subTab:null, appendixNum:1,
  sScope:'all', sColl:'', sType:'', sYearFrom:'', sYearTo:'', countryTab:null, orgTab:null };

function go(mode, collId){
  view.mode = mode; view.collId = collId||null; view.q=''; view.page=1; view.typeFilter='all'; view.treeIndex=0;
  view.section = null; view.subTab = null; view.appendixNum = 1;
  if(mode==='collection'){
    const c = collById[collId];
    if(!c){ view.mode='home'; view.collId=null; render(); window.scrollTo({top:0}); return; }
    if(c.presidentSections){
      view.section = c.presidentSections[0].president;
      view.subTab = 'tree';
    } else if(c.partSections){
      view.section = c.partSections[0].part;
      view.subTab = 'tree';
    } else if(c.appendices){
      view.subTab = 'intro';
    } else {
      view.tab = (c.trees && c.trees.length && c.trees.some(t=>t.nodes.length)) ? 'tree' : 'items';
    }
  } else {
    view.tab='items';
  }
  gsearchInput.value='';
  render();
  window.scrollTo({top:0});
}
document.getElementById('homeBtn').addEventListener('click', ()=>go('home'));
document.getElementById('homeBtn').addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go('home'); } });

function renderBreadcrumb(){
  const bc = document.getElementById('breadcrumb');
  let html = `<a data-nav="home">홈</a>`;
  if(view.mode==='collection'){
    const c = collById[view.collId];
    html += `<span class="sep">›</span><a data-nav="collection">${escapeHtml(c.shortName)}</a>`;
  }
  if(view.mode==='search'){
    html += `<span class="sep">›</span><span>통합검색</span>`;
  }
  if(view.mode==='archives'){
    html += `<span class="sep">›</span><span>수집 아카이브 소장처</span>`;
  }
  if(view.mode==='data'){
    html += `<span class="sep">›</span><span>데이터 제공</span>`;
  }
  if(view.mode==='country'){
    html += `<span class="sep">›</span><span>국가별 보기${view.countryTab?' · '+escapeHtml(view.countryTab):''}</span>`;
  }
  if(view.mode==='orgs'){
    html += `<span class="sep">›</span><span>타기관 보유 자료${view.orgTab?' · '+escapeHtml(view.orgTab):''}</span>`;
  }
  if(view.mode==='timeline'){
    html += `<span class="sep">›</span><span>연표</span>`;
  }
  if(view.mode==='stats'){
    html += `<span class="sep">›</span><span>자료 현황</span>`;
  }
  if(view.mode==='bookmarks'){
    html += `<span class="sep">›</span><span>담은 자료</span>`;
  }
  bc.innerHTML = html;
  bc.querySelectorAll('[data-nav]').forEach(el=>{
    el.addEventListener('click', ()=>{
      if(el.dataset.nav==='home') go('home');
      if(el.dataset.nav==='collection') { view.mode='collection'; view.q=''; view.page=1; render(); }
    });
  });
}

// 자료집별 대메뉴(최상위) 정의 — 클릭 시 해당 자료집의 그 메뉴로 바로 이동
function collTopMenus(c){
  if(c.presidentSections){
    // 미국편1: 대통령도서관별 + 비공개 + 데이터
    const menus = c.presidentSections.map(s=>({key:'sec:'+s.president, label:s.president+' 대통령도서관'}));
    menus.push({key:'sec:restricted', label:'비공개 관련 기록물'});
    menus.push({key:'sec:data', label:'데이터 제공'});
    return menus;
  }
  if(c.partSections){
    const menus = c.partSections.map(s=>({key:'sec:'+s.part, label:s.part}));
    menus.push({key:'sec:data', label:'데이터 제공'});
    return menus;
  }
  if(c.appendices){
    // 미국편3
    return [
      {key:'sub:intro', label:'총론·도서관소개'},
      {key:'sub:items', label:'기록물목록'},
      {key:'sub:appendix', label:'부록'},
      {key:'sub:data', label:'데이터 제공'},
    ];
  }
  // 일반(카터편 등)
  const menus = [];
  const hasTree = c.trees && c.trees.length && c.trees.some(t=>t.nodes.length);
  if(hasTree) menus.push({key:'tab:tree', label:'수집 기록물 내용'});
  menus.push({key:'tab:items', label:'전체 목록'});
  if(c.reference && c.reference.length) menus.push({key:'tab:reference', label:'참고자료'});
  if((c.appendixTables && c.appendixTables.length) || c.appendixNote || c.appendixImages) menus.push({key:'tab:appendix', label:'부록'});
  menus.push({key:'tab:data', label:'데이터 제공'});
  return menus;
}
function currentMenuKey(c){
  if(c.presidentSections) return 'sec:'+(view.section||'');
  if(c.partSections) return 'sec:'+(view.section||'');
  if(c.appendices) return 'sub:'+(view.subTab||'');
  return 'tab:'+(view.tab||'');
}
function applyMenuKey(c, key){
  const [kind, val] = key.split(':');
  if(kind==='sec'){
    view.section = val;
    view.subTab = val==='restricted' ? 'restrictedList' : 'tree';
  }
  else if(kind==='sub'){ view.subTab = val; if(val==='appendix' && !view.appendixNum) view.appendixNum=1; }
  else if(kind==='tab'){ view.tab = val; }
  view.q=''; view.page=1;
}

function renderSidebar(){
  const nav = document.getElementById('sidebar');
  let html = '';
  DATA.collections.forEach(c=>{
    const isActive = view.mode==='collection' && view.collId===c.id;
    html += `<div class="sidebar-group">
      <button class="sidebar-coll ${isActive?'active open':''}" data-coll="${c.id}" tabindex="0" aria-expanded="${isActive}">
        <span>${escapeHtml(c.shortName)}</span>
        <span class="sc-caret" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
      </button>`;
    if(isActive){
      const menus = collTopMenus(c);
      const curKey = currentMenuKey(c);
      html += `<div class="sidebar-sub">`;
      menus.forEach(m=>{
        html += `<button data-coll="${c.id}" data-menu="${m.key}" tabindex="0" class="${m.key===curKey?'active':''}">${escapeHtml(m.label)}</button>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  });
  // 통합 데이터 제공 (자료집과 별개의 최상위 메뉴)
  html += `<div class="sidebar-group sidebar-group-sep">
    <button class="sidebar-coll ${view.mode==='archives'?'active':''}" data-archivesmenu="1" tabindex="0">
      <span>수집 아카이브 소장처</span>
      <span class="sc-caret" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
    </button>
  </div>
  <div class="sidebar-group">
    <button class="sidebar-coll ${view.mode==='country'?'active open':''}" data-countrymenu="1" tabindex="0" aria-expanded="${view.mode==='country'}">
      <span>국가별 보기</span>
      <span class="sc-caret" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
    </button>
    ${view.mode==='country' ? `<div class="sidebar-sub">${COUNTRIES.map(c=>`<button data-countrytab="${escapeHtml(c)}" tabindex="0" class="${c===view.countryTab?'active':''}">${escapeHtml(c)}</button>`).join('')}</div>` : ''}
  </div>
  <div class="sidebar-group">
    <button class="sidebar-coll ${view.mode==='orgs'?'active open':''}" data-orgsmenu="1" tabindex="0" aria-expanded="${view.mode==='orgs'}">
      <span>타기관 보유 자료</span>
      <span class="sc-caret" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
    </button>
    ${view.mode==='orgs' ? `<div class="sidebar-sub">${ORG_LIST.map(o=>`<button data-orgtab="${escapeHtml(o)}" tabindex="0" class="${o===view.orgTab?'active':''}">${escapeHtml(o)}</button>`).join('')}</div>` : ''}
  </div>
  <div class="sidebar-group">
    <button class="sidebar-coll ${view.mode==='timeline'?'active':''}" data-timelinemenu="1" tabindex="0">
      <span>연표</span>
      <span class="sc-caret" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="13"/><line x1="22" y1="20" x2="22" y2="7"/></svg></span>
    </button>
  </div>
  <div class="sidebar-group">
    <button class="sidebar-coll ${view.mode==='stats'?'active':''}" data-statsmenu="1" tabindex="0">
      <span>자료 현황</span>
      <span class="sc-caret" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="8"/><rect x="10" y="7" width="4" height="13"/><rect x="17" y="3" width="4" height="17"/></svg></span>
    </button>
  </div>
  <div class="sidebar-group">
    <button class="sidebar-coll ${view.mode==='bookmarks'?'active':''}" data-bookmarksmenu="1" tabindex="0">
      <span>담은 자료${loadBookmarks().length ? ` (${loadBookmarks().length})` : ''}</span>
      <span class="sc-caret" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></span>
    </button>
  </div>
  <div class="sidebar-group">
    <button class="sidebar-coll ${view.mode==='data'?'active':''}" data-datamenu="1" tabindex="0">
      <span>데이터 제공</span>
      <span class="sc-caret" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
    </button>
  </div>`;
  nav.innerHTML = html;
  const am = nav.querySelector('[data-archivesmenu]');
  if(am){
    const actA = ()=>{ view.mode='archives'; view.collId=null; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    am.addEventListener('click', actA);
    am.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); actA(); } });
  }
  const cm = nav.querySelector('[data-countrymenu]');
  if(cm){
    const actC = ()=>{ view.mode='country'; view.collId=null; if(!view.countryTab) view.countryTab=COUNTRIES[0]; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    cm.addEventListener('click', actC);
    cm.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); actC(); } });
  }
  nav.querySelectorAll('[data-countrytab]').forEach(el=>{
    const act = ()=>{ view.mode='country'; view.collId=null; view.countryTab=el.dataset.countrytab; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } });
  });
  const om = nav.querySelector('[data-orgsmenu]');
  if(om){
    const actO = ()=>{ view.mode='orgs'; view.collId=null; if(!view.orgTab) view.orgTab=ORG_LIST[0]; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    om.addEventListener('click', actO);
    om.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); actO(); } });
  }
  nav.querySelectorAll('[data-orgtab]').forEach(el=>{
    const act = ()=>{ view.mode='orgs'; view.collId=null; view.orgTab=el.dataset.orgtab; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } });
  });
  const dm = nav.querySelector('[data-datamenu]');
  if(dm){
    const actD = ()=>{ view.mode='data'; view.collId=null; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    dm.addEventListener('click', actD);
    dm.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); actD(); } });
  }
  const tm = nav.querySelector('[data-timelinemenu]');
  if(tm){
    const actT = ()=>{ view.mode='timeline'; view.collId=null; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    tm.addEventListener('click', actT);
    tm.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); actT(); } });
  }
  const sm = nav.querySelector('[data-statsmenu]');
  if(sm){
    const actS = ()=>{ view.mode='stats'; view.collId=null; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    sm.addEventListener('click', actS);
    sm.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); actS(); } });
  }
  const bm = nav.querySelector('[data-bookmarksmenu]');
  if(bm){
    const actB = ()=>{ view.mode='bookmarks'; view.collId=null; gsearchInput.value=''; render(); window.scrollTo({top:0}); };
    bm.addEventListener('click', actB);
    bm.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); actB(); } });
  }
  nav.querySelectorAll('.sidebar-coll[data-coll]').forEach(el=>{
    const act = ()=>{
      if(view.mode==='collection' && view.collId===el.dataset.coll){
        // 이미 열린 자료집을 다시 누르면 첫 메뉴로
        go('collection', el.dataset.coll);
      } else {
        go('collection', el.dataset.coll);
      }
    };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } });
  });
  nav.querySelectorAll('[data-menu]').forEach(el=>{
    const act = ()=>{
      const c = collById[el.dataset.coll];
      if(view.collId!==c.id){ go('collection', c.id); }
      applyMenuKey(c, el.dataset.menu);
      render();
      window.scrollTo({top:0});
    };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } });
  });
}

const A11Y_SELS = '.tab,.chip,.tree-toggle,.tree-label.has-detail,.submenu-item,.row[data-id],.row[data-ref],.fm-toggle,.orig-toggle,[data-treeidx],[data-coll],[data-nav],[data-menu],[data-subtab],[data-section],[data-tab],[data-type]';
function applyA11y(root){
  (root||document).querySelectorAll(A11Y_SELS).forEach(el=>{
    if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0');
    if(!el.hasAttribute('role')) el.setAttribute('role','button');
  });
}
// 전역 위임: 커스텀 클릭요소에서 Enter/Space → click
document.addEventListener('keydown', (e)=>{
  if(e.key!=='Enter' && e.key!==' ') return;
  const t = e.target;
  if(t.matches && t.matches(A11Y_SELS) && t.tagName!=='INPUT' && t.tagName!=='SELECT' && t.tagName!=='BUTTON' && t.tagName!=='TEXTAREA'){
    e.preventDefault(); t.click();
  }
});

function render(){
  renderBreadcrumb();
  renderSidebar();
  const main = document.getElementById('main');
  if(view.mode==='home') renderHome(main);
  else if(view.mode==='collection') renderCollection(main);
  else if(view.mode==='search') renderSearchResults(main);
  else if(view.mode==='data') renderDataHub(main);
  else if(view.mode==='archives') renderArchivesMap(main);
  else if(view.mode==='country') renderCountryView(main);
  else if(view.mode==='orgs') renderOrgView(main);
  else if(view.mode==='timeline') renderTimelineView(main);
  else if(view.mode==='stats') renderStatsView(main);
  else if(view.mode==='bookmarks') renderBookmarksView(main);
  applyA11y();
}
// 동적 하위 렌더 후에도 tabindex 부여를 위해 MutationObserver 사용
new MutationObserver(()=>applyA11y()).observe(document.getElementById('main'), {childList:true, subtree:true});

// ── 수집 아카이브 소장처: 실제 세계지도(Leaflet + OpenStreetMap, API 키 불필요) ──
const ARCHIVE_SITES = [
  {name:'지미 카터 대통령도서관', place:'미국 조지아주 애틀랜타', lat:33.7627, lng:-84.3557, collId:'carter_haeje', section:null, country:'미국'},
  {name:'린든 존슨 대통령도서관', place:'미국 텍사스주 오스틴', lat:30.2861, lng:-97.7312, collId:'usa1_collection', section:'존슨', country:'미국'},
  {name:'로널드 레이건 대통령도서관', place:'미국 캘리포니아주 시미밸리', lat:34.2592, lng:-118.8206, collId:'usa1_collection', section:'레이건', country:'미국'},
  {name:'조지 H.W. 부시 대통령도서관', place:'미국 텍사스주 칼리지스테이션', lat:30.6006, lng:-96.3231, collId:'usa3_bush', section:null, country:'미국'},
  {name:'영국 국가기록원(TNA)', place:'영국 런던 큐(Kew)', lat:51.4796, lng:-0.2919, collId:'europe1', section:'영국 국가기록원(TNA)', country:'영국'},
  {name:'프랑스 외무부 기록관', place:'프랑스 라 쿠르뇌브', lat:48.9186, lng:2.3854, collId:'europe1', section:'프랑스 외무부 기록관', country:'프랑스'},
  {name:'독일연방기록청', place:'독일 코블렌츠', lat:50.3569, lng:7.5886, collId:'europe2', section:null, country:'독일'},
  {name:'프랑스 국립기록관', place:'프랑스 피에르피트쉬르센', lat:48.9575, lng:2.3639, collId:'france1', section:null, country:'프랑스'},
  {name:'프랑스 외무부기록관', place:'프랑스 라 쿠르뇌브', lat:48.9146, lng:2.3814, collId:'france2', section:null, country:'프랑스'},
];
// 린든 존슨 도서관은 1.1~1.2 등 존슨 섹션(usa1_collection, section:'존슨')에 해당하며,
// usa1_collection에는 '레이건' 외 '카터'(usa1 자료집 자체 내 카터 섹션)도 있을 수 있어
// 국가별 집계는 country 필드가 아니라 아래 COUNTRY_GROUPS로 별도 관리한다.

// ── 국가별 보기: 자료집(또는 자료집 내 특정 구간)을 국가별로 묶는 정의 ──
// matchItem(it)이 true를 반환하는 품목만 해당 국가에 집계한다.
const COUNTRIES = ['미국','영국','프랑스','독일'];
const COUNTRY_GROUPS = {
  '미국': [
    {collId:'carter_haeje', label:'카터편 해제 (지미 카터 대통령도서관)', match:null},
    {collId:'usa1_collection', label:'미국편1 (존슨·카터·레이건 대통령도서관)', match:null},
    {collId:'usa2', label:'미국편2 (닉슨·포드 대통령도서관)', match:null},
    {collId:'usa3_bush', label:'미국편3 (부시 대통령도서관)', match:null},
  ],
  '영국': [
    {collId:'europe1', label:'유럽편1 중 영국 국가기록원(TNA) 소장분', match: it => String(it.id||'').startsWith('eu1-tna'), part:'영국 국가기록원(TNA)'},
  ],
  '프랑스': [
    {collId:'europe1', label:'유럽편1 중 프랑스 외무부 기록관 소장분', match: it => String(it.id||'').startsWith('eu1-fr'), part:'프랑스 외무부 기록관'},
    {collId:'france1', label:'프랑스편1 (프랑스 국립기록관)', match:null},
    {collId:'france2', label:'프랑스편2 (프랑스 외무부기록관)', match:null},
  ],
  '독일': [
    {collId:'europe2', label:'유럽편2 (독일연방기록청)', match:null},
  ],
};

// ── 각 기관(국가기록원·국사편찬위원회·국립중앙도서관·외교부 등)이 발간·구축한
// 해외수집기록물 관련 참고문헌. 2026년 조사 기준으로, 공식 홈페이지·보고서에서
// 직접 확인된 내용만 수록했다. 항목별 소장 목록까지는 확인되지 않아 note에 한계를 밝혔다. ──
const COUNTRY_REFERENCES = {
  '공통': [
    {inst:'국립중앙도서관', title:'해외 소재 한국 관련 자료 중장기 수집 정책 수립 연구 최종보고서(2022.12)', desc:'국내 기관의 해외 한국관련자료 수집 현황과 중장기 수집 정책 방향을 종합 조사한 정책연구보고서.', url:'https://www.oak.go.kr/nl-ir/handle/2020.oak/1175', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 (전체 안내)', desc:'2002년부터 간행 중인 총서(2022년 기준 39책). 미국·일본·러시아·중국 소재 자료가 중심이며, 조사 대상국에 영국도 포함되었으나 영국 전담 권은 확인되지 않는다. 각 권 PDF를 무료로 내려받을 수 있다.', url:'https://db.history.go.kr/id/pbct_005_0110_0110', note:'미국편은 아래 개별 권으로 정리함. 일본·러시아·중국편은 본 아카이브의 국가 탭(미국·영국·프랑스·독일)과 무관해 생략함'},
    {inst:'국사편찬위원회', title:'수집 자료 편람 시리즈', desc:'국가·지역별 수집 사료 현황을 정리한 편람. 예: 「국사편찬위원회 수집 일본 자료 편람」(2015.12).', url:'https://www.history.go.kr/', note:'미국·유럽 지역에 대한 편람 발간 여부는 추가 확인이 필요함'},
  ],
  '미국': [
    {inst:'국립중앙도서관', title:'해외 한국관련자료 디지털컬렉션 — 미국 국립문서기록관리청(NARA)', desc:'2004년부터 NARA 소장 한국 관련 기록을 수집·디지털화. 2025년 말 기준 약 341만 면 제공.', url:'https://www.nl.go.kr/NL/contents/N20401010000.do', note:null},
    {inst:'국립중앙도서관', title:'해외 한국관련자료 디지털컬렉션 — 미국 중앙정보국(CIA)', desc:'미국 CIA가 비밀해제한 한국 관련 문서를 디지털화하여 제공하는 컬렉션.', url:'https://www.nl.go.kr/NL/contents/N10200000000.do', note:null},
    {inst:'외교부 외교사료관', title:'30년 경과 외교문서 공개', desc:'생산 후 30년이 지난 외교문서를 매년 정기 공개. 2026년 기준 제33차(1995년도분)까지 공개되었으며 한미관계 문서를 포함한다.', url:'https://diplomaticarchives.mofa.go.kr/', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 2 미국소재 한국사 자료 조사보고 I -NARA 소장 RG 59·RG 84 외-', desc:'강영철, 정태헌, 허영란 | 2002-12-30 | ii, 469 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0020', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 3 미국소재 한국사 자료 조사보고 II -NARA 소장 RG 332·RG 338 외-', desc:'강영철, 정태헌, 허영란 | 2002-12-30 | iv, 252 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0030', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 4 미국소재 한국사 자료 조사보고 III -NARA 소장 RG 242 〈선별노획문서〉 외-', desc:'강영철, 정태헌, 허영란 | 2002-12-30 | vi, 571 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0040', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 7 미국소재 한국사 자료 조사보고 IV', desc:'이상태, 김득중 | 2004-12-23 | iv, vii, 507 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0070', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 13 미국소재 한국사 자료 조사보고 V', desc:'구선희, 윤덕영 외 | 2007-12-15 | x, 487 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0130', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 17 한미 행정협정 문서 I(1954~1961)', desc:'구선희, 김점숙 | 2008-12-18 | xiii, 405 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0170', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 20 한미 행정협정 문서 II(1962~1966)', desc:'장필기, 김점숙 | 2009-06-30 | xii, 407 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0200', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 23 1950년대 한국경제 관련 미국 문서', desc:'나애자, 이상록 | 2011-12-31 | xxvii, 492 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0230', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 24 한국에서 보낸 나날들', desc:'빈센트 브란트(저) · 나애자, 이상록, 김여두(기획) | 2011-12-31 | 252 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0240', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 27 미국 NARA 소장 주한 미국공보원 영상자료 해제', desc:'김대길, 김광재, 고지훈 | 2013-12 | 281 p.+CD-ROM · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0270', note:null},
    {inst:'국사편찬위원회', title:'해외사료총서 29 미국소재 한국사 자료 조사보고Ⅵ', desc:'박진희, 이현진 | 2016-11-21 | 481 p. · 페이지 내 PDF 다운로드 버튼 이용', url:'https://db.history.go.kr/id/pbct_005_0110_0290', note:null},
  ],
  '영국': [
    {inst:'국립중앙도서관', title:'해외 한국관련자료 수집 정책 (영국 소재분)', desc:'2022년 정책연구보고서에서 유럽 소재 한국 관련 자료 수집 필요성이 검토된 바 있다.', url:'https://www.oak.go.kr/nl-ir/handle/2020.oak/1175', note:'영국 국가기록원(TNA) 전용 상설 디지털컬렉션은 조사 시점 기준 확인되지 않음'},
  ],
  '프랑스': [
    {inst:'국립중앙도서관', title:'해외 한국관련자료 수집 정책 (프랑스 소재분)', desc:'2022년 정책연구보고서에서 유럽 소재 한국 관련 자료 수집 필요성이 검토된 바 있다.', url:'https://www.oak.go.kr/nl-ir/handle/2020.oak/1175', note:'프랑스 외무부·국립기록관 전용 상설 디지털컬렉션은 조사 시점 기준 확인되지 않음'},
  ],
  '독일': [
    {inst:'국립중앙도서관', title:'해외 한국관련자료 수집 정책 (독일 소재분)', desc:'2022년 정책연구보고서에서 유럽 소재 한국 관련 자료 수집 필요성이 검토된 바 있다.', url:'https://www.oak.go.kr/nl-ir/handle/2020.oak/1175', note:'독일연방기록청 전용 상설 디지털컬렉션은 조사 시점 기준 확인되지 않음'},
  ],
};
// ── 타기관 보유 자료: COUNTRY_REFERENCES에 등장하는 기관명을 모아 목록화 ──
const ORG_LIST = Array.from(new Set(Object.values(COUNTRY_REFERENCES).flat().map(r=>r.inst)));
// ── 국가별 보기: 자료집 + 참고문헌을 국가 단위로 모아 보여준다 ──
function renderCountryView(main){
  if(!view.countryTab) view.countryTab = COUNTRIES[0];
  const tab = view.countryTab;
  const tabsHtml = COUNTRIES.map(c=>`<button class="country-tab ${c===tab?'active':''}" data-ctab="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');

  const groups = COUNTRY_GROUPS[tab] || [];
  const collCards = groups.map(g=>{
    const c = collById[g.collId];
    if(!c) return '';
    const count = g.match ? c.items.filter(g.match).length : c.items.length;
    return `<div class="country-coll-card" data-coll="${c.id}" data-part="${g.part?escapeHtml(g.part):''}">
      <span class="country-coll-name">${escapeHtml(g.label)}</span>
      <span class="country-coll-count">${count.toLocaleString()}건 →</span>
    </div>`;
  }).join('');

  const refs = [...(COUNTRY_REFERENCES[tab]||[])];
  const refCards = refs.map(r=>`
    <div class="ref-card">
      <div class="ref-inst">${escapeHtml(r.inst)}</div>
      <div class="ref-title">${escapeHtml(r.title)}</div>
      <div class="ref-desc">${escapeHtml(r.desc)}</div>
      ${r.note?`<div class="ref-note">※ ${escapeHtml(r.note)}</div>`:''}
      ${r.url?`<a class="ref-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">바로가기 →</a>`:''}
    </div>`).join('');
  const commonRefs = COUNTRY_REFERENCES['공통']||[];
  const commonCards = commonRefs.map(r=>`
    <div class="ref-card">
      <div class="ref-inst">${escapeHtml(r.inst)}</div>
      <div class="ref-title">${escapeHtml(r.title)}</div>
      <div class="ref-desc">${escapeHtml(r.desc)}</div>
      ${r.note?`<div class="ref-note">※ ${escapeHtml(r.note)}</div>`:''}
      ${r.url?`<a class="ref-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">바로가기 →</a>`:''}
    </div>`).join('');

  main.innerHTML = `
    <div class="home-title">국가별로 본 아카이브의 자료집과, 각 기관(국가기록원·국사편찬위원회·국립중앙도서관·외교부 등)이 조사한 해외수집기록물 참고문헌을 함께 볼 수 있습니다.</div>
    <div class="country-tabs">${tabsHtml}</div>
    <div class="country-section-title">📁 본 아카이브의 ${escapeHtml(tab)} 소재 자료집</div>
    <div class="country-coll-list">${collCards || '<div class="ref-note">해당 국가의 자료집이 아직 없습니다.</div>'}</div>
    <div class="country-section-title">📚 ${escapeHtml(tab)} 관련 참고문헌 (타 기관 발간·구축 자료)</div>
    ${refCards || '<div class="ref-note">조사된 참고문헌이 없습니다.</div>'}
    <div class="country-section-title">📚 공통 참고문헌</div>
    ${commonCards}
  `;

  main.querySelectorAll('[data-ctab]').forEach(el=>{
    el.addEventListener('click', ()=>{ view.countryTab = el.dataset.ctab; render(); window.scrollTo({top:0}); });
  });
  main.querySelectorAll('.country-coll-card').forEach(el=>{
    el.addEventListener('click', ()=>{
      go('collection', el.dataset.coll);
      if(el.dataset.part){ view.section = el.dataset.part; view.subTab = 'tree'; }
      render();
      window.scrollTo({top:0});
    });
  });
}

// ── 타기관 보유 자료: 기관을 선택하면 COUNTRY_REFERENCES 전체(국가별+공통)에서
// 해당 기관의 항목만 모아, 어느 국가 관련 자료인지 태그를 붙여 보여준다 ──
function renderOrgView(main){
  if(!view.orgTab) view.orgTab = ORG_LIST[0];
  const org = view.orgTab;
  const tabsHtml = ORG_LIST.map(o=>`<button class="country-tab ${o===org?'active':''}" data-otab="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('');

  const items = [];
  Object.keys(COUNTRY_REFERENCES).forEach(countryKey=>{
    (COUNTRY_REFERENCES[countryKey]||[]).forEach(r=>{
      if(r.inst === org) items.push({...r, countryKey});
    });
  });

  const cards = items.map(r=>`
    <div class="ref-card">
      <div class="ref-inst">${escapeHtml(r.countryKey==='공통' ? '공통' : r.countryKey)}</div>
      <div class="ref-title">${escapeHtml(r.title)}</div>
      <div class="ref-desc">${escapeHtml(r.desc)}</div>
      ${r.note?`<div class="ref-note">※ ${escapeHtml(r.note)}</div>`:''}
      ${r.url?`<a class="ref-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">바로가기 →</a>`:''}
    </div>`).join('');

  main.innerHTML = `
    <div class="home-title">각 기관(국가기록원·국사편찬위원회·국립중앙도서관·외교부 등)별로 조사된 해외수집기록물 참고문헌을 모아 볼 수 있습니다.</div>
    <div class="country-tabs">${tabsHtml}</div>
    <div class="country-section-title">📚 ${escapeHtml(org)} 보유·발간 자료 (${items.length}건)</div>
    ${cards || '<div class="ref-note">조사된 자료가 없습니다.</div>'}
  `;

  main.querySelectorAll('[data-otab]').forEach(el=>{
    el.addEventListener('click', ()=>{ view.orgTab = el.dataset.otab; render(); window.scrollTo({top:0}); });
  });
}

// ── 담은 자료(북마크): 로컬저장소 기반, 이 브라우저에서만 보임 ──
function renderBookmarksView(main){
  const list = loadBookmarks();
  const rows = list.map(b=>`
    <div class="bookmark-row" data-coll="${escapeHtml(b.collId)}" data-item="${escapeHtml(b.itemId)}">
      <div class="bookmark-main">
        <div class="bookmark-title">${escapeHtml(b.title)}</div>
        <div class="bookmark-meta">${escapeHtml(b.collName)}${b.type?' · '+escapeHtml(b.type):''}${b.year?' · '+escapeHtml(b.year):''}</div>
      </div>
      <button class="bookmark-remove" data-remove="1">제거</button>
    </div>`).join('');
  main.innerHTML = `
    <div class="home-title">직접 담아둔 자료 목록입니다. 이 목록은 이 브라우저에만 저장되며 다른 사람과 공유되지 않습니다.</div>
    <div class="bookmark-actions">
      <button class="dl-btn" id="exportBookmarksBtn" ${list.length?'':'disabled'}>⬇ CSV로 내보내기</button>
      <button class="dl-btn" id="clearBookmarksBtn" ${list.length?'':'disabled'}>전체 비우기</button>
    </div>
    <div class="bookmark-list">${rows || '<div class="empty">아직 담아둔 자료가 없습니다. 자료 상세보기에서 "☆ 담기" 버튼을 눌러보세요.</div>'}</div>
  `;
  main.querySelectorAll('.bookmark-row').forEach(row=>{
    row.addEventListener('click', (e)=>{
      if(e.target && e.target.dataset && e.target.dataset.remove) return;
      const c = collById[row.dataset.coll];
      if(!c) return;
      const it = c.items.find(x=>x.id===row.dataset.item);
      if(it) openItemPanel(it, c);
    });
  });
  main.querySelectorAll('[data-remove]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const row = btn.closest('.bookmark-row');
      const list2 = loadBookmarks().filter(b=> !(b.collId===row.dataset.coll && b.itemId===row.dataset.item));
      saveBookmarks(list2);
      renderBookmarksView(main);
      renderSidebar();
    });
  });
  const exportBtn = document.getElementById('exportBookmarksBtn');
  if(exportBtn && list.length) exportBtn.addEventListener('click', ()=> exportBookmarksCSV(list));
  const clearBtn = document.getElementById('clearBookmarksBtn');
  if(clearBtn && list.length){
    clearBtn.addEventListener('click', ()=>{
      let ok = true;
      try{ ok = window.confirm('담은 자료를 모두 비우시겠습니까?'); }catch(e){ ok = true; }
      if(!ok) return;
      saveBookmarks([]);
      renderBookmarksView(main);
      renderSidebar();
    });
  }
}
function exportBookmarksCSV(list){
  const header = ['자료집','제목','유형','연도','담은일시'];
  const rows = list.map(b=>[b.collName, b.title, b.type||'', b.year||'', b.savedAt||'']);
  const csv = [header, ...rows].map(r=> r.map(v=>{
    const s = String(v==null?'':v).replace(/"/g,'""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(',')).join('\r\n');
  const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿'+csv);
  const a = document.createElement('a');
  a.href = dataUri; a.download = '담은자료_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── 연표: 생산연도별 건수를 막대그래프로, 클릭하면 해당 연도로 상세검색 필터 ──
function renderTimelineView(main){
  const counts = {};
  allItems.forEach(it=>{ const y=itemYear(it); if(y) counts[y]=(counts[y]||0)+1; });
  const years = Object.keys(counts).map(Number).sort((a,b)=>a-b);
  if(years.length===0){
    main.innerHTML = `<div class="home-title">생산연도 정보가 있는 자료가 없습니다.</div>`;
    return;
  }
  const minY = years[0], maxY = years[years.length-1];
  const maxCount = Math.max(...years.map(y=>counts[y]));
  const totalWithYear = years.reduce((s,y)=>s+counts[y],0);
  const bars = years.map(y=>{
    const h = Math.max(4, Math.round((counts[y]/maxCount)*160));
    const showLabel = (y % 5 === 0) || y===minY || y===maxY;
    return `<div class="tl-bar-wrap" data-year="${y}" tabindex="0" role="button" title="${y}년 · ${counts[y]}건">
      <div class="tl-bar" style="height:${h}px"></div>
      <div class="tl-year">${showLabel ? y : ''}</div>
    </div>`;
  }).join('');
  main.innerHTML = `
    <div class="home-title">전체 자료를 생산연도별로 늘어놓은 연표입니다. 막대를 클릭하면 해당 연도의 자료만 모아볼 수 있습니다. (${minY}년~${maxY}년, 연도 정보가 있는 자료 ${totalWithYear.toLocaleString()}건)</div>
    <div class="timeline-wrap"><div class="timeline-chart">${bars}</div></div>
  `;
  main.querySelectorAll('.tl-bar-wrap').forEach(el=>{
    const act = ()=>{
      const y = el.dataset.year;
      view.mode='search'; view.q=''; view.sScope='all'; view.sColl=''; view.sType=''; view.sYearFrom=y; view.sYearTo=y; view.page=1;
      gsearchInput.value='';
      render();
      window.scrollTo({top:0});
    };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } });
  });
}

// ── 자료 현황(통계): 자료집별/연도별(10년단위)/생산처별 건수 ──
function renderStatsView(main){
  const collStats = DATA.collections.map(c=>({label:c.shortName, count:c.items.length})).sort((a,b)=>b.count-a.count);
  const maxColl = Math.max(1, ...collStats.map(s=>s.count));
  const statRow = (label, count, max)=>`
    <div class="stat-row">
      <div class="stat-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
      <div class="stat-bar-track"><div class="stat-bar" style="width:${(count/max*100).toFixed(1)}%"></div></div>
      <div class="stat-count">${count.toLocaleString()}</div>
    </div>`;
  const collBars = collStats.map(s=>statRow(s.label, s.count, maxColl)).join('');

  const decadeCounts = {};
  allItems.forEach(it=>{ const y=itemYear(it); if(y){ const d=Math.floor(y/10)*10; decadeCounts[d]=(decadeCounts[d]||0)+1; } });
  const decades = Object.keys(decadeCounts).map(Number).sort((a,b)=>a-b);
  const maxDecade = Math.max(1, ...decades.map(d=>decadeCounts[d]));
  const decadeBars = decades.map(d=>statRow(d+'년대', decadeCounts[d], maxDecade)).join('');

  // 생산처(대통령도서관/상위계층명) 우선, 없으면 자료 유형(구조적 단계 표시는 제외)으로 집계
  const STRUCTURAL_TYPES = new Set(['레벨1','레벨2','레벨3','레벨4','목록','세부기록물']);
  const orgCounts = {};
  allItems.forEach(it=>{
    const org = itemOrg(it) || (it.type && !STRUCTURAL_TYPES.has(it.type) ? it.type : '');
    if(org) orgCounts[org]=(orgCounts[org]||0)+1;
  });
  const orgTop = Object.entries(orgCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const maxOrg = Math.max(1, ...orgTop.map(e=>e[1]));
  const orgBars = orgTop.map(([org,count])=>statRow(org, count, maxOrg)).join('');

  main.innerHTML = `
    <div class="home-title">전체 ${allItems.length.toLocaleString()}건의 자료를 자료집·생산연도·생산처별로 집계한 현황입니다.</div>
    <div class="country-section-title">자료집별 건수</div>
    <div class="stat-list">${collBars}</div>
    <div class="country-section-title">생산연도별 건수 (10년 단위)</div>
    <div class="stat-list">${decadeBars || '<div class="ref-note">연도 정보가 있는 자료가 없습니다.</div>'}</div>
    <div class="country-section-title">생산처별 건수 (상위 10)</div>
    <div class="stat-list">${orgBars || '<div class="ref-note">생산처 정보가 있는 자료가 없습니다.</div>'}</div>
  `;
}

let archivesLeafletMap = null;
function renderArchivesMap(main){
  let html = `<div class="home-title">한국 관련 기록물을 수집한 해외 소장처들입니다. 지도의 표시를 클릭하면 해당 기관에서 수집한 기록물을 볼 수 있습니다.</div>
  <div class="archives-map-wrap">
    <div id="leafletMap" class="archives-leaflet"></div>
  </div>
  <div class="archives-list">
    ${ARCHIVE_SITES.map((s,i)=>`
      <div class="archive-card" data-idx="${i}" tabindex="0" role="button">
        <div class="archive-card-name">${escapeHtml(s.name)}</div>
        <div class="archive-card-place">${escapeHtml(s.place)}</div>
      </div>`).join('')}
  </div>`;
  main.innerHTML = html;

  const goTo = (idx)=>{
    const s = ARCHIVE_SITES[idx];
    if(s.section){
      go('collection', s.collId);
      view.section = s.section; view.subTab = 'tree';
      render();
    } else {
      go('collection', s.collId);
    }
    window.scrollTo({top:0});
  };

  main.querySelectorAll('.archive-card').forEach(el=>{
    el.addEventListener('click', ()=> goTo(+el.dataset.idx));
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); goTo(+el.dataset.idx); } });
  });

  // Leaflet 지도 초기화(OpenStreetMap 타일, API 키 불필요)
  if(typeof L === 'undefined'){
    document.getElementById('leafletMap').innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink-faint);">지도를 불러오려면 인터넷 연결이 필요합니다.</div>';
    return;
  }
  if(archivesLeafletMap){ archivesLeafletMap.remove(); archivesLeafletMap = null; }
  const map = L.map('leafletMap', {scrollWheelZoom:false}).setView([30, 10], 2);
  archivesLeafletMap = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  const markerIcon = L.divIcon({
    className: 'archive-leaflet-pin',
    html: '<div class="pin-dot-html"></div>',
    iconSize: [16,16], iconAnchor: [8,8],
  });
  ARCHIVE_SITES.forEach((s, i)=>{
    const marker = L.marker([s.lat, s.lng], {icon: markerIcon}).addTo(map);
    marker.bindTooltip(s.name, {direction:'top', offset:[0,-6]});
    marker.on('click', ()=> goTo(i));
    marker.on('mouseover', ()=>{
      const card = main.querySelector(`.archive-card[data-idx="${i}"]`);
      if(card) card.classList.add('hover');
    });
    marker.on('mouseout', ()=>{
      const card = main.querySelector(`.archive-card[data-idx="${i}"]`);
      if(card) card.classList.remove('hover');
    });
  });

}

function renderTodayRecordWidget(){
  const it = getTodayRecord();
  if(!it) return '';
  const c = collById[it._collId];
  const org = itemOrg(it);
  const year = (it.detail && it.detail.생산년도) || it.year || '';
  return `<div class="today-record" data-coll="${escapeHtml(it._collId)}" data-item="${escapeHtml(it.id)}" tabindex="0" role="button">
    <div class="today-record-label">오늘의 기록</div>
    <div class="today-record-title">${escapeHtml(it.title)}</div>
    <div class="today-record-meta">${escapeHtml(c?c.shortName:'')}${org?' · '+escapeHtml(org):''}${year?' · '+escapeHtml(String(year)):''}</div>
  </div>`;
}
function wireTodayRecordWidget(main){
  const el = main.querySelector('.today-record');
  if(!el) return;
  const act = ()=>{
    const c = collById[el.dataset.coll];
    if(!c) return;
    const it = c.items.find(x=>x.id===el.dataset.item);
    if(it) openItemPanel(it, c);
  };
  el.addEventListener('click', act);
  el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } });
}
function renderHome(main){
  let html = `<div class="home-title">자료집을 선택하면 원본 목차 구조 그대로 열람할 수 있습니다. 상단 검색창은 전체 자료집을 대상으로 합니다.</div>`;
  html += renderTodayRecordWidget();
  html += `<div class="coll-grid">`;
  DATA.collections.forEach(c=>{
    html += `<div class="coll-card" data-coll="${c.id}">
      ${c.cover ? `<div class="coll-card-cover-wrap"><img class="coll-card-cover" src="data:image/jpeg;base64,${c.cover}" alt="${escapeHtml(c.shortName)} 표지"></div>` : ''}
      <div class="coll-card-body">
        <div class="tag">${escapeHtml(c.shortName)}${c.publishedDate ? ` <span class="tag-date">(제작 ${escapeHtml(c.publishedDate)})</span>` : ''}</div>
        <h3>${escapeHtml(c.name)}</h3>
        <div class="period">${escapeHtml(c.period)}</div>
        <p>${escapeHtml(c.description)}</p>
      </div>
    </div>`;
  });
  html += `</div>`;
  main.innerHTML = html;
  wireTodayRecordWidget(main);
  main.querySelectorAll('[data-coll]').forEach(el=>{
    el.addEventListener('click', ()=> go('collection', el.dataset.coll));
  });
}

function renderCollIntroHtml(c){
  return `<div class="coll-header">
    <div class="coll-intro">
      ${c.cover ? `<img class="coll-cover" src="data:image/jpeg;base64,${c.cover}" alt="표지">` : ''}
      <div class="coll-intro-text">
        <h2>${escapeHtml(c.name)}</h2>
        <div class="period">${escapeHtml(c.period)}</div>
        <p>${escapeHtml(c.description)}</p>
        ${c.frontmatter ? `<div class="fm-toggle" id="fmToggle">발간사·서문 전체 보기 ▾</div>` : ''}
      </div>
    </div>
    ${c.frontmatter ? `<div class="fm-body" id="fmBody" style="display:none;"><pre>${escapeHtml(c.frontmatter)}</pre></div>` : ''}
  </div>`;
}
function wireCollIntroEvents(){
  const fmToggle = document.getElementById('fmToggle');
  if(fmToggle){
    fmToggle.addEventListener('click', ()=>{
      const body = document.getElementById('fmBody');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      fmToggle.textContent = open ? '발간사·서문 전체 보기 ▾' : '발간사·서문 접기 ▴';
    });
  }
}

function renderCollection(main){
  const c = collById[view.collId];
  if(c.presidentSections) return renderUsa1Collection(main, c);
  if(c.appendices) return renderUsa3Collection(main, c);
  if(c.partSections) return renderEurope1Collection(main, c);
  return renderGenericCollection(main, c);
}

// ── 카터편 해제 등 일반 자료집(트리/전체목록/참고자료) ──
function renderGenericAppendix(zone, c){
  if(c.appendixImages){
    const keys = Object.keys(c.appendixImages);
    if(!view.appendixNum || view.appendixNum > keys.length) view.appendixNum = 1;
    let sub = `<div class="submenu">`;
    keys.forEach((k,i)=>{
      const s = c.appendixImages[k];
      sub += `<div class="submenu-item ${view.appendixNum===i+1?'active':''}" data-num="${i+1}">
        <span class="submenu-title">${escapeHtml(s.title)}</span>
      </div>`;
    });
    sub += `</div><div id="appendixBody"></div>`;
    zone.innerHTML = sub;
    zone.querySelectorAll('[data-num]').forEach(el=>{
      el.addEventListener('click', ()=>{ view.appendixNum = +el.dataset.num; renderGenericAppendix(zone, c); });
    });
    const key = keys[view.appendixNum - 1];
    const s = c.appendixImages[key];
    const body = `<h3 class="doc-h3">${escapeHtml(s.title)}</h3>
      <div class="appx-img-wrap"><img src="data:image/png;base64,${s.imageB64}" alt="${escapeHtml(s.title)}"></div>
      <div class="appx-img-legend">
        ${s.items.map(it=>`<div class="appx-legend-row"><div class="appx-legend-num">${escapeHtml(it.num)}</div><div class="appx-legend-text"><b>${escapeHtml(it.label)}</b>${it.desc?`<p>${escapeHtml(it.desc)}</p>`:''}</div></div>`).join('')}
      </div>
      ${s.note ? `<div class="appx-img-note">${escapeHtml(s.note)}</div>` : ''}`;
    document.getElementById('appendixBody').innerHTML = body;
    return;
  }
  if(c.appendixNote && !(c.appendixTables && c.appendixTables.length)){
    zone.innerHTML = `<div class="ocr-notice">※ 원본이 이미지 스캔본이라 OCR(광학문자인식)로 추출한 텍스트입니다. 표 형식이 원본과 다르며 일부 오탈자가 있을 수 있습니다.</div>
      <div class="doc-view"><pre class="haeje-p" style="white-space:pre-wrap;">${escapeHtml(c.appendixNote)}</pre></div>`;
    return;
  }
  if(!view.appendixNum || view.appendixNum > c.appendixTables.length) view.appendixNum = 1;
  let sub = `<div class="submenu">`;
  c.appendixTables.forEach((tbl,i)=>{
    sub += `<div class="submenu-item ${view.appendixNum===i+1?'active':''}" data-num="${i+1}">
      <span class="submenu-num">부록 ${i+1}</span><span class="submenu-title">${escapeHtml(tbl.title.replace(/^부록\d+\.\s*/,''))}</span>
    </div>`;
  });
  sub += `</div><div id="appendixBody"></div>`;
  zone.innerHTML = sub;
  zone.querySelectorAll('[data-num]').forEach(el=>{
    el.addEventListener('click', ()=>{ view.appendixNum = +el.dataset.num; renderGenericAppendix(zone, c); });
  });
  const tbl = c.appendixTables[view.appendixNum - 1];
  const body = `<div class="list-table-wrap"><table class="appx-table simple-list-table">
    <thead><tr>${tbl.columns.map(col=>`<th>${escapeHtml(col)}</th>`).join('')}</tr></thead>
    <tbody>${tbl.rows.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
  document.getElementById('appendixBody').innerHTML =
    `<h3 class="doc-h3">${escapeHtml(tbl.title)}</h3><div class="doc-view">${body}</div>`;
}

function renderGenericCollection(main, c){
  let html = renderCollIntroHtml(c);

  const hasTree = c.trees && c.trees.length && c.trees.some(t=>t.nodes.length);
  html += `<div class="tabs">`;
  if(hasTree){
    html += `<div class="tab ${view.tab==='tree'?'active':''}" data-tab="tree">수집 기록물 내용</div>`;
  }
  html += `<div class="tab ${view.tab==='items'?'active':''}" data-tab="items">전체 목록 (${c.items.length.toLocaleString()})</div>`;
  if(c.reference.length){
    html += `<div class="tab ${view.tab==='reference'?'active':''}" data-tab="reference">참고자료 (${c.reference.length.toLocaleString()})</div>`;
  }
  if((c.appendixTables && c.appendixTables.length) || c.appendixNote || c.appendixImages){
    html += `<div class="tab ${view.tab==='appendix'?'active':''}" data-tab="appendix">부록</div>`;
  }
  html += `<div class="tab ${view.tab==='data'?'active':''}" data-tab="data">데이터 제공</div>`;
  html += `</div>`;

  if(view.tab==='appendix'){
    html += `<div id="listZone"></div>`;
    main.innerHTML = html;
    wireCollIntroEvents();
    main.querySelectorAll('[data-tab]').forEach(el=>{
      el.addEventListener('click', ()=>{ view.tab = el.dataset.tab; view.page=1; render(); });
    });
    renderGenericAppendix(document.getElementById('listZone'), c);
    return;
  }

  if(view.tab==='data'){
    html += `<div id="listZone"></div>`;
    main.innerHTML = html;
    wireCollIntroEvents();
    main.querySelectorAll('[data-tab]').forEach(el=>{
      el.addEventListener('click', ()=>{ view.tab = el.dataset.tab; view.page=1; render(); });
    });
    renderDataSection(document.getElementById('listZone'), c);
    return;
  }

  if(view.tab!=='tree'){
    html += `<div class="local-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="localSearchInput" placeholder="이 자료집 안에서 검색…" value="${escapeHtml(view.q)}">
    </div>`;
  }

  const types = Array.from(new Set(c.items.map(i=>i.type)));
  if(types.length > 1 && view.tab==='items'){
    html += `<div class="filters"><span style="font-size:11px;color:var(--ink-faint)">유형</span>`;
    html += `<div class="chip ${view.typeFilter==='all'?'active':''}" data-type="all">전체</div>`;
    types.forEach(t=> html += `<div class="chip ${view.typeFilter===t?'active':''}" data-type="${escapeHtml(t)}">${escapeHtml(t)}</div>`);
    html += `</div>`;
  }

  html += `<div id="listZone"></div>`;
  main.innerHTML = html;
  wireCollIntroEvents();

  main.querySelectorAll('[data-tab]').forEach(el=>{
    el.addEventListener('click', ()=>{ view.tab = el.dataset.tab; view.page=1; render(); });
  });
  main.querySelectorAll('[data-type]').forEach(el=>{
    el.addEventListener('click', ()=>{ view.typeFilter = el.dataset.type; view.page=1; renderList(); });
  });
  const localInput = document.getElementById('localSearchInput');
  if(localInput) localInput.addEventListener('input', (e)=>{
    view.q = e.target.value; view.page=1; renderList();
  });

  if(view.tab==='tree' && hasTree) renderTree(); else renderList();
}

// ── 미국편1: 원본 목차(대통령별 Ⅰ.목록 Ⅱ.설명 Ⅲ.안내 Ⅳ.소개 + 비공개) ──
function renderUsa1Collection(main, c){
  let html = renderCollIntroHtml(c);

  html += `<div class="filters" style="margin-bottom:10px;">`;
  c.presidentSections.forEach(s=>{
    html += `<div class="chip ${view.section===s.president?'active':''}" data-section="${escapeHtml(s.president)}">${escapeHtml(s.president)} 대통령도서관</div>`;
  });
  html += `<div class="chip ${view.section==='restricted'?'active':''}" data-section="restricted">비공개 관련 기록물</div>`;
  html += `<div class="chip ${view.section==='data'?'active':''}" data-section="data">데이터 제공</div>`;
  html += `</div>`;

  html += `<div id="sectionBody"></div>`;
  main.innerHTML = html;
  wireCollIntroEvents();

  main.querySelectorAll('[data-section]').forEach(el=>{
    el.addEventListener('click', ()=>{
      view.section = el.dataset.section;
      view.subTab = view.section==='restricted' ? 'restrictedList' : 'list';
      view.q=''; view.page=1; render();
    });
  });

  if(view.section==='data'){
    renderDataSection(document.getElementById('sectionBody'), c);
    return;
  }
  renderUsa1Section(c);
}

function renderDocSections(nodes, preface){
  let html = '';
  if(preface){
    const paras = preface.split('\n').filter(p=>p.trim());
    html += `<div class="doc-section-body doc-preface-body">${paras.map(p=>`<p>${escapeHtml(p)}</p>`).join('')}</div>`;
  }
  html += renderDocSectionNodes(nodes);
  return html || `<div class="haeje-empty">내용이 없습니다.</div>`;
}
function renderDocSectionNodes(nodes){
  return nodes.map(n=>{
    let html = `<div class="doc-section lvl-${Math.min(n.레벨,4)}">
      <div class="doc-section-head">${n.번호!=='0' ? `<span class="doc-section-num">${escapeHtml(n.번호)}</span>` : ''}${escapeHtml(n.제목)}</div>`;
    if(n.본문){
      const paras = n.본문.split('\n').filter(p=>p.trim());
      html += `<div class="doc-section-body">${paras.map(p=>`<p>${escapeHtml(p)}</p>`).join('')}</div>`;
    }
    if(n.children && n.children.length){
      html += `<div class="doc-section-children">${renderDocSectionNodes(n.children)}</div>`;
    }
    html += `</div>`;
    return html;
  }).join('');
}

// ── 유럽편1(영국 TNA + 프랑스 외무부, 2개 파트) ──
function renderEurope1Collection(main, c){
  let html = renderCollIntroHtml(c);
  html += `<div class="filters" style="margin-bottom:10px;">`;
  c.partSections.forEach(ps=>{
    html += `<div class="chip ${view.section===ps.part?'active':''}" data-section="${escapeHtml(ps.part)}">${escapeHtml(ps.part)}</div>`;
  });
  html += `<div class="chip ${view.section==='data'?'active':''}" data-section="data">데이터 제공</div>`;
  html += `</div><div id="sectionBody"></div>`;
  main.innerHTML = html;
  wireCollIntroEvents();

  main.querySelectorAll('[data-section]').forEach(el=>{
    el.addEventListener('click', ()=>{
      view.section = el.dataset.section; view.subTab = 'tree'; view.q=''; view.page=1; render();
    });
  });

  if(view.section==='data'){
    renderDataSection(document.getElementById('sectionBody'), c);
    return;
  }
  if(!view.section || !c.partSections.some(p=>p.part===view.section)){
    view.section = c.partSections[0].part; view.subTab = 'tree';
  }
  renderEurope1Section(c);
}

function renderEurope1Section(c){
  const zone = document.getElementById('sectionBody');
  const ps = c.partSections.find(p=>p.part===view.section);
  let html = `<div class="tabs">
    <div class="tab ${view.subTab==='tree'||!view.subTab?'active':''}" data-subtab="tree">수집 기록물 내용</div>
    <div class="tab ${view.subTab==='guide'?'active':''}" data-subtab="guide">소장기록물안내</div>
    <div class="tab ${view.subTab==='intro'?'active':''}" data-subtab="intro">기관소개</div>
  </div><div id="euSubBody"></div>`;
  zone.innerHTML = html;
  zone.querySelectorAll('[data-subtab]').forEach(el=>{
    el.addEventListener('click', ()=>{ view.subTab = el.dataset.subtab; view.q=''; view.page=1; renderEurope1Section(c); });
  });

  const body = document.getElementById('euSubBody');
  if(view.subTab==='guide' || view.subTab==='intro'){
    const sections = view.subTab==='guide' ? ps.guideSections : ps.introSections;
    const preface = view.subTab==='guide' ? ps.guidePreface : ps.introPreface;
    body.innerHTML = `<div class="doc-view">${renderDocSections(sections, preface)}</div>`;
    return;
  }
  if(view.subTab==='tree'){
    body.innerHTML = `<div class="tree-root">${ps.tree.nodes.map(n=>renderTreeNode(n, c)).join('')}</div>`;
    if(!treeInitDone.has(c.id+'-'+ps.part)){
      treeInitDone.add(c.id+'-'+ps.part);
      ps.tree.nodes.forEach(n=> expandedNodes.add(n.itemId || n.번호));
      body.innerHTML = `<div class="tree-root">${ps.tree.nodes.map(n=>renderTreeNode(n, c)).join('')}</div>`;
    }
    body.querySelectorAll('.tree-toggle').forEach(el=>{
      el.addEventListener('click', (e)=>{
        e.stopPropagation();
        const key = el.dataset.key;
        if(expandedNodes.has(key)) expandedNodes.delete(key); else expandedNodes.add(key);
        renderEurope1Section(c);
      });
    });
    body.querySelectorAll('.tree-label').forEach(el=>{
      el.addEventListener('click', ()=>{
        const itemId = el.dataset.itemid;
        const it = c.items.find(x=>x.id===itemId);
        if(it) openItemPanel(it, c);
      });
    });
    return;
  }
  // 목록/개요
  body.innerHTML = `
    <div class="local-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="localSearchInput" placeholder="이 목록 안에서 검색…" value="${escapeHtml(view.q)}">
    </div>
    <div id="listZone"></div>`;
  document.getElementById('localSearchInput').addEventListener('input', (e)=>{
    view.q = e.target.value; view.page=1; renderEurope1ListZone(ps);
  });
  renderEurope1ListZone(ps);
}
// ── 원본 자료집의 표 형식 그대로 목록을 렌더링 (트리/카드 대신 컬럼 표) ──
function renderSimpleListTable(items, columns){
  let html = `<div class="list-table-wrap"><table class="appx-table simple-list-table">
    <thead><tr>${columns.map(c=>`<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${items.map(it=>`<tr data-id="${escapeHtml(it.id)}" tabindex="0" role="button">${columns.map(c=>`<td${c.nowrap?' class="nowrap"':''}>${escapeHtml(c.get(it))}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
  return html;
}
function wireSimpleListTable(zone, items, c){
  zone.querySelectorAll('tr[data-id]').forEach(tr=>{
    tr.addEventListener('click', ()=>{
      const it = items.find(x=>x.id===tr.dataset.id);
      if(!it) return;
      const linkId = it.detail && it.detail._linkId;
      const target = linkId ? c.items.find(x=>x.id===linkId) : null;
      openItemPanel(target || it, c);
    });
  });
}

function renderEurope1ListZone(ps){
  const c = collById[view.collId];
  const zone = document.getElementById('listZone');
  const q = normalize(view.q);
  let listItems = ps.list;
  if(q) listItems = listItems.filter(i=> normalize(i.title).includes(q) || normalize(i.subtitle).includes(q));
  const isTNA = ps.part.includes('영국');
  const columns = isTNA ? [
    {label:'시리즈', get:it=>it.detail._그룹1},
    {label:'파일(Piece)', get:it=>it.detail.파일코드, nowrap:true},
    {label:'생산자', get:it=>it.detail._그룹2},
    {label:'제목', get:it=>it.title},
    {label:'제목(국문)', get:it=>it.subtitle},
    {label:'생산년도', get:it=>it.detail.생산년도, nowrap:true},
    {label:'매수', get:it=>it.detail.매수, nowrap:true},
  ] : [
    {label:'Fonds', get:it=>it.detail._그룹1},
    {label:'Série/Sous-Série', get:it=>it.detail._그룹2},
    {label:'Carton', get:it=>it.detail.파일코드, nowrap:true},
    {label:'Vol.', get:it=>it.detail._추가, nowrap:true},
    {label:'Titre', get:it=>it.title},
    {label:'제목', get:it=>it.subtitle},
    {label:'생산년도', get:it=>it.detail.생산년도, nowrap:true},
    {label:'매수', get:it=>it.detail.매수, nowrap:true},
  ];
  zone.innerHTML = renderSimpleListTable(listItems, columns);
  wireSimpleListTable(zone, listItems, c);
}

function renderUsa1Section(c){
  const zone = document.getElementById('sectionBody');
  if(view.section==='restricted'){
    const r = c.restricted;
    let html = `<div class="tabs">
      <div class="tab ${view.subTab==='restrictedList'?'active':''}" data-subtab="restrictedList">비공개 관련 기록물 목록</div>
      <div class="tab ${view.subTab==='restrictedMain'?'active':''}" data-subtab="restrictedMain">주요 수집기록물</div>
    </div>`;
    const text = view.subTab==='restrictedMain' ? r.mainText : r.listText;
    html += `<div class="doc-view"><pre>${escapeHtml(text || '내용이 없습니다.')}</pre></div>`;
    zone.innerHTML = html;
    zone.querySelectorAll('[data-subtab]').forEach(el=>{
      el.addEventListener('click', ()=>{ view.subTab = el.dataset.subtab; renderUsa1Section(c); });
    });
    return;
  }

  const sec = c.presidentSections.find(s=>s.president===view.section);
  let html = `<div class="tabs">
    <div class="tab ${view.subTab==='tree'||!view.subTab?'active':''}" data-subtab="tree">수집 기록물 내용</div>
    <div class="tab ${view.subTab==='guide'?'active':''}" data-subtab="guide">소장기록물안내</div>
    <div class="tab ${view.subTab==='intro'?'active':''}" data-subtab="intro">도서관소개</div>
  </div>`;
  html += `<div id="usa1SubBody"></div>`;
  zone.innerHTML = html;

  zone.querySelectorAll('[data-subtab]').forEach(el=>{
    el.addEventListener('click', ()=>{ view.subTab = el.dataset.subtab; view.q=''; view.page=1; renderUsa1Section(c); });
  });

  const subBody = document.getElementById('usa1SubBody');
  if(view.subTab==='guide' || view.subTab==='intro'){
    const sections = view.subTab==='guide' ? sec.guideSections : sec.introSections;
    const preface = view.subTab==='guide' ? sec.guidePreface : sec.introPreface;
    subBody.innerHTML = `<div class="doc-view">${renderDocSections(sections, preface)}</div>`;
    return;
  }
  // Ⅰ.설명·해제(기본)
  subBody.innerHTML = `<div id="listZone"></div>`;
  const treeIdx = c.trees.findIndex(t=>t.label===view.section);
  view.treeIndex = treeIdx>=0?treeIdx:0;
  renderTree();
}

function renderUsa1ListZone(c, sec){
  const zone = document.getElementById('listZone');
  const q = normalize(view.q);
  let listItems = sec.list.concat(sec.media);
  if(q) listItems = listItems.filter(i=> normalize(i.title).includes(q) || normalize(i.subtitle).includes(q));
  const columns = [
    {label:'레코드그룹', get:it=>it.detail._레벨1||''},
    {label:'시리즈', get:it=>it.detail._레벨2||''},
    {label:'파일', get:it=>it.detail._레벨3||''},
    {label:'상자번호', get:it=>it.detail.상자번호||'', nowrap:true},
    {label:'폴 더', get:it=>it.title},
    {label:'폴 더 (번역)', get:it=>it.subtitle},
    {label:'생산년도', get:it=>it.detail.생산년도||'', nowrap:true},
  ];
  zone.innerHTML = renderSimpleListTable(listItems, columns);
  wireSimpleListTable(zone, listItems, c);
}

// ── 미국편3: 총론 + 기록물목록 + 부록1~8 ──
function renderUsa3Collection(main, c){
  let html = renderCollIntroHtml(c);
  // 부록 탭 진입 시 기본 부록번호
  if(view.subTab==='appendix' && !view.appendixNum) view.appendixNum = 1;
  html += `<div class="tabs">
    <div class="tab ${view.subTab==='intro'?'active':''}" data-subtab="intro">총론·도서관소개</div>
    <div class="tab ${view.subTab==='items'?'active':''}" data-subtab="items">기록물목록 (${c.items.length.toLocaleString()})</div>
    <div class="tab ${view.subTab==='appendix'?'active':''}" data-subtab="appendix">부록</div>
    <div class="tab ${view.subTab==='data'?'active':''}" data-subtab="data">데이터 제공</div>
  </div><div id="usa3Body"></div>`;
  main.innerHTML = html;
  wireCollIntroEvents();

  main.querySelectorAll('[data-subtab]').forEach(el=>{
    el.addEventListener('click', ()=>{
      view.subTab = el.dataset.subtab;
      if(view.subTab==='appendix' && !view.appendixNum) view.appendixNum = 1;
      view.q=''; view.page=1; render();
    });
  });

  renderUsa3Body(c);
}

function renderAppendixBody(a){
  const t = a.table;
  // 표 데이터가 있으면 원문 preface 텍스트 덩어리는 표시하지 않음(중복 정보)
  const preface = (!t && a.preface) ? `<div class="doc-preface">${escapeHtml(a.preface)}</div>` : '';
  if(!t){
    if(a.sections && a.sections.length) return preface + renderDocSections(a.sections, a.preface);
    return preface + `<pre>${escapeHtml(a.text||'')}</pre>`;
  }
  if(a.번호===1){
    return preface + `<table class="appx-table">
      <thead><tr><th>날짜</th><th>내용</th></tr></thead>
      <tbody>${t.map(e=>`<tr><td class="nowrap">${escapeHtml(e.날짜)}</td><td>${escapeHtml(e.내용)}</td></tr>`).join('')}</tbody>
    </table>`;
  }
  if(a.번호===2){
    const side = (label, rows)=>`
      <div class="appx-people-col">
        <div class="appx-people-title">${label}</div>
        <table class="appx-table"><thead><tr><th>직책</th><th>시기</th><th>이름</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.직책)}</td><td class="nowrap">${escapeHtml(r.시기)}</td><td>${escapeHtml(r.이름)}</td></tr>`).join('')}</tbody></table>
      </div>`;
    return preface + `<div class="appx-people-grid">${side('한국', t.한국)}${side('미국', t.미국)}</div>`;
  }
  if(a.번호===7){
    return preface + `<table class="appx-table appx-glossary">
      <thead><tr><th>영어명칭 및 약어명칭</th><th>한국어번역</th></tr></thead>
      <tbody>${t.map(([en,ko])=>`<tr><td>${escapeHtml(en)}</td><td>${escapeHtml(ko)}</td></tr>`).join('')}</tbody>
    </table>`;
  }
  if(a.번호===8){
    let html = `<div class="rg-tree">`;
    t.forEach(rg=>{
      html += `<div class="rg-node">
        <div class="rg-label">${escapeHtml(rg.레코드그룹)}</div>`;
      rg.children.forEach(series=>{
        html += `<div class="series-node">
          <div class="series-label">${escapeHtml(series.시리즈)}</div>
          <table class="appx-table rg-file-table"><thead><tr><th>파일(폴더)</th><th>코드</th></tr></thead>
          <tbody>${series.children.map(f=>`<tr><td>${escapeHtml(f.파일)}</td><td>${escapeHtml(f.코드)}</td></tr>`).join('')}</tbody></table>
        </div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
    return preface + html;
  }
  // 부록3~6: 단순 표 (헤더+행)
  if(t.헤더){
    return preface + `<table class="appx-table">
      <thead><tr>${t.헤더.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${t.행.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  }
  return preface + `<pre>${escapeHtml(a.text||'')}</pre>`;
}

function renderUsa3Body(c){
  const zone = document.getElementById('usa3Body');
  if(view.subTab==='data'){ zone.innerHTML = ''; renderDataSection(zone, c); return; }
  if(view.subTab==='appendix'){
    // 부록 1~8 소메뉴(제목 포함)
    let sub = `<div class="submenu">`;
    c.appendices.forEach(a=>{
      sub += `<div class="submenu-item ${view.appendixNum===a.번호?'active':''}" data-num="${a.번호}">
        <span class="submenu-num">부록 ${a.번호}</span><span class="submenu-title">${escapeHtml(a.제목)}</span>
      </div>`;
    });
    sub += `</div><div id="appendixBody"></div>`;
    zone.innerHTML = sub;
    zone.querySelectorAll('[data-num]').forEach(el=>{
      el.addEventListener('click', ()=>{ view.appendixNum = +el.dataset.num; renderUsa3Body(c); });
    });
    const a = c.appendices.find(x=>x.번호===view.appendixNum);
    const body = renderAppendixBody(a);
    document.getElementById('appendixBody').innerHTML =
      `<h3 class="doc-h3">부록 ${a.번호}. ${escapeHtml(a.제목)}</h3><div class="doc-view">${body}</div>`;
    return;
  }
  if(view.subTab==='items'){
    zone.innerHTML = `
      <div class="local-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="localSearchInput" placeholder="이 자료집 안에서 검색…" value="${escapeHtml(view.q)}">
      </div>
      <div id="listZone"></div>`;
    document.getElementById('localSearchInput').addEventListener('input', (e)=>{
      view.q = e.target.value; view.page=1; renderList();
    });
    renderList();
    return;
  }
  // intro
  zone.innerHTML = `<div class="doc-view">${renderDocSections(c.introSections, c.introPreface)}</div>`;
}

// ── 데이터 제공 섹션 (원문 PDF·JSON·CSV 일괄 다운로드) ──
function downloadTextFile(text, filename, mime){
  const blob = new Blob([text], {type: mime||'text/plain;charset=utf-8'});
  downloadBlob(blob, filename);
}
// 자료집 하나의 '전체' 데이터(발간사·부록·트리 구조 포함)를 export용 객체로 만드는 단일 소스.
// 다운로드 지점이 여러 곳(허브 통합, 허브 개별, 자료집 상세 탭)이라도 전부 이 함수 하나만 거치게 해서
// 필드 누락이 한 곳만 고쳐지고 다른 곳은 안 고쳐지는 문제를 원천 차단한다.
function buildFullCollectionExport(c){
  const out = {
    id: c.id, name: c.name, shortName: c.shortName, period: c.period,
    description: c.description, items: c.items,
  };
  if(c.publishedDate) out.publishedDate = c.publishedDate;
  if(c.originalPdfUrl) out.originalPdfUrl = c.originalPdfUrl;
  if(c.frontmatter) out.frontmatter = c.frontmatter;
  if(c.reference && c.reference.length) out.reference = c.reference;
  if(c.intro) out.intro = c.intro;
  if(c.introPreface) out.introPreface = c.introPreface;
  if(c.trees) out.trees = c.trees;
  if(c.partSections) out.partSections = c.partSections;
  if(c.presidentSections){ out.presidentSections = c.presidentSections; out.restricted = c.restricted; }
  if(c.appendices){ out.appendices = c.appendices; out.introSections = c.introSections; }
  if(c.appendixTables) out.appendixTables = c.appendixTables;
  if(c.appendixImages) out.appendixImages = c.appendixImages;
  if(c.appendixNote) out.appendixNote = c.appendixNote;
  return out;
}
function renderDataSection(zone, c){
  const html = `
    <div class="data-panel">
      <div class="data-intro">
        <h3 class="doc-h3">데이터 제공 · Open Data</h3>
        <p>이 자료집의 구조화 데이터를 표준 형식으로 내려받을 수 있습니다. 기록물의 계층·서지정보가 그대로 담겨 있어 재이용·연계 분석에 활용할 수 있습니다. 개별 기록물의 원문 PDF는 각 항목 상세화면에서 받을 수 있습니다.</p>
      </div>
      <div class="data-cards">
        <div class="data-card">
          <div class="data-fmt">JSON</div>
          <div class="data-desc">계층 구조·해제·서지정보를 모두 포함한 완전한 구조화 데이터입니다. API 연계·프로그래밍 활용에 적합합니다.</div>
          <div class="data-meta">${c.items.length.toLocaleString()}개 항목</div>
          <button class="dl-btn primary" data-dl="json">⬇ JSON 내려받기</button>
        </div>
        <div class="data-card">
          <div class="data-fmt">CSV</div>
          <div class="data-desc">항목별 서지정보를 표 형태로 정리한 파일입니다. Excel·스프레드시트에서 바로 열람·분석할 수 있습니다.</div>
          <div class="data-meta">${c.items.length.toLocaleString()}행 · UTF-8(BOM)</div>
          <button class="dl-btn primary" data-dl="csv">⬇ CSV 내려받기</button>
        </div>
        <div class="data-card">
          <div class="data-fmt">API</div>
          <div class="data-desc">이 아카이브는 정적 JSON API로도 연계할 수 있습니다. 아래 안내를 참고하세요.</div>
          <div class="data-meta">REST · 정적 JSON</div>
          <button class="dl-btn" data-dl="apidoc">API 사용 안내</button>
        </div>
        ${c.originalPdfUrl ? `<div class="data-card">
          <div class="data-fmt">원문 PDF</div>
          <div class="data-desc">대통령기록관이 발간한 자료집 원본 PDF 전체를 내려받습니다(외부 사이트로 연결).</div>
          <div class="data-meta">대통령기록관 발간자료 원문</div>
          <a class="dl-btn primary" href="${c.originalPdfUrl}" target="_blank" rel="noopener">⬇ 원문 PDF 열기</a>
        </div>` : ''}
      </div>
      <div id="apiDocZone"></div>
    </div>`;
  zone.innerHTML = html;
  zone.querySelector('[data-dl="json"]').addEventListener('click', ()=>{
    downloadTextFile(JSON.stringify(buildFullCollectionExport(c), null, 2), `${c.id}.json`, 'application/json');
  });
  zone.querySelector('[data-dl="csv"]').addEventListener('click', ()=>{
    downloadTextFile(c.csv, `${c.id}.csv`, 'text/csv;charset=utf-8');
  });
  zone.querySelector('[data-dl="apidoc"]').addEventListener('click', ()=>{
    document.getElementById('apiDocZone').innerHTML = renderApiDoc(c);
  });
}
function renderApiDoc(c){
  const BASE = 'https://cheo6203.github.io/pa-archive';
  return `<div class="api-doc">
    <h4>정적 JSON API</h4>
    <p>아래 엔드포인트로 데이터를 가져올 수 있습니다.</p>
    <pre class="code"># 전체 자료집 메타
GET ${BASE}/api/collections.json

# 특정 자료집 전체 항목
GET ${BASE}/api/${c.id}.json

# 예시 (fetch)
fetch('${BASE}/api/${c.id}.json')
  .then(r =&gt; r.json())
  .then(data =&gt; console.log(data.items.length));</pre>
    <p class="api-note">※ 배포용 API 파일은 저장소의 <code>/api</code> 폴더에 함께 생성됩니다.</p>
  </div>`;
}

// ── 통합 데이터 제공 허브 (모든 자료집 데이터를 한 곳에서) ──
function totalItems(){ return DATA.collections.reduce((s,c)=>s+c.items.length,0); }

function buildCombinedJSON(){
  return JSON.stringify({
    title: "대통령기록관 해외수집기록물 온라인 아카이브",
    generated: new Date().toISOString().slice(0,10),
    collections: DATA.collections.map(c=>({ ...buildFullCollectionExport(c), itemCount: c.items.length })),
  }, null, 2);
}
function buildCombinedCSV(){
  // 모든 자료집 항목을 자료집 열 포함해 하나로 합침. subRecords가 있으면 세부기록물 단위로 펼침.
  const rows = [];
  const cols = ['자료집','id','제목','부제/번역제목','유형','생산년도','주요내용'];
  DATA.collections.forEach(c=>{
    c.items.forEach(it=>{
      const sub = it.haeje && it.haeje.subRecords;
      if(sub && sub.length){
        sub.forEach((sr,i)=>{
          rows.push([
            c.shortName, `${it.id}-${i+1}`, sr.번역제목 || sr.원문제목 || it.title, it.subtitle, it.type,
            sr.생산일자 || sr.생산년도 || it.year || '',
            sr.주요내용 || sr.설명 || '',
          ]);
        });
      } else {
        rows.push([
          c.shortName, it.id, it.title, it.subtitle, it.type,
          it.year || (it.detail&&it.detail.생산년도) || '',
          (it.haeje&&it.haeje.summary)||'',
        ]);
      }
    });
  });
  const esc = v=>{ v=String(v==null?'':v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  let out = '\ufeff' + cols.join(',') + '\n';
  rows.forEach(r=> out += r.map(esc).join(',') + '\n');
  return out;
}

function renderDataHub(main){
  let html = `
    <div class="hub-header">
      <h2 class="hub-title">데이터 제공 · Open Data</h2>
      <p class="hub-lead">대통령기록관 해외수집기록물 아카이브의 모든 구조화 데이터를 한 곳에서 내려받을 수 있습니다.
      원본 자료집의 계층·서지정보·해제 내용이 그대로 담겨 있어, 재이용·연계 분석·연구에 활용할 수 있습니다.
      개별 기록물의 원문 PDF는 각 항목 상세화면에서 받을 수 있습니다.</p>
    </div>

    <div class="hub-section">
      <div class="hub-section-title">전체 통합 데이터</div>
      <div class="data-cards">
        <div class="data-card">
          <div class="data-fmt">전체 JSON</div>
          <div class="data-desc">3개 자료집 전체 항목을 하나로 묶은 완전한 구조화 데이터입니다.</div>
          <div class="data-meta">${totalItems().toLocaleString()}개 항목 · ${DATA.collections.length}개 자료집</div>
          <button class="dl-btn primary" id="dlAllJson">⬇ 전체 JSON</button>
        </div>
        <div class="data-card">
          <div class="data-fmt">전체 CSV</div>
          <div class="data-desc">모든 자료집 항목을 자료집 구분과 함께 하나의 표로 정리했습니다. Excel에서 바로 열람됩니다.</div>
          <div class="data-meta">${totalItems().toLocaleString()}행 · UTF-8(BOM)</div>
          <button class="dl-btn primary" id="dlAllCsv">⬇ 전체 CSV</button>
        </div>
        <div class="data-card">
          <div class="data-fmt">API</div>
          <div class="data-desc">정적 JSON API로 외부 서비스에서 데이터를 연계할 수 있습니다.</div>
          <div class="data-meta">REST · 정적 JSON</div>
          <button class="dl-btn" id="dlApiHub">API 사용 안내</button>
        </div>
      </div>
      <div id="hubApiZone"></div>
    </div>

    <div class="hub-section">
      <div class="hub-section-title">자료집별 데이터</div>
      <div class="list-table-wrap"><table class="hub-table">
        <thead><tr><th>자료집</th><th>기간</th><th>내려받기</th></tr></thead>
        <tbody>`;
  DATA.collections.forEach(c=>{
    html += `<tr>
      <td><b>${escapeHtml(c.shortName)}</b><div class="hub-td-sub">${escapeHtml(c.name)}</div></td>
      <td class="hub-td-period">${escapeHtml(c.period)}</td>
      <td class="hub-dl-cell">
        <button class="dl-btn sm" data-hubjson="${c.id}">JSON</button>
        <button class="dl-btn sm" data-hubcsv="${c.id}">CSV</button>
        ${c.originalPdfUrl ? `<a class="dl-btn sm" href="${c.originalPdfUrl}" target="_blank" rel="noopener">원문 PDF</a>` : ''}
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>
    </div>`;
  main.innerHTML = html;

  document.getElementById('dlAllJson').addEventListener('click', ()=>{
    downloadTextFile(buildCombinedJSON(), 'pa_archive_all.json', 'application/json');
  });
  document.getElementById('dlAllCsv').addEventListener('click', ()=>{
    downloadTextFile(buildCombinedCSV(), 'pa_archive_all.csv', 'text/csv;charset=utf-8');
  });
  document.getElementById('dlApiHub').addEventListener('click', ()=>{
    document.getElementById('hubApiZone').innerHTML = renderApiDocHub();
  });
  main.querySelectorAll('[data-hubjson]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const c = collById[el.dataset.hubjson];
      downloadTextFile(JSON.stringify(buildFullCollectionExport(c), null, 2), `${c.id}.json`, 'application/json');
    });
  });
  main.querySelectorAll('[data-hubcsv]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const c = collById[el.dataset.hubcsv];
      downloadTextFile(c.csv, `${c.id}.csv`, 'text/csv;charset=utf-8');
    });
  });
}
function renderApiDocHub(){
  const ids = DATA.collections.map(c=>c.id);
  const BASE = 'https://cheo6203.github.io/pa-archive';
  return `<div class="api-doc">
    <h4>정적 JSON API</h4>
    <p>아래 엔드포인트로 데이터를 가져올 수 있습니다.</p>
    <pre class="code"># 자료집 메타 목록
GET ${BASE}/api/collections.json

# 자료집별 전체 항목
${ids.map(id=>`GET ${BASE}/api/${id}.json`).join('\n')}

# 예시 (fetch)
fetch('${BASE}/api/collections.json')
  .then(r =&gt; r.json())
  .then(meta =&gt; console.log(meta.collections));</pre>
    <p class="api-note">※ 배포용 API 파일은 저장소의 <code>/api</code> 폴더, CSV는 <code>/data</code> 폴더에 있습니다.</p>
  </div>`;
}

// ── 트리(계층) 렌더링 ──
const expandedNodes = new Set();
const treeInitDone = new Set();
function renderTree(){
  const c = collById[view.collId];
  const zone = document.getElementById('listZone');
  const trees = c.trees;
  const initKey = c.id + '-' + view.treeIndex;
  if(!treeInitDone.has(initKey)){
    treeInitDone.add(initKey);
    const t = trees[view.treeIndex] || trees[0];
    t.nodes.forEach(n=> expandedNodes.add(n.itemId || n.번호));
  }

  let html = '';
  const suppressSelector = view.section && trees.some(t=>t.label===view.section);
  if(trees.length > 1 && !suppressSelector){
    html += `<div class="filters" style="margin-bottom:14px;">`;
    trees.forEach((t,idx)=> html += `<div class="chip ${view.treeIndex===idx?'active':''}" data-treeidx="${idx}">${escapeHtml(t.label)} (${t.nodes.length})</div>`);
    html += `</div>`;
  }
  const activeTree = trees[view.treeIndex] || trees[0];
  html += `<div class="tree-root">${activeTree.nodes.map(n=>renderTreeNode(n, c)).join('')}</div>`;
  zone.innerHTML = html;

  zone.querySelectorAll('[data-treeidx]').forEach(el=>{
    el.addEventListener('click', ()=>{ view.treeIndex = +el.dataset.treeidx; renderTree(); });
  });
  zone.querySelectorAll('.tree-toggle').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      const key = el.dataset.key;
      if(expandedNodes.has(key)) expandedNodes.delete(key); else expandedNodes.add(key);
      renderTree();
    });
  });
  zone.querySelectorAll('.tree-label').forEach(el=>{
    el.addEventListener('click', ()=>{
      const itemId = el.dataset.itemid;
      const it = c.items.find(x=>x.id===itemId);
      if(it) openItemPanel(it, c);
    });
  });
}
function renderTreeNode(node, c){
  const key = node.itemId || node.번호;
  const hasChildren = node.children && node.children.length;
  const isOpen = expandedNodes.has(key) || !hasChildren ? true : expandedNodes.has(key);
  const item = c.items.find(x=>x.id===node.itemId);
  const hasDetail = item && (item.haeje.summary || item.haeje.raw || (item.haeje.subRecords&&item.haeje.subRecords.length) || item.detail.번역제목 || (node.itemId && !hasChildren));
  const isOpenNow = expandedNodes.has(key);
  const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  let html = `<div class="tree-node lvl-${node.레벨}">
    <div class="tree-row">
      ${hasChildren ? `<span class="tree-toggle ${isOpenNow?'open':''}" data-key="${key}">${chevron}</span>` : `<span class="tree-toggle-spacer"></span>`}
      <span class="tree-num">${escapeHtml(node.번호)}</span>
      <span class="tree-label ${hasDetail?'has-detail':''}" data-itemid="${escapeHtml(node.itemId||'')}">${escapeHtml(node.제목)}</span>
    </div>`;
  if(hasChildren && expandedNodes.has(key)){
    html += `<div class="tree-children">${node.children.map(ch=>renderTreeNode(ch, c)).join('')}</div>`;
  }
  html += `</div>`;
  return html;
}

function renderList(){
  const c = collById[view.collId];
  const zone = document.getElementById('listZone');
  const q = normalize(view.q);

  if(view.tab==='reference'){
    let refs = c.reference;
    if(q) refs = refs.filter(r=> normalize(r.title).includes(q) || normalize(r.text).includes(q));
    zone.innerHTML = `<div class="result-meta"><b>${refs.length.toLocaleString()}</b>건</div>` +
      refs.slice(0,200).map((r,idx)=>`<div class="row" data-ref="${idx}" style="grid-template-columns:1fr;">
        <div><div class="title">${escapeHtml(r.title)}</div><div class="sub">${highlightRaw(r.text.slice(0,140).replace(/\n/g,' '), view.q)}…</div></div>
      </div>`).join('');
    zone.querySelectorAll('[data-ref]').forEach(el=>{
      el.addEventListener('click', ()=> openReferencePanel(refs[+el.dataset.ref]));
    });
    return;
  }

  let items = c.items;
  if(view.typeFilter !== 'all') items = items.filter(i=>i.type===view.typeFilter);
  if(q) items = items.filter(i=> normalize(i.title).includes(q) || normalize(i.subtitle).includes(q) || normalize(haejeSearchText(i)).includes(q));

  renderPagedRows(zone, items, view.q, false);
}

function renderPagedRows(zone, items, q, showCollBadge){
  const pageSize = view.pageSize;
  const totalPages = Math.max(1, Math.ceil(items.length/pageSize));
  if(view.page>totalPages) view.page = totalPages;
  const start = (view.page-1)*pageSize;
  const pageItems = items.slice(start, start+pageSize);

  let html = `<div class="result-meta"><b>${items.length.toLocaleString()}</b>건</div>`;
  html += `<div class="ledger">`;
  if(pageItems.length===0){
    html += `<div class="empty">검색 결과가 없습니다.</div>`;
  } else {
    html += pageItems.map(it=>`<div class="row" data-id="${escapeHtml(it.id)}" data-coll="${it._collId}">
      <div>
        ${showCollBadge?`<span class="badge">${escapeHtml(it._collName)}</span>`:''}
        <div class="title">${highlightRaw(it.title, q)}</div>
        <div class="sub">${highlightRaw(it.subtitle||'', q)}</div>
      </div>
      <div class="col-coll">${escapeHtml(it.type||'')}</div>
      <div class="col-year">${escapeHtml(it.year||'')}</div>
    </div>`).join('');
  }
  html += `</div>`;
  html += `<div class="pager">
    <button id="prevP" ${view.page<=1?'disabled':''}>← 이전</button>
    <span>${view.page} / ${totalPages}</span>
    <button id="nextP" ${view.page>=totalPages?'disabled':''}>다음 →</button>
  </div>`;
  zone.innerHTML = html;

  zone.querySelectorAll('.row[data-id]').forEach(row=>{
    row.addEventListener('click', ()=>{
      const c = collById[row.dataset.coll];
      const it = c.items.find(x=>x.id===row.dataset.id);
      openItemPanel(it, c);
    });
  });
  const prevBtn = document.getElementById('prevP'), nextBtn = document.getElementById('nextP');
  if(prevBtn) prevBtn.onclick = ()=>{ view.page--; renderCurrentList(); window.scrollTo({top:0,behavior:'smooth'}); };
  if(nextBtn) nextBtn.onclick = ()=>{ view.page++; renderCurrentList(); window.scrollTo({top:0,behavior:'smooth'}); };
}

function renderCurrentList(){
  if(view.mode==='collection') renderList();
  else if(view.mode==='search') renderSearchList();
}

function itemYear(it){
  const y = (it.year || (it.detail&&it.detail.생산년도) || '').toString();
  const m = y.match(/\d{4}/);
  return m ? parseInt(m[0]) : null;
}
function itemFieldText(it, scope){
  if(scope==='title') return normalize(it.title) + ' ' + normalize(it.subtitle) + ' ' + normalize(it.detail&&it.detail.번역제목||'') + ' ' + normalize(it.detail&&it.detail.원문출처||'');
  if(scope==='content') return normalize(haejeSearchText(it));
  return normalize(it.title)+' '+normalize(it.subtitle)+' '+normalize(itemFieldText(it,'title'))+' '+normalize(haejeSearchText(it));
}

function renderSearchResults(main){
  const collOptions = DATA.collections.map(c=>`<option value="${c.id}" ${view.sColl===c.id?'selected':''}>${escapeHtml(c.shortName)}</option>`).join('');
  const allTypes = Array.from(new Set(allItems.map(i=>i.type))).filter(Boolean);
  const typeOptions = allTypes.map(t=>`<option value="${escapeHtml(t)}" ${view.sType===t?'selected':''}>${escapeHtml(t)}</option>`).join('');

  main.innerHTML = `
    <div class="adv-search">
      <h2 class="adv-title">상세검색</h2>
      <div class="adv-grid">
        <label class="adv-field"><span>검색어</span>
          <input id="advQ" type="text" value="${escapeHtml(view.q)}" placeholder="검색어 입력…"></label>
        <label class="adv-field"><span>검색 범위</span>
          <select id="advScope">
            <option value="all" ${view.sScope==='all'?'selected':''}>전체(제목+내용)</option>
            <option value="title" ${view.sScope==='title'?'selected':''}>제목·번역제목만</option>
            <option value="content" ${view.sScope==='content'?'selected':''}>주요내용·해제만</option>
          </select></label>
        <label class="adv-field"><span>자료집</span>
          <select id="advColl"><option value="">전체</option>${collOptions}</select></label>
        <label class="adv-field"><span>유형</span>
          <select id="advType"><option value="">전체</option>${typeOptions}</select></label>
        <label class="adv-field"><span>생산연도(부터)</span>
          <input id="advYearFrom" type="number" placeholder="예: 1977" value="${view.sYearFrom||''}"></label>
        <label class="adv-field"><span>생산연도(까지)</span>
          <input id="advYearTo" type="number" placeholder="예: 1993" value="${view.sYearTo||''}"></label>
      </div>
      <div class="adv-actions">
        <button class="dl-btn primary" id="advRun">검색</button>
        <button class="dl-btn" id="advReset">초기화</button>
      </div>
    </div>
    <div id="searchZone"></div>
    <div id="thesaurusZone"></div>
    <div id="historyDbZone"></div>
    <div id="nlZone"></div>
    <div id="externalZone"></div>`;

  const run = ()=>{
    view.q = document.getElementById('advQ').value;
    view.sScope = document.getElementById('advScope').value;
    view.sColl = document.getElementById('advColl').value;
    view.sType = document.getElementById('advType').value;
    view.sYearFrom = document.getElementById('advYearFrom').value;
    view.sYearTo = document.getElementById('advYearTo').value;
    view.page = 1;
    renderSearchList();
  };
  document.getElementById('advRun').addEventListener('click', run);
  document.getElementById('advQ').addEventListener('keydown', e=>{ if(e.key==='Enter') run(); });
  document.getElementById('advReset').addEventListener('click', ()=>{
    view.q=''; view.sScope='all'; view.sColl=''; view.sType=''; view.sYearFrom=''; view.sYearTo='';
    gsearchInput.value=''; renderSearchResults(main);
  });
  renderSearchList();
}
function renderSearchList(){
  const zone = document.getElementById('searchZone');
  const q = normalize(view.q);
  const scope = view.sScope || 'all';
  let items = allItems;
  if(view.sColl) items = items.filter(i=> i._collId===view.sColl);
  if(view.sType) items = items.filter(i=> i.type===view.sType);
  if(view.sYearFrom){ const yf=parseInt(view.sYearFrom); items = items.filter(i=>{const y=itemYear(i); return y!==null && y>=yf;}); }
  if(view.sYearTo){ const yt=parseInt(view.sYearTo); items = items.filter(i=>{const y=itemYear(i); return y!==null && y<=yt;}); }
  if(q) items = items.filter(i=> itemFieldText(i, scope).includes(q));
  renderPagedRows(zone, items, view.q, true);
  renderThesaurusMatch(view.q);
  renderHistoryDbSearch(view.q);
  renderNlSearch(view.q);
  renderExternalArchivesSearch(view.q);
}

// ── 국립중앙도서관 해외한국관련자료(NARA·CIA·CIS·헝가리·튀르키예) 연계검색 ──
// 공식 오픈API는 일반 소장자료(도서·고문헌 등) 대상이라 디지털컬렉션 포함 여부가
// 확인되지 않아, 대신 사이트 자체 통합검색이 쓰는 search.do URL로 바로가기를 제공한다.
// (이 URL은 공식 문서화된 API가 아니라 사이트 검색창을 그대로 재현한 것이므로,
// 결과를 이 화면으로 가져오지 않고 국립중앙도서관 사이트로 안내한다.)
function renderNlSearch(query){
  const zone = document.getElementById('nlZone');
  if(!zone) return;
  const q = (query||'').trim();
  if(!q){ zone.innerHTML=''; return; }
  const url = `https://www.nl.go.kr/NL/contents/search.do?category=${encodeURIComponent('해외한국관련자료')}&srchTarget=total&pageNum=1&pageSize=10&kwd=${encodeURIComponent(q)}`;
  zone.innerHTML = `<div class="ext-search-box">
    <div class="ext-search-head">📖 국립중앙도서관 해외한국관련자료 연계검색</div>
    <p class="ext-search-note">국립중앙도서관의 해외한국관련자료(NARA·CIA·독립국가연합·헝가리·튀르키예 디지털컬렉션)는 전용 공개 API가 없어 결과를 이 화면에 바로 가져올 수 없습니다. 아래 버튼을 누르면 국립중앙도서관에서 "${escapeHtml(q)}" 검색 결과를 바로 확인할 수 있습니다.</p>
    <a class="dl-btn" href="${url}" target="_blank" rel="noopener">국립중앙도서관 해외한국관련자료에서 "${escapeHtml(q)}" 검색 →</a>
  </div>`;
}

// ── 국사편찬위원회 한국사데이터베이스(해외사료총서 등) 연계검색 ──
// db.history.go.kr은 국가기록원과 달리 공개 검색 API가 없어 실시간 결과를 가져올 수 없다.
// 대신 통합검색 URL로 바로 연결되는 바로가기를 제공한다.
function renderHistoryDbSearch(query){
  const zone = document.getElementById('historyDbZone');
  if(!zone) return;
  const q = (query||'').trim();
  if(!q){ zone.innerHTML=''; return; }
  const url = `https://db.history.go.kr/search/searchTotalResult.do?totalWord=${encodeURIComponent(q)}`;
  zone.innerHTML = `<div class="ext-search-box">
    <div class="ext-search-head">🏛️ 국사편찬위원회 한국사데이터베이스 연계검색</div>
    <p class="ext-search-note">한국사데이터베이스(해외사료총서 등)는 공개 검색 API가 없어 결과를 이 화면에 바로 가져올 수 없습니다. 아래 버튼을 누르면 한국사데이터베이스에서 "${escapeHtml(q)}" 검색 결과를 바로 확인할 수 있습니다.</p>
    <a class="dl-btn" href="${url}" target="_blank" rel="noopener">한국사데이터베이스에서 "${escapeHtml(q)}" 검색 →</a>
  </div>`;
}

// ── 국사편찬위원회 한국역사용어시소러스: 용어 기본정보 매칭(현대 시대 용어, 로컬 데이터) ──
// 유의어·관련어 연계 데이터는 공공데이터포털 제공분에 없어, 검색어와 일치하는 용어의
// 기본정보(한자/연도/분류/설명/참고문헌)만 보조적으로 보여줍니다.
function renderThesaurusMatch(query){
  const zone = document.getElementById('thesaurusZone');
  if(!zone) return;
  const q = (query||'').trim();
  if(!q || typeof NIKH_THESAURUS === 'undefined'){ zone.innerHTML=''; return; }
  const ql = q.toLowerCase();
  let matches = NIKH_THESAURUS.filter(t=> t.t.toLowerCase()===ql);
  if(matches.length===0) matches = NIKH_THESAURUS.filter(t=> t.t.toLowerCase().includes(ql) || ql.includes(t.t.toLowerCase()));
  matches = matches.slice(0,3);
  if(matches.length===0){ zone.innerHTML=''; return; }
  const cards = matches.map(t=>`
    <div class="thesaurus-card">
      <div class="thesaurus-term">${escapeHtml(t.t)}${t.h?` <span class="thesaurus-hanja">(${escapeHtml(t.h)})</span>`:''}${t.y?` <span class="thesaurus-year">· ${escapeHtml(t.y)}</span>`:''}</div>
      ${t.c?`<div class="thesaurus-cat">${escapeHtml(t.c.split('>').join(' › '))}</div>`:''}
      ${t.d?`<div class="thesaurus-desc">${escapeHtml(t.d)}</div>`:''}
      ${t.s?`<div class="thesaurus-src">출처: ${escapeHtml(t.s)}</div>`:''}
    </div>`).join('');
  zone.innerHTML = `<div class="ext-search-box thesaurus-box">
    <div class="ext-search-head">📚 국사편찬위원회 한국역사용어시소러스 — 용어 기본정보</div>
    <p class="ext-search-note">국사편찬위원회가 구축한 한국역사용어시소러스(현대 시대) 중 검색어와 일치하는 용어의 기본정보입니다. 유의어·관련어 연계 정보는 포함되어 있지 않습니다.</p>
    <div class="thesaurus-list">${cards}</div>
    <a class="ext-more-link" href="https://db.history.go.kr/" target="_blank" rel="noopener">국사편찬위원회 한국사데이터베이스에서 더 보기 →</a>
  </div>`;
}

// ── 외부 기관 연계검색: 국가기록원 나라기록물 검색서비스 OpenAPI ──
// 발급받은 인증키를 아래에 넣으면 활성화됩니다. (공공데이터포털에서 '나라기록물 검색 서비스' 개발계정 신청)
const NATIONAL_ARCHIVES_API_KEY = '98bbf4b7f8dd32a86e78f925901456642a70753177bf1b4d495ff11d091273f3';
let _naSearchToken = 0;
function renderExternalArchivesSearch(query){
  const zone = document.getElementById('externalZone');
  if(!zone) return;
  const q = (query||'').trim();
  if(!q){ zone.innerHTML = ''; return; }
  if(!NATIONAL_ARCHIVES_API_KEY || NATIONAL_ARCHIVES_API_KEY.indexOf('__')===0){
    zone.innerHTML = `<div class="ext-search-box">
      <div class="ext-search-head">🔗 국가기록원 연계검색</div>
      <p class="ext-search-note">인증키가 아직 설정되지 않았습니다. 대신 국가기록원에서 "${escapeHtml(q)}"를 직접 검색해볼 수 있습니다.</p>
      <a class="dl-btn" href="https://www.archives.go.kr/next/newsearch/listSubjectSearch.do?query=${encodeURIComponent(q)}" target="_blank" rel="noopener">국가기록원에서 "${escapeHtml(q)}" 검색 →</a>
    </div>`;
    return;
  }
  const myToken = ++_naSearchToken;
  zone.innerHTML = `<div class="ext-search-box"><div class="ext-search-head">🔗 국가기록원 연계검색</div><p class="ext-search-note">검색 중…</p></div>`;
  const url = `https://apis.data.go.kr/1741050/openapi/searcharc?serviceKey=${encodeURIComponent(NATIONAL_ARCHIVES_API_KEY)}&query=${encodeURIComponent(q)}&display=8&pageNo=1`;
  fetch(url).then(r=>{
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.text();
  }).then(text=>{
    if(myToken !== _naSearchToken) return; // 더 최신 검색이 진행 중이면 이 결과는 버림
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    if(xml.querySelector('parsererror')) throw new Error('parse error');
    const items = Array.from(xml.querySelectorAll('item'));
    const total = xml.querySelector('total')?.textContent || items.length;
    if(items.length===0){
      zone.innerHTML = `<div class="ext-search-box"><div class="ext-search-head">🔗 국가기록원 연계검색</div><p class="ext-search-note">"${escapeHtml(q)}"에 대한 국가기록원 검색 결과가 없습니다.</p></div>`;
      return;
    }
    const cards = items.map(it=>{
      const g = sel => it.querySelector(sel)?.textContent || '';
      const title = g('title'); const prod = g('prod_name'); const year = g('prod_year');
      const isOpen = g('is_open'); const link = g('link'); const online = g('online_reading');
      const openLabel = isOpen==='1' ? '공개' : isOpen==='2' ? '부분공개' : isOpen==='3' ? '비공개' : '';
      return `<a class="ext-result-card" href="${escapeHtml(link)}" target="_blank" rel="noopener">
        <div class="ext-result-title">${escapeHtml(title)}</div>
        <div class="ext-result-meta">${escapeHtml(prod)}${year?' · '+escapeHtml(year)+'년':''}${openLabel?' · '+openLabel:''}${online==='Y'?' · 원문열람가능':''}</div>
      </a>`;
    }).join('');
    zone.innerHTML = `<div class="ext-search-box">
      <div class="ext-search-head">🔗 국가기록원 연계검색 <span class="ext-result-count">(전체 ${escapeHtml(String(total))}건 중 ${items.length}건)</span></div>
      <p class="ext-search-note">아래는 이 사이트가 아니라 <b>국가기록원(archives.go.kr)</b>이 소장한 기록물 검색 결과입니다. 클릭하면 국가기록원 사이트로 이동합니다.</p>
      <div class="ext-result-list">${cards}</div>
      <a class="ext-more-link" href="https://www.archives.go.kr/next/newsearch/listSubjectSearch.do?query=${encodeURIComponent(q)}" target="_blank" rel="noopener">국가기록원에서 전체 결과 더 보기 →</a>
    </div>`;
  }).catch(err=>{
    if(myToken !== _naSearchToken) return;
    zone.innerHTML = `<div class="ext-search-box">
      <div class="ext-search-head">🔗 국가기록원 연계검색</div>
      <p class="ext-search-note">지금은 자동으로 불러올 수 없습니다. 아래 링크로 직접 검색해 주세요.</p>
      <a class="dl-btn" href="https://www.archives.go.kr/next/newsearch/listSubjectSearch.do?query=${encodeURIComponent(q)}" target="_blank" rel="noopener">국가기록원에서 "${escapeHtml(q)}" 검색 →</a>
    </div>`;
  });
}

const META_EXCLUDE = new Set(['번호','레벨','시작페이지','목차페이지','물리페이지']);
const LONG_FIELD_THRESHOLD = 20; // 이 길이를 넘으면 무조건 전체 폭 한 줄로 표시

function renderInfoTable(it){
  const d = it.detail || {};
  const translatedTitle = d['번역제목'] || '';
  let html = '<div class="info-table">';
  if(translatedTitle){
    html += `<div class="info-row info-row-full"><div class="info-label">번역제목</div><div class="info-value">${escapeHtml(translatedTitle)}</div></div>`;
  }
  const rest = Object.entries(d).filter(([k])=> !META_EXCLUDE.has(k) && k!=='번역제목' && !k.startsWith('_'));
  rest.forEach(([k,v])=>{
    html += `<div class="info-row info-row-full"><div class="info-label">${escapeHtml(k)}</div><div class="info-value">${escapeHtml(v)||'-'}</div></div>`;
  });
  html += '</div>';
  return html;
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function downloadItemJSON(it, c){
  const data = {
    자료집: c.name, id: it.id, title: it.title, subtitle: it.subtitle,
    detail: it.detail, haeje: it.haeje,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  downloadBlob(blob, `${it.id}.json`);
}

function buildPdfFromJpeg(base64, imgW, imgH){
  const bin = atob(base64);
  const jpegBytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) jpegBytes[i] = bin.charCodeAt(i);
  const enc = new TextEncoder();
  const chunks = []; let offset = 0; const offsets = {};
  function push(x){ const b = typeof x==='string' ? enc.encode(x) : x; chunks.push(b); offset += b.length; }
  push('%PDF-1.4\n');
  offsets[1]=offset; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offsets[2]=offset; push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  offsets[3]=offset; push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> /MediaBox [0 0 ${imgW} ${imgH}] /Contents 5 0 R >>\nendobj\n`);
  offsets[4]=offset; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  push(jpegBytes); push('\nendstream\nendobj\n');
  const content = `q ${imgW} 0 0 ${imgH} 0 0 cm /Im0 Do Q`;
  offsets[5]=offset; push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  const xrefStart = offset;
  push('xref\n0 6\n0000000000 65535 f \n');
  for(let i=1;i<=5;i++) push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  const total = chunks.reduce((a,c)=>a+c.length,0);
  const buf = new Uint8Array(total); let p=0;
  for(const c of chunks){ buf.set(c,p); p+=c.length; }
  return new Blob([buf], {type:'application/pdf'});
}

function downloadItemPDF(it, c, base64, btn){
  const img = new Image();
  const origLabel = btn.textContent;
  btn.textContent = '생성 중…';
  img.onload = ()=>{
    const blob = buildPdfFromJpeg(base64, img.naturalWidth, img.naturalHeight);
    downloadBlob(blob, `${it.id}.pdf`);
    btn.textContent = origLabel;
  };
  img.onerror = ()=>{ btn.textContent = origLabel; };
  img.src = `data:image/jpeg;base64,${base64}`;
}

function renderPageImage(it, c){
  const pageNum = it.detail && (it.detail.시작페이지 || it.detail.원본페이지);
  if(!pageNum) return '';
  const b64 = c.pageImages && c.pageImages[String(pageNum)];
  if(!b64) return '';
  return `
    <div class="orig-box">
      <div class="orig-toggle" data-page="${pageNum}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
        원문 보기 (p.${pageNum})
      </div>
      <div class="orig-img-wrap" style="display:none;"><img src="data:image/jpeg;base64,${b64}" alt="원문 p.${pageNum}"></div>
    </div>`;
}

function openItemPanel(it, c){
  const h = it.haeje || {};
  let haejeHtml = '';

  if(h.summary){
    haejeHtml += `<div class="htitle">주요내용</div>${formatListText(h.summary)}`;
  }
  if(h.subRecords && h.subRecords.length){
    const isRichRecord = h.subRecords[0].주요내용 !== undefined || h.subRecords[0].발신 !== undefined;
    haejeHtml += `<div class="htitle" style="margin-top:18px;">개별 문서 (${h.subRecords.length}건)</div>`;
    if(isRichRecord){
      h.subRecords.forEach(s=>{
        haejeHtml += `<div class="subrec-card">
          <div class="subrec-head">${escapeHtml(s.번호||'')}${s.생산일자?` <span class="subrec-date">${escapeHtml(s.생산일자)}</span>`:''}</div>
          ${s.원문제목?`<div class="subrec-title">${escapeHtml(s.원문제목)}</div>`:''}
          ${s.번역제목?`<div class="subrec-title-kr">${escapeHtml(s.번역제목)}</div>`:''}
          <div class="subrec-meta">${[s.발신?`발신: ${escapeHtml(s.발신)}`:'', s.수신?`수신: ${escapeHtml(s.수신)}`:'', s.형태?`형태: ${escapeHtml(s.형태)}`:''].filter(Boolean).join(' · ')}</div>
          ${s.주요내용?formatListText(s.주요내용).replace(/class="haeje-p/g,'class="haeje-p subrec-content'):''}
        </div>`;
      });
    } else {
      haejeHtml += `<table class="sub-table"><thead><tr><th>번역제목</th><th>생산년도</th><th>기록물건수</th><th>상자번호</th></tr></thead><tbody>`;
      h.subRecords.forEach(s=>{
        haejeHtml += `<tr><td>${escapeHtml(s.번역제목)||'<span class="muted">-</span>'}</td><td>${escapeHtml(s.생산년도)}</td><td>${escapeHtml(s.기록물건수)}</td><td>${escapeHtml(s.상자번호)}</td></tr>`;
      });
      haejeHtml += `</tbody></table>`;
    }
  }
  if(h.itemList && h.itemList.length){
    haejeHtml += `<div class="htitle" style="margin-top:18px;">수록/세부 기록물 (${h.itemList.length}건)</div>`;
    haejeHtml += `<ul class="item-list">` + h.itemList.map(t=>`<li>${escapeHtml(t)}</li>`).join('') + `</ul>`;
  }
  if(!haejeHtml && h.raw){
    haejeHtml += `<div class="htitle">원문 발췌</div><pre>${escapeHtml(h.raw)}</pre>`;
  }
  if(!haejeHtml){
    haejeHtml = `<div class="haeje-empty">이 항목에는 별도 해제(설명) 텍스트가 없습니다.</div>`;
  }

  const pageImgHtml = renderPageImage(it, c);
  const pageNum = it.detail && (it.detail.시작페이지 || it.detail.원본페이지);
  const hasPageImg = pageNum && c.pageImages && c.pageImages[String(pageNum)];

  // 검색 결과에서 들어온 경우, 상세보기 본문에도 검색어를 하이라이트
  const hlQ = (view.mode==='search' && view.q) ? view.q : '';
  haejeHtml = highlightInHtml(haejeHtml, hlQ);

  const related = relatedItems(it, c, 5);
  const relatedHtml = related.length ? `
    <div class="related-box">
      <div class="related-head">관련 자료 (같은 생산처·연도·유형)</div>
      <div class="related-list">${related.map(r=>`
        <div class="related-item" data-relid="${escapeHtml(r.id)}">
          <div class="related-title">${escapeHtml(r.title)}</div>
          <div class="related-meta">${escapeHtml(r.type||'')}${r.year?' · '+escapeHtml(String(r.year)):''}</div>
        </div>`).join('')}</div>
    </div>` : '';

  const bookmarked = isBookmarked(c.id, it.id);

  document.getElementById('panelBody').innerHTML = `
    <div class="p-badge">${escapeHtml(c.shortName)}</div>
    <h2>${highlightRaw(it.title, hlQ)}</h2>
    ${it.subtitle && it.subtitle !== it.title ? `<div class="p-subtitle">${highlightRaw(it.subtitle, hlQ)}</div>` : ''}
    <div class="download-row">
      <button class="dl-btn" id="dlJsonBtn">⬇ JSON</button>
      ${hasPageImg ? `<button class="dl-btn" id="dlPdfBtn">⬇ PDF (원문 p.${pageNum})</button>` : ''}
      <button class="dl-btn" id="bookmarkBtn">${bookmarked ? '★ 담음' : '☆ 담기'}</button>
      <button class="dl-btn" id="copyLinkBtn">🔗 링크 복사</button>
      <button class="dl-btn" id="citeBtn">❝ 인용하기</button>
    </div>
    ${renderInfoTable(it)}
    ${pageImgHtml}
    <div class="haeje-box">${haejeHtml}</div>
    ${relatedHtml}
  `;
  openOverlay();
  try{ history.replaceState(null, '', '#i/'+encodeURIComponent(c.id)+'/'+encodeURIComponent(it.id)); }catch(e){}
  document.getElementById('dlJsonBtn').addEventListener('click', ()=> downloadItemJSON(it, c));
  const pdfBtn = document.getElementById('dlPdfBtn');
  if(pdfBtn){
    pdfBtn.addEventListener('click', ()=> downloadItemPDF(it, c, c.pageImages[String(pageNum)], pdfBtn));
  }
  const bmBtn = document.getElementById('bookmarkBtn');
  if(bmBtn){
    bmBtn.addEventListener('click', ()=>{
      const nowOn = toggleBookmark(it, c);
      bmBtn.textContent = nowOn ? '★ 담음' : '☆ 담기';
      renderSidebar();
    });
  }
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  if(copyLinkBtn){
    copyLinkBtn.addEventListener('click', ()=> copyToClipboard(itemPermalink(it, c), copyLinkBtn, '✓ 링크 복사됨'));
  }
  const citeBtn = document.getElementById('citeBtn');
  if(citeBtn){
    citeBtn.addEventListener('click', ()=> copyToClipboard(buildCitation(it, c), citeBtn, '✓ 인용문 복사됨'));
  }
  document.querySelectorAll('.related-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const relIt = c.items.find(x=>x.id===el.dataset.relid);
      if(relIt) openItemPanel(relIt, c);
    });
  });
  const toggle = document.querySelector('.orig-toggle');
  if(toggle){
    toggle.addEventListener('click', ()=>{
      const wrap = document.querySelector('.orig-img-wrap');
      const open = wrap.style.display !== 'none';
      wrap.style.display = open ? 'none' : 'block';
    });
  }
}
function openReferencePanel(ref){
  document.getElementById('panelBody').innerHTML = `
    <div class="p-badge">참고자료</div>
    <h2>${escapeHtml(ref.title)}</h2>
    <div class="haeje-box">
      <pre>${escapeHtml(ref.text)}</pre>
    </div>
  `;
  openOverlay();
}
function openOverlay(){
  const ov = document.getElementById('overlay');
  ov.classList.add('open'); ov.setAttribute('aria-hidden','false');
  const cb = document.getElementById('closePanel');
  if(cb) cb.focus();
}
function closeOverlay(){
  const ov = document.getElementById('overlay');
  ov.classList.remove('open'); ov.setAttribute('aria-hidden','true');
  if(location.hash && location.hash.indexOf('#i/')===0){
    try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  }
}
document.getElementById('closePanel').onclick = closeOverlay;
document.getElementById('overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay') closeOverlay(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && document.getElementById('overlay').classList.contains('open')) closeOverlay(); });

let debTimer;
document.getElementById('gsearchInput').addEventListener('input', (e)=>{
  clearTimeout(debTimer);
  debTimer = setTimeout(()=>{
    const val = e.target.value.trim();
    if(val){
      view.q=val;
      if(view.mode==='search'){
        const advQ = document.getElementById('advQ');
        if(advQ) advQ.value = val;
        renderSearchList();
      } else {
        view.mode='search'; view.page=1; render();
      }
    } else if(view.mode==='search'){
      go('home');
    }
  }, 200);
});

document.getElementById('gcount').textContent = allItems.length.toLocaleString()+'건 전체';

// ── 영구링크로 들어온 경우 해당 자료 상세보기를 바로 열기 ──
function openFromHash(){
  try{
    const raw = (location.hash||'').replace(/^#\/?/, '');
    if(!raw) return false;
    const parts = raw.split('/').map(p=>{ try{ return decodeURIComponent(p); }catch(e){ return p; } });
    if(parts[0]!=='i' || !parts[1] || !parts[2]) return false;
    const c = collById[parts[1]];
    if(!c) return false;
    const it = c.items.find(x=>x.id===parts[2]);
    if(!it) return false;
    go('collection', c.id);
    openItemPanel(it, c);
    return true;
  }catch(e){ return false; }
}
if(!openFromHash()) go('home');