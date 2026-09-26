window.HermeneiaCache = (()=>{
  'use strict';
  const DB='Hermeneia44Cache', STORE='kv', VER=1;
  function supported(){return typeof indexedDB!=='undefined'}
  function open(){return new Promise((resolve,reject)=>{if(!supported())return reject(new Error('IndexedDB indisponível'));const r=indexedDB.open(DB,VER);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Falha no IndexedDB'))})}
  async function put(key,value){try{const db=await open();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();return true}catch(_){return false}}
  async function get(key){try{const db=await open();const v=await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});db.close();return v||null}catch(_){return null}}
  const k=s=>'lex:'+String(s||'');
  async function putBundle(bundle){if(!bundle)return false;const lex=bundle.lexical||{},sem=bundle.semantic||{};const jobs=[];Object.keys(lex).forEach(x=>jobs.push(put(k(x),{lexical:lex[x],semantic:sem[x]||null,at:Date.now()})));if(bundle.morphology)jobs.push(put('morphology',bundle.morphology));await Promise.all(jobs);return true}
  async function getBundle(keys){const lexical={},semantic={};let hits=0;for(const key of (keys||[])){const x=await get(k(key));if(x&&x.lexical){lexical[key]=x.lexical;if(x.semantic)semantic[key]=x.semantic;hits++}}const morphology=await get('morphology');return hits||morphology?{lexical,semantic,morphology:morphology||{},cache:{hits,requested:(keys||[]).length,source:'IndexedDB'}}:null}
  return {supported,put,get,putBundle,getBundle};
})();

