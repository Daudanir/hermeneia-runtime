window.HermeneiaCore = (() => {
  'use strict';
  const LX = window.HermeneiaLexicon;
  let EXTERNAL = { lexical:{}, icf:{}, semantic:{}, morphology:{verbLemmas:{},verbForms:{}}, ready:{}, version:'' };
  function resourceKey(s){
    return deaccent(String(s||'').toLowerCase())
      .replace(/[^a-z\-]/g,'')
      .replace(/ph/g,'f').replace(/th/g,'t').replace(/rh/g,'r').replace(/y/g,'i')
      .replace(/ch(?=[rl])/g,'c')
      .replace(/([bcdfglmnptvz])\1/g,'$1');
  }
  function setExternalResources(bundle){
    EXTERNAL = {
      lexical: bundle?.lexical || {},
      icf: bundle?.icf || {},
      semantic: bundle?.semantic || {},
      morphology: bundle?.morphology || {verbLemmas:{},verbForms:{}},
      ready: bundle?.ready || {},
      version: bundle?.version || ''
    };
    return getExternalResources();
  }
  function getExternalResources(){
    return { ready:{...EXTERNAL.ready}, version:EXTERNAL.version, lexicalKeys:Object.keys(EXTERNAL.lexical).length, icfKeys:Object.keys(EXTERNAL.icf).length, semanticKeys:Object.keys(EXTERNAL.semantic).length, verbLemmaKeys:Object.keys(EXTERNAL.morphology?.verbLemmas||{}).length, verbFormKeys:Object.keys(EXTERNAL.morphology?.verbForms||{}).length };
  }
  function extLex(k){return EXTERNAL.lexical[resourceKey(k)]||null}
  function extSemantic(k){return EXTERNAL.semantic[resourceKey(k)]||null}
  function extIcf(k){
    const v=Number(EXTERNAL.icf[resourceKey(k)]);
    return Number.isFinite(v)?v:null;
  }
  function icfSupport(k){
    const v=extIcf(k); if(v==null)return 0;
    const a=Math.abs(v); return a/(1+a);
  }
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const uniq=a=>[...new Set(a)];
  const deaccent=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const norm=s=>deaccent(String(s||'').toLowerCase()).replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
  const words=s=>(String(s||'').match(/[\p{L}À-ÿ]+(?:[-’'][\p{L}À-ÿ]+)*/gu)||[]);

  class SemanticState {
    constructor(){this.facts=new Map();this.provenance=[];this.rejected=[];this.conflicts=[]}
    key(f){return `${f.type}::${f.subject}`}
    assert(raw){
      const f={confidence:.5,sources:[],anchors:[],...raw}; f.confidence=clamp(f.confidence); f.sources=uniq(f.sources);f.anchors=uniq(f.anchors);
      const key=this.key(f),old=this.facts.get(key);
      if(!old){this.facts.set(key,f);this.provenance.push({...f,operation:'accepted'});return f}
      if(JSON.stringify(old.value)===JSON.stringify(f.value)){
        old.confidence=Math.max(old.confidence,f.confidence);old.sources=uniq([...old.sources,...f.sources]);old.anchors=uniq([...old.anchors,...f.anchors]);
        this.provenance.push({...f,operation:'reinforced'});return old;
      }
      if(f.corrects&&f.confidence>=old.confidence+.10){this.conflicts.push({key,previous:{...old},incoming:{...f},resolution:'corrected'});this.facts.set(key,f);this.provenance.push({...f,operation:'corrected'});return f}
      this.conflicts.push({key,previous:{...old},incoming:{...f},resolution:'rejected'});this.reject(f,'contradição sem evidência superior');return old;
    }
    reject(item,reason){const r={...item,reason};this.rejected.push(r);this.provenance.push({...r,operation:'rejected'});return r}
    list(type=null){return [...this.facts.values()].filter(f=>!type||f.type===type)}
  }

  function verbLemmaCandidates(n){
    const out=[n],add=x=>{if(x&&x.length>2&&!out.includes(x))out.push(x)};
    if(n.length>5&&/avam$/.test(n))add(n.slice(0,-4)+'ar');
    if(n.length>5&&/iam$/.test(n)){add(n.slice(0,-3)+'er');add(n.slice(0,-3)+'ir')}
    if(n.length>4&&/aram$/.test(n))add(n.slice(0,-4)+'ar');
    if(n.length>4&&/eram$/.test(n))add(n.slice(0,-4)+'er');
    if(n.length>4&&/iram$/.test(n))add(n.slice(0,-4)+'ir');
    if(n.length>4&&/am$/.test(n)){add(n.slice(0,-2)+'ar');add(n.slice(0,-2)+'er');add(n.slice(0,-2)+'ir')}
    if(n.length>4&&/em$/.test(n)){add(n.slice(0,-2)+'er');add(n.slice(0,-2)+'ir');add(n.slice(0,-2)+'ar')}
    if(n.length>2&&/a$/.test(n))add(n.slice(0,-1)+'ar');
    if(n.length>2&&/e$/.test(n)){add(n.slice(0,-1)+'er');add(n.slice(0,-1)+'ir')}
    if(/ou$/.test(n))add(n.slice(0,-2)+'ar');
    if(/eu$/.test(n))add(n.slice(0,-2)+'er');
    if(/iu$/.test(n))add(n.slice(0,-2)+'ir');
    if(/ai$/.test(n))add(n.slice(0,-2)+'ar');
    if(/ei$/.test(n)){add(n.slice(0,-2)+'er');add(n.slice(0,-2)+'ar')}
    if(n.length>4&&/i$/.test(n))add(n.slice(0,-1)+'ir');
    if(/ando$/.test(n))add(n.slice(0,-4)+'ar');
    if(/endo$/.test(n))add(n.slice(0,-4)+'er');
    if(/indo$/.test(n))add(n.slice(0,-4)+'ir');
    if(/ad[oa]s?$/.test(n))add(n.replace(/ad[oa]s?$/,'ar'));
    if(/id[oa]s?$/.test(n)){add(n.replace(/id[oa]s?$/,'er'));add(n.replace(/id[oa]s?$/,'ir'))}
    return uniq(out);
  }
  function knownVerbLemma(l){
    const key=resourceKey(l),ext=extLex(l),sem=extSemantic(l),m=EXTERNAL.morphology||{};
    return LX.POS.commonVerbs.has(l)||LX.POS.cognition.has(l)||LX.POS.reporting.has(l)||LX.POS.copulas.has(l)||LX.POS.motion.has(l)||LX.POS.agency.has(l)||LX.POS.existence.has(l)||LX.POS.causation.has(l)||LX.POS.relation.has(l)||LX.POS.obligation.has(l)
      ||Boolean(ext?.tags?.includes('V'))||Boolean(sem&&Object.keys(sem.valence||{}).length)||Boolean(m.verbLemmas?.[key]);
  }
  function exactLower(surface){return String(surface||'').toLowerCase().normalize('NFC')}
  function lemma(surface){
    // Formas graficamente distintas são resolvidas antes da desacentuação.
    // Isto impede colisões como “é” (SER) × “e” (conjunção).
    const raw=exactLower(surface);
    if(Object.prototype.hasOwnProperty.call(LX.IRREGULAR,raw))return LX.IRREGULAR[raw];
    const n=norm(surface);
    // Só consulta chave não acentuada quando a própria forma de superfície já é não acentuada.
    if(raw===n&&Object.prototype.hasOwnProperty.call(LX.IRREGULAR,n))return LX.IRREGULAR[n];
    if(/(ando|endo|indo)$/.test(n)){const g=n.replace(/ando$/,'ar').replace(/endo$/,'er').replace(/indo$/,'ir');if(knownVerbLemma(g))return g}
    const cand=verbLemmaCandidates(n).find(knownVerbLemma);return cand||n;
  }
  function strongExactVerb(surface){
    const raw=exactLower(surface), mapped=LX.IRREGULAR[raw];
    if(!mapped)return null;
    // Acento gráfico ou forma inequívoca oferece evidência morfológica superior à homografia lexical.
    if(/[áéíóúâêôãõç]/i.test(raw)||['sou','somos','sao','são','era','eram','foi','foram','sido','seja','sejam','sejais','tem','tinha','tinham','teve','tiveram','havia'].includes(raw))return mapped;
    return null;
  }
  function verbInflection(surface,lem){
    const raw=exactLower(surface), n=norm(surface), l=String(lem||'');
    const exact={
      'é':['presente','indicativo','3ª','singular'],'são':['presente','indicativo','3ª','plural'],'sao':['presente','indicativo','3ª','plural'],
      'sou':['presente','indicativo','1ª','singular'],'somos':['presente','indicativo','1ª','plural'],'era':['pretérito imperfeito','indicativo','3ª','singular'],'eram':['pretérito imperfeito','indicativo','3ª','plural'],
      'foi':['pretérito perfeito','indicativo','3ª','singular'],'foram':['pretérito perfeito','indicativo','3ª','plural'],
      'retém':['presente','indicativo','3ª','singular'],'retem':['presente','indicativo','3ª','singular'],'retêm':['presente','indicativo','3ª','plural'],
      'possui':['presente','indicativo','3ª','singular'],'possuem':['presente','indicativo','3ª','plural']
    };
    let x=exact[raw]||exact[n];
    if(!x){
      if(/(ar|er|ir)$/.test(n))x=['infinitivo','—','—','—'];
      else if(/(ando|endo|indo)$/.test(n))x=['gerúndio','—','—','—'];
      else if(/(ado|ada|ados|adas|ido|ida|idos|idas)$/.test(n))x=['particípio','—','—',/s$/.test(n)?'plural':'singular'];
      else if(/(ou|eu|iu)$/.test(n))x=['pretérito perfeito','indicativo','3ª','singular'];
      else if(/(aram|eram|iram)$/.test(n))x=['pretérito perfeito/forma ambígua','indicativo','3ª','plural'];
      else if(/iar$/.test(l)&&n===l.slice(0,-1))x=['presente','indicativo','3ª','singular'];
      else if(/(ava|ia)$/.test(n))x=['pretérito imperfeito','indicativo','3ª','singular'];
      else if(/(avam|iam)$/.test(n))x=['pretérito imperfeito','indicativo','3ª','plural'];
      else if(/êm$/.test(raw))x=['presente','indicativo','3ª','plural'];
      else if(/ém$/.test(raw))x=['presente','indicativo','3ª','singular'];
      else if(/ui$/.test(n)&&/uir$/.test(l))x=['presente','indicativo','3ª','singular'];
    }
    return x?{tense:x[0],mood:x[1],person:x[2],number:x[3]}:{};
  }
  function tokenize(text){
    return (String(text).match(/[\p{L}À-ÿ]+(?:[-’'][\p{L}À-ÿ]+)*|\d+(?:[.,]\d+)?|[^\s\p{L}\d]/gu)||[]).map((surface,index)=>({surface,norm:norm(surface),lemma:lemma(surface),index}));
  }
  function sentenceSplit(paragraph){
    const protectedText=String(paragraph)
      .replace(/\b([1-3]?[A-Za-zÀ-ÿ]{1,12}\s+\d{1,3})\.(\d{1,3})\b/g,'$1§$2')
      .replace(/\b(Sr|Sra|Dr|Dra|Prof|Pr|Rev|cap|caps|v|vv|p|pp|cf|etc)\./gi,'$1¤');
    const out=[];let buf='',quote=false,paren=0;
    for(let i=0;i<protectedText.length;i++){
      const c=protectedText[i];buf+=c;if(c==='"'||c==='“'||c==='”')quote=!quote;if(c==='(')paren++;if(c===')')paren=Math.max(0,paren-1);
      if(/[.!?]/.test(c)&&!quote&&!paren){const next=protectedText[i+1]||'';if(!next||/\s/.test(next)){if(buf.trim())out.push(buf.trim().replace(/§/g,'.').replace(/¤/g,'.'));buf=''}}
    }
    if(buf.trim())out.push(buf.trim().replace(/§/g,'.').replace(/¤/g,'.'));return out;
  }
  function clauseSplit(sentence){
    const parts=String(sentence).split(/,\s*(?=(?:mas|porém|porem|contudo|todavia|entretanto|porque|embora|portanto|assim|então|entao)\b)|,\s*e\s+(?=(?:eu|tu|ele|ela|eles|elas|nós|nos|vós|vos|vocês|voces|este|esta|isto|isso|aquele|aquela|o|a|os|as)\b)|;\s*/i).map(x=>x.trim()).filter(Boolean);
    return parts.length?parts:[String(sentence).trim()];
  }
  function stripSourceMarkers(text){
    return String(text||'').replace(/\b[1-3]?[A-Za-zÀ-ÿ]{1,12}\s+\d{1,3}\.\d{1,3}\b/g,' ').replace(/\s+/g,' ').trim();
  }
  function segment(text){
    const paragraphs=String(text).split(/\n\s*\n+/).map(s=>s.trim()).filter(Boolean);const units=[];let id=1;
    const pushUnit=(raw,pi,si)=>{
      const cleaned=stripSourceMarkers(raw);if(!cleaned)return;
      const uid=`U${id++}`;
      units.push({id:uid,paragraph:pi+1,sentence:si+1,text:raw.trim(),analysisText:cleaned,norm:norm(cleaned),tokens:tokenize(cleaned),clauses:clauseSplit(cleaned).map((c,ci)=>({id:`${uid}C${ci+1}`,text:c,norm:norm(c),tokens:tokenize(c)}))});
    };
    paragraphs.forEach((p,pi)=>{
      const lines=p.split(/\n+/).map(x=>x.trim()).filter(Boolean);
      const biblicalLines=lines.length>1&&lines.filter(x=>/^\s*[1-3]?[A-Za-zÀ-ÿ]{1,12}\s+\d{1,3}\.\d{1,3}\b/.test(x)).length>=Math.ceil(lines.length*.6);
      if(biblicalLines){lines.forEach((line,li)=>pushUnit(line,pi,li));return}
      sentenceSplit(p).forEach((sent,si)=>pushUnit(sent,pi,si));
    });
    return {paragraphs,units};
  }

  function isVerbToken(t){
    const n=t.norm,l=t.lemma,m=EXTERNAL.morphology||{};
    if(knownVerbLemma(l)||knownVerbLemma(n)||m.verbForms?.[resourceKey(n)])return true;
    if(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t.surface)&&!LX.POS.imperative.has(n))return false;
    if(verbLemmaCandidates(n).some(knownVerbLemma))return true;
    return /(ar|er|ir|ou|eu|iu|aram|eram|iram|asse|esse|isse|arei|erei|irei|aria|eria|iria|ando|endo|indo|ado|ada|ados|adas|ido|ida|idos|idas)$/.test(n) || (n.length>5&&/(ava|avam|iam)$/.test(n));
  }
  function nominalLemmaCandidate(value){
    const n=norm(value);
    if(/oes$/.test(n)&&n.length>5)return n.slice(0,-3)+'ao';
    if(/ais$/.test(n)&&n.length>5)return n.slice(0,-3)+'al';
    if(/eis$/.test(n)&&n.length>5)return n.slice(0,-3)+'el';
    if(/ns$/.test(n)&&n.length>4)return n.slice(0,-2)+'m';
    if(/s$/.test(n)&&n.length>4&&!/(is|us)$/.test(n))return n.slice(0,-1);
    return n;
  }
  function classifyToken(t,prev,next){
    const n=t.norm,raw=exactLower(t.surface);let pos='content',features=[];
    const strongVerb=strongExactVerb(t.surface);
    if(/^[.,:;!?()[\]"“”]+$/.test(t.surface))pos='punct';
    else if(strongVerb)pos='verb';
    else if(['à','às'].includes(raw))pos='preposition';
    else if(LX.POS.negation.has(n))pos='negation';
    else if(LX.POS.modal.has(n)||LX.POS.time.has(n)||['também','tambem','apenas','somente','igualmente','ali','aqui','lá','la','perto','longe','só','so'].includes(n))pos='adverb';
    else if(LX.POS.articles.has(n))pos='article';
    else if(LX.POS.demonstratives.has(n))pos='demonstrative';
    else if(LX.POS.possessives.has(n))pos='possessive';
    else if(LX.POS.pronouns.has(n))pos='pronoun';
    else if(LX.POS.prepositions.has(n))pos='preposition';
    else if(LX.POS.conjunctions.has(n))pos='conjunction';
    else if(prev&&(LX.POS.articles.has(prev.norm)||LX.POS.demonstratives.has(prev.norm)||LX.POS.possessives.has(prev.norm)||(['de','do','da','dos','das'].includes(prev.norm)))&&!LX.POS.imperative.has(n)){
      const nextLex=next&&(LX.WORDS[next.norm]||extLex(next.norm));
      pos=nextLex&&(nextLex.pos==='noun'||(nextLex.tags||[]).some(x=>['N','Nm','Nf'].includes(x)))&&!LX.WORDS[n]?'content':'nounish';
    }
    else if(LX.WORDS[n]?.pos==='noun'&&prev&&['nounish','content','possessive','article','demonstrative'].includes(prev.pos))pos='nounish';
    else if(isVerbToken(t))pos='verb';
    else if(/mente$/.test(n))pos='adverb';
    else if(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t.surface)&&!isVerbToken(t)&&(t.index>0||(next&&isVerbToken(next))||(next&&['se','me','te','lhe','lhes'].includes(next.norm))||(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+$/.test(t.surface)&&!/s$/.test(t.norm))))pos='proper';
    else if(prev&&(LX.POS.articles.has(prev.norm)||LX.POS.demonstratives.has(prev.norm)||LX.POS.possessives.has(prev.norm)))pos='nounish';
    else if(/(ção|cao|dade|mento|ismo|ista|or|ora|ez|eza|ura|ncia|agem|ude|ice|ao|ão)$/.test(n))pos='nounish';
    const resolvedVerbLemma=pos==='verb'?(strongVerb||t.lemma):t.lemma;
    const nominalLemma=nominalLemmaCandidate(n);
    const ext=pos==='verb'?(extLex(resolvedVerbLemma)||extLex(n)):(extLex(n)||extLex(nominalLemma));
    // O dicionário fornece candidatos; só decide POS quando o contexto não resolveu a classe.
    if(pos==='content'&&ext?.tags?.length){
      if(ext.tags.includes('ADV'))pos='adverb';
      else if(ext.tags.includes('PREP'))pos='preposition';
      else if(ext.tags.includes('CONJ'))pos='conjunction';
      else if(ext.tags.includes('PRON'))pos='pronoun';
      else if(ext.tags.some(x=>['Nm','Nf','N','ADJ'].includes(x)))pos='nounish';
      else if(ext.tags.includes('V'))pos='verb';
    }
    if(LX.POS.negation.has(n))features.push('negation');if(LX.POS.modal.has(n))features.push('modal');if(LX.POS.imperative.has(n))features.push('imperative');
    if(LX.POS.evaluation.has(n))features.push('evaluation');if(LX.POS.cognition.has(resolvedVerbLemma)||LX.POS.cognition.has(n))features.push('cognition');if(LX.POS.affect.has(n)||LX.POS.affect.has(resolvedVerbLemma))features.push('affect');
    let number='unknown',gender='unknown',tense='',mood='',person='';
    if(pos==='verb'){
      const inf=verbInflection(t.surface,resolvedVerbLemma);tense=inf.tense||'';mood=inf.mood||'';person=inf.person||'';number=inf.number||'unknown';
      [tense,mood,person].filter(x=>x&&x!=='—').forEach(x=>features.push(x));
    }else if(['punct','conjunction','preposition','adverb','negation'].includes(pos)){
      number='n/a';gender='n/a';
    }else{
      number=/s$/.test(n)&&!/(is|us)$/.test(n)?'plural':'singular';
      const femForms=new Set(['a','as','uma','umas','esta','estas','essa','essas','aquela','aquelas','minha','minhas','tua','tuas','sua','suas','nossa','nossas','vossa','vossas']);
      const mascForms=new Set(['o','os','um','uns','este','estes','esse','esses','aquele','aqueles','meu','meus','teu','teus','seu','seus','nosso','nossos','vosso','vossos']);
      gender=femForms.has(n)?'feminine':mascForms.has(n)?'masculine':ext?.tags?.includes('Nf')?'feminine':ext?.tags?.includes('Nm')?'masculine':/(a|ção|cao|dade)$/.test(n)?'feminine':/(o|or|mento|ismo)$/.test(n)?'masculine':'unknown';
    }
    if(pos==='pronoun'&&n==='quem')features.push('relative-free');
    const resolvedLemma=pos==='verb'?resolvedVerbLemma:(pos==='proper'?t.surface:(pos==='nounish'?nominalLemma:n));
    return {...t,lemma:resolvedLemma,pos,features,number,gender,tense,mood,person,externalTags:ext?.tags||[],lexicalSourceOnly:Boolean(ext?.tags?.length)};
  }
  function classifySequence(tokens){
    const out=[];
    for(let i=0;i<tokens.length;i++) out.push(classifyToken(tokens[i],out[i-1]||null,tokens[i+1]||null));
    for(let i=0;i<out.length;i++){
      const t=out[i],n1=out[i+1],n2=out[i+2];
      if(t?.pos==='verb'&&n1?.pos==='possessive'&&n2?.pos==='verb'&&LX.POS.copulas.has(n2.lemma)){
        const ext=extLex(t.norm);
        if(!ext?.tags?.length||ext.tags.some(x=>['N','Nm','Nf','ADJ'].includes(x))){
          out[i]={...t,pos:'nounish',lemma:t.norm,features:(t.features||[]).filter(x=>x!=='imperativo'),tense:'',mood:'',person:'',number:'singular'};
        }
      }
    }
    return out;
  }
  function classifySeRoles(morph){
    const roles=[];
    const lexicalIndex=(start,step)=>{for(let i=start;i>=0&&i<morph.length;i+=step){if(morph[i].pos!=='punct')return i}return -1};
    for(let i=0;i<morph.length;i++){
      if(morph[i].norm!=='se')continue;
      const pi=lexicalIndex(i-1,-1),ni=lexicalIndex(i+1,1),ai=ni>=0?lexicalIndex(ni+1,1):-1;
      const prev=pi>=0?morph[pi]:null,next=ni>=0?morph[ni]:null,after=ai>=0?morph[ai]:null;
      let role='ambiguous',confidence=.52,reason='forma “se” semanticamente ambígua';
      // “se expia a culpa”, “se fazem as obras”: clítico/passiva sintética favorecida.
      const postverbalNP=next?.pos==='verb'&&after&&['article','demonstrative','possessive','nounish','proper','content'].includes(after.pos);
      const precededByVerb=prev?.pos==='verb';
      const explicitSubjectAfter=next&&['pronoun','proper','nounish'].includes(next.pos)&&!isVerbToken(next);
      if(precededByVerb){role='clitic';confidence=.88;reason='o pronome se liga a um predicado anterior'}
      else if(postverbalNP){role='clitic-passive-or-indeterminate';confidence=.90;reason='“se” precede verbo seguido de sintagma nominal, padrão compatível com construção pronominal/passiva'}
      else if(explicitSubjectAfter){role='conditional';confidence=.94;reason='“se” introduz participante expresso antes do predicado'}
      else if(next?.pos==='verb'&&/^(for|fosse|forem|vier|viesse|tiver|tivesse|fizer|fizesse|puder|pudesse|quiser|quisesse|souber|soubesse|houver|houvesse)$/i.test(next.norm)){
        role='conditional';confidence=.96;reason='forma verbal favorece prótase condicional';
      }
      roles.push({index:i,role,confidence,reason,surface:morph[i].surface});
    }
    return roles;
  }
  function morphology(unit,state){
    unit.morph=classifySequence(unit.tokens);
    unit.clauses.forEach(c=>{c.morph=classifySequence(c.tokens);c.seRoles=classifySeRoles(c.morph)});
    unit.seRoles=classifySeRoles(unit.morph);
    let modality='declarative',confidence=.80;
    if(unit.text.includes('?')){modality='interrogative';confidence=.98}else if(unit.morph.slice(0,5).some(t=>t.features.includes('imperative'))||(/\b(vós|vos)\b/i.test(unit.analysisText||unit.text)&&unit.morph.some(t=>t.pos==='verb'&&/(ai|ei|i)$/i.test(t.surface)))){modality='imperative';confidence=.92}else if(unit.text.includes('!')){modality='exclamative';confidence=.88}
    unit.modality=modality;state.assert({type:'modality',subject:unit.id,value:modality,confidence,sources:['morphology'],anchors:[unit.id]});
    state.assert({type:'negation',subject:unit.id,value:unit.morph.some(t=>t.features.includes('negation')),confidence:.94,sources:['morphology'],anchors:[unit.id]});
    unit.seRoles.forEach((x,j)=>state.assert({type:'se-role',subject:`${unit.id}:se${j+1}`,value:{role:x.role,reason:x.reason},confidence:x.confidence,sources:['morphology','syntax-context'],anchors:[unit.id]}));
  }

  function nominalChunks(morph){
    const chunks=[];let cur=[];
    const allowed=new Set(['article','demonstrative','possessive','nounish','proper','content']);
    const flush=()=>{if(cur.some(t=>['nounish','proper','content'].includes(t.pos))){chunks.push(cur)}cur=[]};
    for(let i=0;i<morph.length;i++){
      const t=morph[i],next=morph[i+1];
      const attachDe=t.pos==='preposition'&&['de','do','da','dos','das'].includes(t.norm)&&cur.length&&next&&allowed.has(next.pos)&&!isVerbToken(next);
      if((allowed.has(t.pos)&&!isVerbToken(t)&&!t.features.includes('modal')&&!LX.POS.time.has(t.norm))||attachDe){cur.push(t)}else flush();
    }flush();
    return chunks.map(ts=>{const lexical=ts.filter(t=>['nounish','proper','content'].includes(t.pos));const agreeHead=lexical[0]||ts[0],semanticHead=lexical[lexical.length-1]||ts[ts.length-1];return{text:ts.map(t=>t.surface).join(' '),norm:ts.map(t=>t.norm).join(' '),head:semanticHead,agreementHead:agreeHead,proper:ts.some(t=>t.pos==='proper'),tokens:ts}});
  }
  function clauseFrame(clause){
    const m=clause.morph;
    const verbIdx=m.map((t,i)=>t.pos==='verb'?i:-1).filter(i=>i>=0);
    const AUX=new Set(['ser','estar','ter','haver','ir','vir','poder','dever','querer','precisar','parecer','ficar','continuar','começar','comecar','acabar','voltar']);
    const nonFinite=i=>/(ando|endo|indo|ado|ada|ados|adas|ido|ida|idos|idas)$/i.test(m[i]?.norm||'')||['infinitivo','gerúndio','particípio'].includes(m[i]?.tense);
    const canBridge=t=>t&&(['adverb','negation','pronoun'].includes(t.pos)||['a','de','que'].includes(t.norm));
    const auxiliaryChain=(first,target)=>{
      if(first<0||target<=first||target-first>5)return false;
      const head=m[first];if(!AUX.has(head?.lemma))return false;
      const between=m.slice(first+1,target);
      if(between.some(t=>t.pos==='conjunction'||t.pos==='nounish'||t.pos==='proper'||(t.pos==='content'&&!canBridge(t))||/[;,:]/.test(t.surface)))return false;
      const immediate=m[first+1];
      if(['ser','estar'].includes(head.lemma)&&immediate&&['article','possessive','demonstrative','nounish','proper','content'].includes(immediate.pos)&&!nonFinite(first+1))return false;
      return true;
    };
    let embedded=[],forcedSubject=null,forcedMain=-1;
    // Relativa livre em posição de sujeito: “Quem retém as palavras possui o conhecimento”.
    if(m[0]?.norm==='quem'&&verbIdx.length>=2){
      const first=verbIdx[0];
      const second=verbIdx.slice(1).find(i=>!auxiliaryChain(first,i)&&!m.slice(first+1,i).some(t=>t.pos==='conjunction'));
      if(second!==undefined){
        const relObj=nominalChunks(m.slice(first+1,second))[0]||null;
        const relText=m.slice(0,second).map(t=>t.surface).join(' ');
        embedded.push({type:'relative-free',label:'oração relativa livre encaixada',text:relText,subject:{text:m[0].surface,kind:'relative-pronoun'},verb:{surface:m[first].surface,lemma:m[first].lemma},object:relObj?{text:relObj.text,kind:'direct-object'}:null,confidence:.94});
        forcedSubject={text:relText,norm:norm(relText),kind:'relative-free-clause',gender:'unknown',number:'singular',proper:false};
        forcedMain=second;
      }
    }
    let vi=forcedMain>=0?forcedMain:(verbIdx.length?verbIdx[0]:-1);
    if(forcedMain<0&&verbIdx.length>1){
      const first=verbIdx[0],lexical=verbIdx.filter(i=>!AUX.has(m[i].lemma));
      const target=lexical.find(i=>auxiliaryChain(first,i));
      if(target!==undefined)vi=target;
      else{const finite=verbIdx.filter(i=>!nonFinite(i));vi=finite.length?finite[0]:first}
    }
    const verb=vi>=0?m[vi]:null,firstVerb=forcedMain>=0?vi:(verbIdx.length?verbIdx[0]:vi);
    const before=firstVerb>=0?m.slice(0,firstVerb):m,after=vi>=0?m.slice(vi+1):[];
    const beforeChunks=nominalChunks(before);
    const subjectChunks=beforeChunks.filter(ch=>{const fi=m.indexOf(ch.tokens[0]);const pt=fi>0?m[fi-1]:null;return !pt||pt.pos!=='preposition'});
    let leftNP=subjectChunks.slice(-1)[0]||null,rightNP=nominalChunks(after)[0]||null;
    const subjectPronouns=new Set(['eu','tu','ele','ela','nos','nós','vos','vós','voces','vocês','eles','elas']);
    const pronSub=before.find(t=>t.pos==='pronoun'&&subjectPronouns.has(t.norm));
    if(rightNP&&rightNP.tokens.length===1&&/(ado|ada|idos|idas|ido|ida)$/.test(rightNP.head.norm))rightNP=null;
    let subject=forcedSubject||(leftNP?{text:leftNP.text,norm:leftNP.norm,kind:'nominal',gender:leftNP.agreementHead.gender,number:leftNP.agreementHead.number,proper:leftNP.proper}:pronSub?{text:pronSub.surface,norm:pronSub.norm,kind:'pronoun',gender:pronSub.gender,number:pronSub.number}:null);
    const sePassive=(clause.seRoles||[]).some(x=>x.role==='clitic-passive-or-indeterminate');
    let voice=sePassive?'pronominal-passive-or-indeterminate':'active-or-copular';
    if(sePassive&&rightNP&&!subject){subject={text:rightNP.text,norm:rightNP.norm,kind:'postverbal-under-se',gender:rightNP.agreementHead.gender,number:rightNP.agreementHead.number,proper:rightNP.proper};rightNP=null}
    const verbInfo=verb?{surface:verb.surface,lemma:verb.lemma,tense:verb.tense||'',mood:verb.mood||'',person:verb.person||'',number:verb.number||''}:null;
    const auxiliaries=verbIdx.filter(i=>i!==vi&&i<vi&&auxiliaryChain(i,vi)).map(i=>({surface:m[i].surface,lemma:m[i].lemma}));
    const copular=Boolean(verbInfo&&['ser','estar','parecer','permanecer','ficar','tornar','continuar','resultar','significar','representar','constituir'].includes(verbInfo.lemma)&&!auxiliaries.length);
    let predicative=null,object=rightNP;
    if(copular&&rightNP){predicative={text:rightNP.text,norm:rightNP.norm,kind:'subject-predicative',gender:rightNP.agreementHead.gender,number:rightNP.agreementHead.number,proper:rightNP.proper};object=null}
    const sem=verbInfo?extSemantic(verbInfo.lemma):null,rawFrames=sem?Object.entries(sem.frames||{}).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,8):[];
    const maxCount=rawFrames.length?Math.max(...rawFrames.map(x=>Number(x[1])||0),1):1;
    const semanticFrames=rawFrames.map(([frame,count])=>{const valence=sem.valence?.[frame]||null,roleCount=Array.isArray(valence?.roles)?valence.roles.length:Object.keys(valence?.roles||{}).length,frequencySupport=(Number(count)||0)/maxCount,genericPenalty=AUX.has(verbInfo?.lemma)?0.35:0;const support=clamp(.50*frequencySupport+.30*Math.min(1,roleCount/3)+.20*(verbInfo&&!AUX.has(verbInfo.lemma)?1:.35)-genericPenalty);return {frame,count:Number(count)||0,valence,support,lemma:verbInfo?.lemma||''}}).filter(x=>x.support>=.55);
    const structure=embedded.length?'oração principal com oração relativa livre encaixada':copular?'oração copulativa/predicativa':auxiliaries.length?'cadeia verbal':'oração verbal';
    return {id:clause.id,text:clause.text,structure,subject,verb:verbInfo,auxiliaries,copular,voice,object:object?{text:object.text,norm:object.norm,kind:'direct-or-oblique-complement',gender:object.agreementHead.gender,number:object.agreementHead.number,proper:object.proper}:null,predicative,embedded,negated:m.some(t=>t.features.includes('negation')),modals:m.filter(t=>t.features.includes('modal')).map(t=>t.surface),semanticFrames};
  }
  function frames(units,state){
    const all=[];units.forEach(u=>{u.frames=u.clauses.map(clauseFrame);u.frames.forEach(f=>{all.push({...f,unit:u.id});if(f.verb)state.assert({type:'predicate',subject:f.id,value:{subject:f.subject?.text||null,verb:f.verb.lemma,object:f.object?.text||null,negated:f.negated,modals:f.modals,semanticFrames:f.semanticFrames?.map(x=>x.frame)||[]},confidence:f.subject?.text?.length?.82:.68,sources:f.semanticFrames?.length?['syntax','Frame2']:['syntax'],anchors:[u.id]})})});return all;
  }

  function relationTypeFromCategory(cat){return {contrast:'contrast',concession:'concession',cause:'cause',consequence:'consequence',condition:'condition',purpose:'purpose',explanation:'reformulation',example:'example',addition:'addition',temporal:'temporal',comparison:'comparison'}[cat]||cat}
  function markerAtOpening(unit,marker){
    const txt=norm(unit.analysisText||unit.text).replace(/^[“"'([{—–-]+\s*/,'').trim();
    const mk=norm(marker||'');
    if(!mk)return false;
    if(mk==='para + infinitivo')return /^para\s+/.test(txt);
    return txt===mk||txt.startsWith(mk+' ')||txt.startsWith(mk+',')||txt.startsWith(mk+':');
  }
  function conditionalSeAuthorized(unit){
    const roles=unit.seRoles||[];
    if(!roles.length)return false;
    return roles.some(x=>x.role==='conditional'&&x.confidence>=.70);
  }
  function relations(unit,state){
    const found=[];
    for(const reg of LX.REGISTRY){if(reg.re.test(unit.text)){found.push({id:`${unit.id}R${found.length+1}`,type:'government',subtype:reg.role,marker:`${reg.lemma} ${reg.prep}`,confidence:.98,scope:'intraunit'})}}
    for(const [cat,patterns] of Object.entries(LX.DISCOURSE)){
      for(const p of patterns){if(!p.re.test(unit.text))continue;
        if(cat==='cause'&&p.marker==='pois'&&/\w+\s*,\s*pois\s*,/i.test(unit.text))continue;
        if(cat==='consequence'&&p.marker==='assim'&&!/^\s*assim\b|[.;]\s*assim\b/i.test(unit.text))continue;
        // “se” só recebe estatuto condicional quando a morfossintaxe não o favorece como clítico.
        if(cat==='condition'&&p.marker==='se'&&!conditionalSeAuthorized(unit))continue;
        const type=relationTypeFromCategory(cat),opens=markerAtOpening(unit,p.marker);
        found.push({id:`${unit.id}R${found.length+1}`,type,subtype:'explicit',marker:p.marker,confidence:p.conf,scope:opens?'cross-unit-candidate':'intraunit',opensUnit:opens});
      }
    }
    // Coordenação explícita entre predicações: registra a relação interna sem promovê-la automaticamente a ponte entre unidades.
    if(unit.clauses?.length>1&&/[,;]\s*e\s+/i.test(unit.analysisText||unit.text)&&!found.some(r=>r.type==='addition'&&r.marker==='e')){
      found.push({id:`${unit.id}R${found.length+1}`,type:'addition',subtype:'coordinate-predications',marker:'e',confidence:.99,scope:'intraunit',opensUnit:false});
    }
    // logo: temporal por padrão quando não abre com vírgula
    if(/\blogo\b/i.test(unit.text)&&!found.some(r=>r.marker==='logo')){
      const opens=/^\s*logo\s*,/i.test(unit.analysisText||unit.text);
      found.push({id:`${unit.id}R${found.length+1}`,type:opens?'consequence':'temporal',subtype:opens?'inferential':'adverbial',marker:'logo',confidence:opens?.87:.93,scope:opens?'cross-unit-candidate':'intraunit',opensUnit:opens});
    }
    // “antes,” após pausa forte pode funcionar como correção/oposição.
    found.forEach(r=>{if(r.type==='temporal'&&r.marker==='antes'&&/[;:]\s*antes\s*,/i.test(unit.text)){r.type='contrast';r.subtype='corrective';r.confidence=Math.max(r.confidence||0,.93);r.scope='intraunit';r.opensUnit=false}});
    // catáfora demonstrativa + dois pontos
    if(/\b(este|esta|isto|seguinte)\b[^:]{0,60}:/.test(unit.norm))found.push({id:`${unit.id}R${found.length+1}`,type:'presentation',subtype:'cataphora',marker:'demonstrative + colon',confidence:.97,scope:'intraunit',opensUnit:false});
    // evita causa superficial quando há regência
    if(found.some(r=>r.type==='government')){
      for(let i=found.length-1;i>=0;i--){if(found[i].type==='cause'&&found[i].marker==='por')found.splice(i,1)}
    }
    unit.relations=found;found.forEach(r=>state.assert({type:'relation',subject:r.id,value:{type:r.type,subtype:r.subtype,marker:r.marker,scope:r.scope},confidence:r.confidence,sources:['discourse'],anchors:[unit.id]}));return found;
  }

  function entityCandidates(units,state){
    const map=new Map();const banned=new Set(['este','esta','isso','isto','aquele','assim','então','entao','logo','não','nao','que','se']);
    const add=(np,anchor,role,confidence)=>{if(!np||!np.text)return;const key=norm(np.text).replace(/^(o|a|os|as|um|uma|uns|umas)\s+/,'');if(!key||banned.has(key)||key.length<2)return;let e=map.get(key);if(!e)e={id:`E${map.size+1}`,key,label:np.text.replace(/^(o|a|os|as|um|uma|uns|umas)\s+/i,''),gender:np.gender||'unknown',number:np.number||'singular',proper:Boolean(np.proper),roles:new Set(),anchors:[],mentions:0,confidence:0};e.roles.add(role);e.anchors.push(anchor);e.mentions++;e.confidence=Math.max(e.confidence,confidence);map.set(key,e)};
    units.forEach(u=>u.frames.forEach(f=>{if(f.subject?.kind==='nominal')add(f.subject,u.id,'subject',.90);if(f.object?.kind==='nominal'&&!/^(não|nao|que|se|ali|aqui)$/i.test(f.object.text)&&!/(ado|ada|idos|idas|ido|ida)$/i.test(f.object.text))add(f.object,u.id,'object',.60)}));
    const entities=[...map.values()].map(e=>({...e,roles:[...e.roles],anchors:uniq(e.anchors)}));entities.forEach(e=>state.assert({type:'entity',subject:e.id,value:{label:e.label,gender:e.gender,number:e.number,roles:e.roles},confidence:e.confidence,sources:['reference'],anchors:e.anchors}));return entities;
  }
  function compatiblePronoun(pron,e){
    const p=norm(pron);if(['eles','elas'].includes(p)&&e.number!=='plural')return false;if(['ele','ela'].includes(p)&&e.number==='plural')return false;if(p==='ela'&&e.gender==='masculine')return false;if(p==='ele'&&e.gender==='feminine')return false;return true;
  }
  function coreference(units,entities,state){
    const links=[];const recent=[];
    units.forEach(u=>{
      for(const f of u.frames){
        if(f.subject?.kind==='nominal'){
          const e=entities.find(x=>norm(x.label)===norm(f.subject.text).replace(/^(o|a|os|as|um|uma)\s+/,''));
          if(e){recent.unshift(e);if(recent.length>8)recent.pop()}
        }
        if(f.subject?.kind==='pronoun'&&['ele','ela','eles','elas'].includes(norm(f.subject.text))){
          const cand=recent.find(e=>compatiblePronoun(f.subject.text,e));
          if(cand){const link={pronoun:f.subject.text,entityId:cand.id,entity:cand.label,unit:u.id,confidence:.78};links.push(link);state.assert({type:'coreference',subject:`${u.id}:${f.subject.text}`,value:cand.id,confidence:.78,sources:['coreference'],anchors:[u.id,...cand.anchors.slice(-1)]})}
        }
      }
    });return links;
  }


  const ANAPHORIC_EXPRESSIONS=[
    {re:/\b(estas|essas|tais)\s+coisas\b/i,kind:'set',label:'estas coisas'},
    {re:/\b(tudo isso|tudo isto)\b/i,kind:'proposition-set',label:'tudo isso'},
    {re:/\b(isso|isto|aquilo)\b/i,kind:'proposition',label:'isso'}
  ];
  function contentTerms(unit){
    const stop=new Set(['coisa','coisas','estas','essas','tais','isso','isto','aquilo','todo','toda','todos','todas','mesmo','mesma','senhor','texto','passagem']);
    const map=new Map();
    unit.morph.filter(t=>['nounish','content'].includes(t.pos)&&!isVerbToken(t)&&!stop.has(t.norm)&&t.norm.length>3).forEach(t=>{if(!map.has(t.norm))map.set(t.norm,t.surface)});
    return [...map.values()];
  }
  function enumerationScore(unit){
    const punctuation=(unit.analysisText.match(/[,;:]/g)||[]).length;
    const additions=(unit.analysisText.match(/\b(e|bem como|também|tambem|com)\b/gi)||[]).length;
    const terms=contentTerms(unit);
    return clamp(.18*punctuation+.12*additions+.08*Math.min(terms.length,6));
  }
  function discourseCoreference(units,state){
    const links=[];
    units.forEach((u,i)=>{
      const expr=ANAPHORIC_EXPRESSIONS.find(x=>x.re.test(u.analysisText||u.text));
      if(!expr||i===0)return;
      const raw=u.analysisText||u.text;
      const match=raw.match(expr.re);
      if(expr.kind==='proposition'&&match&&/\bpor\s+isso\b/i.test(raw.slice(Math.max(0,match.index-5),match.index+match[0].length+6)))return;

      // Se a mesma expressão foi resolvida na unidade imediatamente anterior, herda o antecedente já estabilizado.
      const previousResolved=links.find(x=>x.unit===units[i-1].id&&norm(x.expression)===norm(match?.[0]||expr.label));
      if(previousResolved){
        const link={id:`DC${links.length+1}`,expression:match?.[0]||expr.label,kind:expr.kind,unit:u.id,antecedentUnits:[...previousResolved.antecedentUnits],terms:[...previousResolved.terms],confidence:Math.max(.88,previousResolved.confidence-.02),inheritedFrom:previousResolved.unit};
        links.push(link);
        state.assert({type:'discourse-coreference',subject:`${u.id}:${norm(link.expression)}`,value:{antecedentUnits:link.antecedentUnits,terms:link.terms,kind:link.kind},confidence:link.confidence,sources:['discourse-coreference'],anchors:[...link.antecedentUnits,u.id]});
        return;
      }

      const windowStart=Math.max(0,i-4);
      const candidates=units.slice(windowStart,i).map((p,j)=>{
        const distance=i-(windowStart+j),enumS=enumerationScore(p),terms=contentTerms(p),semanticDensity=Math.min(1,terms.length/5);
        const listShape=/^\s*(com|e com)\b/i.test(p.analysisText)||/[;:]/.test(p.analysisText);
        const score=clamp(.48*(1/distance)+.27*enumS+.15*semanticDensity+.10*(listShape?1:0));
        return {unit:p,score,terms,listShape};
      }).sort((a,b)=>b.score-a.score);
      const best=candidates[0];if(!best)return;

      let antecedentUnits=[best.unit.id],terms=[...best.terms];
      if(expr.kind==='set'){
        // Expande para trás quando o antecedente é uma enumeração distribuída em várias unidades contíguas.
        const bestIndex=units.findIndex(x=>x.id===best.unit.id);
        for(let j=bestIndex-1;j>=Math.max(0,bestIndex-2);j--){
          const p=units[j],listLike=/^\s*(com|e com)\b/i.test(p.analysisText)||/[;:]/.test(p.analysisText)||unitRhetoricalRole(p)==='development';
          if(!listLike)break;
          antecedentUnits.unshift(p.id);terms.unshift(...contentTerms(p));
        }
      }
      terms=uniq(terms).slice(0,16);
      let confidence=expr.kind==='set'?Math.max(.78,best.score):Math.max(.68,best.score-.06);
      if(expr.kind==='set'&&terms.length>=3)confidence=Math.max(confidence,.92);
      const link={id:`DC${links.length+1}`,expression:match?.[0]||expr.label,kind:expr.kind,unit:u.id,antecedentUnits,terms,confidence};
      links.push(link);
      state.assert({type:'discourse-coreference',subject:`${u.id}:${norm(link.expression)}`,value:{antecedentUnits:link.antecedentUnits,terms:link.terms,kind:link.kind},confidence,sources:['discourse-coreference'],anchors:[...link.antecedentUnits,u.id]});
    });
    return links;
  }
  function hasPositivePresence(u){
    const n=u.norm;
    return /\b(existir|existe|existem|existindo|presente|presentes|aumenta|aumentam|aumentando|cresce|crescem|crescendo|permanecem)\b/.test(n);
  }
  function hasNegativePresence(u){
    const n=u.norm;return /\b(não|nao|sem|ausente|ausentes|falta|faltam|não estão presentes|nao estao presentes)\b/.test(n);
  }
  function sharedAnaphoricTarget(a,b,discourseCoref){
    const ca=discourseCoref.find(x=>x.unit===a.id),cb=discourseCoref.find(x=>x.unit===b.id);
    if(ca&&cb&&ca.antecedentUnits.some(x=>cb.antecedentUnits.includes(x)))return true;
    const common=['estas coisas','essas coisas','tais coisas','isso','isto'].filter(x=>a.norm.includes(x)&&b.norm.includes(x));
    return common.length>0;
  }

  function epistemicAndTemporal(unit,state){
    const modal=unit.morph.filter(t=>t.features.includes('modal')).map(t=>t.norm);const cognitive=unit.morph.filter(t=>t.features.includes('cognition')).map(t=>t.lemma);const neg=unit.morph.some(t=>t.features.includes('negation'));
    const ep=[];
    if(modal.some(x=>['talvez','possivelmente','provavelmente','aparentemente','presumivelmente'].includes(x)))ep.push({kind:'possibility/probability',confidence:.90});
    if(modal.some(x=>['certamente','necessariamente','evidentemente','realmente'].includes(x)))ep.push({kind:'asserted-certainty',confidence:.85});
    if(cognitive.length)ep.push({kind:'cognitive-state',confidence:.80,evidence:cognitive});
    if(neg&&cognitive.some(x=>x==='saber'||x==='conhecer'))ep.push({kind:'epistemic-limit',confidence:.91});
    const temp=[];if(unit.morph.some(t=>LX.POS.time.has(t.norm)))temp.push({kind:'explicit-time',confidence:.86});if(/\b(irá|ira|vai|ocorrerá|ocorrera|será|sera)\b/i.test(unit.text))temp.push({kind:'prospective',confidence:.88});if(/\b(foi|foram|fez|disse|respondeu|perguntou|ocorreu|chegou|saiu)\b/i.test(unit.text))temp.push({kind:'past',confidence:.84});
    unit.epistemic=ep;unit.temporal=temp;ep.forEach((e,i)=>state.assert({type:'epistemic',subject:`${unit.id}:${i}`,value:e.kind,confidence:e.confidence,sources:['semantics'],anchors:[unit.id]}));return {ep,temp};
  }

  function familyHits(unit){
    const generic=new Set(['ser','estar','ter','haver','ir','vir','poder','dever','fazer','dar','ficar']);
    const lemmas=unit.morph.filter(t=>['nounish','content','verb','proper'].includes(t.pos)&&!(t.pos==='verb'&&generic.has(norm(t.lemma)))).map(t=>norm(t.lemma));const out=[];
    for(const [id,fam] of Object.entries(LX.CONCEPT_FAMILIES)){const raw=lemmas.filter(l=>fam.words.has(l));if(raw.length)out.push({id,label:fam.label,hits:uniq(raw),occurrences:raw.length})}return out;
  }
  function conceptualAnalysis(units,schLinks,state){
    const perUnit=units.map(u=>({unit:u.id,families:familyHits(u)}));
    const familyMap=new Map();for(const u of perUnit)for(const f of u.families){let x=familyMap.get(f.id)||{id:f.id,label:f.label,hits:[],anchors:[],relations:0,transitions:0,occurrences:0};x.hits.push(...f.hits);x.anchors.push(u.unit);x.occurrences+=f.occurrences||f.hits.length;familyMap.set(f.id,x)}
    const entries=[...familyMap.values()].map(x=>{x.hits=uniq(x.hits);x.anchors=uniq(x.anchors);x.relations=schLinks.filter(l=>x.anchors.includes(l.from)||x.anchors.includes(l.to)).length;return x});
    // transformação: entre unidades e também no interior de uma unidade marcada por contraste/reformulação.
    for(const e of entries){
      for(const l of schLinks){if(['contrast','consequence','reformulation','comparison'].includes(l.type)&&e.anchors.includes(l.from)&&e.anchors.includes(l.to))e.transitions++}
      for(const uid of e.anchors){const u=units.find(x=>x.id===uid);if(u&&u.relations.some(r=>['contrast','reformulation','consequence'].includes(r.type))&&(e.occurrences||0)>=2)e.transitions++}
    }
    const total=Math.max(1,units.length);
    const familyCandidates=entries.map(e=>{
      const frequency=clamp((e.occurrences||e.hits.length)/4),dispersion=clamp(e.anchors.length/Math.max(2,total*.45)),relational=clamp(e.relations/5),transform=clamp(e.transitions/2);
      const salience=e.hits.length?e.hits.reduce((s,h)=>s+icfSupport(h),0)/e.hits.length:0;
      const score=clamp(.24*frequency+.25*dispersion+.18*relational+.23*transform+.10*salience);
      return {...e,score,kind:'family',icfSalience:salience};
    });
    const stop=new Set(['texto','passagem','coisa','forma','modo','parte','outro','outra','mesmo','mesma','qual','quem','onde','quando','porque','como','mais','menos','muito','muita','todo','toda','este','esta','esse','essa','aqui','ali']);
    const lexMap=new Map();
    units.forEach(u=>u.morph.forEach(t=>{if(!['nounish','proper','content'].includes(t.pos)||stop.has(t.norm)||t.norm.length<4||isVerbToken(t))return;let x=lexMap.get(t.norm)||{id:`lex:${t.norm}`,label:t.surface.toLowerCase(),hits:[],anchors:[],relations:0,transitions:0,kind:'lexical'};x.hits.push(t.norm);x.anchors.push(u.id);lexMap.set(t.norm,x)}));
    const lexicalCandidates=[...lexMap.values()].map(e=>{
      e.hits=uniq(e.hits);e.anchors=uniq(e.anchors);e.relations=schLinks.filter(l=>e.anchors.includes(l.from)||e.anchors.includes(l.to)).length;
      const occurrences=units.reduce((n,u)=>n+u.morph.filter(t=>t.norm===e.id.slice(4)).length,0),frequency=clamp(occurrences/3),dispersion=clamp(e.anchors.length/Math.max(2,total*.50)),relational=clamp(e.relations/4),salience=icfSupport(e.id.slice(4));
      e.icfSalience=salience;e.score=clamp(.34*frequency+.32*dispersion+.18*relational+.16*salience);return e;
    }).filter(e=>e.anchors.length>=2||e.score>=.48);
    const candidates=[...familyCandidates,...lexicalCandidates].sort((a,b)=>b.score-a.score);
    const accepted=[],rejected=[];for(const c of candidates){if(c.anchors.length&&c.score>=(c.kind==='lexical'?.46:.42)){accepted.push(c);state.assert({type:'concept',subject:c.id,value:c.label,confidence:c.score,sources:['prorelation','conceptual'],anchors:c.anchors})}else{rejected.push({...c,reason:'insufficient convergence'});state.reject({type:'concept-candidate',subject:c.id,value:c.label,confidence:c.score,sources:['prorelation'],anchors:c.anchors},'insufficient convergence')}}
    return {perUnit,candidates,accepted,rejected};
  }

  function schesitomeric(units,state,discourseCoref=[]){
    const links=[];const add=(from,to,type,confidence,basis,meta={})=>{const l={id:`S${links.length+1}`,from,to,type,confidence,basis,...meta};links.push(l);state.assert({type:'schesis',subject:l.id,value:{from,to,type},confidence,sources:['schesitomeric'],anchors:[from,to]})};
    units.forEach((u,i)=>{
      const prev=units[i-1],next=units[i+1];
      // Uma relação interna (“X, mas Y”) não é automaticamente promovida a U(i-1) → Ui.
      // Apenas marcadores que abrem a unidade atual podem funcionar como ponte explícita com a anterior.
      if(prev){for(const r of u.relations){if(r.scope==='cross-unit-candidate'&&['contrast','concession','cause','consequence','reformulation','addition','temporal','comparison','condition','purpose'].includes(r.type))add(prev.id,u.id,r.type,Math.min(.96,r.confidence),r.marker,{scope:'interunit'})}}
      if(next&&u.relations.some(r=>r.type==='presentation'))add(u.id,next.id,'presentation',.96,'cataphora',{scope:'interunit'});
      const dc=discourseCoref.find(x=>x.unit===u.id);
      if(dc)for(const ant of dc.antecedentUnits)add(ant,u.id,'anaphoric-resumption',dc.confidence,dc.expression,{terms:dc.terms,scope:'interunit'});
      if(prev){
        const a=new Set(prev.frames.flatMap(f=>[f.subject?.norm,f.object?.norm]).filter(Boolean));const b=new Set(u.frames.flatMap(f=>[f.subject?.norm,f.object?.norm]).filter(Boolean));const common=[...a].filter(x=>b.has(x));if(common.length)add(prev.id,u.id,'referential-continuity',.68,common.join(', '),{scope:'interunit'});
        const prevFrameMap=new Map(),curFrameMap=new Map();
        prev.frames.forEach(f=>(f.semanticFrames||[]).forEach(x=>{if(x.support>=.60)prevFrameMap.set(x.frame,{lemma:x.lemma,support:x.support})}));
        u.frames.forEach(f=>(f.semanticFrames||[]).forEach(x=>{if(x.support>=.60)curFrameMap.set(x.frame,{lemma:x.lemma,support:x.support})}));
        const sharedFrames=[...prevFrameMap.keys()].filter(x=>curFrameMap.has(x));
        if(sharedFrames.length){
          const reliable=sharedFrames.filter(fr=>{const p=prevFrameMap.get(fr),c=curFrameMap.get(fr);return Math.min(p.support,c.support)>=.60 && (!['ser','estar','ter','haver','ir','poder','dever','fazer','dar','ficar'].includes(p.lemma)||p.lemma!==c.lemma)});
          if(reliable.length)add(prev.id,u.id,'frame-continuity',.70,reliable.slice(0,3).join(', '),{scope:'interunit'});
        }
        if(sharedAnaphoricTarget(prev,u,discourseCoref)&&((hasPositivePresence(prev)&&hasNegativePresence(u))||(hasNegativePresence(prev)&&hasPositivePresence(u))))add(prev.id,u.id,'presence-absence-contrast',.94,'mesmo referente sob presença/ausência',{scope:'interunit'});
        const sharedPredicate=prev.frames.find(f=>f.verb&&u.frames.some(g=>g.verb?.lemma===f.verb.lemma));
        if(sharedPredicate&&prev.frames.some(f=>f.negated)!==u.frames.some(f=>f.negated))add(prev.id,u.id,'polarity-contrast',.88,sharedPredicate.verb.lemma,{scope:'interunit'});
        // Paralelismo: duas unidades podem compartilhar a mesma organização interna sem que o “mas” de uma
        // estabeleça uma relação externa com a outra.
        const pInternal=new Set(prev.relations.filter(r=>r.scope==='intraunit').map(r=>r.type));
        const uInternal=new Set(u.relations.filter(r=>r.scope==='intraunit').map(r=>r.type));
        const sharedInternal=[...pInternal].filter(x=>uInternal.has(x)&&['contrast','comparison','cause','purpose','concession'].includes(x));
        if(sharedInternal.length)add(prev.id,u.id,'structural-parallelism',.72,`paralelismo interno: ${sharedInternal.slice(0,2).join(', ')}`,{scope:'interunit',parallelRelations:sharedInternal});
        const hasExplicitCross=links.some(l=>l.from===prev.id&&l.to===u.id&&l.type!=='linear-progression');
        if(!hasExplicitCross&&!dc)add(prev.id,u.id,'linear-progression',.42,'adjacency',{scope:'interunit'});
      }
    });return links;
  }

  function equideque(units,state){
    return units.map(u=>{
      const deform={predicates:u.frames.filter(f=>f.verb).map(f=>({subject:f.subject?.text||null,verb:f.verb.lemma,object:f.object?.text||null,negated:f.negated,modals:f.modals})),relations:u.relations.map(r=>({type:r.type,marker:r.marker})),epistemic:u.epistemic,temporal:u.temporal};
      const literal=[];for(const t of u.morph){
        const key=norm(t.lemma),entry=LX.WORDS[key]||LX.WORDS[t.norm],external=extLex(key)||extLex(t.norm);
        if((entry||external?.definitions?.length)&&!literal.some(x=>x.lemma===key))literal.push({surface:t.surface,lemma:key,definitions:entry?.defs||external.definitions||[],synonyms:entry?.syn||[],source:entry?'interno':'dicionario-drive'});
      }
      const possible=[];
      if(u.epistemic.some(e=>e.kind==='possibility/probability'))possible.push({kind:'modal-distinction',value:{asserted:false,scope:'proposition'},confidence:.91,anchors:[u.id]});
      if(u.relations.some(r=>r.type==='contrast'))possible.push({kind:'restriction',value:{relation:'contrast'},confidence:.86,anchors:[u.id]});
      if(u.relations.some(r=>r.type==='cause'))possible.push({kind:'causal-link',value:{relation:'cause'},confidence:.87,anchors:[u.id]});
      if(u.relations.some(r=>r.type==='consequence'))possible.push({kind:'inferential-link',value:{relation:'consequence'},confidence:.87,anchors:[u.id]});
      if(u.frames.some(f=>f.negated))possible.push({kind:'negative-scope',value:{negation:true},confidence:.84,anchors:[u.id]});
      const affirmed=[];for(const p of possible){if(p.confidence>=.78){affirmed.push(p);state.assert({type:'derived',subject:`${u.id}:${p.kind}`,value:p.value,confidence:p.confidence,sources:['equideque'],anchors:p.anchors})}else state.reject({type:'possible-derivation',subject:`${u.id}:${p.kind}`,value:p.value,confidence:p.confidence,sources:['equideque'],anchors:p.anchors},'weak local confirmation')}
      return {unit:u.id,deform,literal,possible,affirmed};
    });
  }

  function integrateComments(comments,units,state){
    return (comments||[]).map((c,i)=>{const txt=norm(c.text),meta=/\b(verbo|substantivo|adjetivo|conjugacao|gramatica|sintaxe|morfologia|classe)\b/.test(txt);const classification=c.role==='author'&&!meta?'author-intention':c.role==='author'?'author-metalinguistic':'commentator-hypothesis';const weight=classification==='author-intention'?.94:classification==='author-metalinguistic'?.50:.65;const q=norm(c.quote);const anchors=q?units.filter(u=>u.norm.includes(q.slice(0,Math.min(50,q.length)))||q.includes(u.norm.slice(0,Math.min(50,u.norm.length)))).map(u=>u.id):[];const item={id:`C${i+1}`,...c,classification,weight,anchors};state.provenance.push({type:'human-comment',subject:item.id,value:c.text,confidence:weight,sources:[c.role],anchors,operation:'human-input'});return item});
  }

  function detectGenre(text,units,userGenre='auto'){
    if(userGenre&&userGenre!=='auto')return {genre:userGenre,confidence:1,basis:['user']};const n=norm(text),sc={narrativa:0,argumentativo:0,expositivo:0,didatico:0,poetico:0,epistolar:0};
    if(/\b(disso|então|entao|depois|no dia seguinte|respondeu|perguntou|disse)\b/.test(n))sc.narrativa+=2;if(/["“”]/.test(text))sc.narrativa++;
    if(/\b(portanto|logo,|porque|conclui-se|segue-se|tese|argumento|por isso mesmo)\b/.test(n))sc.argumentativo+=2;
    if(/\b(isto é|ou seja|em outras palavras|define-se|significa|consiste|refere-se|é o processo|e o processo|depende de|ocorre em)\b/.test(n))sc.expositivo+=2;
    if(/\b(primeiro|segundo|passo|deve-se|faça|faca|observe)\b/.test(n))sc.didatico+=2;
    const lines=text.split('\n').filter(x=>x.trim());if(lines.length>=5&&lines.filter(x=>x.trim().length<70).length>lines.length*.6)sc.poetico+=2;
    if(/\b(caro|amada|saudações|saudacoes|escrevo|vos escrevo|irmãos|irmaos|amados)\b/.test(n))sc.epistolar+=2;
    if(/\bgraça e paz\b|\bgraca e paz\b/.test(n))sc.epistolar+=2;
    if(/\baos que\b|\bàs igrejas\b|\bas igrejas\b/.test(n))sc.epistolar+=1;
    if(/\b(apóstolo|apostolo|servo)\b/.test(n)&&/\b(aos|às|as)\b/.test(n))sc.epistolar+=1;
    const [genre,value]=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0];return {genre:value?genre:'indeterminado',confidence:value?clamp(.52+.09*value):.35,basis:Object.entries(sc).filter(x=>x[1]).map(x=>`${x[0]}:${x[1]}`)};
  }

  function contentLemmaSet(unit){
    const stop=new Set(['coisa','coisas','texto','passagem','forma','modo','parte','mesmo','mesma','outro','outra','senhor','jesus','cristo']);
    return new Set(unit.morph.filter(t=>['nounish','content','proper'].includes(t.pos)&&!isVerbToken(t)&&!stop.has(t.norm)&&t.norm.length>3).map(t=>t.norm));
  }
  function setSimilarity(a,b){
    if(!a.size||!b.size)return 0;let common=0;for(const x of a)if(b.has(x))common++;return common/Math.max(1,new Set([...a,...b]).size);
  }
  function unitRhetoricalRole(unit){
    const rel=new Set(unit.relations.map(r=>r.type)),n=unit.norm;
    const imperative=unit.modality==='imperative'||unit.morph.some(t=>t.pos==='verb'&&LX.POS.obligation.has(t.lemma));
    const question=unit.modality==='interrogative';
    const listContinuation=/^\s*(com|e com|à|ao|a)\b/i.test(unit.analysisText)&&unit.frames.filter(f=>f.verb).length<=1;
    const resultish=/\b(resultado|fruto|frutif|produz|produzem|fazem com que|faz com que|torna|tornam|leva a|conduz a|impede|impedem)\b/.test(n)||unit.morph.some(t=>LX.POS.evaluation.has(t.norm));
    if(question)return'problem';
    if(imperative)return'development';
    if(listContinuation)return'list-continuation';
    if(resultish||rel.has('presence-absence-contrast'))return'outcome';
    if(rel.has('contrast')||rel.has('concession'))return'contrast';
    if(rel.has('consequence'))return'consequence';
    if(rel.has('cause'))return'reason';
    if(rel.has('reformulation'))return'explanation';
    return'foundation';
  }
  function beginsWithRelation(unit,type){
    const r=unit.relations.find(x=>x.type===type);if(!r)return false;
    const txt=norm(unit.analysisText);return txt.startsWith(norm(r.marker))||new RegExp(`^${norm(r.marker).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(txt);
  }
  function boundaryScore(prev,cur,currentBlock,schLinks,discourseCoref){
    let score=0;const prevRole=unitRhetoricalRole(prev),curRole=unitRhetoricalRole(cur);
    const rels=schLinks.filter(l=>l.from===prev.id&&l.to===cur.id).map(l=>l.type);
    const sim=setSimilarity(contentLemmaSet(prev),contentLemmaSet(cur));
    if(prev.paragraph!==cur.paragraph)score+=.24;
    if(curRole==='development'&&prevRole!=='development'&&prevRole!=='list-continuation')score+=.52;
    if(curRole==='outcome'&&currentBlock.some(u=>unitRhetoricalRole(u)==='development'||unitRhetoricalRole(u)==='list-continuation'))score+=.48;
    if(curRole==='problem'&&prevRole!=='problem')score+=.40;
    if(curRole==='contrast'&&sim<.38)score+=.32;
    if(beginsWithRelation(cur,'consequence')&&curRole!==prevRole)score+=.28;
    if(beginsWithRelation(cur,'cause')&&curRole==='outcome'&&currentBlock.some(u=>unitRhetoricalRole(u)==='development'))score+=.24;
    if(curRole==='list-continuation')score-=.55;
    if(rels.includes('anaphoric-resumption'))score-=.25;
    if(rels.includes('referential-continuity'))score-=.12;
    if(rels.includes('presence-absence-contrast'))score-=.18;
    if(rels.includes('cause')&&curRole==='reason'&&prevRole!=='development')score-=.10;
    if(sim>.45)score-=.12;
    return clamp(score,-1,1);
  }
  function dominant(items){
    const count=new Map();for(const x of items.filter(Boolean))count.set(x,(count.get(x)||0)+1);
    return [...count.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  }
  function macroFunction(block,index,total){
    const roles=block.flatMap(u=>[unitRhetoricalRole(u)]);
    if(roles.includes('problem'))return'problem';
    if(roles.includes('development')||roles.includes('list-continuation'))return'development';
    if(roles.includes('outcome')||block.some(u=>u.norm.includes('infrut')||u.norm.includes('resultado')))return'outcome';
    if(roles.includes('contrast'))return'contrast';
    if(index===total-1&&roles.includes('consequence'))return'conclusion';
    if(index===0)return'foundation';
    if(roles.includes('reason'))return'explanation';
    return'development';
  }
  function blockKeyTerms(block){
    const map=new Map(),stop=new Set(['coisa','coisas','texto','passagem','mesmo','mesma','outro','outra','jesus','cristo','deus','senhor','servo','apostolo','apóstolo','proprio','próprio','propria','própria','pleno','toda','todo','todas','todos']);
    block.forEach(u=>u.morph.forEach(t=>{
      if(!['nounish','content'].includes(t.pos)||isVerbToken(t)||stop.has(t.norm))return;
      const known=Boolean(LX.WORDS[t.norm]||extLex(t.norm));
      if(t.norm.length<4&&!known)return;
      const tags=t.externalTags||[];
      if(tags.includes('ADJ')&&!tags.some(x=>['N','Nm','Nf'].includes(x)))return;
      let familyBoost=0;for(const fam of Object.values(LX.CONCEPT_FAMILIES))if(fam.words.has(t.norm)){familyBoost=.45;break}
      // Formas apenas descritivas/adjetivais não viram automaticamente termo-chave.
      // Em modo sem dicionário externo, "content" precisa de suporte lexical ou conceitual.
      if(t.pos==='content'&&!known&&!familyBoost)return;
      const dictionaryBoost=known?.35:0;
      const v=(map.get(t.norm)||{term:t.surface,count:0,salience:icfSupport(t.norm),familyBoost,dictionaryBoost});v.count++;map.set(t.norm,v);
    }));
    return [...map.values()].sort((a,b)=>(b.count+.35*b.salience+b.familyBoost+b.dictionaryBoost)-(a.count+.35*a.salience+a.familyBoost+a.dictionaryBoost)).slice(0,8).map(x=>x.term);
  }
  function blockPredicates(block){
    const map=new Map();block.forEach(u=>u.frames.forEach(f=>{if(!f.verb)return;const l=f.verb.lemma;if(['ser','estar','ter','haver','ir'].includes(l)&&f.auxiliaries?.length)return;let x=map.get(l)||{lemma:l,count:0,subjects:[],objects:[]};x.count++;if(f.subject?.text)x.subjects.push(f.subject.text);if(f.object?.text)x.objects.push(f.object.text);map.set(l,x)}));
    return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,6).map(x=>({...x,subjects:uniq(x.subjects).slice(0,4),objects:uniq(x.objects).slice(0,4)}));
  }
  function macroArgumentation(units,schLinks,discourseCoref,state){
    if(!units.length)return{blocks:[],relations:[],pattern:[],confidence:0};
    const groups=[];let current=[units[0]];
    for(let i=1;i<units.length;i++){
      const prev=units[i-1],cur=units[i],score=boundaryScore(prev,cur,current,schLinks,discourseCoref);
      // textos muito curtos permanecem unidos; em textos maiores, o limiar privilegia mudanças funcionais reais.
      const threshold=units.length<=3?.62:.40;
      if(score>=threshold&&current.length){groups.push(current);current=[cur]}else current.push(cur);
    }
    if(current.length)groups.push(current);
    // Evita fragmentação excessiva: blocos unitários sem mudança forte são reunidos ao vizinho.
    for(let i=1;i<groups.length-1;i++){
      if(groups[i].length===1){
        const u=groups[i][0],role=unitRhetoricalRole(u);
        if(!['development','outcome','problem','contrast'].includes(role)){
          groups[i-1].push(u);groups.splice(i,1);i--;
        }
      }
    }
    const blocks=groups.map((g,i)=>{
      const fn=macroFunction(g,i,groups.length),predicates=blockPredicates(g),keyTerms=blockKeyTerms(g),modalities=uniq(g.map(u=>u.modality)),negated=g.some(u=>u.frames.some(f=>f.negated));
      const unitIds=g.map(u=>u.id),internalRelations=schLinks.filter(l=>unitIds.includes(l.from)&&unitIds.includes(l.to)).map(l=>l.type);const block={id:`B${i+1}`,index:i+1,unitIds,function:fn,predicates,keyTerms,modalities,negated,internalRelations:uniq(internalRelations),sourceStart:g[0].text,sourceEnd:g[g.length-1].text,confidence:clamp(.66+.05*Math.min(g.length,4))};
      state.assert({type:'macro-block',subject:block.id,value:{function:fn,unitIds:block.unitIds,predicates:predicates.map(p=>p.lemma),keyTerms,internalRelations:block.internalRelations},confidence:block.confidence,sources:['macroargumentation'],anchors:block.unitIds});
      return block;
    });
    const relations=[];
    for(let i=1;i<blocks.length;i++){
      const prev=blocks[i-1],cur=blocks[i];
      const crossing=schLinks.filter(l=>prev.unitIds.includes(l.from)&&cur.unitIds.includes(l.to)).sort((a,b)=>b.confidence-a.confidence);
      let type=crossing[0]?.type||'development',basis=crossing[0]?.basis||'mudança funcional';
      let semantic=type;
      if(type==='consequence'&&cur.function==='development')semantic='foundation-to-response';
      else if(type==='cause'&&prev.function==='development'&&cur.function==='outcome')semantic='justification-by-outcome';
      else if(['presence-absence-contrast','polarity-contrast'].includes(type))semantic='alternative-outcomes';
      else if(type==='cause')semantic='explanation-or-ground';
      else if(type==='contrast')semantic='restriction-or-opposition';
      else if(type==='consequence')semantic='result-or-consequence';
      const r={id:`MR${i}`,from:prev.id,to:cur.id,type,semantic,basis,confidence:crossing[0]?.confidence||.64,anchors:[...prev.unitIds.slice(-1),...cur.unitIds.slice(0,1)]};
      relations.push(r);state.assert({type:'macro-relation',subject:r.id,value:{from:r.from,to:r.to,type:r.type,semantic:r.semantic},confidence:r.confidence,sources:['macroargumentation','schesitomeric'],anchors:r.anchors});
    }
    const pattern=blocks.map(b=>b.function);
    const confidence=blocks.length?clamp(blocks.reduce((s,b)=>s+b.confidence,0)/blocks.length*.65+(relations.length?relations.reduce((s,r)=>s+r.confidence,0)/relations.length*.35:.25)):0;
    return {blocks,relations,pattern,confidence};
  }
  function conceptRoleInUnit(unit,concept){
    const hits=new Set((concept.hits||[]).map(norm));
    const tokenIndexes=unit.morph.map((t,i)=>hits.has(norm(t.lemma))||hits.has(t.norm)?i:-1).filter(i=>i>=0);
    if(!tokenIndexes.length)return null;
    for(const i of tokenIndexes){
      let prep='';
      for(let j=i-1;j>=Math.max(0,i-3);j--){
        const t=unit.morph[j];
        if(t.pos==='preposition'){prep=t.norm;break}
        if(t.pos==='verb'||t.pos==='punct')break;
      }
      if(['por','pelo','pela','pelos','pelas','mediante'].includes(prep))return'meio ou fundamento';
      if(['para','à','ao'].includes(prep))return'finalidade ou direção';
      if(['em','no','na','nos','nas'].includes(prep))return'domínio ou esfera';
      if(['com'].includes(prep))return'associação ou componente';
      if(['de','do','da','dos','das'].includes(prep))return'especificação ou origem';
    }
    const asSubject=unit.frames.some(f=>f.subject&&tokenIndexes.some(i=>unit.morph[i]&&norm(f.subject.text).includes(unit.morph[i].norm)));
    if(asSubject)return'tema ou participante da predicação';
    const asObject=unit.frames.some(f=>f.object&&tokenIndexes.some(i=>unit.morph[i]&&norm(f.object.text).includes(unit.morph[i].norm)));
    if(asObject)return'alvo ou complemento da predicação';
    return'elemento do desenvolvimento';
  }
  function promoteConceptsByMacro(concepts,macro,state){
    const blockByUnit={};(macro.blocks||[]).forEach(b=>b.unitIds.forEach(u=>blockByUnit[u]=b.id));
    const enriched=concepts.accepted.map(c=>{
      const macroAnchors=uniq(c.anchors.map(u=>blockByUnit[u]).filter(Boolean));
      const representative=(c.hits&&c.hits.length?c.hits[0]:c.label);
      const macroSpan=macroAnchors.length;
      const macroScore=clamp((macroSpan-1)/Math.max(1,(macro.blocks||[]).length-1));
      const thematicScore=clamp(.58*c.score+.42*macroScore);
      return {...c,representative,macroAnchors,macroSpan,thematicScore};
    });
    const thematic=enriched.filter(c=>c.kind==='family'&&c.macroSpan>=2&&c.thematicScore>=.48).sort((a,b)=>b.thematicScore-a.thematicScore);
    const supporting=enriched.filter(c=>!thematic.some(t=>t.id===c.id));
    thematic.forEach(c=>state.assert({type:'macro-concept',subject:c.id,value:{label:c.label,macroAnchors:c.macroAnchors},confidence:c.thematicScore,sources:['macroargumentation','prorelation'],anchors:c.anchors}));
    return {...concepts,accepted:enriched,thematic,supporting};
  }

  function transformations(units,concepts,schLinks,state,macro){
    const out=[];const pool=(concepts.thematic?.length?concepts.thematic:concepts.accepted.filter(c=>c.kind==='family'));
    const blockOf={};(macro?.blocks||[]).forEach(b=>b.unitIds.forEach(u=>blockOf[u]=b.id));
    for(const c of pool){
      const occurrences=units.filter(u=>c.anchors.includes(u.id)).map(u=>({unit:u,block:blockOf[u.id],role:conceptRoleInUnit(u,c)})).filter(x=>x.block);
      for(let i=1;i<occurrences.length;i++){
        const prev=occurrences[i-1],cur=occurrences[i];
        if(prev.role===cur.role)continue;
        const between=schLinks.find(l=>l.from===prev.unit.id&&l.to===cur.unit.id)||schLinks.find(l=>l.from===prev.unit.id)||null;
        const roleChanged=prev.role&&cur.role&&prev.role!==cur.role;
        const macroChanged=prev.block!==cur.block;
        if(!roleChanged&&!macroChanged&&!between)continue;
        const tr={id:`T${out.length+1}`,concept:c.representative||c.label,from:prev.unit.id,to:cur.unit.id,fromBlock:prev.block,toBlock:cur.block,fromRole:prev.role||'uso anterior',toRole:cur.role||'uso posterior',relation:between?.type||'macro-development',confidence:clamp(.48*c.thematicScore+.32*(between?.confidence||.65)+.20*(roleChanged?1:.55)),evidence:[between?.basis||'mudança entre blocos',prev.role||'',cur.role||''].filter(Boolean)};
        out.push(tr);state.assert({type:'transformation',subject:tr.id,value:{concept:tr.concept,fromRole:tr.fromRole,toRole:tr.toRole,relation:tr.relation},confidence:tr.confidence,sources:['meditatio','macroargumentation'],anchors:[prev.unit.id,cur.unit.id]});
      }
    }return out;
  }

  function retrointerpret(units,genre,concepts,state){
    const out=[];if(units.length<2)return out;const last=units[units.length-1];
    const closureMarkers=/^(assim|portanto|logo|em suma|concluindo|por fim|dessa forma)/i.test(last.text)||last.relations.some(r=>['consequence','reformulation'].includes(r.type));
    if(closureMarkers){const top=(concepts.thematic&&concepts.thematic[0])||concepts.accepted[0];const item={id:'RT1',from:last.id,to:units[0].id,kind:'closure-to-opening',concept:top?.label||null,confidence:.82,anchors:[units[0].id,last.id]};out.push(item);state.assert({type:'retrointerpretation',subject:item.id,value:{kind:item.kind,concept:item.concept},confidence:item.confidence,sources:['retrointerpretation'],anchors:item.anchors})}
    if(genre.genre==='narrativa'&&last.frames.length){const item={id:`RT${out.length+1}`,from:last.id,to:units.slice(0,-1).map(u=>u.id).join(','),kind:'narrative-closure',concept:(concepts.thematic&&concepts.thematic[0]?.label)||concepts.accepted[0]?.label||null,confidence:.72,anchors:[last.id]};out.push(item)}return out;
  }

  function argumentMap(units,schLinks,state){
    const nodes=[];units.forEach(u=>u.frames.forEach(f=>{if(!f.verb)return;const epistemic=u.epistemic.some(e=>e.kind==='possibility/probability')?'H':u.epistemic.some(e=>e.kind==='asserted-certainty')?'D':'I';nodes.push({id:f.id,unit:u.id,subject:f.subject?.text||null,verb:f.verb.lemma,object:f.object?.text||null,negated:f.negated,epistemic,sourceText:f.text})}));
    const edges=schLinks.filter(l=>l.type!=='linear-progression').map(l=>({from:l.from,to:l.to,relation:l.type,confidence:l.confidence}));return {nodes,edges};
  }

  function contentPlan(analysis){
    const sections=[];const add=(id,title,items)=>{if(items&&items.length)sections.push({id,title,items})};
    const overview=[{kind:'overview',subject:'text',predicate:'genre-structure',data:{genre:analysis.genre.genre,paragraphs:analysis.paragraphs.length,units:analysis.units.length,macroBlocks:analysis.macro.blocks.length,macroPattern:analysis.macro.pattern,macroConfidence:analysis.macro.confidence},relation:null,epistemic:'D',anchors:analysis.units.slice(0,1).map(u=>u.id)}];
    const relSummary=uniq(analysis.macro.relations.map(r=>r.type).concat(analysis.units.flatMap(u=>u.relations.map(r=>r.type)))).filter(x=>!['government','linear-progression'].includes(x));
    if(relSummary.length)overview.push({kind:'relation-summary',subject:'text',predicate:'relations',data:{relations:relSummary},relation:'addition',epistemic:'D',anchors:analysis.units.filter(u=>u.relations.length).map(u=>u.id)});
    add('overview','Leitura do conjunto',overview);

    const macroItems=analysis.macro.blocks.map((b,i)=>({kind:'macro-block',subject:b.id,predicate:b.function,data:b,relation:i?analysis.macro.relations[i-1]?.type:null,epistemic:b.confidence>=.72?'D':'I',anchors:b.unitIds}));
    add('macro','Grandes partes do desenvolvimento',macroItems);
    const macroRel=analysis.macro.relations.map(r=>({kind:'macro-relation',subject:r.from,predicate:r.semantic,data:r,relation:r.type,epistemic:r.confidence>=.75?'D':'I',anchors:r.anchors}));
    add('macro-relations','Como as partes se conectam',macroRel);

    // Progressão local fica disponível para o relatório apenas quando o texto é curto ou a macroestrutura é pouco segura.
    if(analysis.units.length<=6||analysis.macro.confidence<.58){
      const progression=analysis.units.map(u=>({kind:'unit-meaning',subject:bestSubject(u,analysis.entities,analysis.coreference),predicate:'unit-content',data:{unit:u.id,source:u.text,frames:u.frames,relations:u.relations,epistemic:u.epistemic,temporal:u.temporal},relation:u.relations[0]?.type||'addition',epistemic:u.epistemic.some(e=>e.kind==='possibility/probability')?'H':'D',anchors:[u.id]}));
      add('progression','Progressão local',progression);
    }

    const thematic=(analysis.concepts.thematic||[]).slice(0,5);
    const supporting=analysis.concepts.accepted.filter(c=>c.kind==='family'&&!thematic.some(t=>t.id===c.id)).slice(0,4);
    const conceptItems=thematic.map((c,i)=>({kind:'concept',subject:c.label,predicate:'macro-concept',data:{label:c.label,representative:c.representative||c.hits?.[0]||c.label,hits:c.hits,score:c.thematicScore||c.score,anchors:c.anchors,macroAnchors:c.macroAnchors||[],rank:i+1,kind:c.kind},relation:i?'addition':null,epistemic:(c.thematicScore||c.score)>=.65?'D':'I',anchors:c.anchors}));
    add('concepts','Conceitos que atravessam o desenvolvimento',conceptItems);
    const supportingItems=supporting.map((c,i)=>({kind:'supporting-concept',subject:c.label,predicate:'supporting-role',data:{label:c.label,hits:c.hits,score:c.score,anchors:c.anchors,macroAnchors:c.macroAnchors||[]},relation:i?'addition':null,epistemic:'I',anchors:c.anchors}));
    add('supporting','Conceitos auxiliares',supportingItems);

    const lexical=analysis.concepts.accepted.filter(c=>c.kind==='lexical').slice(0,5);
    const topics=lexical.map((c,i)=>({kind:'topic',subject:c.label,predicate:'lexical-topic',data:{label:c.label,score:c.score,anchors:c.anchors,rank:i+1},relation:i?'addition':null,epistemic:'I',anchors:c.anchors}));
    add('topics','Assuntos lexicais recorrentes',topics);

    const crossTransformations=analysis.transformations.filter(t=>t.fromBlock!==t.toBlock);const transformationSource=crossTransformations.length?crossTransformations:analysis.transformations;const trs=transformationSource.map(t=>({kind:'transformation',subject:t.concept,predicate:'changes-role',data:t,relation:t.relation,epistemic:t.confidence>=.72?'I':'H',anchors:[t.from,t.to]}));
    add('transformations','Transformações conceituais',trs);

    const anaphora=(analysis.discourseCoreference||[]).map(x=>({kind:'anaphora',subject:x.expression,predicate:'resumes-complex-antecedent',data:x,relation:'resumption',epistemic:x.confidence>=.82?'D':'I',anchors:[...x.antecedentUnits,x.unit]}));
    add('anaphora','Retomadas e correferências do discurso',anaphora);

    const confirmed=analysis.equideque.flatMap(e=>e.affirmed.map(x=>({kind:'confirmed',subject:e.unit,predicate:x.kind,data:x,relation:'addition',epistemic:'I',anchors:x.anchors})));
    analysis.schLinks.filter(l=>['presence-absence-contrast','polarity-contrast','anaphoric-resumption'].includes(l.type)).forEach(l=>confirmed.push({kind:'confirmed',subject:l.from,predicate:l.type==='presence-absence-contrast'?'presence-absence':l.type==='polarity-contrast'?'polarity-opposition':'anaphoric-link',data:l,relation:l.type,epistemic:l.confidence>=.85?'D':'I',anchors:[l.from,l.to]}));
    add('confirmed','Sentidos confirmados',confirmed);
    const retro=analysis.retro.map(r=>({kind:'retro',subject:'closure',predicate:'reframes-earlier',data:r,relation:'resumption',epistemic:'I',anchors:r.anchors}));add('retro','Retorno do todo às partes',retro);
    const human=analysis.comments.map(c=>({kind:'human-comment',subject:c.role,predicate:c.classification,data:c,relation:'addition',epistemic:c.classification==='author-intention'?'D':'H',anchors:c.anchors}));add('human','Comentários humanos',human);

    const synthesis=[{kind:'synthesis',subject:'macro-composition',predicate:'dominant-interpretation',data:{macro:analysis.macro,concepts:thematic.slice(0,3),transformations:analysis.transformations,anaphora:analysis.discourseCoreference||[],argument:analysis.argument},relation:'composition',epistemic:analysis.macro.confidence>=.72?'I':'H',anchors:analysis.units.map(u=>u.id)}];
    add('synthesis','Síntese interpretativa',synthesis);
    add('limits','Limites da afirmação',[{kind:'limit',subject:'interpretation',predicate:'limits',data:{noPrescription:true,noPsychologyFromSyntax:true,noThemeFromFrequency:true,noUnsupportedConcepts:true,noFrameWithoutContext:true},relation:null,epistemic:'D',anchors:[]}]);
    return {sections};
  }
  function bestSubject(unit,entities,coref){
    const f=unit.frames.find(x=>x.subject);if(!f)return null;if(f.subject.kind==='pronoun'){const c=coref.find(x=>x.unit===unit.id&&norm(x.pronoun)===norm(f.subject.text));return c?c.entity:f.subject.text}return f.subject.text;
  }

  function robustness(a){
    const facts=a.state.list(),anchored=facts.filter(f=>f.anchors?.length).length;const anchoring=facts.length?anchored/facts.length:0;const conflicts=a.state.conflicts.length;const unsupported=a.concepts.accepted.filter(c=>!c.anchors.length).length;const corefAmbig=a.coreference.filter(c=>c.confidence<.65).length;const score=clamp(.48*anchoring+.20*(conflicts?Math.max(0,1-conflicts/Math.max(1,facts.length)):1)+.20*(unsupported?0:1)+.12*(corefAmbig?Math.max(0,1-corefAmbig/Math.max(1,a.coreference.length)):1));return {score,facts:facts.length,anchoring,conflicts,rejected:a.state.rejected.length,unsupported,coreferenceAmbiguities:corefAmbig};
  }

  function analyze(text,options={},comments=[]){
    if(!String(text||'').trim())throw new Error('Texto vazio.');
    const state=new SemanticState(),seg=segment(text),units=seg.units;
    units.forEach(u=>morphology(u,state));
    const frameList=frames(units,state);
    units.forEach(u=>relations(u,state));
    units.forEach(u=>epistemicAndTemporal(u,state));
    const entities=entityCandidates(units,state);
    const coref=coreference(units,entities,state);
    const discourseCoref=discourseCoreference(units,state);
    const schLinks=schesitomeric(units,state,discourseCoref);
    const eq=equideque(units,state);
    const integratedComments=integrateComments(comments,units,state);
    let concepts=conceptualAnalysis(units,schLinks,state);
    const macro=macroArgumentation(units,schLinks,discourseCoref,state);
    concepts=promoteConceptsByMacro(concepts,macro,state);
    const transformationsList=transformations(units,concepts,schLinks,state,macro);
    const genre=detectGenre(text,units,options.genre||'auto');
    const retro=retrointerpret(units,genre,concepts,state);
    const argument=argumentMap(units,schLinks,state);
    const analysis={version:'Hermeneia 5.0 · Microkernel remoto',createdAt:new Date().toISOString(),title:options.title||'Sem título',options,sourceText:text,paragraphs:seg.paragraphs,units,frames:frameList,entities,coreference:coref,discourseCoreference:discourseCoref,schLinks,equideque:eq,comments:integratedComments,concepts,macro,transformations:transformationsList,genre,retro,argument,state,resources:getExternalResources()};
    analysis.plan=contentPlan(analysis);analysis.robustness=robustness(analysis);return analysis;
  }


  const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
  async function analyzeAsync(text,options={},comments=[],progress){
    if(!String(text||'').trim())throw new Error('Texto vazio.');
    const step=async(label,p)=>{if(typeof progress==='function')progress(label,p);await yieldUI()};
    const state=new SemanticState();
    await step('Segmentando o texto',.05);const seg=segment(text),units=seg.units;
    await step('Classificando morfologia',.14);for(let i=0;i<units.length;i++){morphology(units[i],state);if(i%5===4)await yieldUI()}
    await step('Construindo predicações e valência',.25);const frameList=frames(units,state);
    await step('Detectando relações explícitas',.34);units.forEach(u=>relations(u,state));units.forEach(u=>epistemicAndTemporal(u,state));
    await step('Resolvendo referenciação',.44);const entities=entityCandidates(units,state),coref=coreference(units,entities,state),discourseCoref=discourseCoreference(units,state);
    await step('Executando schesis das partes',.55);const schLinks=schesitomeric(units,state,discourseCoref),eq=equideque(units,state),integratedComments=integrateComments(comments,units,state);
    await step('Compondo conceitos e macroestrutura',.68);let concepts=conceptualAnalysis(units,schLinks,state);const macro=macroArgumentation(units,schLinks,discourseCoref,state);concepts=promoteConceptsByMacro(concepts,macro,state);
    await step('Calculando transformações',.78);const transformationsList=transformations(units,concepts,schLinks,state,macro),genre=detectGenre(text,units,options.genre||'auto'),retro=retrointerpret(units,genre,concepts,state),argument=argumentMap(units,schLinks,state);
    const analysis={version:'Hermeneia 5.0 · Microkernel remoto',createdAt:new Date().toISOString(),title:options.title||'Sem título',options,sourceText:text,paragraphs:seg.paragraphs,units,frames:frameList,entities,coreference:coref,discourseCoreference:discourseCoref,schLinks,equideque:eq,comments:integratedComments,concepts,macro,transformations:transformationsList,genre,retro,argument,state,resources:getExternalResources()};
    await step('Preparando plano semântico',.90);analysis.plan=contentPlan(analysis);analysis.robustness=robustness(analysis);await step('Exegese estrutural concluída',1);return analysis;
  }

  function serialize(a){return {id:a.id||null,version:a.version,createdAt:a.createdAt,title:a.title,options:a.options,sourceText:a.sourceText,paragraphs:a.paragraphs,units:a.units,entities:a.entities,coreference:a.coreference,discourseCoreference:a.discourseCoreference||[],schLinks:a.schLinks,equideque:a.equideque,comments:a.comments,concepts:a.concepts,macro:a.macro,transformations:a.transformations,genre:a.genre,retro:a.retro,argument:a.argument,plan:a.plan,robustness:a.robustness,resources:a.resources||{},facts:a.state.list(),provenance:a.state.provenance,rejected:a.state.rejected,conflicts:a.state.conflicts}}

  return {analyze,analyzeAsync,serialize,norm,words,tokenize,lemma,nominalLemmaCandidate,nominalChunks,setExternalResources,getExternalResources,resourceKey};
})();

/* ================================================================
 * DEEP PARSER 4.4 — dependências + HMM de fallback + correferência
 * semântica + relações assindéticas candidatas.
 * Não transforma hipótese em fato. Toda inferência profunda recebe
 * provenance=deep-parser e status=candidate.
 * ================================================================ */
