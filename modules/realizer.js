window.HermeneiaRealizer = (() => {
  'use strict';
  const LX=window.HermeneiaLexicon, Core=window.HermeneiaCore;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cap=s=>String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1);
  const lowFirst=s=>String(s||'').charAt(0).toLowerCase()+String(s||'').slice(1);
  const uniq=a=>[...new Set(a)];
  const norm=Core.norm;

  class ConnectorSelector {
    constructor(register='formal'){this.register=register;this.recent=[];this.cursors={}}
    category(relation){return ({cause:'cause',consequence:'consequence',contrast:'contrast',concession:'concession',condition:'condition',purpose:'purpose',addition:'addition',example:'example',reformulation:'explanation',temporal:'temporal',comparison:'contrast',resumption:'resumption',emphasis:'emphasis','referential-continuity':'addition','frame-continuity':'addition','linear-progression':'addition',presentation:'explanation',government:'addition'}[relation]||'addition')}
    choose(relation,position='middle'){
      const cat=this.category(relation),base=[...(LX.CONNECTORS[cat]||LX.CONNECTORS.addition)];
      let pool=base.filter(x=>!this.recent.includes(norm(x)));if(!pool.length)pool=base;
      const idx=(this.cursors[cat]||0)%pool.length;let picked=pool[idx];this.cursors[cat]=(this.cursors[cat]||0)+1;
      if(position==='opening'&&['porque','se','para'].includes(norm(picked)))picked=(LX.CONNECTORS.resumption.find(x=>!this.recent.includes(norm(x)))||picked);
      this.recent.push(norm(picked));if(this.recent.length>3)this.recent.shift();return picked;
    }
  }

  class ReferenceManager {
    constructor(analysis){this.analysis=analysis;this.mentions=new Map();this.paragraphEntities=[]}
    resetParagraph(){this.paragraphEntities=[]}
    entity(label){return this.analysis.entities.find(e=>norm(e.label)===norm(label).replace(/^(o|a|os|as|um|uma|uns|umas)\s+/,''))}
    pronoun(e){if(!e)return null;if(e.number==='plural')return e.gender==='feminine'?'elas':'eles';return e.gender==='feminine'?'ela':e.gender==='masculine'?'ele':null}
    ambiguous(e){return this.paragraphEntities.some(x=>x.id!==e.id&&x.number===e.number&&(x.gender===e.gender||x.gender==='unknown'||e.gender==='unknown'))}
    ref(label){if(!label)return null;const e=this.entity(label);if(!e)return label;const count=this.mentions.get(e.id)||0;let out=e.label;if(count>0&&!this.ambiguous(e)){const p=this.pronoun(e);if(p)out=p}this.mentions.set(e.id,count+1);if(!this.paragraphEntities.some(x=>x.id===e.id))this.paragraphEntities.push(e);return out}
  }

  const Agreement={
    article(features={}){if(features.proper)return'';if(features.number==='plural')return features.gender==='feminine'?'as':'os';return features.gender==='feminine'?'a':'o'},
    pronoun(features={}){if(features.number==='plural')return features.gender==='feminine'?'elas':'eles';return features.gender==='feminine'?'ela':features.gender==='masculine'?'ele':null},
    adjective(base,features={}){let x=String(base||'');if(features.gender==='feminine'&&/o$/.test(x))x=x.slice(0,-1)+'a';if(features.number==='plural'&&!/s$/.test(x))x+='s';return x}
  };

  function gerund(lemma){const l=String(lemma||'');if(l.endsWith('ar'))return l.slice(0,-2)+'ando';if(l.endsWith('er'))return l.slice(0,-2)+'endo';if(l.endsWith('ir'))return l.slice(0,-2)+'indo';return l}
  function verbClass(lemma){const l=norm(lemma);if(LX.POS.cognition.has(l))return'cognition';if(LX.POS.reporting.has(l))return'speech';if(LX.POS.agency.has(l))return'agency';if(LX.POS.motion.has(l))return'motion';if(LX.POS.causation.has(l))return'cause';if(LX.POS.copulas.has(l))return'copula';return'action'}
  function entityArticle(e){return Agreement.article(e||{})}
  function withArticle(label,analysis){if(!label)return'';if(/^(o|a|os|as|um|uma|uns|umas)\s/i.test(label))return label;const e=analysis.entities.find(x=>norm(x.label)===norm(label));return e?(e.proper?e.label:`${entityArticle(e)} ${e.label}`.trim()):label}

  function cleanSource(text){return String(text||'').replace(/^\s*["“]|["”]\s*$/g,'').replace(/\s+/g,' ').trim()}
  function shorten(text,max=210){const t=cleanSource(text);return t.length<=max?t:t.slice(0,max).replace(/\s+\S*$/,'')+'…'}
  function listHuman(items){const a=items.filter(Boolean);if(!a.length)return'';if(a.length===1)return a[0];if(a.length===2)return `${a[0]} e ${a[1]}`;return `${a.slice(0,-1).join(', ')} e ${a[a.length-1]}`}

  function frameMeaning(frame,analysis,refs){
    if(!frame?.verb)return null;const subject=frame.subject?.text?refs.ref(frame.subject.text):null,object=frame.object?.text?frame.object.text:null,v=frame.verb.lemma,cls=verbClass(v);
    if(subject){
      if(cls==='cognition')return `${withArticle(subject,analysis)} aparece ${gerund(v)}${object?` acerca de ${object}`:''}`;
      if(cls==='speech')return `${withArticle(subject,analysis)} intervém por meio de uma fala${object?` a respeito de ${object}`:''}`;
      if(cls==='agency')return `${withArticle(subject,analysis)} é apresentado ${gerund(v)}${object?` ${object}`:''}`;
      if(cls==='motion')return `${withArticle(subject,analysis)} participa de uma mudança de posição ou estado expressa por “${v}”${object?` em relação a ${object}`:''}`;
      if(cls==='cause')return `${withArticle(subject,analysis)} é associado a uma ação que produz ou condiciona ${object||'o acontecimento seguinte'}`;
      if(cls==='copula')return `${withArticle(subject,analysis)} recebe uma atribuição ou identificação${object?` ligada a ${object}`:''}`;
      return `${withArticle(subject,analysis)} é apresentado ${gerund(v)}${object?` ${object}`:''}`;
    }
    return object?`a ação expressa por “${v}” recai sobre ${object}`:`a ação principal é expressa por “${v}”`;
  }

  function unitClause(item,analysis,refs,connectors,index){
    const d=item.data,unit=analysis.units.find(u=>u.id===d.unit);if(!unit)return null;
    const quote=`“${shorten(unit.text,170)}”`;
    const rel=unit.relations?.find(r=>!['government'].includes(r.type));
    let base;
    if(index===0) base=`a abertura apresenta a situação ${quote}`;
    else if(rel?.type==='contrast') base=`o desenvolvimento restringe o que vinha sendo apresentado e acrescenta ${quote}`;
    else if(rel?.type==='cause') base=`a afirmação seguinte oferece uma razão para o que a antecede: ${quote}`;
    else if(rel?.type==='consequence') base=`o encadeamento passa ao efeito ou à conclusão expressa em ${quote}`;
    else if(rel?.type==='reformulation') base=`a ideia anterior recebe nova formulação em ${quote}`;
    else if(rel?.type==='temporal') base=`o relato avança para o momento seguinte, em que se afirma ${quote}`;
    else if(rel?.type==='condition') base=`surge uma condição que limita o alcance da afirmação: ${quote}`;
    else base=`o desenvolvimento acrescenta ${quote}`;
    const prob=unit.epistemic?.some(e=>e.kind==='possibility/probability'),limit=unit.epistemic?.some(e=>e.kind==='epistemic-limit');
    if(prob)base+=', sem apresentar essa possibilidade como fato já consumado';
    if(limit)base+=', ao mesmo tempo em que o conhecimento disponível é expressamente limitado';
    if(index>0&&rel&&!['contrast','cause','consequence','reformulation','temporal','condition'].includes(rel.type)){const c=connectors.choose(rel.type,'middle');base=`${c}, ${lowFirst(base)}`}
    return base;
  }

  function aggregateClauses(clauses){
    const clean=clauses.filter(Boolean).map(x=>x.replace(/\s+/g,' ').trim().replace(/[.;:]$/,''));if(!clean.length)return[];
    const sentences=[];let current=clean[0];for(let i=1;i<clean.length;i++){
      const c=clean[i];const wc=Core.words(current).length,wn=Core.words(c).length;
      if(wc+wn<42&&i%2===1){current+=`; ${lowFirst(c)}`}else{sentences.push(cap(current)+'.');current=c}
    }sentences.push(cap(current)+'.');return sentences;
  }

  function paragraphFromUnits(items,analysis,ctx){
    ctx.refs.resetParagraph();const clauses=items.slice(0,5).map((it,i)=>unitClause(it,analysis,ctx.refs,ctx.connectors,i));return aggregateClauses(clauses).join(' ');
  }

  function genreAdj(g){return ({narrativa:'narrativa',argumentativo:'argumentativa',expositivo:'expositiva',didatico:'didática',poetico:'poética',epistolar:'epistolar'}[g]||g)}

  function overviewParagraph(section,analysis,ctx){
    const o=section.items[0]?.data||{},genre=o.genre==='indeterminado'?'uma forma que não se deixa reduzir com segurança a um único gênero':`uma forma predominantemente ${genreAdj(o.genre)}`;
    const rel=section.items.find(x=>x.kind==='relation-summary')?.data?.relations||[];
    const n=Number(o.macroBlocks||analysis.macro?.blocks?.length||0);
    let p=`Considerado em seu conjunto, o escrito apresenta ${genre}`;
    if(n>1)p+=` e organiza seu desenvolvimento em ${n} grandes movimentos funcionais, identificados pelas mudanças de relação, modalidade, referente e papel argumentativo`;
    else p+=` e desenvolve sua ideia sem uma divisão macroargumentativa forte o bastante para justificar vários blocos independentes`;
    p+='.';
    if(rel.length){const names=uniq(rel.map(r=>relationName(r))).slice(0,5);p+=` A coesão é sustentada sobretudo por ${listHuman(names)}, de modo que cada parte deve ser compreendida pelo que recebe da anterior e pelo que prepara na seguinte.`}
    return p;
  }
  function relationName(r){return ({contrast:'contraste',concession:'concessão',cause:'causa ou explicação',consequence:'consequência',condition:'condição',purpose:'finalidade',reformulation:'reformulação',example:'exemplificação',addition:'adição',temporal:'progressão temporal',comparison:'comparação',presentation:'apresentação',government:'regência verbal','referential-continuity':'continuidade referencial','frame-continuity':'continuidade semântica','linear-progression':'progressão linear'}[r]||r)}


  function ordinal(i){return ['primeira','segunda','terceira','quarta','quinta','sexta'][i]||`${i+1}ª`}
  function macroFunctionName(fn){
    return ({foundation:'fundamento ou situação inicial',development:'desenvolvimento ou resposta',outcome:'resultado ou avaliação',problem:'problema ou pergunta',contrast:'contraste ou restrição',conclusion:'conclusão',explanation:'explicação ou fundamento posterior'}[fn]||'desenvolvimento');
  }
  function blockContentPhrase(block){
    const terms=(block.keyTerms||[]).slice(0,5).map(x=>String(x).toLowerCase());
    const verbs=(block.predicates||[]).slice(0,3).map(x=>x.lemma).filter(Boolean);
    if(terms.length&&verbs.length)return `em torno de ${listHuman(terms)}, por meio de ações ou estados expressos principalmente por “${verbs.join('”, “')}”`;
    if(terms.length)return `em torno de ${listHuman(terms)}`;
    if(verbs.length)return `por meio de ações ou estados expressos principalmente por “${verbs.join('”, “')}”`;
    return 'a partir das afirmações reunidas nesse trecho';
  }
  function macroParagraph(items,analysis,ctx){
    if(!items.length)return'';
    const sentences=items.map((it,i)=>{
      const b=it.data,range=b.unitIds.length>1?`${b.unitIds[0]}–${b.unitIds[b.unitIds.length-1]}`:b.unitIds[0];
      let s=`A ${ordinal(i)} parte (${range}) funciona como ${macroFunctionName(b.function)} e organiza seu conteúdo ${blockContentPhrase(b)}`;
      if((b.internalRelations||[]).includes('presence-absence-contrast'))s+=', contrapondo explicitamente a presença e o crescimento de um mesmo referente à sua ausência';
      else if(b.negated&&b.function==='outcome')s+=', incluindo uma formulação negativa que limita ou contrapõe um resultado possível';
      return cap(s)+'.';
    });
    return sentences.join(' ');
  }
  function macroRelationMeaning(r,from,to){
    if(r.semantic==='foundation-to-response')return `o que é estabelecido na ${from} parte funciona como fundamento para a resposta ou desenvolvimento apresentado na ${to}`;
    if(r.semantic==='justification-by-outcome')return `a ${to} parte fornece a razão ou os resultados que esclarecem por que o desenvolvimento da ${from} é relevante`;
    if(r.semantic==='alternative-outcomes')return `as duas partes distribuem resultados alternativos segundo presença e ausência, afirmação e negação ou outra oposição equivalente`;
    if(r.semantic==='restriction-or-opposition')return `a ${to} parte restringe ou contrapõe o alcance da ${from}`;
    if(r.semantic==='result-or-consequence')return `a ${to} parte é apresentada como resultado ou consequência do que foi estabelecido na ${from}`;
    if(r.semantic==='explanation-or-ground')return `a ${to} parte oferece fundamento ou explicação para a afirmação anterior`;
    if(r.type==='anaphoric-resumption')return `a ${to} parte retoma explicitamente conteúdo já construído na ${from}`;
    return `a ${to} parte continua e determina o que foi construído na ${from}`;
  }
  function macroRelationsParagraph(items,analysis,ctx){
    if(!items.length)return'';
    return items.map((it,i)=>{const r=it.data;return cap(macroRelationMeaning(r,ordinal(Number(r.from.slice(1))-1),ordinal(Number(r.to.slice(1))-1)))+'.'}).join(' ');
  }

  function conceptsParagraph(items,analysis,ctx){
    const cs=items.slice(0,5).map(i=>i.data.representative||i.data.label);if(!cs.length)return'';
    let p=`Depois de estabelecida a arquitetura do escrito, os termos ou conceitos que realmente atravessam mais de uma de suas grandes partes são ${listHuman(cs.map(x=>String(x).toLowerCase()))}.`;
    const top=items[0]?.data;
    if(top)p+=` Esse conceito não é promovido apenas porque aparece no vocabulário: sua importância decorre de participar de ${top.macroAnchors?.length||0} movimentos maiores do texto e de receber funções diferentes ou complementares ao longo deles.`;
    return p;
  }

  function supportingConceptsParagraph(items){
    if(!items.length)return'';
    const names=items.map(i=>i.data.label.toLowerCase());
    return `Outras famílias semânticas, como ${listHuman(names)}, permanecem úteis para descrever partes do vocabulário, mas não recebem automaticamente estatuto temático, porque não atravessam a macroestrutura com força suficiente.`;
  }

  function transformationsParagraph(items,analysis,ctx){
    if(!items.length)return'';
    const parts=items.slice(0,6).map(it=>{
      const t=it.data;
      const blocks=t.fromBlock&&t.toBlock&&t.fromBlock!==t.toBlock?` entre ${t.fromBlock} e ${t.toBlock}`:'';
      return `“${String(t.concept).toLowerCase()}” passa de ${t.fromRole} para ${t.toRole}${blocks}`;
    });
    return `${cap(listHuman(parts))}. A transformação, portanto, é descrita pela mudança de função do mesmo conceito, e não apenas pelo fato de ele reaparecer.`;
  }
  function topicsParagraph(items){if(!items.length)return'';const names=items.map(i=>i.data.label.toLowerCase());return `No plano lexical, reaparecem ${listHuman(names)}. Esses termos ajudam a reconhecer os objetos de que se fala, mas não são tratados automaticamente como tema, pois recorrência e centralidade interpretativa não são equivalentes.`}

  function anaphoraParagraph(items){
    if(!items.length)return'';
    const groups=new Map();
    for(const it of items){
      const d=it.data,key=`${norm(d.expression)}|${(d.antecedentUnits||[]).join(',')}`;
      let g=groups.get(key);if(!g)g={expression:d.expression,antecedentUnits:d.antecedentUnits||[],terms:d.terms||[],units:[]};
      g.units.push(d.unit);g.terms=uniq([...g.terms,...(d.terms||[])]);groups.set(key,g);
    }
    const parts=[...groups.values()].map(g=>{
      const terms=g.terms.slice(0,9),where=g.units.length>1?` em ${listHuman(g.units)}`:'';
      return terms.length?`a expressão “${g.expression}”${where} retoma o conjunto anterior, especialmente ${listHuman(terms)}`:`a expressão “${g.expression}”${where} retoma uma proposição ou conjunto anterior`;
    });
    return cap(listHuman(parts))+'. Essa retomada impede que o demonstrativo seja interpretado como referência vaga ou independente do que o precede.';
  }

  function confirmedParagraph(items){
    if(!items.length)return'';const kinds=uniq(items.map(i=>i.predicate));const parts=[];
    if(kinds.includes('modal-distinction'))parts.push('marcas de possibilidade ou probabilidade são preservadas como expectativa, sem serem convertidas em fatos realizados');
    if(kinds.includes('restriction'))parts.push('os contrastes limitam ou corrigem aquilo que vinha sendo afirmado');
    if(kinds.includes('causal-link'))parts.push('as razões explicitamente apresentadas são conservadas como fundamento das afirmações a que se ligam');
    if(kinds.includes('inferential-link'))parts.push('as conclusões e consequências são mantidas como dependentes do caminho que as antecede');
    if(kinds.includes('negative-scope'))parts.push('a negação permanece ligada ao predicado sobre o qual efetivamente incide');
    if(kinds.includes('presence-absence'))parts.push('quando o mesmo referente aparece sob presença e crescimento numa parte e sob ausência noutra, essa oposição é tratada como estrutura de resultados, não como simples mudança de vocabulário');
    if(kinds.includes('polarity-opposition'))parts.push('a oposição entre afirmação e negação do mesmo predicado é preservada como contraste estrutural');
    if(kinds.includes('anaphoric-link'))parts.push('demonstrativos que retomam um conjunto anterior permanecem ligados ao antecedente já construído');
    return parts.length?cap(listHuman(parts))+'.':'';
  }
  function retroParagraph(items,analysis,ctx){if(!items.length)return'';const top=items[0].data.concept;return `O fechamento permite retornar às afirmações anteriores e restringir leituras que, tomadas isoladamente, seriam mais amplas. ${top?`À luz dessa conclusão, a noção de “${top.toLowerCase()}” deve ser entendida segundo a função que recebe no conjunto, e não apenas pelo sentido possível de cada palavra separada.`:'A parte final, assim, funciona como critério para reler o caminho anterior sem transformar detalhes circunstanciais em tese principal.'}`}
  function humanParagraph(items){const author=items.filter(x=>x.data.role==='author'),commentator=items.filter(x=>x.data.role==='commentator');const bits=[];if(author.length)bits.push(`${author.length} ${author.length===1?'explicação autoral foi considerada':'explicações autorais foram consideradas'} como informação privilegiada sobre a intenção, desde que compatíveis com a formulação efetiva`);if(commentator.length)bits.push(`${commentator.length} ${commentator.length===1?'comentário do intérprete permaneceu':'comentários do intérprete permaneceram'} como hipótese favorecida, sujeita à confirmação pelo restante`);return bits.length?cap(listHuman(bits))+'.':''}

  function macroAction(fn){
    return ({foundation:'estabelece o fundamento ou a situação inicial',development:'desenvolve a resposta ou o desdobramento que parte desse fundamento',outcome:'expõe os resultados, consequências ou avaliações produzidos pelo desenvolvimento anterior',problem:'formula o problema que governa o restante',contrast:'restringe ou contrapõe o que vinha sendo afirmado',conclusion:'reúne o percurso numa conclusão',explanation:'oferece a explicação ou fundamento necessário ao movimento anterior'}[fn]||'prossegue no desenvolvimento da ideia');
  }

  function synthesisParagraph(item,analysis,ctx){
    const macro=item.data.macro||analysis.macro;
    if(!macro?.blocks?.length)return'Não há base suficiente para formular uma síntese global sem acrescentar ao escrito algo que ele próprio não sustenta.';
    const blocks=macro.blocks,rels=macro.relations||[];
    let p='A interpretação global não é escolhida por uma palavra recorrente, mas pela relação entre as grandes partes que o escrito efetivamente constrói.';
    if(blocks.length===3){
      p+=` O primeiro movimento ${macroAction(blocks[0].function)}; o segundo ${macroAction(blocks[1].function)}; e o terceiro ${macroAction(blocks[2].function)}.`;
    }else if(blocks.length>1){
      p+=` O percurso contém ${blocks.length} movimentos principais: ${listHuman(blocks.map((b,i)=>`${ordinal(i)} movimento, que ${macroAction(b.function)}`))}.`;
    }else{
      p+=` O texto mantém um único movimento dominante, que ${macroAction(blocks[0].function)}.`;
    }
    if(rels.length){
      const relText=rels.slice(0,4).map(r=>macroRelationMeaning(r,ordinal(Number(r.from.slice(1))-1),ordinal(Number(r.to.slice(1))-1)));
      p+=` Por isso, ${listHuman(relText)}.`;
    }
    const presence=analysis.schLinks?.some(l=>l.type==='presence-absence-contrast');
    if(presence)p+=' Dentro desse percurso, a oposição entre presença/crescimento e ausência do mesmo referente estabelece resultados diferentes e precisa ser preservada na síntese.';
    const concepts=item.data.concepts||[];
    if(concepts.length)p+=` Conceitos como ${listHuman(concepts.map(c=>String(c.representative||c.label).toLowerCase()))} ajudam a nomear aspectos desse desenvolvimento, mas não substituem a relação argumentativa que os organiza.`;
    return p;
  }
  function limitsParagraph(){return 'A leitura, entretanto, deve conservar alguns limites: uma descrição não se torna automaticamente prescrição; uma forma sintática não revela por si só a intenção psicológica de quem fala; repetição lexical não basta para estabelecer o tema; e nenhuma ideia que não possa ser reconduzida a palavras, relações ou explicações humanas identificadas deve ser tratada como afirmação do escrito.'}

  function sectionParagraph(section,analysis,ctx){
    if(section.id==='overview')return overviewParagraph(section,analysis,ctx);
    if(section.id==='macro')return macroParagraph(section.items,analysis,ctx);
    if(section.id==='macro-relations')return macroRelationsParagraph(section.items,analysis,ctx);
    if(section.id==='progression')return paragraphFromUnits(section.items,analysis,ctx);
    if(section.id==='concepts')return conceptsParagraph(section.items,analysis,ctx);
    if(section.id==='supporting')return supportingConceptsParagraph(section.items);
    if(section.id==='topics')return topicsParagraph(section.items);
    if(section.id==='transformations')return transformationsParagraph(section.items,analysis,ctx);
    if(section.id==='anaphora')return anaphoraParagraph(section.items);
    if(section.id==='confirmed')return confirmedParagraph(section.items);
    if(section.id==='retro')return retroParagraph(section.items,analysis,ctx);
    if(section.id==='human')return humanParagraph(section.items);
    if(section.id==='synthesis')return synthesisParagraph(section.items[0],analysis,ctx);
    if(section.id==='limits')return limitsParagraph();return'';
  }

  function applyRegister(text,register){
    let s=text;
    if(register==='simples')s=s.replace(/Considerado em seu conjunto/g,'De modo geral').replace(/permanece mais firmemente ligado/g,'aparece com mais clareza').replace(/formulaçao efetiva/gi,'forma do texto');
    if(register==='academico')s=s.replace(/De modo geral/g,'Considerado o conjunto').replace(/mostra que/g,'indica que').replace(/razão pela qual/g,'de modo que');
    if(register==='classico')s=s.replace(/A leitura, entretanto,/g,'Cumpre, entretanto, que a leitura').replace(/vale observar que/gi,'convém notar que');
    if(register==='pastoral')s=s.replace(/O escrito/g,'A passagem').replace(/o escrito/g,'a passagem');
    return s;
  }

  function metaFilter(text){let s=String(text||'');for(const re of LX.META_TERMS)s=s.replace(re,'');return s.replace(/\s{2,}/g,' ').replace(/\s+([,.;:!?])/g,'$1').trim()}
  function sentenceArray(text){
    const src=String(text||''),out=[];let buf='',quote=false;
    for(let i=0;i<src.length;i++){const c=src[i];buf+=c;if(c==='"'||c==='“'||c==='”')quote=!quote;if(/[.!?]/.test(c)&&!quote){const next=src[i+1]||'';if(!next||/\s/.test(next)){if(buf.trim())out.push(buf.trim());buf=''}}}
    if(buf.trim())out.push(buf.trim());return out;
  }
  function repeatedNgrams(sentA,sentB,n=3){const a=Core.words(norm(sentA)),b=Core.words(norm(sentB));const set=new Set();for(let i=0;i<=a.length-n;i++)set.add(a.slice(i,i+n).join(' '));for(let i=0;i<=b.length-n;i++)if(set.has(b.slice(i,i+n).join(' ')))return true;return false}
  function fluencyPass(text,register='formal'){
    let s=metaFilter(applyRegister(text,register));let sentences=sentenceArray(s);const replacements=[['o texto','o escrito'],['o escrito','a passagem'],['a passagem','o conjunto'],['mostra que','indica que'],['por isso','desse modo']];
    for(let i=1;i<sentences.length;i++)if(repeatedNgrams(sentences[i-1],sentences[i],4)){for(const [a,b] of replacements){if(norm(sentences[i]).includes(norm(a))){sentences[i]=sentences[i].replace(new RegExp(a,'i'),b);break}}}
    // impede duas sentenças seguidas com a mesma abertura de 2 palavras
    for(let i=1;i<sentences.length;i++){const a=Core.words(norm(sentences[i-1])).slice(0,2).join(' '),b=Core.words(norm(sentences[i])).slice(0,2).join(' ');if(a&&a===b)sentences[i]=cap('nesse ponto, '+lowFirst(sentences[i]))}
    return sentences.join(' ');
  }

  function report(analysis,options={}){
    const register=options.register||analysis.options?.register||'formal';const ctx={connectors:new ConnectorSelector(register),refs:new ReferenceManager(analysis)};const html=[];
    for(const section of analysis.plan.sections){const p=sectionParagraph(section,analysis,ctx);if(!p)continue;const title=section.title;html.push(`<h3>${esc(title)}</h3><p>${esc(fluencyPass(p,register))}</p>`)}
    return html.join('');
  }

  function replaceMarker(text,marker,replacement){
    if(!marker||!replacement)return text;const escaped=String(marker).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return text.replace(new RegExp(escaped,'i'),replacement);
  }
  function lexicalVary(text){
    let s=text;const seen=new Set();for(const tok of Core.tokenize(text)){const e=LX.WORDS[norm(tok.lemma)]||LX.WORDS[tok.norm];if(!e?.syn?.length||seen.has(tok.norm)||tok.surface.length<5)continue;seen.add(tok.norm);const syn=e.syn[0];if(syn&&syn.split(' ').length<=2){const escaped=tok.surface.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');s=s.replace(new RegExp(`\\b${escaped}\\b`,'i'),syn)}}return s;
  }
  function recomposeUnit(unit,analysis,ctx,index){
    // A Apocompose 3.2 preserva o vocabulário nuclear e a flexão do texto.
    // Ela explicita relações entre unidades; não troca palavras por sinônimos de modo mecânico.
    return cleanSource(unit.analysisText||unit.text);
  }
  function recomposition(analysis,options={}){
    const register=options.register||analysis.options?.register||'formal';
    const ctx={connectors:new ConnectorSelector(register),refs:new ReferenceManager(analysis)};
    const blocks=analysis.macro?.blocks||[];
    if(!blocks.length)return analysis.units.map(u=>cleanSource(u.analysisText||u.text)).join(' ');
    const paragraphs=[];
    blocks.forEach((b,i)=>{
      const units=b.unitIds.map(id=>analysis.units.find(u=>u.id===id)).filter(Boolean);
      let text=units.map((u,j)=>recomposeUnit(u,analysis,ctx,j)).join(' ');
      if(i>0){
        const rel=analysis.macro.relations?.[i-1];
        let bridge='';
        if(rel?.semantic==='foundation-to-response')bridge='A partir desse fundamento,';
        else if(rel?.semantic==='justification-by-outcome')bridge='A razão e os resultados desse desenvolvimento aparecem em seguida:';
        else if(rel?.semantic==='alternative-outcomes')bridge='Em contraste,';
        else if(rel?.semantic==='restriction-or-opposition')bridge='Por outro lado,';
        else if(rel?.semantic==='result-or-consequence')bridge='Como consequência,';
        else if(rel?.semantic==='explanation-or-ground')bridge='Isso recebe a seguinte explicação:';
        if(bridge&&!new RegExp(`^(porque|pois|portanto|por isso|contudo|mas|entretanto|assim)\\b`,'i').test(text))text=`${bridge} ${lowFirst(text)}`;
      }
      paragraphs.push(sentenceArray(fluencyPass(text,register)).map(cap).join(' '));
    });
    return paragraphs.join('\n\n');
  }

  function dominantTheme(a){const c=(a.concepts.thematic&&a.concepts.thematic[0])||a.concepts.accepted.find(c=>c.kind==='family')||a.concepts.accepted[0];return c?(c.representative||c.hits?.[0]||c.label):'o assunto predominante'}
  function progressionPoints(a,max=4){const pts=[];for(const u of a.units){const f=u.frames.find(x=>x.verb);if(!f)continue;pts.push({unit:u.id,source:shorten(u.text,180),subject:f.subject?.text||null,verb:f.verb.lemma});if(pts.length>=max)break}return pts}
  function derived(analysis,mode='explicacao',options={}){
    const register=options.register||'formal',theme=dominantTheme(analysis),syn=fluencyPass(synthesisParagraph({data:{concepts:analysis.concepts.accepted.slice(0,3)}},analysis,{connectors:new ConnectorSelector(register),refs:new ReferenceManager(analysis)}),register),pts=progressionPoints(analysis,4),out=[];
    if(mode==='explicacao')return report(analysis,{register});
    if(mode==='resumo'){out.push(`<h3>Resumo interpretativo</h3><p>${esc(syn)}</p>`);return out.join('')}
    if(mode==='meditacao'){
      out.push(`<h3>${esc(theme)}</h3><p>${esc(fluencyPass(`A reflexão pode começar pela maneira como ${theme.toLowerCase()} é construído ao longo do escrito. ${syn}`,register))}</p>`);
      if(pts.length)out.push(`<p>${esc(fluencyPass(`O percurso não oferece apenas uma afirmação isolada: primeiro ${lowFirst(pts[0].source)}${pts[1]?`; depois, ${lowFirst(pts[1].source)}`:''}. Consideradas juntas, essas partes convidam o leitor a examinar não somente o resultado mencionado, mas o princípio que as relaciona.`,register))}</p>`);
      out.push(`<p>${esc(fluencyPass('A aplicação deve permanecer proporcional ao que foi efetivamente dito: aquilo que a passagem descreve pode orientar a reflexão quando sua relação central é preservada, sem transformar circunstâncias narrativas em regras que o próprio escrito não formulou.',register))}</p>`);return out.join('');
    }
    if(mode==='licao'){
      out.push(`<h3>Tema</h3><p>${esc(theme)}</p><h3>Objetivo</h3><p>${esc(fluencyPass(`Compreender como ${theme.toLowerCase()} é determinado pelas relações do escrito e como o fechamento esclarece as partes anteriores.`,register))}</p>`);
      out.push('<h3>Desenvolvimento</h3>');pts.slice(0,3).forEach((p,i)=>out.push(`<p><strong>${i+1}.</strong> ${esc(fluencyPass(p.source,register))}</p>`));out.push(`<h3>Conclusão</h3><p>${esc(syn)}</p>`);return out.join('');
    }
    if(mode==='sermao'){
      out.push(`<h3>Tema proposto</h3><p>${esc(theme)}</p><h3>Proposição</h3><p>${esc(syn)}</p><h3>Movimentos expositivos</h3>`);pts.slice(0,3).forEach((p,i)=>out.push(`<p><strong>${i+1}.</strong> ${esc(fluencyPass(p.source,register))}</p>`));out.push(`<h3>Aplicação</h3><p>${esc(fluencyPass('A aplicação deve nascer da mesma relação que governa a exposição, preservando a diferença entre aquilo que o escrito afirma, aquilo que implica e aquilo que apenas permite considerar.',register))}</p>`);return out.join('');
    }
    if(mode==='artigo'){
      out.push(`<h3>Introdução</h3><p>${esc(fluencyPass(`O escrito oferece uma estrutura em que ${theme.toLowerCase()} não aparece como termo isolado, mas como noção formada progressivamente pelas relações entre as partes.`,register))}</p>`);out.push(`<h3>Desenvolvimento</h3><p>${esc(syn)}</p>`);if(analysis.transformations.length)out.push(`<p>${esc(fluencyPass(transformationsParagraph(analysis.transformations.map(t=>({data:t})),analysis,{connectors:new ConnectorSelector(register),refs:new ReferenceManager(analysis)}),register))}</p>`);out.push(`<h3>Conclusão</h3><p>${esc(fluencyPass('A interpretação mais segura, portanto, é aquela que conserva simultaneamente o vocabulário, as relações e o movimento do conjunto, recusando tanto a leitura por palavra solta quanto a introdução de uma tese externa.',register))}</p>`);return out.join('');
    }
    if(mode==='aconselhamento'){
      out.push(`<h3>Princípio observado</h3><p>${esc(syn)}</p><h3>Uso prudente</h3><p>${esc(fluencyPass(`Para aconselhamento, ${theme.toLowerCase()} pode ser retomado como ponto de reflexão somente na medida em que a situação concreta corresponda à relação que o escrito realmente apresenta. O conselho não deve ser retirado de um detalhe circunstancial nem apresentado como mandamento quando a passagem apenas descreve.`,register))}</p>`);return out.join('');
    }
    return report(analysis,{register});
  }

  function auditFluency(html){const text=String(html||'').replace(/<[^>]+>/g,' ');const meta=LX.META_TERMS.filter(re=>{re.lastIndex=0;return re.test(text)}).length;const sentences=sentenceArray(text);let repeated=0;for(let i=1;i<sentences.length;i++)if(repeatedNgrams(sentences[i-1],sentences[i],4))repeated++;const starts=sentences.map(s=>Core.words(norm(s)).slice(0,2).join(' '));let sameStarts=0;for(let i=1;i<starts.length;i++)if(starts[i]&&starts[i]===starts[i-1])sameStarts++;return {metaLeaks:meta,repeatedNgrams:repeated,repeatedStarts:sameStarts,sentences:sentences.length,score:Math.max(0,1-(meta*.25+repeated*.08+sameStarts*.06))}}

  return {report,recomposition,derived,fluencyPass,auditFluency,ConnectorSelector,ReferenceManager,Agreement};
})();

/* ================================================================
 * AMBÍGUO 2 — reforço distribucional determinístico
 * Não interpreta por decreto. Induz agrupamentos de contexto e
 * devolve distribuições que podem alimentar a Apótica.
 * ================================================================ */
