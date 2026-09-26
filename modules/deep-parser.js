window.HermeneiaDeepParser = (()=>{
  'use strict';
  const Core=window.HermeneiaCore;
  const N=Core.norm;
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
  const STATES=['article','pronoun','preposition','conjunction','nounish','proper','verb','adverb','content'];
  const CLOSED={article:new Set('o a os as um uma uns umas'.split(' ')),preposition:new Set('a ao aos de do da dos das em no na nos nas por para com sem sobre sob entre ate até desde'.split(' ')),conjunction:new Set('e ou mas porem porém contudo todavia entretanto porque pois embora se quando enquanto portanto logo'.split(' ')),pronoun:new Set('eu tu ele ela nos nós vos vós eles elas quem que qual quais me te se lhe lhes isto isso aquilo'.split(' '))};
  const TRANS={
    '<s>,<s>':{article:.15,pronoun:.18,preposition:.05,conjunction:.02,nounish:.23,proper:.18,verb:.10,adverb:.05,content:.04},
    'article,nounish':{nounish:.34,content:.25,verb:.03,preposition:.05,conjunction:.03,adverb:.05,proper:.08,article:.02,pronoun:.02},
    'preposition,article':{nounish:.38,proper:.22,content:.23,verb:.02,adverb:.03,pronoun:.04,article:.01,preposition:.01,conjunction:.01},
    'pronoun,verb':{article:.10,nounish:.20,proper:.07,verb:.10,adverb:.14,preposition:.12,conjunction:.08,pronoun:.04,content:.15},
    'nounish,verb':{article:.12,nounish:.17,proper:.06,verb:.08,adverb:.11,preposition:.14,conjunction:.11,pronoun:.04,content:.17},
    'verb,article':{nounish:.38,content:.25,proper:.11,preposition:.07,adverb:.06,conjunction:.05,pronoun:.04,verb:.02,article:.01},
    'verb,nounish':{preposition:.18,conjunction:.13,adverb:.12,article:.11,verb:.07,nounish:.16,content:.15,pronoun:.04,proper:.04},
    'nounish,preposition':{article:.27,nounish:.22,proper:.16,content:.16,pronoun:.07,verb:.03,adverb:.04,conjunction:.03,preposition:.02},
    'nounish,conjunction':{article:.14,pronoun:.14,nounish:.20,proper:.14,verb:.12,adverb:.06,preposition:.04,content:.14,conjunction:.02}
  };
  function emission(tok,state){
    const n=N(tok.surface||tok.norm||'');
    if(CLOSED.article.has(n))return state==='article'?.99:.001;
    if(CLOSED.preposition.has(n))return state==='preposition'?.99:.001;
    if(CLOSED.conjunction.has(n))return state==='conjunction'?.98:.002;
    if(CLOSED.pronoun.has(n))return state==='pronoun'?.97:.003;
    if(tok.pos&&tok.pos!=='content'&&tok.pos!=='nounish')return state===tok.pos?.88:.015;
    if(/mente$/.test(n))return state==='adverb'?.82:.025;
    if(/(ar|er|ir|ou|eu|iu|ava|avam|ando|endo|indo|ado|ido)$/.test(n))return state==='verb'?.72:.04;
    if(/(cao|ção|dade|mento|ismo|agem|ez|eza|ura)$/.test(n))return state==='nounish'?.72:.04;
    if(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(tok.surface||'')&&tok.index>0)return state==='proper'?.58:(state==='nounish'?.22:.04);
    return state==='nounish'?.25:state==='content'?.25:state==='verb'?.10:.07;
  }
  function trans(a,b,c){const row=TRANS[(a||'<s>')+','+(b||'<s>')];return Math.max(1e-5,(row&&row[c])||({article:.08,pronoun:.08,preposition:.09,conjunction:.07,nounish:.20,proper:.08,verb:.17,adverb:.10,content:.13}[c]||.05))}
  function hmmTag(tokens){
    if(!tokens||!tokens.length)return[];
    let beam=[{tags:[],score:0,p1:'<s>',p2:'<s>'}];
    tokens.forEach((tok,i)=>{const next=[];beam.forEach(p=>STATES.forEach(s=>{const sc=p.score+Math.log(trans(p.p1,p.p2,s))+Math.log(Math.max(1e-6,emission(tok,s)));next.push({tags:p.tags.concat(s),score:sc,p1:p.p2,p2:s})}));beam=next.sort((x,y)=>y.score-x.score).slice(0,24)});
    const best=beam[0]||{tags:[]};return tokens.map((t,i)=>({index:i,surface:t.surface,tag:best.tags[i]||t.pos,original:t.pos,changed:!!(best.tags[i]&&best.tags[i]!==t.pos),confidence:best.tags[i]===t.pos?.82:.58}));
  }
  function isNom(t){return t&&['nounish','proper','pronoun','content'].includes(t.pos)}
  function isVerb(t){return t&&t.pos==='verb'}
  function pairScore(head,dep,dir){
    if(!head||!dep)return null;let score=0,label='dep';
    if(isVerb(head)&&isNom(dep)){score=.70;label=dep.index<head.index?'nsubj':'obj';if(dep.pos==='pronoun')score+=.08}
    if(isNom(head)&&dep.pos==='article'){score=.96;label='det'}
    if(isNom(head)&&dep.pos==='content'&&dep.index<head.index){score=Math.max(score,.60);label='amod'}
    if(isNom(head)&&dep.pos==='preposition'){score=Math.max(score,.66);label='case'}
    if(isVerb(head)&&dep.pos==='adverb'){score=Math.max(score,.67);label='advmod'}
    if(isVerb(head)&&dep.pos==='negation'){score=.94;label='neg'}
    if(isVerb(head)&&dep.pos==='verb'){score=Math.max(score,.54);label='xcomp'}
    if(head.pos==='conjunction'&&(isVerb(dep)||isNom(dep))){score=Math.max(score,.52);label='cc'}
    if(isVerb(head)&&dep.pos==='conjunction'){score=Math.max(score,.55);label='cc'}
    if(isNom(head)&&isNom(dep)&&Math.abs(head.index-dep.index)<=2){score=Math.max(score,.42);label='nmod'}
    const dist=Math.abs(head.index-dep.index);score-=Math.min(.20,.025*Math.max(0,dist-1));
    return score>.30?{head:head.index,dependent:dep.index,label,score:clamp(score),dir}:null;
  }
  function shiftReduce(morph){
    const toks=(morph||[]).filter(t=>t.pos!=='punct').map((t,i)=>({...t,index:t.index!=null?t.index:i}));
    const buffer=toks.slice(),stack=[],edges=[],trace=[];const hasDep=new Set();
    let guard=0;
    while((buffer.length||stack.length>1)&&guard++<toks.length*8+20){
      if(stack.length<2&&buffer.length){const x=buffer.shift();stack.push(x);trace.push({action:'SHIFT',token:x.surface});continue}
      if(stack.length>=2){const a=stack[stack.length-2],b=stack[stack.length-1],ab=pairScore(a,b,'RIGHT-ARC'),ba=pairScore(b,a,'LEFT-ARC');
        if(ba&&(!ab||ba.score>ab.score+.05)&&!hasDep.has(a.index)){edges.push(ba);hasDep.add(a.index);stack.splice(stack.length-2,1);trace.push({action:'LEFT-ARC',label:ba.label,head:b.surface,dep:a.surface,score:ba.score});continue}
        if(ab&&ab.score>=.50&&!hasDep.has(b.index)){edges.push(ab);hasDep.add(b.index);stack.pop();trace.push({action:'RIGHT-ARC',label:ab.label,head:a.surface,dep:b.surface,score:ab.score});continue}
      }
      if(buffer.length){const x=buffer.shift();stack.push(x);trace.push({action:'SHIFT',token:x.surface});continue}
      if(stack.length>1){const dep=stack.pop(),head=stack[stack.length-1];if(!hasDep.has(dep.index)){const e=pairScore(head,dep,'RIGHT-ARC')||{head:head.index,dependent:dep.index,label:'dep',score:.30,dir:'RIGHT-ARC'};edges.push(e);hasDep.add(dep.index);trace.push({action:'RIGHT-ARC',label:e.label,head:head.surface,dep:dep.surface,score:e.score})}}
    }
    const verbRoots=toks.filter(isVerb).sort((a,b)=>{const da=edges.filter(e=>e.head===a.index).length,db=edges.filter(e=>e.head===b.index).length;return db-da||a.index-b.index});
    const root=verbRoots[0]||toks[0]||null;if(root&&!hasDep.has(root.index))edges.push({head:-1,dependent:root.index,label:'root',score:.88,dir:'ROOT'});
    toks.forEach(t=>{if(!hasDep.has(t.index)&&(!root||t.index!==root.index)){const candidates=toks.filter(h=>h.index!==t.index&&(isVerb(h)||isNom(h))).map(h=>pairScore(h,t,'ATTACH')).filter(Boolean).sort((x,y)=>y.score-x.score);const e=candidates[0]||{head:root?root.index:-1,dependent:t.index,label:'dep',score:.25,dir:'ATTACH'};edges.push(e);hasDep.add(t.index)}});
    const nodeMap=Object.fromEntries(toks.map(t=>[t.index,t]));return{nodes:toks,edges,trace,root:root?root.index:null,nodeMap};
  }
  function phraseSpan(morph,text){
    const ws=Core.words(N(text||''));if(!ws.length)return null;const ns=(morph||[]).map(t=>t.norm);
    for(let i=0;i<ns.length;i++){let j=i,k=0;while(j<ns.length&&k<ws.length){if(ns[j]===ws[k]){j++;k++;continue}if((morph[j]?.pos)==='punct'){j++;continue}break}if(k===ws.length)return[i,j-1]}
    return null;
  }
  function phraseHead(morph,span){if(!span)return null;const slice=morph.slice(span[0],span[1]+1);const de=slice.findIndex(t=>['de','do','da','dos','das'].includes(t.norm));const left=de>=0?slice.slice(0,de):slice;const lex=left.filter(t=>['nounish','proper','content','pronoun'].includes(t.pos)&&!['article','demonstrative','possessive'].includes(t.pos));return (lex[lex.length-1]||left[left.length-1]||slice[0])?.index??null}
  function repairWithFrames(unit,parse){
    if(!unit?.frames?.length||!parse)return parse;const morph=(unit.morph||[]).map((t,i)=>({...t,index:i})),edges=(parse.edges||[]).slice();
    const setEdge=(head,dep,label,score)=>{if(head==null||dep==null||head===dep)return;for(let i=edges.length-1;i>=0;i--)if(edges[i].dependent===dep)edges.splice(i,1);edges.push({head,dependent:dep,label,score,dir:'FRAME-CONSTRAINT'})};
    const findVerb=(f,min=0,max=morph.length-1)=>{const surf=N(f?.verb?.surface||''),lem=N(f?.verb?.lemma||'');let cand=morph.filter(t=>t.index>=min&&t.index<=max&&t.pos==='verb'&&(N(t.surface)===surf||N(t.lemma)===lem));return cand[0]?.index??null};
    const attachPhrase=(headIdx,text,label,score)=>{const sp=phraseSpan(morph,text);if(!sp)return null;const ph=phraseHead(morph,sp);if(ph!=null)setEdge(headIdx,ph,label,score);const toks=morph.slice(sp[0],sp[1]+1);for(let k=0;k<toks.length;k++){if(['de','do','da','dos','das'].includes(toks[k].norm)){const obj=toks.slice(k+1).find(t=>['nounish','proper','content','pronoun'].includes(t.pos));if(obj){setEdge(obj.index,toks[k].index,'case',.94);if(ph!=null&&obj.index!==ph)setEdge(ph,obj.index,'nmod',.76)}}}const det=toks.filter(t=>['article','demonstrative','possessive'].includes(t.pos));det.forEach(d=>{if(ph!=null)setEdge(ph,d.index,'det',.96)});return ph};
    let previousMain=null,root=null,searchFrom=0;
    unit.frames.forEach((f,fi)=>{
      const vi=findVerb(f,searchFrom);if(vi==null)return;searchFrom=vi+1;if(root==null)root=vi;
      if(f.embedded?.length){f.embedded.forEach(em=>{const evi=morph.find(t=>t.index<vi&&t.pos==='verb'&&(N(t.surface)===N(em.verb?.surface)||N(t.lemma)===N(em.verb?.lemma)))?.index;if(evi!=null){setEdge(vi,evi,'csubj',.94);if(em.subject?.text)attachPhrase(evi,em.subject.text,'nsubj',.96);if(em.object?.text)attachPhrase(evi,em.object.text,'obj',.93)}})}
      if(f.subject?.text&&f.subject.kind!=='relative-free-clause')attachPhrase(vi,f.subject.text,'nsubj',.93);
      if(f.predicative?.text)attachPhrase(vi,f.predicative.text,'xcomp:pred',.94);else if(f.object?.text)attachPhrase(vi,f.object.text,'obj',.91);
      if(previousMain!=null){setEdge(previousMain,vi,'conj',.84);const cc=morph.filter(t=>t.index>previousMain&&t.index<vi&&t.pos==='conjunction').slice(-1)[0];if(cc)setEdge(vi,cc.index,'cc',.93)}
      previousMain=vi;
    });
    if(root!=null){for(let i=edges.length-1;i>=0;i--)if(edges[i].label==='root'||edges[i].dependent===root)edges.splice(i,1);edges.push({head:-1,dependent:root,label:'root',score:.97,dir:'FRAME-CONSTRAINT'})}
    const nodeMap=Object.fromEntries((parse.nodes||[]).map(t=>[t.index,t]));return{...parse,edges,nodeMap,root:root??parse.root,hybrid:true};
  }
  function depLabel(x){return({nsubj:'sujeito',obj:'complemento',det:'determinante',amod:'modificador',case:'marcador de regência',advmod:'modificador adverbial',neg:'negação',xcomp:'predicado encaixado','xcomp:pred':'predicativo',csubj:'oração-sujeito',conj:'predicação coordenada',nmod:'modificador nominal',cc:'coordenação',root:'raiz'}[x]||x)}
  function semanticCoreference(a){
    const Amb=window.HermeneiaAmbiguo;if(!Amb||!a)return[];const stats=Amb.buildCorpus(a.sourceText,{window:5}),out=[];
    (a.units||[]).forEach((u,ui)=>{(u.frames||[]).forEach(f=>{if(f.subject?.kind!=='pronoun'||!['ele','ela','eles','elas'].includes(N(f.subject.text)))return;const candidates=(a.entities||[]).filter(e=>(e.anchors||[]).some(id=>{const j=a.units.findIndex(x=>x.id===id);return j>=0&&j<ui&&ui-j<=5}));if(candidates.length<2)return;const vv=Amb.vectorOf(stats,N(f.verb?.lemma||''));const scored=candidates.map(e=>{const ev=Amb.vectorOf(stats,N(e.label));const sem=Amb.cosine(ev,vv);const rec=1/(1+Math.min(...(e.anchors||[]).map(id=>Math.max(0,ui-a.units.findIndex(x=>x.id===id))).filter(Number.isFinite),5));const agree=((N(f.subject.text)==='ela'&&e.gender==='feminine')||(N(f.subject.text)==='ele'&&e.gender==='masculine')||['eles','elas'].includes(N(f.subject.text)))?.15:0;return{entity:e.label,entityId:e.id,semantic:sem,recency:rec,score:clamp(.58*sem+.27*rec+agree)}}).sort((x,y)=>y.score-x.score);if(scored.length)out.push({unit:u.id,pronoun:f.subject.text,verb:f.verb?.lemma||null,candidates:scored.slice(0,5),chosen:scored[0],confidence:scored[0].score,status:'candidate'})})});return out;
  }
  const POSITIVE=new Set('bom boa justo justa verdade misericordia misericórdia vida sabedoria prudencia prudência conhecimento paz agradavel agradável excelente'.split(' ').map(N));
  const NEGATIVE=new Set('mal mau injustica injustiça impiedade culpa perverso arrogante contenda divisao divisão morte cego cegueira'.split(' ').map(N));
  const RESULT_VERBS=new Set('produzir gerar resultar causar provocar conduzir levar alcançar alcancar estabelecer preservar obter tornar'.split(' ').map(N));
  function polarity(u){let p=0;(u.morph||[]).forEach(t=>{if(POSITIVE.has(t.norm))p++;if(NEGATIVE.has(t.norm))p--;if(t.features?.includes('negation'))p-=.5});return p}
  function lexicalSet(u){return new Set((u.morph||[]).filter(t=>['nounish','proper','content','verb'].includes(t.pos)).map(t=>t.lemma||t.norm).filter(x=>x&&x.length>2))}
  function jac(A,B){let i=0;A.forEach(x=>{if(B.has(x))i++});return i/Math.max(1,A.size+B.size-i)}
  function implicitRelations(a){const out=[];for(let i=1;i<(a.units||[]).length;i++){const x=a.units[i-1],y=a.units[i];const explicit=(a.schLinks||[]).some(l=>l.from===x.id&&l.to===y.id&&l.type!=='linear-progression'&&l.confidence>=.65);if(explicit)continue;const px=polarity(x),py=polarity(y),sim=jac(lexicalSet(x),lexicalSet(y));const yResult=(y.frames||[]).some(f=>RESULT_VERBS.has(N(f.verb?.lemma||'')));if(px*py<0&&Math.abs(px-py)>=1){out.push({from:x.id,to:y.id,type:'contrast',confidence:clamp(.48+.08*Math.min(2,Math.abs(px-py))+.08*sim),basis:'delta de polaridade sem marcador explícito',status:'candidate',source:'deep-rhetoric'})}if(yResult&&sim<.28){out.push({from:x.id,to:y.id,type:'consequence',confidence:clamp(.46+.10*(1-sim)),basis:'mudança funcional para predicado de resultado/produção',status:'candidate',source:'deep-rhetoric'})}if(sim>.42&&!out.some(r=>r.from===x.id&&r.to===y.id)){out.push({from:x.id,to:y.id,type:'addition',confidence:clamp(.42+.20*sim),basis:'continuidade lexical densa por justaposição',status:'candidate',source:'deep-rhetoric'})}}return out}
  async function enrichAnalysis(a,progress){if(!a)return a;const step=async(label,p)=>{if(progress)progress(label,p);await new Promise(r=>setTimeout(r,0))};await step('Executando HMM de fallback',.15);for(let i=0;i<a.units.length;i++){const u=a.units[i];u.hmm=hmmTag(u.morph||[]);u.deepParse=repairWithFrames(u,shiftReduce((u.morph||[]).map((t,j)=>({...t,index:j}))));if(i%4===3)await new Promise(r=>setTimeout(r,0))}await step('Calculando correferência semântica',.55);a.deepCoreference=semanticCoreference(a);await step('Testando justaposições lógicas',.78);a.rhetoricalHypotheses=implicitRelations(a);a.deepParser={method:'shift-reduce heurístico ponderado',hmm:'HMM trigramático leve como fallback',units:a.units.length,implicitRelations:a.rhetoricalHypotheses.length,semanticCoreference:a.deepCoreference.length};await step('Deep parsing concluído',1);return a}
  return{hmmTag,shiftReduce,depLabel,semanticCoreference,implicitRelations,enrichAnalysis};
})();

/*
 * HermeneiaRealizer — único escritor do sistema.
 * Recebe apenas dados do plano semântico; nenhuma outra camada produz prosa final.
 */
