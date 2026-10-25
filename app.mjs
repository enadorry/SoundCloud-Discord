import http from 'node:http';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {Discord,TrackStore,normalize,activity} from './lib.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),configPath=path.join(root,'config.json');
let config={clientId:'',key:randomBytes(24).toString('hex'),enabled:true};
try{config={...config,...JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''))};}catch{}
const save=()=>fs.writeFileSync(configPath,JSON.stringify(config,null,2));save();
const port=Number(process.env.SC_PORT||32145),origin=`http://127.0.0.1:${port}`,discord=new Discord(),tracks=new TrackStore();
let sent='',lastSend=0,busy=false,applied=false;
// Clear connection-specific cache so a restarted Discord receives the current song.
 discord.on('ready',()=>{sent='';lastSend=0;applied=false;});
async function tick(){if(busy)return;busy=true;try{
 await discord.connect(config.clientId);
 const a=activity(config.enabled?tracks.current():null);
 const signature=JSON.stringify(a?{...a,timestamps:a.timestamps?{end:Math.round(a.timestamps.end/5)*5}:undefined}:null);
 if(discord.ready&&(!applied||signature!==sent)&&Date.now()-lastSend>2000){lastSend=Date.now();if(await discord.set(a)){sent=signature;applied=true;}}
}finally{busy=false;}}
const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const server=http.createServer(async(req,res)=>{
 const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 if(req.headers.host!==`127.0.0.1:${port}`)return reply(403,{error:'Host rejected'});
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline'; img-src 'self' https://*.sndcdn.com; script-src 'self'; frame-ancestors 'none'"});return res.end(fs.readFileSync(path.join(root,'panel.html')));}
 if(req.method==='GET'&&req.url==='/panel.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(root,'panel.js')));}
 const local=req.headers.origin===origin;
 if(req.method==='GET'&&req.url==='/api/status'){
  if(req.headers['x-local-panel']!=='1'||(req.headers.origin&&!local))return reply(403,{});
  return reply(200,{...config,discord:discord.status,connected:discord.ready,track:tracks.current(),applied});
 }
 if(req.method!=='POST')return reply(404,{});
 const extension=/^chrome-extension:\/\/[a-p]{32}$/.test(req.headers.origin||'');
 if(req.url==='/api/track'&&((req.headers.origin&&!extension)||!equal(req.headers['x-pair-key'],config.key)))return reply(403,{error:'設定画面のペアリングキーを拡張機能に保存してください'});
 if(req.url==='/api/config'&&(!local||req.headers['x-local-panel']!=='1'))return reply(403,{});
 if(!['/api/track','/api/config'].includes(req.url))return reply(404,{});
 let size=0,chunks=[];
 try{for await(const chunk of req){size+=chunk.length;if(size>8192){reply(413,{});req.destroy();return;}chunks.push(chunk);}
  const body=JSON.parse(Buffer.concat(chunks).toString());
  if(req.url==='/api/config'){
   if(typeof body.clientId!=='string'||!/^\d{17,22}$/.test(body.clientId))return reply(400,{error:'Application IDは17〜22桁の数字です'});
   if(config.clientId!==body.clientId){await discord.set(null);discord.close();}
   config.clientId=body.clientId;config.enabled=body.enabled!==false;save();
  }else{if(typeof body.tab!=='string'||body.tab.length>100)throw Error('タブIDが不正です');tracks.update(body.tab,normalize(body));}
  reply(200,{ok:true});void tick();
 }catch(e){reply(400,{error:e.message});}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'すでに起動中です。http://127.0.0.1:32145 を開いてください。':e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{console.log(`SoundCloud → Discord\n設定画面: ${origin}\n終了: Ctrl+C`);setInterval(()=>void tick(),2000).unref();void tick();if(process.env.SC_OPEN_PANEL==='1'&&process.platform==='win32'){const browser=spawn('cmd.exe',['/c','start','',origin],{windowsHide:true,stdio:'ignore'});browser.on('error',()=>{});browser.unref();}});
async function shutdown(){await discord.set(null);discord.close();server.close();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);


