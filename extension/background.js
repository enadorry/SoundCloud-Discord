const endpoint='http://127.0.0.1:32145';
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
 if(m.type==='track'){
  if(!sender.tab||!/^https:\/\/(www\.)?soundcloud\.com\//.test(sender.url||''))return;
  (async()=>{const {key}=await chrome.storage.local.get('key');if(!key)return {error:'ペアリングキーを保存してください'};
   const response=await fetch(endpoint+'/api/track',{method:'POST',headers:{'Content-Type':'application/json','X-Pair-Key':key},body:JSON.stringify({...m,tab:String(sender.tab.id)}),signal:AbortSignal.timeout(3000)});return response.json();
  })().then(v=>{chrome.storage.local.set({lastError:v.error||'',lastContact:Date.now()});respond(v);}).catch(()=>{chrome.storage.local.set({lastError:'START.cmdで連携プログラムを起動してください'});respond({ok:false});});return true;
 }
});
