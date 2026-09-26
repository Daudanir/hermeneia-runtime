window.HermeneiaHypothesis = (() => {
  'use strict';
  const Core = window.HermeneiaCore;
  const norm = Core.norm;
  const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
  const uniq = a => [...new Set((a || []).filter(Boolean))];
  const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  const low = s => String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1);

  const REL = {
    cause: ['causal', 'apresenta uma razão ou causa para o que se relaciona a ela'],
    consequence: ['consequencial', 'apresenta uma consequência ou conclusão em relação ao que a antecede'],
    contrast: ['contrastiva', 'opõe ou restringe uma formulação em relação a outra'],
    concession: ['concessiva', 'admite uma circunstância sem cancelar a afirmação principal'],
    condition: ['condicional', 'estabelece uma condição para a relação expressa'],
    purpose: ['final', 'indica finalidade para a ação ou afirmação a que se liga'],
    reformulation: ['explicativa', 'reformula ou esclarece uma formulação relacionada'],
    example: ['exemplificativa', 'apresenta um caso que especifica uma formulação mais geral'],
    addition: ['aditiva', 'acrescenta informação sem inverter a direção anterior'],
    temporal: ['temporal', 'ordena a informação no tempo'],
    comparison: ['comparativa', 'aproxima duas formulações segundo um critério comum'],
    presentation: ['apresentativa', 'introduz o conteúdo anunciado por uma expressão anterior'],
    government: ['regencial', 'liga o predicado ao seu complemento por exigência regencial'],
    'referential-continuity': ['referencial', 'mantém um referente entre unidades sucessivas'],
    'frame-continuity': ['semântica', 'mantém um domínio semântico compatível entre unidades'],
    'presence-absence-contrast': ['presença/ausência', 'contrasta o mesmo referente sob presença e ausência'],
    'polarity-contrast': ['polaridade', 'contrasta afirmação e negação sobre um mesmo predicado'],
    'anaphoric-resumption': ['anafórica', 'retoma um conteúdo anterior por expressão referencial'],
    'linear-progression': ['sequencial', 'mantém continuidade por adjacência sem marcador mais forte'],
    'structural-parallelism': ['paralela', 'mantém uma organização interna semelhante sem transformar o conectivo interno em ponte entre as unidades']
  };

  const POS_LABELS = {
    verb:'verbo', nounish:'nome/adjetivo', proper:'nome próprio', content:'conteúdo lexical',
    pronoun:'pronome', possessive:'possessivo', demonstrative:'demonstrativo', article:'artigo',
    preposition:'preposição', conjunction:'conjunção', adverb:'advérbio', negation:'negação', punct:'pontuação'
  };

  function propositionText(f){
    if(!f?.verb) return '';
    const s = f.subject?.text ? `${f.subject.text} ` : '';
    const neg = f.negated ? 'não ' : '';
    const o = f.object?.text ? ` ${f.object.text}` : '';
    return `${s}${neg}${f.verb.surface || f.verb.lemma}${o}`.replace(/\s+/g,' ').trim();
  }
  function participantsFromFrame(f){return uniq([f?.subject?.text, f?.object?.text]);}
  function conceptsForUnit(a,u){
    const accepted = a.concepts?.accepted || [];
    return accepted.filter(c => (c.anchors||[]).includes(u.id)).map(c => c.representative || c.label).slice(0,10);
  }
  function macroForUnit(a,id){return (a.macro?.blocks||[]).find(b => (b.unitIds||[]).includes(id)) || null;}
  function eqForUnit(a,id){return (a.equideque||[]).find(e=>e.unit===id) || null;}
  function addCandidate(list,c){
    if(!c?.statement) return;
    const key = norm(c.statement).replace(/\s+/g,' ');
    if(!key || list.some(x=>x.key===key)) return;
    list.push({
      id:c.id || '', key, unitId:c.unitId, family:c.family||'structural', lens:c.lens||'structure',
      statement:c.statement.trim(), support:clamp(c.support ?? .5), evidence:uniq(c.evidence), anchors:uniq(c.anchors),
      participants:uniq(c.participants), concepts:uniq(c.concepts), relation:c.relation||null,
      assumptions:uniq(c.assumptions), status:c.status||'candidate', source:c.source||'engine', payload:c.payload||null, scope:c.scope||null
    });
  }

  function buildLocal(a,u,index,capN=50){
    const list=[]; const eq=eqForUnit(a,u.id); const macro=macroForUnit(a,u.id); const concepts=conceptsForUnit(a,u);
    let seq=1; const add=c=>addCandidate(list,{id:`${u.id}H${seq++}`,...c,unitId:u.id,anchors:[u.id,...(c.anchors||[])],concepts:uniq([...(c.concepts||[]),...concepts.slice(0,4)])});

    (u.frames||[]).forEach(f=>{
      if(f.verb){
        const p=propositionText(f);
        add({family:'proposition',lens:'structure',statement:`A unidade codifica a proposição nuclear “${p}”.`,support:f.subject?.text?.length?.82:.70,evidence:[f.id,'predicado lexical'],participants:participantsFromFrame(f),source:'syntax',payload:{type:'proposition',text:p,subject:f.subject?.text||null,verb:f.verb.lemma,object:f.object?.text||null,negated:f.negated,copular:!!f.copular}});
        add({family:'predicate-role',lens:'participants',statement:`O predicado “${f.verb.lemma}” organiza a oração; ${f.subject?.text?`“${f.subject.text}” ocupa a posição de sujeito`:'o sujeito não está lexicalmente expresso'}${f.object?.text?` e “${f.object.text}” aparece como complemento principal da predicação`:''}.`,support:.78,evidence:[f.id,'estrutura de predicação'],participants:participantsFromFrame(f),source:'syntax',payload:{type:'predicate-role',subject:f.subject?.text||null,verb:f.verb.lemma,object:f.object?.text||null,copular:!!f.copular}});
        if(f.auxiliaries?.length)add({family:'verbal-chain',lens:'structure',statement:`A cadeia verbal distingue ${f.auxiliaries.map(x=>`“${x.surface}”`).join(' + ')} como auxiliar(es) e “${f.verb.surface}” como núcleo lexical.`,support:.88,evidence:[f.id,'cadeia verbal'],participants:participantsFromFrame(f),source:'morphosyntax',payload:{type:'verbal-chain',auxiliaries:f.auxiliaries,verb:f.verb}});
        if(f.copular)add({family:'copular-predication',lens:'structure',statement:`“${f.verb.surface}” funciona como cópula nesta oração; não deve ser tratado como auxiliar de outro verbo distante.`,support:.91,evidence:[f.id,'predicação copular'],participants:participantsFromFrame(f),source:'morphosyntax',payload:{type:'copular',verb:f.verb,subject:f.subject?.text||null,complement:f.object?.text||null}});
        if(f.negated)add({family:'negation',lens:'pragmatic',statement:`A negação incide sobre a predicação cujo núcleo é “${f.verb.lemma}”; uma leitura que torne afirmativo esse predicado perde compatibilidade com a forma observada.`,support:.90,evidence:[f.id,'negação'],participants:participantsFromFrame(f),source:'syntax'});
        (f.semanticFrames||[]).filter(sf=>(sf.support||0)>=.68).slice(0,4).forEach(sf=>add({family:'semantic-frame',lens:'conceptual',statement:`O predicado “${f.verb.lemma}” admite, neste ponto, compatibilidade com o frame semântico “${sf.frame}”, usado apenas como apoio de papéis e não como interpretação final.`,support:clamp(.46+.40*(sf.support||0)),evidence:[`Frame²:${sf.frame}`,`suporte:${Math.round((sf.support||0)*100)}%`],participants:participantsFromFrame(f),assumptions:(sf.support||0)<.78?['frame externo ainda depende de confirmação contextual']:[],source:'Frame2',payload:{type:'semantic-frame',frame:sf.frame,lemma:f.verb.lemma,support:sf.support}}));
      }
    });

    (u.relations||[]).forEach(r=>{
      const info=REL[r.type]||[r.type,'estabelece uma relação discursiva'];
      const internal=r.scope!=='cross-unit-candidate';
      const statement=internal
        ? `Dentro de ${u.id}, o marcador “${r.marker||'—'}” favorece uma relação ${info[0]} entre partes da própria unidade; isso não autoriza, por si só, uma relação com a unidade anterior.`
        : `Na abertura de ${u.id}, o marcador “${r.marker||'—'}” pode ligar esta unidade à anterior por uma relação ${info[0]}.`;
      add({family:internal?'intraunit-relation':'relation-opening',lens:['cause','consequence','purpose','condition'].includes(r.type)?'causal':'structure',statement,support:r.confidence||.72,evidence:[`relação:${r.type}`,`marcador:${r.marker||'—'}`,`escopo:${r.scope||'intraunit'}`],relation:r.type,source:'discourse',scope:r.scope||'intraunit',payload:{type:'relation',relation:r.type,marker:r.marker,scope:r.scope||'intraunit'}});
    });
    (u.seRoles||[]).forEach(x=>{
      if(x.role==='conditional')add({family:'se-conditional',lens:'causal',statement:'A forma “se” é favorecida como conjunção condicional neste contexto.',support:x.confidence,evidence:[x.reason],relation:'condition',source:'morphosyntax',payload:{type:'se-role',role:x.role}});
      else if(x.role.startsWith('clitic'))add({family:'se-clitic',lens:'structure',statement:'A forma “se” é favorecida como elemento pronominal da construção verbal; por isso, não deve gerar hipótese condicional.',support:x.confidence,evidence:[x.reason],source:'morphosyntax',payload:{type:'se-role',role:x.role}});
    });

    ((a.ambiguity&&a.ambiguity.byUnit&&a.ambiguity.byUnit[u.id])||[]).forEach(hit=>{
      (hit.distribution||[]).slice(0,3).forEach((d,di)=>{
        const label=(d.sense?.label||[]).slice(0,5);
        if(!label.length)return;
        add({family:'distributional-sense',lens:'conceptual',statement:`O contexto distribucional de “${hit.raw||hit.word}” aproxima esta ocorrência do agrupamento [${label.join(', ')}] com probabilidade relativa de ${Math.round((d.prob||0)*100)}%; isso funciona apenas como reforço estatístico e não elimina os demais sentidos.`,support:clamp(.42+.28*(d.prob||0)+.18*Math.max(0,hit.separation||0)),evidence:[`PPMI/grafo:${hit.word}`,`separação:${hit.separation}`],source:'Ambiguo',status:'candidate',payload:{type:'distributional-sense',word:hit.word,label,prob:d.prob,separation:hit.separation}});
      });
    });


    ((a.rhetoricalHypotheses||[]).filter(r=>r.from===u.id||r.to===u.id)).forEach(r=>{
      const other=r.from===u.id?r.to:r.from;
      add({family:'implicit-rhetorical-relation',lens:['cause','consequence','condition','purpose','contrast'].includes(r.type)?'causal':'structure',statement:`Sem marcador explícito, a transição ${r.from} → ${r.to} admite como hipótese uma relação de ${r.type}; a base é ${r.basis}.`,support:r.confidence||.5,evidence:[`justaposição:${r.from}→${r.to}`,r.basis],anchors:[other],relation:r.type,source:'deep-rhetoric',status:'candidate',assumptions:['relação assindética: exige confirmação pelo conjunto'],payload:{type:'implicit-relation',from:r.from,to:r.to,relation:r.type}});
    });
    ((a.deepCoreference||[]).filter(c=>c.unit===u.id)).forEach(c=>{
      if(!c.chosen)return;
      add({family:'semantic-coreference',lens:'participants',statement:`A correferência de “${c.pronoun}” recebe reforço distribucional em favor de “${c.chosen.entity}” no contexto do predicado “${c.verb||'—'}”, sem excluir candidatos concorrentes.`,support:Math.min(.72,c.confidence||.5),evidence:[`similaridade semântica:${Math.round((c.chosen.semantic||0)*100)}%`,`recência:${Math.round((c.chosen.recency||0)*100)}%`],participants:[c.chosen.entity],source:'deep-coreference',status:'candidate',assumptions:['apoio estatístico, não resolução absoluta']});
    });

    (a.schLinks||[]).filter(l=>l.to===u.id||l.from===u.id).slice(0,8).forEach(l=>{
      const other=l.to===u.id?l.from:l.to,dir=l.to===u.id?'retoma/recebe':'projeta/afeta'; const info=REL[l.type]||[l.type,'mantém relação'];
      add({family:'interunit-relation',lens:['cause','consequence','purpose','condition','presence-absence-contrast','polarity-contrast'].includes(l.type)?'causal':'structure',statement:`${u.id} ${dir} ${other} por uma relação ${info[0]} (${l.basis||l.type}).`,support:l.confidence||.62,evidence:[`${l.from}→${l.to}`,l.basis||l.type],anchors:[other],relation:l.type,source:'schesitomeric',scope:'interunit',payload:{type:'interunit-relation',from:l.from,to:l.to,relation:l.type,basis:l.basis}});
    });

    const rawText=u.analysisText||u.text;
    if(/\b(rogo|peço|peco|exorto|suplico|ordeno|recomendo)(?:-\w+)?\b/i.test(rawText)){
      add({family:'speech-act-directive',lens:'pragmatic',statement:'A unidade contém um ato de fala diretivo ou exortativo: o locutor formula um pedido, apelo ou orientação dirigido aos destinatários.',support:.86,evidence:['verbo de apelo/exortação'],source:'pragmatics'});
    }
    if(/\b(eu|nós|nos|cada um|cada pessoa)\b[^:;.!?]{0,45}\b(sou|somos|é|e)\b[^:;.!?]{0,30}\bde\b/i.test(rawText) && (rawText.match(/\bde\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]+/g)||[]).length>=2){
      const names=(rawText.match(/\bde\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]+)/g)||[]).map(x=>x.replace(/^de\s+/i,''));
      add({family:'belonging-enumeration',lens:'participants',statement:`A unidade permite a hipótese de uma distribuição de pertencimento ou identificação por referentes diferentes (${uniq(names).join(', ')}).`,support:.84,evidence:['enumeração de “de + referente”','autodesignação/atribuição'],participants:uniq(names),source:'pattern'});
    }
    if(/\bnão\b[\s\S]{0,90}\bmas\b/i.test(rawText)){
      const parts=rawText.split(/\bmas\b/i);
      const left=(parts[0]||'').trim().slice(-110),right=(parts.slice(1).join(' mas ')||'').trim().slice(0,130);
      add({family:'corrective-contrast',lens:'causal',statement:`A construção “não … mas …” permite uma leitura corretiva: “${left}” é restringido ou negado em favor de “${right}”.`,support:.90,evidence:['não … mas …'],relation:'contrast',source:'pattern'});
    }
    if(/\bpara que\b/i.test(rawText)){
      const parts=rawText.split(/\bpara que\b/i);
      add({family:'purpose-span',lens:'causal',statement:`A oração introduzida por “para que” apresenta como finalidade o conteúdo “${(parts.slice(1).join(' para que ')||'').trim().slice(0,150)}”.`,support:.91,evidence:['para que'],relation:'purpose',source:'pattern'});
    }
    if(/^\s*(pois|porque)\b/i.test(rawText)){
      const marker=(rawText.match(/^\s*(pois|porque)\b/i)||[])[1]||'porque';
      add({family:'explanatory-opening',lens:'causal',statement:`A abertura por “${marker}” favorece a leitura de que esta unidade fornece razão, explicação ou fundamento para uma formulação anterior.`,support:marker.toLowerCase()==='porque'?.90:.78,evidence:[`abertura:${marker}`],relation:'cause',source:'pattern'});
    }
    const neighborInterrogative=(a.units[index-1]?.modality==='interrogative'||a.units[index+1]?.modality==='interrogative');
    if(u.modality==='interrogative'){
      add({family:'question',lens:'pragmatic',statement:'A forma interrogativa pode funcionar como pedido real de informação.',support:.48,evidence:['modalidade interrogativa'],assumptions:['função pragmática não explicitada'],source:'modality'});
      add({family:'rhetorical-question',lens:'pragmatic',statement:'A forma interrogativa também permite a hipótese de pergunta retórica usada para testar ou negar uma consequência pressuposta.',support:.64,evidence:['modalidade interrogativa','contexto discursivo necessário'],assumptions:['requer confirmação pelo encadeamento'],source:'modality'});
      if(neighborInterrogative)add({family:'interrogative-sequence',lens:'pragmatic',statement:'Por integrar uma sequência de perguntas, a unidade pode funcionar como parte de um teste argumentativo aplicado à formulação anterior, e não apenas como solicitação isolada de informação.',support:.76,evidence:['sequência interrogativa'],assumptions:['função retórica depende do contexto anterior'],source:'pragmatics'});
    } else if(u.modality==='imperative'){
      add({family:'directive',lens:'pragmatic',statement:'A unidade possui força diretiva/exortativa: sua forma verbal orienta uma resposta do destinatário, em vez de apenas descrever um estado.',support:.90,evidence:['modalidade imperativa'],source:'modality'});
    } else add({family:'assertion',lens:'pragmatic',statement:'A unidade é formulada predominantemente como declaração, sem marca interrogativa ou imperativa dominante.',support:.52,evidence:['modalidade declarativa'],source:'modality'});

    (u.epistemic||[]).forEach(e=>add({family:'epistemic',lens:'pragmatic',statement:`A unidade contém a marca epistêmica “${e.kind}”, que limita o grau com que seu conteúdo pode ser tomado como afirmação plena.`,support:e.confidence||.70,evidence:[e.kind],source:'epistemic'}));

    (a.coreference||[]).filter(c=>c.unit===u.id).forEach(c=>add({family:'coreference',lens:'participants',statement:`O pronome “${c.pronoun}” é compatível com a retomada de “${c.entity}”.`,support:c.confidence||.70,evidence:[`correferência:${c.pronoun}→${c.entity}`],participants:[c.entity],source:'coreference'}));
    (a.discourseCoreference||[]).filter(c=>c.unit===u.id).forEach(c=>add({family:'discourse-coreference',lens:'participants',statement:`A expressão “${c.expression}” retoma o conjunto anterior formado por ${c.terms.slice(0,8).join(', ')}${c.terms.length>8?'…':''}.`,support:c.confidence||.80,evidence:[`retomada:${(c.antecedentUnits||[]).join('/')}`],anchors:c.antecedentUnits||[],concepts:c.terms,source:'discourse-coreference'}));

    const properNames=uniq((u.morph||[]).filter(t=>t.pos==='proper').map(t=>t.surface));
    if(properNames.length>=2)add({family:'participant-constellation',lens:'participants',statement:`A unidade coloca em relação os participantes nomeados ${properNames.join(', ')}; a função dessa relação permanece aberta até ser comparada com as unidades vizinhas.`,support:.70,evidence:['nomes próprios na mesma unidade'],participants:properNames,source:'reference'});

    if(macro)add({family:'macro-role',lens:'structure',statement:`Dentro da partição macroargumentativa atual, ${u.id} pertence a ${macro.id}, classificado provisoriamente como “${macro.function}”.`,support:Math.min(.58,macro.confidence||.58),evidence:[macro.id,macro.function],anchors:macro.unitIds||[],assumptions:['rótulo macro provisório'],source:'macroargumentation'});
    (eq?.possible||[]).forEach(p=>add({family:'equideque-possible',lens:'conceptual',statement:`A Equídeque conserva a possibilidade local “${p.kind}” porque ela é compatível com os observáveis desta unidade.`,support:p.confidence||.60,evidence:[p.kind],source:'equideque'}));

    concepts.slice(0,6).forEach((c,i)=>add({family:'conceptual-role',lens:'conceptual',statement:`“${c}” pode participar da organização semântica desta unidade, mas sua centralidade depende de reaparecer e cooperar com relações posteriores.`,support:clamp(.54-i*.03),evidence:[`conceito:${c}`],concepts:[c],assumptions:['centralidade ainda não demonstrada'],source:'conceptual'}));

    // Combinações locais: ampliam o espaço sem inventar conteúdo novo.
    const seeds=list.slice().sort((a,b)=>b.support-a.support).slice(0,12);
    outer: for(let i=0;i<seeds.length;i++) for(let j=i+1;j<seeds.length;j++){
      if(list.length>=capN)break outer;
      const a1=seeds[i],a2=seeds[j]; if(a1.family===a2.family)continue;
      add({family:`compound:${a1.family}+${a2.family}`,lens:a1.lens===a2.lens?a1.lens:'integrative',statement:`Uma leitura composta pode conservar simultaneamente que ${low(a1.statement.replace(/\.$/,''))} e que ${low(a2.statement.replace(/\.$/,''))}.`,support:clamp((a1.support+a2.support)/2-.04),evidence:[...a1.evidence,...a2.evidence],anchors:[...a1.anchors,...a2.anchors],participants:[...a1.participants,...a2.participants],concepts:[...a1.concepts,...a2.concepts],assumptions:[...a1.assumptions,...a2.assumptions],relation:a1.relation||a2.relation,source:'composition'});
    }

    return list.sort((a,b)=>b.support-a.support).slice(0,capN).map((h,i)=>({...h,rank:i+1}));
  }

  function jaccard(a,b){const A=new Set(a||[]),B=new Set(b||[]);if(!A.size&&!B.size)return 0;let inter=0;A.forEach(x=>{if(B.has(x))inter++});return inter/(A.size+B.size-inter||1)}
  function relationBetween(a,from,to){return (a.schLinks||[]).filter(l=>l.from===from&&l.to===to).sort((x,y)=>(y.confidence||0)-(x.confidence||0))[0]||null;}
  function compatibility(a,path,cand){
    if(!path.choices.length)return cand.support;
    const prev=path.choices[path.choices.length-1],link=relationBetween(a,prev.unitId,cand.unitId);
    const part=jaccard(path.participants,cand.participants),conc=jaccard(path.concepts,cand.concepts);
    let discourse=0;if(link){discourse=(link.confidence||.5);if(cand.relation===link.type)discourse=Math.min(1,discourse+.12)}
    const macroPrev=macroForUnit(a,prev.unitId),macroCur=macroForUnit(a,cand.unitId),macro=macroPrev&&macroCur?(macroPrev.id===macroCur.id?.78:.72):.5;
    const assumptionPenalty=Math.min(.18,(cand.assumptions||[]).length*.045);
    return clamp(.50*cand.support+.16*part+.12*conc+.14*discourse+.08*macro-assumptionPenalty);
  }
  function pathSimilarity(p,q){return .45*jaccard(p.families,q.families)+.30*jaccard(p.concepts,q.concepts)+.25*jaccard(p.participants,q.participants)}
  function diverseTop(paths,width){
    const pool=paths.slice().sort((a,b)=>b.score-a.score),chosen=[];
    while(pool.length&&chosen.length<width){
      let bestIndex=0,bestValue=-1;
      for(let i=0;i<Math.min(pool.length,350);i++){
        const p=pool[i],sim=chosen.length?Math.max(...chosen.map(q=>pathSimilarity(p,q))):0;
        const v=p.score-.11*sim;if(v>bestValue){bestValue=v;bestIndex=i}
      }
      chosen.push(pool.splice(bestIndex,1)[0]);
    }
    return chosen;
  }
  function buildBeam(a,local,{width=50,pinned={}}={}){
    let beam=[],expansions=0,pruned=0;
    const units=a.units||[];
    units.forEach((u,idx)=>{
      let candidates=(local[u.id]||[]).slice();
      if(pinned[u.id]) candidates=candidates.map(c=>c.id===pinned[u.id]?{...c,support:Math.min(1,c.support+.18),pinned:true}:c);
      if(idx===0){beam=candidates.map(c=>({choices:[c],score:c.support,rawScore:c.support,participants:[...c.participants],concepts:[...c.concepts],families:[c.family],lenses:[c.lens],anchors:[...c.anchors]}));beam=diverseTop(beam,width);return}
      const next=[];
      beam.forEach(p=>candidates.forEach(c=>{
        expansions++;const comp=compatibility(a,p,c),score=clamp((p.score*idx+comp)/(idx+1));
        next.push({choices:[...p.choices,c],score,rawScore:score,participants:uniq([...p.participants,...c.participants]).slice(-20),concepts:uniq([...p.concepts,...c.concepts]).slice(-24),families:uniq([...p.families,c.family]),lenses:[...p.lenses,c.lens],anchors:uniq([...p.anchors,...c.anchors])});
      }));
      const before=next.length;beam=diverseTop(next,width);pruned+=Math.max(0,before-beam.length);
    });
    // Retrointerpretação: coerência com macroestrutura e fechamento.
    beam=beam.map(p=>{
      const coverage=new Set(p.choices.map(c=>macroForUnit(a,c.unitId)?.id).filter(Boolean)).size;
      const total=Math.max(1,(a.macro?.blocks||[]).length),macroCoverage=coverage/total;
      const closure=p.choices[p.choices.length-1];
      const finalBoost=.04*macroCoverage+.02*(closure?.support||0);
      return {...p,score:clamp(p.score+finalBoost),macroCoverage};
    }).sort((x,y)=>y.score-x.score);
    return {paths:beam,expansions,pruned};
  }

  const LENS_META={
    structure:{title:'Estrutura e progressão',desc:'privilegia a forma como proposições e blocos se encadeiam'},
    participants:{title:'Participantes e pertencimento',desc:'privilegia referentes, identidades, papéis e correferências'},
    causal:{title:'Causa, finalidade e consequência',desc:'privilegia dependências causais, finais e inferenciais'},
    conceptual:{title:'Conceitos e campos semânticos',desc:'privilegia conceitos que reaparecem e mudam de função'},
    pragmatic:{title:'Modalidade e força discursiva',desc:'privilegia pergunta, ordem, negação, certeza e uso pragmático'},
    integrative:{title:'Composição integrada',desc:'combina estrutura, participantes e conceitos em uma leitura de conjunto'}
  };
  function lensScores(path){const counts={};(path.lenses||[]).forEach(l=>counts[l]=(counts[l]||0)+1);return Object.fromEntries(Object.keys(LENS_META).map(k=>[k,(counts[k]||0)/Math.max(1,path.lenses.length)]));}
  function cleanSource(u){return String(u?.analysisText||u?.text||'').replace(/\s+/g,' ').trim()}
  function frameProposition(f){
    if(!f?.verb)return'';
    let txt=String(f.text||'').replace(/\s+/g,' ').trim();
    if(!txt){
      const s=f.subject?.text?`${f.subject.text} `:'';
      const n=f.negated?'não ':'';
      const aux=(f.auxiliaries||[]).map(x=>x.surface).join(' ');
      const chain=[aux,f.verb.surface||f.verb.lemma].filter(Boolean).join(' ');
      const o=f.predicative?.text?` ${f.predicative.text}`:(f.object?.text?` ${f.object.text}`:'');
      txt=`${s}${n}${chain}${o}`.replace(/\s+/g,' ').trim();
    }
    const marker=(f.openingMarker||f.marker||f.relationMarker||'').toLowerCase();
    if(marker){const safe=marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');txt=txt.replace(new RegExp('^\\s*'+safe+'[,:;]?\\s+','i'),'')}
    if(f.negated&&!/\b(não|nao|nem)\b/i.test(txt.slice(0,60)))txt='não '+txt;
    return txt.trim();
  }
  function strongestInternalRelation(u){return (u.relations||[]).filter(r=>r.scope!=='cross-unit-candidate'&&r.type!=='government').sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0]||null}
  function unitCompression(u){
    const frames=(u.frames||[]).filter(f=>f.verb),rel=strongestInternalRelation(u);
    const props=frames.map(frameProposition).filter(x=>x.split(/\s+/).length>=2);
    if(props.length>=2&&rel){
      const connector={contrast:'mas',cause:'porque',consequence:'por isso',purpose:'para que',comparison:'em comparação com',concession:'embora',addition:'e'}[rel.type]||'e';
      return `${cap(props[0])}, ${connector} ${low(props[1])}`.replace(/\s+/g,' ').trim();
    }
    if(props[0]&&props[0].split(/\s+/).length>=3)return cap(props[0]);
    const src=cleanSource(u);return src.length>190?src.slice(0,187)+'…':src;
  }
  function relationConnector(type){return ({cause:'porque',consequence:'por isso',contrast:'em contraste',concession:'ainda assim',purpose:'com essa finalidade',comparison:'em comparação',reformulation:'isto é',addition:'além disso','referential-continuity':'mantendo o mesmo referente','frame-continuity':'mantendo o mesmo domínio semântico','anaphoric-resumption':'retomando o que veio antes','presence-absence-contrast':'em oposição entre presença e ausência','polarity-contrast':'em oposição de polaridade','structural-parallelism':'em paralelo','linear-progression':'em seguida'}[type]||'em seguida')}
  function representativeUnits(a,block,path,lens){
    const ids=block.unitIds||[],choices=(path.choices||[]).filter(c=>ids.includes(c.unitId));
    const scored=new Map(ids.map((id,i)=>[id,{id,score:.15+(i===0||i===ids.length-1?.08:0)}]));
    choices.forEach(c=>{const x=scored.get(c.unitId)||{id:c.unitId,score:0};const lensBoost=(lens==='integrative'||c.lens===lens)?.10:0;x.score=Math.max(x.score,c.support+lensBoost);scored.set(c.unitId,x)});
    const top=[...scored.values()].sort((x,y)=>y.score-x.score).slice(0,Math.min(3,ids.length)).map(x=>x.id);
    return ids.filter(id=>top.includes(id)).map(id=>a.units.find(u=>u.id===id)).filter(Boolean);
  }
  function blockClaim(a,block,path,lens){
    const units=representativeUnits(a,block,path,lens),parts=units.map(unitCompression).filter(Boolean);
    const localChoices=(path.choices||[]).filter(c=>(block.unitIds||[]).includes(c.unitId));
    const anchors=uniq(localChoices.flatMap(c=>c.anchors).concat(block.unitIds||[]));
    const support=localChoices.length?localChoices.reduce((n,c)=>n+c.support,0)/localChoices.length:block.confidence||.5;
    let text='';
    if(parts.length===1)text=parts[0];
    else if(parts.length>1){
      const connected=[];
      for(let i=0;i<parts.length;i++){
        if(i===0){connected.push(parts[i]);continue}
        const from=units[i-1]?.id,to=units[i]?.id,link=(a.schLinks||[]).filter(l=>l.from===from&&l.to===to&&l.type!=='linear-progression').sort((x,y)=>(y.confidence||0)-(x.confidence||0))[0];
        connected.push(`${relationConnector(link?.type||'linear-progression')}, ${low(parts[i])}`);
      }
      text=connected.join('; ');
    }
    const role=block.function||'development';
    return {id:block.id,role,text:cap(text.replace(/[.;]+$/,''))+'.',anchors,support:clamp(support),unitIds:block.unitIds||[],keyTerms:block.keyTerms||[]};
  }
  function globalComposition(a,path,lens='integrative'){
    const blocks=(a.macro?.blocks||[]).map(b=>blockClaim(a,b,path,lens)).filter(b=>b.text);
    if(!blocks.length){
      const u=(a.units||[]).slice(0,3).map(unitCompression).filter(Boolean);
      return {blocks:[],relations:[],global:u.join(' '),anchors:uniq(path.anchors||[])};
    }
    const relations=a.macro?.relations||[];
    const sentences=[];
    blocks.forEach((b,i)=>{
      if(i===0){sentences.push(`Primeiro, ${low(b.text)}`);return}
      const r=relations.find(x=>x.from===blocks[i-1].id&&x.to===b.id)||relations[i-1];
      const lead=relationConnector(r?.type||'linear-progression');
      sentences.push(`${cap(lead)}, ${low(b.text)}`);
    });
    const global=`A passagem pode ser lida como um desenvolvimento em ${blocks.length} movimento${blocks.length===1?'':'s'}: ${sentences.join(' ')}`.replace(/\s+/g,' ').trim();
    return {blocks,relations,global,anchors:uniq(blocks.flatMap(b=>b.anchors))};
  }
  function constructionSummary(a,path,lens){
    const comp=globalComposition(a,path,lens),meta=LENS_META[lens]||LENS_META.integrative;
    return `${comp.global} Nesta construção, o critério privilegiado é ${meta.desc}.`;
  }
  function finalConstructions(a,beam,n=5){
    const paths=beam.paths||[],picked=[];
    const lensOrder=['structure','participants','causal','conceptual','pragmatic','integrative'];
    for(const lens of lensOrder){
      const candidates=paths.map(p=>({p,ls:lensScores(p)[lens]})).filter(x=>x.ls>.08).sort((x,y)=>(y.p.score+.12*y.ls)-(x.p.score+.12*x.ls));
      const best=candidates.find(x=>!picked.some(q=>pathSimilarity(q.path,x.p)>.83));if(best)picked.push({path:best.p,lens,lensWeight:best.ls});if(picked.length>=n)break;
    }
    for(const p of paths){if(picked.length>=n)break;if(!picked.some(q=>pathSimilarity(q.path,p)>.80))picked.push({path:p,lens:'integrative',lensWeight:.5})}
    return picked.slice(0,n).map((x,i)=>{
      const meta=LENS_META[x.lens]||LENS_META.integrative;const weak=x.path.choices.filter(c=>c.support<.62).slice(0,4);
      const comp=globalComposition(a,x.path,x.lens),anchors=uniq(comp.anchors.concat(x.path.choices.flatMap(c=>c.anchors)));
      return {id:`F${i+1}`,rank:i+1,title:meta.title,lens:x.lens,description:meta.desc,score:clamp(x.path.score+.04*x.lensWeight),coverage:(x.path.choices?.length||0)/Math.max(1,(a.units||[]).length),summary:`${comp.global} Nesta construção, o critério privilegiado é ${meta.desc}.`,macroComposition:comp,anchors,path:x.path,weakPoints:weak.map(c=>`${c.unitId}: ${c.statement}`),supporting:x.path.choices.slice().sort((p,q)=>q.support-p.support).slice(0,8)};
    });
  }

  function generate(analysis,opts={}){
    const local={};(analysis.units||[]).forEach((u,i)=>local[u.id]=buildLocal(analysis,u,i,opts.localCap||50));
    const beam=buildBeam(analysis,local,{width:opts.beamWidth||50,pinned:opts.pinned||{}});
    const finals=finalConstructions(analysis,beam,opts.finalCount||5);
    const localTotal=Object.values(local).reduce((n,x)=>n+x.length,0);
    return {version:'Apótica 1.4 / Hermeneia 4.5',local,beam,finals,stats:{units:analysis.units.length,localTotal,beamWidth:beam.paths.length,expansions:beam.expansions,pruned:beam.pruned,finalCount:finals.length}};
  }

  function mergeFinals(finals,analysis){
    const selected=finals||[];if(!selected.length)return null;
    const all=selected.flatMap(f=>f.path.choices),seen=new Map();
    all.forEach(c=>{const k=norm(c.statement);const prev=seen.get(k);if(!prev||c.support>prev.support)seen.set(k,c)});
    const choices=[...seen.values()].sort((a,b)=>b.support-a.support);
    // Para múltiplas construções, compõe um caminho representativo por unidade a partir das escolhas mais fortes.
    const byUnit=new Map();choices.forEach(c=>{const p=byUnit.get(c.unitId);if(!p||c.support>p.support)byUnit.set(c.unitId,c)});
    const mergedPath={choices:(analysis?.units||[]).map(u=>byUnit.get(u.id)).filter(Boolean),score:selected.reduce((n,x)=>n+x.score,0)/selected.length,anchors:uniq(selected.flatMap(x=>x.anchors)),participants:uniq(choices.flatMap(c=>c.participants)),concepts:uniq(choices.flatMap(c=>c.concepts)),families:uniq(choices.map(c=>c.family)),lenses:choices.map(c=>c.lens)};
    const preferredLens=selected.length===1?selected[0].lens:'integrative';
    const comp=analysis?globalComposition(analysis,mergedPath,preferredLens):(selected[0].macroComposition||null);
    const summary=comp?.global||selected.map(x=>x.summary).join(' ');
    return {id:selected.map(x=>x.id).join('+'),title:selected.map(x=>x.title).join(' + '),score:mergedPath.score,summary,choices,anchors:mergedPath.anchors,sourceFinals:selected.map(x=>x.id),macroComposition:comp};
  }

  return {generate,mergeFinals,POS_LABELS,REL,LENS_META,globalComposition};
})();

