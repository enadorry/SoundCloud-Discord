(() => {
 const text=s=>document.querySelector(s)?.textContent?.trim()||'';
 function seconds(s){const p=s.trim().split(':').map(Number);return p.length>=2&&p.every(Number.isFinite)?p.reduce((n,v)=>n*60+v,0):0;}

 function artwork(){
  const image=document.querySelector('.playbackSoundBadge__avatar img');
  if(image?.currentSrc||image?.src)return image.currentSrc||image.src;
  for(const selector of ['.playbackSoundBadge__avatar .sc-artwork','.playbackSoundBadge__avatar [style*="background-image"]','.playbackSoundBadge__avatar']){
   const node=document.querySelector(selector);if(!node)continue;
   const background=node.style?.backgroundImage||(typeof getComputedStyle==='function'?getComputedStyle(node).backgroundImage:'');
   const match=background?.match(/url\(\s*["']?(.*?)["']?\s*\)/);if(match)return match[1];
  }
  return '';
 }
 function read(){
  const link=document.querySelector('.playbackSoundBadge__titleLink');
  const time=s=>seconds(text(s+' span[aria-hidden="true"]')||text(s));
  return {title:link?.getAttribute('title')||link?.textContent?.trim()||'',artist:text('.playbackSoundBadge__lightLink'),url:link?.href||'',artwork:artwork(),playing:!!document.querySelector('.playControls__play.playing'),position:time('.playbackTimeline__timePassed'),duration:time('.playbackTimeline__duration')};
 }
 let previous='',last=0,timer;
 function send(force=false){const data=read(),signature=JSON.stringify({...data,position:0});if(!force&&signature===previous&&Date.now()-last<10000)return;previous=signature;last=Date.now();try{chrome.runtime.sendMessage({type:'track',...data},()=>{if(chrome.runtime.lastError)clearInterval(timer);});}catch{clearInterval(timer);}}
 timer=setInterval(()=>send(),2000);send(true);
 document.addEventListener('visibilitychange',()=>send(true));
})();
