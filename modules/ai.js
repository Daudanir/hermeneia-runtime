window.HermeneiaAI = (() => {
  'use strict';
  const S={provider:'deterministic',session:null,generator:null,module:null,model:null,status:'idle',detail:'Redator determinístico',lastError:null};
  const STYLE_MATRIX=`Escreva em português brasileiro objetivo, didático e derivativo. Prefira períodos desenvolvidos que partem de uma proposição e explicitam observações, qualificações, distinções e consequências. Use com naturalidade os verbos ser e estar e construções com "que" quando isso torna as relações explícitas. Evite metáforas ornamentais, slogans, frases telegráficas e paralelismos artificiais. Sempre explique o estatuto de um conceito antes de utilizá-lo como conclusão. Diferencie claramente observação textual, inferência, hipótese, decisão do leitor e evidência externa.`;
  const SYSTEM=`Você é o Explicador subordinado do Hermeneia. O Hermeneia é o motor interpretativo; você não o substitui. Sua tarefa é converter estruturas lógicas em prosa compreensível e instrutiva.\nREGRAS:\n1. Nunca invente tese, referente, relação ou dado que não esteja na entrada.\n2. Nunca converta hipótese em fato.\n3. Nunca apresente evidência externa E como se fosse observação do texto T.\n4. Para cada conclusão técnica, explique o que significa, qual evidência a gerou, por que importa, o que permite e o que não permite concluir.\n5. Preserve divergências e graus de suporte.\n6. Se os dados forem insuficientes, diga que são insuficientes.\n7. O usuário é o intérprete final.\nMATRIZ DE REDAÇÃO:\n${STYLE_MATRIX}`;
  const FEWSHOT=[{role:'user',content:'DADO: U2 → U3 = consequence; suporte 0.72; marcador explícito: não; origem: hipótese.'},{role:'assistant',content:'A relação entre U2 e U3 foi mantida como possível consequência. Isso significa que U3 pode apresentar um resultado da situação formulada em U2. Como não há marcador explícito de consequência, a relação não deve ser tratada como dado sintático certo: ela permanece uma hipótese sustentada pelo encadeamento observado e pelo suporte de 72% nos critérios do motor.'}];
  function cfg(){return {pref:(document.getElementById('aiProviderPref')?.value||localStorage.getItem('hermeneia.ai.pref')||'auto'),model:(document.getElementById('webgpuModel')?.value||localStorage.getItem('hermeneia.ai.webgpuModel')||'onnx-community/Qwen2.5-0.5B-Instruct')}}
  function persist(){const c=cfg();try{localStorage.setItem('hermeneia.ai.pref',c.pref);localStorage.setItem('hermeneia.ai.webgpuModel',c.model)}catch(_e){}return c}
  function legacyNative(){return (globalThis.ai&&globalThis.ai.languageModel)||(globalThis.ai&&globalThis.ai.createTextSession?globalThis.ai:null)}
  async function detect(){const nativeAPI=typeof globalThis.LanguageModel!=='undefined'||!!legacyNative();let availability='unavailable';try{if(typeof globalThis.LanguageModel!=='undefined'&&globalThis.LanguageModel.availability)availability=await globalThis.LanguageModel.availability()}catch(_e){availability='unknown'}return {native:nativeAPI,nativeAvailability:availability,webgpu:!!navigator.gpu,deterministic:true,userAgent:navigator.userAgent}}
  async function createNative(){if(S.session&&S.provider==='native')return S.session;if(typeof globalThis.LanguageModel!=='undefined'){const av=globalThis.LanguageModel.availability?await globalThis.LanguageModel.availability():'available';if(av==='unavailable')throw new Error('LanguageModel nativo indisponível neste dispositivo.');S.status=(av==='downloadable'||av==='downloading')?'downloading':'loading';S.session=await globalThis.LanguageModel.create({initialPrompts:[{role:'system',content:SYSTEM},...FEWSHOT]});S.provider='native';S.status='ready';S.detail='LanguageModel nativo do navegador';return S.session}const legacy=legacyNative();if(legacy&&legacy.create){S.session=await legacy.create({systemPrompt:SYSTEM});S.provider='native';S.status='ready';S.detail='API nativa legada';return S.session}if(globalThis.ai&&globalThis.ai.createTextSession){S.session=await globalThis.ai.createTextSession();S.provider='native';S.status='ready';S.detail='window.ai legado';return S.session}throw new Error('Nenhuma Prompt API nativa foi encontrada.')}
  async function createWebGPU(progress){if(!navigator.gpu)throw new Error('WebGPU não está disponível neste navegador/dispositivo.');const c=persist();if(S.generator&&S.provider==='webgpu'&&S.model===c.model)return S.generator;S.status='loading';S.detail='Carregando Transformers.js / '+c.model;if(!S.module){S.module=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');S.module.env.allowLocalModels=false}S.generator=await S.module.pipeline('text-generation',c.model,{device:'webgpu',dtype:'q4',progress_callback:x=>{try{progress&&progress(x)}catch(_e){}}});S.provider='webgpu';S.model=c.model;S.status='ready';S.detail='WebGPU · '+c.model;return S.generator}
  async function activate(pref,progress){const c=persist();pref=pref||c.pref;S.lastError=null;if(pref==='deterministic'){S.provider='deterministic';S.status='ready';S.detail='Redator determinístico';return S}if(pref==='native'){await createNative();return S}if(pref==='webgpu'){await createWebGPU(progress);return S}try{await createNative();return S}catch(e1){S.lastError=e1}try{await createWebGPU(progress);return S}catch(e2){S.lastError=e2}S.provider='deterministic';S.status='ready';S.detail='Redator determinístico (fallback)';return S}
  function compact(x,n=12000){const z=typeof x==='string'?x:JSON.stringify(x);return z.length>n?z.slice(0,n)+'\n[conteúdo truncado]':z}
  function taskPrompt(task,data){const base={explain:'Explique o dado técnico abaixo para um leitor que precisa compreender exatamente o que ele significa, por que apareceu e que efeito pode ter na interpretação. Não escolha a interpretação pelo leitor.',research:'Compare a hipótese interna com as fontes E recuperadas. Separe claramente o que vem do texto/motor e o que vem das fontes externas. Indique convergências, divergências e lacunas, sem transformar frequência documental em verdade.',final:'Reescreva o plano lógico em prosa contínua, clara, acadêmica e didática. Preserve cada relação e grau epistêmico. Não acrescente nenhuma tese. Se houver fontes E, trate-as em seção distinta de aprofundamento externo.'}[task]||'Explique os dados fornecidos sem acrescentar conteúdo.';return `${base}\n\nDADOS CONTROLADOS:\n${compact(data)}\n\nResponda somente com a explicação solicitada em português brasileiro.`}
  function webgpuOutput(out){let g=Array.isArray(out)?out[0]?.generated_text:out?.generated_text;if(Array.isArray(g)){const last=g[g.length-1];g=last?.content||String(last||'')}if(typeof g!=='string')g=String(g||'');return g.trim()}
  async function run(task,data,opts={}){
    const fallback=String(opts.fallback||'').trim(), c=cfg(), pref=opts.provider||c.pref||'auto';
    // Chamadas de explicação são ações explícitas do usuário; portanto podem inicializar
    // automaticamente o melhor provedor local. O Redator continua sendo fallback obrigatório.
    if(pref!=='deterministic' && S.status==='idle'){try{await activate(pref,opts.progress)}catch(e){S.lastError=e}}
    if(pref==='deterministic'){S.provider='deterministic';S.status='ready'}
    const prompt=taskPrompt(task,data);
    async function execute(){
      let text='';
      if(S.provider==='native'){
        if(S.session?.prompt) text=await S.session.prompt(prompt);
        else if(S.session?.promptStreaming){let acc='';for await(const chunk of S.session.promptStreaming(prompt))acc+=chunk;text=acc}
      }else if(S.provider==='webgpu'){
        const messages=[{role:'system',content:SYSTEM},...FEWSHOT,{role:'user',content:prompt}];
        const out=await S.generator(messages,{max_new_tokens:opts.maxNewTokens||520,do_sample:false,return_full_text:false});
        text=webgpuOutput(out);
      }
      text=String(text||'').trim();
      if(text.length<20)throw new Error('Resposta local insuficiente.');
      return text;
    }
    if(S.provider==='deterministic')return {text:fallback,provider:'deterministic',fallback:true};
    try{return {text:await execute(),provider:S.provider,fallback:false}}
    catch(e1){
      S.lastError=e1;
      // No modo automático, falha da Prompt API tenta WebGPU antes de desistir.
      if(pref==='auto' && S.provider==='native' && navigator.gpu){
        try{S.session=null;await createWebGPU(opts.progress);return {text:await execute(),provider:S.provider,fallback:false,failover:'native→webgpu'}}catch(e2){S.lastError=e2}
      }
      return {text:fallback,provider:'deterministic',fallback:true,error:(S.lastError?.message||String(S.lastError||e1))};
    }
  }
  function status(){return {...S}}
  function reset(){try{S.session?.destroy?.()}catch(_e){}S.session=null;S.generator=null;S.provider='deterministic';S.status='idle';S.detail='Redator determinístico'}
  return {detect,activate,run,status,reset,STYLE_MATRIX,SYSTEM,persist};
})();

