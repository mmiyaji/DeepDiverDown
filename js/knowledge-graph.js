import { comparisonCandidates } from './reference-compare.js?v=performance-compare1';

// These edges encode curated comparison topics and registry classifications, not integrations.
export function makeKnowledgeGraph(entries, registry) {
  const byId = new Map(entries.map(e => [e.id, e]));
  const categories = new Map();
  for (const entry of entries) {
    const key = `${entry.domain || 'その他'} / ${entry.category || 'その他'}`;
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key).push(entry);
  }
  function related(id) {
    return comparisonCandidates(registry, id).filter(c => byId.has(c.entry.id)).map(c => ({ entry: byId.get(c.entry.id), topics: [...new Set(c.topics)] }));
  }
  return { byId, categories, related };
}

// A stable shelf layout keeps every model visible without inventing relationships.
export function overviewLayout(graph) {
  const columns = 5, gap = 24, boxWidth = 370, nodeWidth = 164, nodeHeight = 38;
  const heights = Array(columns).fill(24), groups = [], nodes = [], byId = new Map();
  const ordered = [...graph.categories].sort((a,b) => a[0].localeCompare(b[0], 'ja'));
  for (const [key, entries] of ordered) {
    const col = heights.indexOf(Math.min(...heights)), x = 24 + col * (boxWidth + gap), y = heights[col];
    const height = 48 + Math.ceil(entries.length / 2) * 48;
    groups.push({ key, x, y, width: boxWidth, height });
    entries.forEach((entry, i) => { const node = { entry, x: x + 12 + (i % 2) * 178, y: y + 38 + Math.floor(i / 2) * 48, width: nodeWidth, height: nodeHeight }; nodes.push(node); byId.set(entry.id, node); });
    heights[col] += height + gap;
  }
  const edges = [];
  for (const node of nodes) for (const peer of graph.related(node.entry.id)) {
    if (node.entry.id < peer.entry.id && byId.has(peer.entry.id)) edges.push({ from: node.entry.id, to: peer.entry.id, topics: peer.topics });
  }
  return { groups, nodes, edges, byId, width: 24 + columns * (boxWidth + gap), height: Math.max(...heights) };
}

const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, text = '') { const e = document.createElementNS(svgNS, tag); for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); if (text) e.textContent = text; return e; }
function html(tag, text, attrs = {}) { const e = document.createElement(tag); e.textContent = text; for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; }
function modelUrl(id) { return './#/m/' + encodeURIComponent(id) + '/struct'; }
function documentUrl(path) { return 'research.html?doc=' + encodeURIComponent(path); }
function categoryKey(entry) { return `${entry.domain || 'その他'} / ${entry.category || 'その他'}`; }

async function start() {
  const [indexResponse, registryResponse] = await Promise.all([fetch('models/research-index.json'), fetch('models/registry.json')]);
  if (!indexResponse.ok || !registryResponse.ok) throw new Error('index');
  const [{entries},registry] = await Promise.all([indexResponse.json(),registryResponse.json()]);
  const graph = makeKnowledgeGraph(entries, registry), overview = overviewLayout(graph); let state = {kind:'home'}, zoom = 1, overviewSelected = null;
  const result = $('kg-results'), detail = $('kg-detail'), svg = $('kg-svg');
  function select(next) {
    if (state.kind === 'overview' && next.kind === 'model') { overviewSelected = next.id; zoom = Math.max(zoom, .8); render(); revealSelected(); return; }
    state = next; render(); $('kg-graph').scrollTo(0, 0);
  }
  function renderResults() {
    const q = $('kg-query').value.trim().toLocaleLowerCase();
    const matches = entries.filter(e => [e.name,e.id,e.domain,e.category,e.description,...(e.tags || [])].join(' ').toLocaleLowerCase().includes(q));
    $('kg-count').textContent = `${matches.length} 件 / ${entries.length} 件`;
    result.replaceChildren();
    for (const e of matches) { const b=html('button',e.name,{type:'button',class:'kg-result'}); if((state.kind==='model'&&state.id===e.id)||(state.kind==='overview'&&overviewSelected===e.id))b.setAttribute('aria-current','true'); b.append(html('small',`${e.domain} / ${e.category}`)); b.addEventListener('click',()=>select({kind:'model',id:e.id})); result.append(b); }
  }
  function draw(center, neighbors) {
    const rowHeight=64, yStart=30, height=Math.max(320,yStart+neighbors.length*rowHeight+20), centerY=30;
    svg.setAttribute('viewBox',`0 0 900 ${height}`); svg.style.height = `${height}px`; svg.replaceChildren();
    const addNode=(n,x,y,w,central=false)=>{ const g=el('g',{class:`kg-node${central?' center':''}`,tabindex:'0',role:'button','aria-label':n.label}); g.append(el('rect',{x,y,width:w,height:48,rx:5}),el('text',{x:x+12,y:y+20},n.label.length>23?n.label.slice(0,22)+'…':n.label),el('text',{x:x+12,y:y+38,class:'kg-type'},n.type.length>32?n.type.slice(0,31)+'…':n.type)); const activate=()=>n.action?.(); g.addEventListener('click',activate); g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}}); svg.append(g); };
    for(const [i,n] of neighbors.entries()){const y=yStart+i*rowHeight; svg.append(el('path',{class:'kg-edge',d:`M 320 ${centerY+24} C 470 ${centerY+24}, 440 ${y+24}, 520 ${y+24}`}));}
    addNode(center,40,centerY,280,true); neighbors.forEach((n,i)=>addNode(n,520,yStart+i*rowHeight,340));
  }
  function setZoom(value) {
    zoom = Math.max(.18, Math.min(2, value)); svg.style.width = (overview.width * zoom) + 'px'; svg.style.height = (overview.height * zoom) + 'px'; $('kg-zoom-value').textContent = Math.round(zoom * 100) + '%';
  }
  function fitOverview() { const box = $('kg-graph'); setZoom(Math.min((box.clientWidth - 12) / overview.width, (box.clientHeight - 12) / overview.height)); box.scrollTo(0, 0); }
  function revealSelected() { const n = overview.byId.get(overviewSelected); if (!n) return; const box = $('kg-graph'); box.scrollTo({left: Math.max(0,(n.x+n.width/2)*zoom-box.clientWidth/2), top: Math.max(0,(n.y+n.height/2)*zoom-box.clientHeight/2), behavior:'smooth'}); }
  function drawOverview() {
    svg.replaceChildren(); svg.setAttribute('viewBox', '0 0 '+overview.width+' '+overview.height); setZoom(zoom);
    const selectedEdges = overview.edges.filter(e => e.from === overviewSelected || e.to === overviewSelected);
    const connected = new Set(selectedEdges.flatMap(e => [e.from,e.to]));
    for (const g of overview.groups) { svg.append(el('rect',{x:g.x,y:g.y,width:g.width,height:g.height,rx:7,class:'kg-category-box'})); const t=el('text',{x:g.x+12,y:g.y+22,class:'kg-category-label'},g.key.length>30?g.key.slice(0,29)+'…':g.key); t.append(el('title',{},g.key)); svg.append(t); }
    for (const edge of overview.edges) { const a=overview.byId.get(edge.from), b=overview.byId.get(edge.to); const line=el('line',{x1:a.x+a.width/2,y1:a.y+a.height/2,x2:b.x+b.width/2,y2:b.y+b.height/2,class:'kg-overview-edge'+(overviewSelected&&(edge.from===overviewSelected||edge.to===overviewSelected)?' active':'')}); line.append(el('title',{},edge.topics.join(' / '))); svg.append(line); }
    for (const n of overview.nodes) { const active=n.entry.id===overviewSelected, neighbor=connected.has(n.entry.id); const g=el('g',{class:'kg-overview-node'+(active?' selected':neighbor?' connected':overviewSelected?' dim':''),tabindex:'0',role:'button','aria-label':n.entry.name,'data-model':n.entry.id}); g.append(el('rect',{x:n.x,y:n.y,width:n.width,height:n.height,rx:4}),el('text',{x:n.x+8,y:n.y+24},n.entry.name.length>19?n.entry.name.slice(0,18)+'…':n.entry.name),el('title',{},n.entry.name)); const activate=()=>select({kind:'model',id:n.entry.id}); g.addEventListener('click',activate); g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}}); svg.append(g); }
  }
  function overviewDetails() {
    if (!overviewSelected) { detail.append(html('h3','全体ネットワーク'),html('p','技術を選択すると、比較対象の線を強調し、構成図や資料へのリンクを表示します。')); return; }
    const entry=graph.byId.get(overviewSelected), peers=graph.related(overviewSelected);
    detail.append(html('h3',entry.name),html('p',entry.description || ''),html('p','比較対象 '+peers.length+' 件：'+peers.map(p=>p.entry.name).join('、')));
    const links=html('div','',{class:'kg-links'}); links.append(html('a','構成図を開く →',{href:modelUrl(entry.id)})); for (const doc of entry.documents || []) links.append(html('a','解説を読む →',{href:documentUrl(doc)}));
    const focus=html('button','この技術の関連を詳しく見る',{type:'button',class:'kg-related'}); focus.addEventListener('click',()=>{state={kind:'model',id:entry.id};render();$('kg-graph').scrollTo(0,0)}); links.append(focus); detail.append(links);
  }
  function render() {
    renderResults(); detail.replaceChildren(); let center, neighbors=[];
    const isOverview=state.kind==='overview'; $('kg-overview').setAttribute('aria-pressed',String(isOverview)); $('kg-zoom').hidden=!isOverview;
    if(isOverview) { $('kg-title').textContent='全体ネットワーク'; $('kg-caption').textContent=overview.nodes.length+' 件の技術・'+overview.groups.length+' 分類・'+overview.edges.length+' 件の比較関係。枠は分類、線は比較の観点を表します。'; drawOverview(); overviewDetails(); return; }
    svg.style.width='900px';
    if(state.kind==='home') {
      $('kg-title').textContent='調査済みスタック';
      center={label:'調査済みスタック',type:`${entries.length} 件の技術`,action:()=>{}};
      neighbors=[...graph.categories].sort((a,b)=>a[0].localeCompare(b[0],'ja')).map(([name,items])=>({label:name,type:`分類 · ${items.length} 件`,action:()=>select({kind:'category',key:name})}));
      $('kg-caption').textContent=`${neighbors.length} 分類を表示中。分類を選んで技術を表示します。`;
      detail.append(html('h3','分類から探す'),html('p','左の検索欄から技術を直接選ぶこともできます。'));
    } else if(state.kind==='category') {
      const items=graph.categories.get(state.key) || []; $('kg-title').textContent=state.key;
      center={label:state.key,type:'分類',action:()=>select({kind:'home'})};
      neighbors=items.map(e=>({label:e.name,type:'調査済み技術',action:()=>select({kind:'model',id:e.id})}));
      $('kg-caption').textContent=`この分類に属する ${items.length} 件を表示中。`;
      detail.append(html('h3',state.key),html('p','技術を選択すると、比較対象と参照資料を表示します。'));
    } else {
      const entry=graph.byId.get(state.id); if(!entry){select({kind:'home'});return;}
      const related=graph.related(entry.id), key=categoryKey(entry); $('kg-title').textContent=entry.name;
      center={label:entry.name,type:'選択中の技術',action:()=>{}};
      neighbors=[{label:key,type:'所属する分類',action:()=>select({kind:'category',key})},...related.map(({entry:e,topics})=>({label:e.name,type:`比較の観点：${topics.join(' / ')}`,action:()=>select({kind:'model',id:e.id})}))];
      $('kg-caption').textContent=`所属する分類と、${related.length} 件の比較対象を表示中。比較対象がない場合も分類からほかの技術を探せます。`;
      detail.append(html('h3',entry.name),html('p',entry.description || ''));
      const links=html('div','',{class:'kg-links'});links.append(html('a','構成図を開く →',{href:modelUrl(entry.id)}));for(const doc of entry.documents||[])links.append(html('a','解説を読む →',{href:documentUrl(doc)})); detail.append(links);
      if(related.length){detail.append(html('h3','比較対象と観点'));const ul=html('ul','');for(const r of related){const li=html('li','');const b=html('button',r.entry.name,{type:'button',class:'kg-related'});b.addEventListener('click',()=>select({kind:'model',id:r.entry.id}));li.append(b,document.createTextNode(' — '+r.topics.join(' / ')));ul.append(li);}detail.append(ul);}
      if(entry.sources?.length){detail.append(html('h3','公式資料'));const ul=html('ul','');for(const source of entry.sources){try {const u=new URL(source.url);if(!['http:','https:'].includes(u.protocol))continue;const li=html('li','');li.append(html('a',source.title,{href:u.href,target:'_blank',rel:'noopener noreferrer'}));ul.append(li);}catch{}}detail.append(ul);}
    }
    draw(center,neighbors);
  }
  $('kg-query').addEventListener('input',renderResults); $('kg-home').addEventListener('click',()=>select({kind:'home'}));
  $('kg-overview').addEventListener('click',()=>{ overviewSelected=state.kind==='model'?state.id:overviewSelected; state={kind:'overview'}; render(); requestAnimationFrame(fitOverview); });
  $('kg-zoom-in').addEventListener('click',()=>setZoom(zoom*1.35)); $('kg-zoom-out').addEventListener('click',()=>setZoom(zoom/1.35)); $('kg-zoom-fit').addEventListener('click',fitOverview);
  const id=new URLSearchParams(location.search).get('model'); if(id&&graph.byId.has(id))state={kind:'model',id}; render();
}
if (typeof document !== 'undefined') start().catch(()=>{ $('kg-count').textContent='データを読み込めませんでした。'; $('kg-detail').textContent='サーバーへの接続を確認して再読み込みしてください。'; });
