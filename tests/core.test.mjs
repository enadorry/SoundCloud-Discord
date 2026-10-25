import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {frame,Decoder,normalize,activity,TrackStore,Discord,normalizeArtwork} from '../lib.mjs';
const t=normalize({title:'テスト曲',artist:'Artist',playing:true,url:'https://soundcloud.com/artist/track?secret=1',position:15,duration:180,artwork:'https://i1.sndcdn.com/artworks-example-t50x50.jpg'});
test('fragmented/coalesced UTF-8 IPC frames',()=>{const d=new Decoder(),b=Buffer.concat([frame(1,{title:'日本語🎵'}),frame(3,{ping:true})]);assert.deepEqual(d.push(b.subarray(0,7)),[]);assert.deepEqual(d.push(b.subarray(7)),[[1,{title:'日本語🎵'}],[3,{ping:true}]]);});
test('reject oversized frame',()=>{const b=Buffer.alloc(8);b.writeUInt32LE(2000000,4);assert.throws(()=>new Decoder().push(b));});
test('sanitize track URLs, strings and times',()=>{assert.equal(t.url,'https://soundcloud.com/artist/track');assert.equal(normalize({url:'https://evil.test',position:-3,title:'\u0000x'}).url,'');assert.equal(normalize({title:123}).playing,false);assert.equal(normalize({position:Infinity}).position,0);});
test('listening activity, progress and pause',()=>{const a=activity(t,1000000);assert.equal(a.type,2);assert.equal(a.status_display_type,2);assert.equal(a.details,'テスト曲');assert.equal(activity({...t,title:'次の曲'}).details,'次の曲');assert.deepEqual(a.timestamps,{start:985,end:1165});assert.equal(activity({...t,playing:false}),null);});
test('multiple tabs: newest playing wins, paused tabs do not clear another tab',()=>{const s=new TrackStore();s.update('a',t,100);s.update('b',{...t,title:'B'},200);assert.equal(s.current(300).title,'B');s.update('b',{...t,playing:false},400);assert.equal(s.current(500).title,t.title);assert.equal(s.current(91000),null);});
test('content script reads SoundCloud player fixture and detects pause',()=>{let playing=true,interval;const out=[];const nodes={'.playbackSoundBadge__avatar .sc-artwork':{style:{backgroundImage:'url("https://i1.sndcdn.com/artworks-fixture-t50x50.jpg")'}},'.playbackSoundBadge__titleLink':{getAttribute:()=>t.title,href:t.url},'.playbackSoundBadge__lightLink':{textContent:'Artist'},'.playbackTimeline__timePassed span[aria-hidden="true"]':{textContent:'1:23'},'.playbackTimeline__duration span[aria-hidden="true"]':{textContent:'4:56'}};vm.runInNewContext(fs.readFileSync(new URL('../extension/content.js',import.meta.url),'utf8'),{document:{querySelector:s=>s==='.playControls__play.playing'?(playing?{}:null):nodes[s],addEventListener(){}},chrome:{runtime:{sendMessage:(m,cb)=>{out.push(m);cb();}}},setInterval:fn=>{interval=fn;return 1;},clearInterval(){},Date});assert.equal(out[0].artwork,'https://i1.sndcdn.com/artworks-fixture-t50x50.jpg');assert.equal(out[0].position,83);assert.equal(out[0].duration,296);assert.equal(out[0].playing,true);playing=false;interval();assert.equal(out.at(-1).playing,false);});
test('Windows pipe path is literal',()=>assert.equal(new Discord().paths[0],String.raw`\\?\pipe\discord-ipc-0`));
test('IPC handshake, ping, SET_ACTIVITY acknowledgement, error and reconnect',async()=>{
 const pipe=process.platform==='win32'?String.raw`\\?\pipe\sc-rpc-test-${process.pid}`:path.join(os.tmpdir(),`sc-rpc-test-${process.pid}.sock`);
 const received=[];let active;
 const server=net.createServer(s=>{active=s;const d=new Decoder();s.on('data',chunk=>{for(const[op,p]of d.push(chunk)){received.push([op,p]);if(op===0){s.write(frame(1,{evt:'READY'}));s.write(frame(3,{ping:1}));}if(p.cmd==='SET_ACTIVITY')s.write(frame(1,p.args.activity?.details==='fail'?{evt:'ERROR',nonce:p.nonce,data:{message:'Rejected'}}:{nonce:p.nonce,cmd:'SET_ACTIVITY',data:{}}));}});});
 server.listen(pipe);await once(server,'listening');const d=new Discord([pipe]);
 try{const ready=once(d,'ready');await d.connect('123456789012345678');await ready;assert.equal(await d.set(activity(t)),true);const published=received.find(([,p])=>p.cmd==='SET_ACTIVITY')[1].args.activity;assert.equal(published.details,'テスト曲');assert.equal(published.status_display_type,2);assert.equal(published.state,'Artist');assert.equal(published.assets.large_image,'https://i1.sndcdn.com/artworks-example-t500x500.jpg');assert.equal(await d.set({details:'fail'}),false);assert.match(d.status,/Rejected/);assert.equal(await d.set(null),true);assert.ok(received.some(([op])=>op===4));active.destroy();await once(d.socket,'close');const next=once(d,'ready');await d.connect('123456789012345678');await next;assert.equal(await d.set(activity(t)),true);}finally{d.close();active?.destroy();await new Promise(r=>server.close(r));}
});
test('local HTTP: origin, pairing key, config validation and track round trip',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sc-discord-'));
 for(const f of ['app.mjs','lib.mjs','panel.html','panel.js'])fs.copyFileSync(new URL('../'+f,import.meta.url),path.join(dir,f));
 const port=40000+process.pid%10000;
 const child=spawn(process.execPath,['app.mjs'],{cwd:dir,env:{...process.env,SC_PORT:String(port),SC_OPEN_PANEL:'0'},stdio:['ignore','pipe','pipe']});
 const base=`http://127.0.0.1:${port}`;
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),5000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',code=>{clearTimeout(timer);reject(Error('server exit '+code));});});
  assert.equal((await fetch(base)).status,200);
  assert.equal((await fetch(base+'/api/status')).status,403);
  const s=await(await fetch(base+'/api/status',{headers:{'X-Local-Panel':'1'}})).json();
  const headers={'Content-Type':'application/json',Origin:'chrome-extension://'+'a'.repeat(32),'X-Pair-Key':s.key};
  assert.equal((await fetch(base+'/api/track',{method:'POST',headers:{...headers,'X-Pair-Key':'bad'},body:JSON.stringify({...t,tab:'1'})})).status,403);
  assert.equal((await fetch(base+'/api/track',{method:'POST',headers,body:JSON.stringify({...t,tab:'1'})})).status,200);
  const state=await(await fetch(base+'/api/status',{headers:{'X-Local-Panel':'1'}})).json();assert.equal(state.track.title,t.title);assert.equal(state.track.artwork,'https://i1.sndcdn.com/artworks-example-t500x500.jpg');
  assert.equal((await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-Local-Panel':'1'},body:JSON.stringify({clientId:'bad'})})).status,400);
  assert.equal((await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.test','X-Local-Panel':'1'},body:'{}'})).status,403);
 }finally{if(child.exitCode===null){child.kill();await once(child,'exit');}fs.rmSync(dir,{recursive:true,force:true});}
});



test('artwork uses a high resolution SoundCloud image and rejects other URLs',()=>{
 assert.equal(normalizeArtwork('https://i1.sndcdn.com/artworks-demo-t50x50.jpg?x=1'),'https://i1.sndcdn.com/artworks-demo-t500x500.jpg');
 for(const url of ['http://i1.sndcdn.com/a.jpg','https://evil.test/a.jpg','https://i1.sndcdn.com.evil.test/a.jpg','https://user@i1.sndcdn.com/a.jpg','data:image/png,x','invalid'])assert.equal(normalizeArtwork(url),'');
 assert.equal(activity({...t,artwork:''}).assets,undefined);
 assert.equal(activity({...t,artwork:'https://i2.sndcdn.com/next-t500x500.png'}).assets.large_image,'https://i2.sndcdn.com/next-t500x500.png');
});
