import net from 'node:net';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
export function frame(op,value){const d=Buffer.from(JSON.stringify(value)),h=Buffer.alloc(8);h.writeUInt32LE(op);h.writeUInt32LE(d.length,4);return Buffer.concat([h,d]);}
export class Decoder{
 buffer=Buffer.alloc(0);
 push(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);const out=[];while(this.buffer.length>=8){const size=this.buffer.readUInt32LE(4);if(size>1048576)throw Error('IPC frame too large');if(this.buffer.length<8+size)break;out.push([this.buffer.readUInt32LE(0),JSON.parse(this.buffer.subarray(8,8+size).toString())]);this.buffer=this.buffer.subarray(8+size);}return out;}
}
const clean=v=>typeof v==='string'?[...v.replace(/[\x00-\x1f]/g,'').trim()].slice(0,128).join(''):'';

export function normalizeArtwork(value){
 if(typeof value!=='string'||value.length>2048)return '';
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||!u.hostname.endsWith('.sndcdn.com')||u.username||u.password||u.port)return '';
  u.search='';u.hash='';
  u.pathname=u.pathname.replace(/-(?:t\d+x\d+|large|badge|small)(\.[a-z0-9]+)$/i,'-t500x500$1');
  return u.href;
 }catch{return '';}
}
export function normalize(v){
 if(!v||typeof v!=='object')throw Error('曲情報が不正です');let url='';
 try{const u=new URL(v.url);if(u.protocol==='https:'&&['soundcloud.com','www.soundcloud.com'].includes(u.hostname)){u.search='';u.hash='';url=u.href;}}catch{}
 const num=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?Math.min(n,604800):0;
 return {title:clean(v.title),artist:clean(v.artist),url,artwork:normalizeArtwork(v.artwork),playing:v.playing===true&&!!clean(v.title),position:num(v.position),duration:num(v.duration)};
}
export function activity(t,now=Date.now()){
 if(!t?.playing)return null;
 // Show the track title in compact status text as well as the profile card.
 const a={type:2,status_display_type:2,details:t.title.length<2?t.title+' ':t.title,state:t.artist.length>=2?t.artist:'SoundCloud'};
 if(t.duration>t.position)a.timestamps={start:Math.floor(now/1000-t.position),end:Math.floor(now/1000+t.duration-t.position)};
 if(t.artwork)a.assets={large_image:t.artwork,large_text:t.title};
 if(t.url)a.buttons=[{label:'SoundCloudで聴く',url:t.url}];return a;
}
export class TrackStore{
 tabs=new Map();
 update(id,t,now=Date.now()){const p=this.tabs.get(id);this.tabs.set(id,{...t,seen:now,started:t.playing&&(!p?.playing||p.url!==t.url||p.title!==t.title)?now:p?.started||0});}
 current(now=Date.now()){for(const[id,t]of this.tabs)if(now-t.seen>90000)this.tabs.delete(id);const t=[...this.tabs.values()].filter(t=>t.playing).sort((a,b)=>b.started-a.started)[0];return t?{...t,position:Math.min(t.duration||Infinity,t.position+(now-t.seen)/1000)}:null;}
}
export class Discord extends EventEmitter{
 socket=null;ready=false;connecting=false;status='Application IDを設定してください';pending=new Map();
 constructor(paths=Array.from({length:10},(_,i)=>String.raw`\\?\pipe\discord-ipc-${i}`)){super();this.paths=paths;}
 async connect(id){
  if(this.socket||this.connecting||!id)return;this.connecting=true;
  try{for(const path of this.paths){
   const s=net.createConnection(path);
   const ok=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),500);s.once('connect',()=>{clearTimeout(timer);resolve(true);});s.once('error',()=>{clearTimeout(timer);resolve(false);});});
   if(!ok){s.destroy();continue;}this.socket=s;const decoder=new Decoder();this.status='Discordに接続中';const timer=setTimeout(()=>s.destroy(),5000);
   s.on('data',chunk=>{try{for(const[op,p]of decoder.push(chunk)){
    if(op===3)s.write(frame(4,p));if(op===2){this.status='Discordが接続を終了しました';s.destroy();}
    if(p.evt==='READY'){clearTimeout(timer);this.ready=true;this.status='Discord接続済み';this.emit('ready');}
    if(p.evt==='ERROR')this.status=`Discordエラー: ${p.data?.message||p.data?.code}`;
    if(p.nonce&&this.pending.has(p.nonce)){const cb=this.pending.get(p.nonce);this.pending.delete(p.nonce);cb(p);}
   }}catch{this.status='Discord応答の解析に失敗';s.destroy();}});
   s.on('error',()=>{});s.once('close',()=>{clearTimeout(timer);if(this.socket===s){this.socket=null;this.ready=false;if(!this.status.includes('エラー'))this.status='Discord未接続（自動再接続）';for(const cb of this.pending.values())cb({evt:'ERROR'});this.pending.clear();}});
   s.write(frame(0,{v:1,client_id:id}));return;
  }this.status='Discordデスクトップ版を起動してください';}finally{this.connecting=false;}
 }
 async set(value){if(!this.ready)return false;const nonce=randomUUID();return new Promise(resolve=>{const timer=setTimeout(()=>{this.pending.delete(nonce);resolve(false);},5000);this.pending.set(nonce,p=>{clearTimeout(timer);const ok=p.evt!=='ERROR';if(ok)this.status='Discord接続済み';resolve(ok);});this.socket.write(frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:value},nonce}));});}
 close(){this.socket?.destroy();this.ready=false;}
}


