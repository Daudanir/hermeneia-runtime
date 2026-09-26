window.HermeneiaRedator = (() => {
  'use strict';
  const Core=window.HermeneiaCore;
  const trim=s=>String(s||'').replace(/\s+/g,' ').trim(),norm=s=>Core.norm(String(s||''));
  const strip=s=>trim(s).replace(/[.!?;:]+\s*$/,''),cap=s=>{s=trim(s);return s?s[0].toLocaleUpperCase('pt-BR')+s.slice(1):s},low=s=>{s=trim(s);return s?s[0].toLocaleLowerCase('pt-BR')+s.slice(1):s};
  const hashInt=s=>{let h=2166136261>>>0;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h>>>0};
  const CONNECTORS={
    causa:{open:['Isso acontece porque','A razão está em que','Isso se explica porque'],mid:['porque','já que','visto que','uma vez que']},
    consequencia:{open:['Por isso,','Em consequência,','Assim,'],mid:['de modo que','razão pela qual','o que leva a']},
    contraste:{open:['No entanto,','Por outro lado,','Ainda assim,'],mid:['mas','enquanto','ao passo que']},
    concessao:{open:['Ainda que','Mesmo assim,','Apesar disso,'],mid:['embora','ainda que']},
    condicao:{open:['Se','Caso'],mid:['se','caso']},
    finalidade:{open:['Para isso,','Com essa finalidade,'],mid:['para que','a fim de que']},
    adicao:{open:['Além disso,','A isso se acrescenta que'],mid:['e','bem como','e também']},
    reformulacao:{open:['Em outras palavras,','Isto é,'],mid:['isto é','ou seja']},
    temporal:{open:['Em seguida,','Depois disso,'],mid:['quando','enquanto','depois que']},
    comparacao:{open:['Do mesmo modo,','Em paralelo,'],mid:['assim como','tal como']},
    conclusao:{open:['No conjunto,','Em síntese,'],mid:['de sorte que','e, com isso,']},
    desenvolvimento:{open:['A partir daí,','Nesse desenvolvimento,'],mid:['e então','ao mesmo tempo']},
    explicacao:{open:['Isso recebe uma explicação:','A razão aparece em seguida:'],mid:['pois','porque']}
  };
  const relationMap={cause:'causa',consequence:'consequencia',contrast:'contraste',concession:'concessao',condition:'condicao',purpose:'finalidade',addition:'adicao',reformulation:'reformulacao',temporal:'temporal',comparison:'comparacao','structural-parallelism':'comparacao','linear-progression':'desenvolvimento','referential-continuity':'desenvolvimento','frame-continuity':'desenvolvimento','anaphoric-resumption':'desenvolvimento','presence-absence-contrast':'contraste','polarity-contrast':'contraste'};
  function makeChooser(seed='Hermeneia'){const hist={},count={};return function(category,pos='mid'){const bank=CONNECTORS[category];if(!bank)return null;const pool=(bank[pos]||bank.mid||bank.open||[]).slice();if(!pool.length)return null;hist[category]=hist[category]||[];let candidates=pool.filter(x=>!hist[category].includes(x));if(!candidates.length){hist[category]=[];candidates=pool}count[category]=(count[category]||0)+1;const idx=hashInt(`${seed}|${category}|${pos}|${count[category]}`)%candidates.length,choice=candidates[idx];hist[category].push(choice);if(hist[category].length>Math.max(1,Math.floor(pool.length/2)))hist[category].shift();return choice}}
  function MentionTracker(windowSize=3){this.window=windowSize;this.seen={};this.step=0}MentionTracker.prototype.register=function(key,name,gender='m',number='s',epithet=null){if(!key)return;this.seen[key]={name,gender,number,epithet,lastAt:-999}};MentionTracker.prototype.refer=function(key){const r=this.seen[key];if(!r)return key;const first=r.lastAt===-999,recent=!first&&(this.step-r.lastAt)<=this.window;let form=r.name;if(recent){const competing=Object.keys(this.seen).some(k=>k!==key&&this.seen[k].gender===r.gender&&this.seen[k].number===r.number&&(this.step-this.seen[k].lastAt)<=this.window);if(!competing)form=r.gender==='f'?(r.number==='p'?'elas':'ela'):(r.number==='p'?'eles':'ele');else if(r.epithet)form=r.epithet}r.lastAt=this.step;return form};MentionTracker.prototype.advance=function(){this.step++};
  function combine(a,b,relation,chooser,opts={}){a=strip(a);b=strip(b);if(!a)return cap(b)+'.';if(!b)return cap(a)+'.';if(!relation||!CONNECTORS[relation])return cap(a)+'; '+low(b)+'.';const seed=opts.seed||a+b+relation,style=opts.style||((hashInt(seed)%2)?'mid':'open');if(style==='mid'){const c=chooser(relation,'mid');return c?`${cap(a)}, ${c} ${low(b)}.`:`${cap(a)}; ${low(b)}.`}const c=chooser(relation,'open');return c?`${cap(a)}. ${c} ${low(b)}.`:`${cap(a)}. ${cap(b)}.`}
  const JARGON=[/\bequídeque\b/gi,/\bauteirética\b/gi,/\baposiníca\b/gi,/\bapocompose\b/gi,/\bschesitoméric[oa]\b/gi,/\bscore\b/gi,/\bconfiança\s*\d+%/gi];
  function polish(text,mode='reader'){let s=String(text||'').replace(/\s{2,}/g,' ').replace(/\s+([,.;:!?])/g,'$1').trim();if(mode==='reader')JARGON.forEach(re=>s=s.replace(re,''));return s.replace(/\s{2,}/g,' ').replace(/\s+([,.;:!?])/g,'$1').trim()}
  function planFromAffirmedState(analysis,affirmed){const comp=affirmed?.macroComposition||{},blocks=comp.blocks||[],rels=comp.relations||[];return blocks.map((b,i)=>{const rel=i?rels.find(r=>r.from===blocks[i-1].id&&r.to===b.id)||rels[i-1]:null;const relation=rel?relationMap[rel.type]||null:null;const participants=[...new Set((affirmed.choices||[]).filter(c=>(b.unitIds||[]).includes(c.unitId)).flatMap(c=>c.participants||[]))].map(name=>({key:norm(name),name,gender:/a$/.test(norm(name))?'f':'m',number:'s'}));return{clauses:[strip(b.text)],relation,relationRecord:rel||null,participants,epistemic:'U',anchors:b.anchors||[],blockId:b.id}})}
  function write(plan,opts={}){const seed=opts.seed||'Hermeneia',chooser=makeChooser(seed),mode=opts.mode||'reader',paragraphs=[];let current='';(plan||[]).forEach((move,i)=>{const clause=(move.clauses||[]).map(strip).filter(Boolean).join('; ');if(!clause)return;if(!current){current=cap(clause)+'.';return}if(move.relation){current=combine(current,clause,move.relation,chooser,{seed:`${seed}|${i}`});if((current.match(/[.!?]/g)||[]).length>=3){paragraphs.push(polish(current,mode));current=''}}else{paragraphs.push(polish(current,mode));current=cap(clause)+'.'}});if(current)paragraphs.push(polish(current,mode));return{paragraphs,text:paragraphs.join('\n\n')}}
  return{CONNECTORS,makeChooser,MentionTracker,combine,polish,planFromAffirmedState,write};
})();

/* ================================================================
 * HERMENEIA AI 4.5 — explicador subordinado, multibrowser e local-first
 * ================================================================ */
