/* Hermeneia 5.0.1 — compatibilidade entre microkernel e runtime remoto */
(function(){
  'use strict';
  function ensureElement(id, tag, parent){
    var el=document.getElementById(id);
    if(el)return el;
    el=document.createElement(tag);
    el.id=id;
    (parent||document.body||document.documentElement).appendChild(el);
    return el;
  }
  function ensure(){
    var endpoint=document.getElementById('searxEndpoint');
    var host=endpoint && endpoint.parentElement ? endpoint.parentElement : (document.body||document.documentElement);

    var domains=ensureElement('trustedDomains','textarea',host);
    domains.hidden=true;
    domains.setAttribute('aria-hidden','true');
    if(typeof domains.value!=='string')domains.value='';

    var status=document.getElementById('webSearchStatus');
    if(!status){
      status=document.createElement('div');
      status.id='webSearchStatus';
      status.className='provider-detail';
      status.style.marginTop='8px';
      if(endpoint && endpoint.parentElement){
        endpoint.parentElement.appendChild(status);
      }else{
        host.appendChild(status);
      }
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ensure,{once:true});
  }else{
    ensure();
  }
  window.HermeneiaCompat={ensure:ensure,version:'5.0.1'};
})();
