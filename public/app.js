'use strict';
const $=id=>document.getElementById(id);
const SAVED_CHATS='rizwan-ai-chats-device-only-v2';
const uid=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const defaultState=()=>({profile:{name:'Guest',color:'#4b9aff',bio:''},chats:[],activeChat:null,projects:[]});
// Every page load starts fresh. Only an explicit Save Chats action writes chats to device storage.
let state=defaultState();
let ai={provider:'openai',model:'gpt-4.1-mini',apiKey:''};
const save=()=>true;

function toast(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4800)}
function navigate(page){document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===`screen-${page}`));document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('page-heading').textContent=({chat:'AI Chat',voice:'Live Voice',web:'Website Creator',apps:'Python & Java',projects:'My Projects',profile:'My Profile',settings:'AI Settings'})[page]||'Rizwan AI';document.querySelector('.sidebar').classList.remove('shown');if(page==='projects')renderProjects();if(page==='chat')renderChats()}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
$('open-menu').onclick=()=>document.querySelector('.sidebar').classList.add('shown');$('close-menu').onclick=()=>document.querySelector('.sidebar').classList.remove('shown');
function applyTheme(){const col=state.profile?.color||'#4b9aff';document.documentElement.style.setProperty('--accent',col)}applyTheme();
function escaped(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function download(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
const downloadText=(text,filename,type='text/plain')=>download(new Blob([text],{type}),filename);
function cleanFilename(name){return String(name).trim().replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'-').slice(0,35)||'MyApp'}

// --- AI connection: visitor supplies a key for this session only ---
const PROVIDERS={
 openai:{model:'gpt-4.1-mini',voice:true},
 openrouter:{model:'openai/gpt-4o-mini',voice:false},
 groq:{model:'llama-3.3-70b-versatile',voice:false},
 together:{model:'meta-llama/Llama-3.3-70B-Instruct-Turbo',voice:false},
 deepseek:{model:'deepseek-chat',voice:false},
 mistral:{model:'mistral-small-latest',voice:false},
 gemini:{model:'gemini-2.5-flash',voice:false}
};
$('ai-provider').onchange=()=>{
 const provider=$('ai-provider').value;
 $('ai-model').value=PROVIDERS[provider]?.model||'';
 $('ai-key').value='';ai.apiKey='';
 $('ai-help').textContent='This provider needs its own API key. A ChatGPT login or a link to a website is not an API key.';
 updateAiLabel();
};
function updateAiLabel(){
 const ready=Boolean(ai.apiKey);
 $('connection-dot').classList.toggle('good',ready);
 $('connection-label').textContent=ready?`${ai.provider} connected (this session)`:'Enter your own AI key';
 $('ai-provider-note').textContent=PROVIDERS[ai.provider]?.voice?'Text chat and OpenAI live voice are supported.':'Text chat only for this provider. Live voice currently requires an OpenAI API key.';
}
$('ai-connect').onclick=()=>{
 const provider=$('ai-provider').value;
 const key=$('ai-key').value.trim();
 const model=$('ai-model').value.trim();
 if(!PROVIDERS[provider]||!key||!model){toast('Choose a provider, paste its API key, and enter a model.');return}
 if(key.length>500){toast('This API key is too long.');return}
 ai={provider,apiKey:key,model};
 $('ai-key').value='';
 $('setup-status').textContent=`Ready to try ${provider} / ${model}. The key lives only in memory and will disappear when you refresh or close this page. Try sending a chat message to verify the key.`;
 updateAiLabel();toast('Provider selected for this session. Key not stored.');
};
$('ai-forget').onclick=()=>{
 ai.apiKey='';$('ai-key').value='';updateAiLabel();
 $('setup-status').textContent='No API key is connected. Add your own key to start a chat.';
 toast('Key cleared from this tab.');
};
$('check-connection').onclick=checkStatus;
async function readJson(response){const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))throw Error('The AI endpoint returned a webpage instead of JSON. Deploy the entire folder to Netlify, including netlify/functions.');let payload;try{payload=await response.json()}catch{throw Error('AI server returned invalid JSON. Check Netlify deployment logs.')}if(!response.ok)throw Error(payload?.error||`AI request failed (${response.status}).`);return payload}
async function callApi(path,options={}){let response;try{response=await fetch(path,{...options,cache:'no-store'})}catch{throw Error('Cannot reach the AI server. Check your Netlify deployment.')}return readJson(response)}
async function checkStatus(){
 const output=$('setup-status');output.textContent='Checking Netlify server…';
 try{
  if(location.protocol==='file:')throw Error('This file is a preview. Publish the entire folder on Netlify for live AI.');
  await callApi('/api/status');
  output.textContent=ai.apiKey?`Server online. ${ai.provider} selected for this session. Send a test message to check the key.`:'Server online. Choose your provider and enter your own key below. No Netlify environment variables required.';
  updateAiLabel();
 }catch(e){$('connection-label').textContent='Preview / backend offline';$('connection-dot').classList.remove('good');output.textContent=e.message}
}
updateAiLabel();
// --- Chat ---
function newChat(){const chat={id:String(Date.now())+Math.random().toString(36).slice(2),title:'New chat',messages:[]};state.chats.unshift(chat);state.activeChat=chat.id;save();renderChats()}
function activeChat(){return state.chats.find(c=>c.id===state.activeChat)}
function renderChats(){if(!activeChat())newChatNoRender();$('chat-list').replaceChildren();for(const c of state.chats){const row=document.createElement('div');row.className='chat-item'+(state.activeChat===c.id?' selected':'');const open=document.createElement('button');open.className='chat-open';open.textContent=c.title;open.title=c.title;open.onclick=()=>{state.activeChat=c.id;save();renderChats()};const del=document.createElement('button');del.className='chat-delete';del.textContent='×';del.title='Delete chat';del.setAttribute('aria-label','Delete chat');del.onclick=()=>{if(!confirm('Delete this chat from this browser?'))return;state.chats=state.chats.filter(x=>x.id!==c.id);state.activeChat=state.chats[0]?.id||null;save();renderChats()};row.append(open,del);$('chat-list').append(row)}renderMessages()}
function newChatNoRender(){const c={id:String(Date.now())+Math.random().toString(36).slice(2),title:'New chat',messages:[]};state.chats.unshift(c);state.activeChat=c.id;save()}
function renderMessages(){const target=$('chat-messages');target.replaceChildren();const c=activeChat();if(!c||!c.messages.length){target.append(messageNode('assistant','Hi! I’m Rizwan AI. Ask me a question, or open Live Voice to talk with me.'));return}c.messages.forEach(m=>{const item=document.createElement('div');item.className='message '+m.role;if(m.role==='assistant'){const img=document.createElement('img');img.src='assets/rizwan-avatar.webp';img.alt='AI';item.append(img)}const b=document.createElement('div');b.className='bubble';b.textContent=m.content;item.append(b);target.append(item)});target.scrollTop=target.scrollHeight}
function messageNode(role,text){const el=document.createElement('div');el.className='message '+role;const b=document.createElement('div');b.className='bubble';b.textContent=text;el.append(b);return el}
$('new-chat').onclick=newChat;
$('save-chats').onclick=()=>{
 try{
  // Stored locally on this browser, never uploaded to the AI service or another laptop.
  localStorage.setItem(SAVED_CHATS,JSON.stringify({savedAt:new Date().toISOString(),chats:state.chats}));
  toast('Chats saved on this device. They will not appear on another computer.');
 }catch{toast('Browser storage unavailable. Use Download backup from My Projects instead.');}
};
$('load-chats').onclick=()=>{
 let record;
 try{record=JSON.parse(localStorage.getItem(SAVED_CHATS)||'null')}catch{}
 if(!record||!Array.isArray(record.chats)){toast('No saved chats on this device.');return}
 if(!confirm('Load chats saved on this device? This replaces the temporary chats currently open.'))return;
 state.chats=record.chats.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).slice(0,100);
 state.activeChat=state.chats[0]?.id||null;
 renderChats();toast('Saved chats loaded from this device.');
};
$('delete-saved-chats').onclick=()=>{
 if(!confirm('Delete the manually saved chats on THIS device?'))return;
 localStorage.removeItem(SAVED_CHATS);toast('Local saved chats deleted.');
};
let busy=false;
$('chat-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const input=$('chat-input').value.trim();if(!input)return;if(!ai.apiKey){navigate('settings');toast('Choose an AI provider and connect its key first.');return}const c=activeChat();if(!c)return;const messages=[...c.messages,{role:'user',content:input}].slice(-20);c.messages.push({role:'user',content:input});if(c.title==='New chat')c.title=input.slice(0,32);$('chat-input').value='';save();renderChats();busy=true;$('send-chat').disabled=true;$('chat-status').classList.remove('error');$('chat-status').textContent='Thinking…';try{const r=await callApi('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,provider:ai.provider,model:ai.model,apiKey:ai.apiKey})});c.messages.push({role:'assistant',content:r.reply});save();$('chat-status').textContent='Reply received.'}catch(err){$('chat-status').textContent=err.message;$('chat-status').classList.add('error');toast('Could not send: '+err.message)}finally{busy=false;$('send-chat').disabled=false;renderChats()}};
$('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit()}});

// --- Real voice: browser mic → OpenAI Realtime WebRTC → spoken output ---
let voicePC=null,voiceTrack=null,voiceAudio=null,voiceTimer=null,voiceBusy=false,voiceChannel=null,voiceMuted=false;
function voiceStatus(msg,mode=''){ $('voice-status').textContent=msg;$('voice-ring').classList.toggle('active',mode==='listening');$('voice-ring').classList.toggle('speaking',mode==='speaking') }
function stopVoice(msg='Voice ended. Click Start to talk again.'){clearTimeout(voiceTimer);voiceTimer=null;try{voiceChannel?.close()}catch{}voiceChannel=null;try{voicePC?.close()}catch{}voicePC=null;if(voiceTrack){voiceTrack.getTracks().forEach(t=>t.stop());voiceTrack=null}if(voiceAudio){voiceAudio.pause();voiceAudio.srcObject=null;voiceAudio.remove();voiceAudio=null}voiceBusy=false;voiceMuted=false;$('voice-start').disabled=false;$('voice-mute').disabled=true;$('voice-stop').disabled=true;$('voice-mute').textContent='Mute mic';voiceStatus(msg)}
$('voice-stop').onclick=()=>stopVoice();
$('voice-mute').onclick=()=>{if(!voiceTrack)return;voiceMuted=!voiceMuted;voiceTrack.getAudioTracks().forEach(t=>t.enabled=!voiceMuted);$('voice-mute').textContent=voiceMuted?'Unmute mic':'Mute mic';voiceStatus(voiceMuted?'Microphone muted.':'Listening…',voiceMuted?'':'listening')};
$('voice-start').onclick=async()=>{if(voiceBusy||voicePC)return;if(!ai.apiKey||ai.provider!=='openai'){navigate('settings');toast('Live voice needs your own OpenAI API key. Other providers support text chat only.');return}if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){voiceStatus('Live voice needs an HTTPS website and browser microphone permission.');return}voiceBusy=true;$('voice-start').disabled=true;voiceStatus('Requesting a secure voice session…');try{
 const token=await callApi('/api/voice-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:ai.apiKey,provider:ai.provider})});
 const pc=new RTCPeerConnection();voicePC=pc;const audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.style.display='none';document.body.appendChild(audio);voiceAudio=audio;
 pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>voiceStatus('Connected. Press play if the browser blocked audio.'))};
 pc.onconnectionstatechange=()=>{if(pc!==voicePC)return;if(pc.connectionState==='connected'){voiceStatus('Listening… speak naturally!', 'listening');$('voice-mute').disabled=false;$('voice-stop').disabled=false}else if(['failed','disconnected','closed'].includes(pc.connectionState)){stopVoice('Voice connection ended. Please try again.')}};
 voiceStatus('Allow microphone access to start talking…');voiceTrack=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});voiceTrack.getTracks().forEach(t=>pc.addTrack(t,voiceTrack));
 voiceChannel=pc.createDataChannel('oai-events');voiceChannel.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch{return}if(!voicePC)return;if(d.type==='input_audio_buffer.speech_started')voiceStatus('Listening…','listening');else if(d.type==='response.created')voiceStatus('Rizwan AI is speaking…','speaking');else if(d.type==='response.done')voiceStatus('Listening…','listening');else if(d.type==='error')voiceStatus('Voice provider: '+(d.error?.message||'Unknown error').slice(0,140))};
 const offer=await pc.createOffer();await pc.setLocalDescription(offer);
 const response=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${token.value}`,'Content-Type':'application/sdp'},body:offer.sdp});
 if(!response.ok){let error=await response.text();try{error=JSON.parse(error).error?.message||error}catch{}throw Error('Voice connection rejected: '+String(error).slice(0,160))}
 await pc.setRemoteDescription({type:'answer',sdp:await response.text()});
 voiceBusy=false;$('voice-stop').disabled=false;voiceTimer=setTimeout(()=>stopVoice('90-second voice session finished.'),90*1000);
 }catch(err){stopVoice('Could not start live voice: '+(err?.message||'unknown error'));toast('Voice error: '+(err?.message||'unknown error'))}};
window.addEventListener('pagehide',()=>stopVoice());

// --- Website builder ---
function websiteHTML(){const name=escaped($('web-name').value||'My Website'),sub=escaped($('web-subtitle').value),body=escaped($('web-body').value).replace(/\n/g,'<br>'),color=$('web-color').value;return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><style>body{margin:0;background:#f3f7fc;color:#10243b;font:17px system-ui,sans-serif}header{text-align:center;background:${color};color:white;padding:80px 20px}header h1{font-size:clamp(32px,5vw,58px)}main{max-width:850px;margin:38px auto;padding:35px;background:white;border-radius:20px;box-shadow:0 12px 35px #1232}footer{text-align:center;padding:25px;color:#456}</style></head><body><header><h1>${name}</h1><p>${sub}</p></header><main><h2>Welcome!</h2><p>${body}</p></main><footer>Made with Rizwan AI Website Creator</footer></body></html>`}
let importedHTML='';function getWebHTML(){return importedHTML||websiteHTML()}
function previewWeb(){$('web-frame').srcdoc=getWebHTML()}
$('web-preview-btn').onclick=()=>{importedHTML='';previewWeb();toast('Preview updated!')};
$('web-download-btn').onclick=()=>downloadText(getWebHTML(),'index.html','text/html');
$('web-save-btn').onclick=()=>{state.projects.unshift({id:uid(),type:'website',name:$('web-name').value||'My Website',data:getWebHTML(),created:new Date().toISOString()});save();toast('Website added to temporary Projects. Download or back it up before closing.')};
$('web-import').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;importedHTML=await file.text();$('web-name').value=file.name.replace(/\.html?$/i,'');previewWeb();toast('HTML imported. Preview is sandboxed.')};
for(const el of ['web-name','web-subtitle','web-body','web-color'])$(el).addEventListener('input',()=>{importedHTML='';previewWeb()});previewWeb();

// --- App kit ZIP exporter (creates ZIP and scripts; not the finished EXE) ---
function setVersions(){const lang=$('app-language').value;const versions=lang==='python'?['3.14','3.13','3.12','3.11','3.10','3.9','3.8','2.7 (legacy)']:['27','25','24','23','22','21','20','19','18','17','11 (legacy)','8 (legacy)'];$('app-version').replaceChildren();for(const v of versions){const op=document.createElement('option');op.value=v;op.textContent=(lang==='python'?'Python ':'Java ')+v;$('app-version').append(op)}}$('app-language').onchange=setVersions;setVersions();
function crc32(bytes){let crc=-1;for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}return (crc^-1)>>>0}
const bytes=s=>new TextEncoder().encode(s);
function zipFiles(files){let local=[],central=[],offset=0;for(const f of files){const name=bytes(f.name);const payload=f.data;const crc=crc32(payload);const l=new Uint8Array(30+name.length+payload.length),d=new DataView(l.buffer);d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);d.setUint32(14,crc,true);d.setUint32(18,payload.length,true);d.setUint32(22,payload.length,true);d.setUint16(26,name.length,true);l.set(name,30);l.set(payload,30+name.length);local.push(l);
const c=new Uint8Array(46+name.length),v=new DataView(c.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,payload.length,true);v.setUint32(24,payload.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=l.length}
const cs=central.reduce((t,x)=>t+x.length,0);const out=new Uint8Array(offset+cs+22);let cur=0;for(const x of [...local,...central]){out.set(x,cur);cur+=x.length}const end=new DataView(out.buffer);end.setUint32(cur,0x06054b50,true);end.setUint16(cur+8,files.length,true);end.setUint16(cur+10,files.length,true);end.setUint32(cur+12,cs,true);end.setUint32(cur+16,offset,true);return out}
async function icoFromFile(file){if(!file)return null;const data=new Uint8Array(await file.arrayBuffer());if(/\.ico$/i.test(file.name))return data;let img;try{img=await createImageBitmap(file)}catch{return null}const canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').drawImage(img,0,0,256,256);img.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const png=new Uint8Array(await blob.arrayBuffer());const out=new Uint8Array(22+png.length),v=new DataView(out.buffer);v.setUint16(0,0,true);v.setUint16(2,1,true);v.setUint16(4,1,true);out[6]=0;out[7]=0;out[8]=0;out[9]=0;v.setUint16(10,1,true);v.setUint16(12,32,true);v.setUint32(14,png.length,true);v.setUint32(18,22,true);out.set(png,22);return out}
$('app-kit').onclick=async()=>{const files=[...$('app-files').files];if(!files.length){toast('Upload your Python .py file or Java .jar file first.');return}const lang=$('app-language').value,name=cleanFilename($('app-name').value),version=$('app-version').value;const required=lang==='python'?'.py':'.jar';const main=files.find(f=>f.name.toLowerCase().endsWith(required));if(!main){toast(`Upload at least one ${required} file.`);return}const selected=$('app-icon').files?.[0];const icon=await icoFromFile(selected);const entries=[];for(const f of files){entries.push({name:'project/'+f.name.replace(/[\\/]/g,'_'),data:new Uint8Array(await f.arrayBuffer())})}if(icon)entries.push({name:'project/app.ico',data:icon});
let script,readme;
if(lang==='python'){
 const hasExtras=files.length>1;script=`@echo off\r\ntitle Build ${name}\r\ncd /d "%~dp0project"\r\npy -m pip install --upgrade pyinstaller\r\npy -m PyInstaller --noconfirm --clean --onefile --windowed --name "${name}" ${icon?'--icon "app.ico" ':''}${hasExtras?'--add-data ".;." ':''}"${main.name.replace(/"/g,'')}"\r\necho Find the app in project\\dist\\${name}.exe\r\npause\r\n`;
 readme=`RIZWAN AI - PYTHON BUILD KIT\n\nLanguage: Python ${version}\nApp name: ${name}\n1. On Windows, install Python ${version} (modern supported Python 3 is recommended).\n2. Extract this ZIP and double-click BUILD_ON_WINDOWS.bat.\n3. The script installs PyInstaller and builds a single app EXE in project/dist.\n4. The script does NOT make a click-through setup installer. For a setup wizard, use Inno Setup after building the app.\n5. Extra resources inside the onefile executable may need paths fixed in your Python source.\n6. Ask a parent before executing unknown software.\n`;
}else{
 script=`@echo off\r\ntitle Build ${name}\r\ncd /d "%~dp0"\r\nwhere jpackage >nul 2>&1\r\nif errorlevel 1 (echo ERROR: Install a JDK with jpackage, such as JDK 17 or newer. & pause & exit /b 1)\r\nif not exist "output" mkdir "output"\r\njpackage --type exe --input "project" --dest "output" --name "${name}" --main-jar "${main.name.replace(/"/g,'')}" ${icon?'--icon "project\\app.ico" ':''}--win-shortcut\r\necho Your Windows setup file should appear in output.\r\npause\r\n`;
 readme=`RIZWAN AI - JAVA BUILD KIT\n\nLanguage: Java ${version}\nApp name: ${name}\n1. On Windows, install JDK 17+ that contains jpackage (even if your JAR targets an older Java version).\n2. Ensure your JAR is runnable and has a Main-Class manifest entry.\n3. Windows installer creation may require WiX Toolset.\n4. Extract this ZIP and double-click BUILD_ON_WINDOWS.bat.\n5. It creates a Windows setup EXE in the output folder (if required tools are installed).\n6. Your program and resources must already work as a JAR.\n`;
}
 entries.push({name:'BUILD_ON_WINDOWS.bat',data:bytes(script)},{name:'README_FIRST.txt',data:bytes(readme)});
 const zip=zipFiles(entries);download(new Blob([zip],{type:'application/zip'}),`${name}_Windows_Build_Kit.zip`);
 let data='';if(zip.length<1_000_000){let binary='';for(let i=0;i<zip.length;i+=8192)binary+=String.fromCharCode(...zip.subarray(i,i+8192));data=btoa(binary)}
 state.projects.unshift({id:uid(),type:'appkit',name:`${name} (${lang})`,data,created:new Date().toISOString(),filename:`${name}_Windows_Build_Kit.zip`});save();$('app-notice').textContent=data?'Your build kit was downloaded and is in temporary Projects until this page closes. Export a backup to keep it.':'Downloaded! This kit is too large for browser storage; keep your ZIP file safe.';renderProjects();toast('Windows build kit ZIP downloaded. It is not the final EXE.')};

// --- Local projects and profile ---
function renderProjects(){const list=$('project-list');list.replaceChildren();if(!state.projects.length){const p=document.createElement('p');p.className='hint';p.textContent='No saved projects yet. Try Website Creator or Python & Java Builder.';list.append(p);return}for(const p of state.projects){const row=document.createElement('div');row.className='project-item';const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=p.name;const small=document.createElement('small');small.textContent=(p.type==='website'?'Website':'Windows build kit')+' · '+new Date(p.created).toLocaleDateString();info.append(strong,small);const controls=document.createElement('div');controls.className='button-row';const dl=document.createElement('button');dl.className='secondary';dl.textContent='Download';dl.disabled=!p.data;dl.onclick=()=>{if(p.type==='website')downloadText(p.data,'index.html','text/html');else{const binary=atob(p.data);const data=Uint8Array.from(binary,c=>c.charCodeAt(0));download(new Blob([data],{type:'application/zip'}),p.filename||'project.zip')}};const del=document.createElement('button');del.className='secondary danger';del.textContent='Delete';del.onclick=()=>{if(confirm('Delete this project from this browser?')){state.projects=state.projects.filter(x=>x.id!==p.id);save();renderProjects()}};controls.append(dl,del);row.append(info,controls);list.append(row)}}
$('export-backup').onclick=()=>downloadText(JSON.stringify(state,null,2),'Rizwan-AI-Backup.json','application/json');
$('import-backup').onclick=()=>$('backup-input').click();
$('backup-input').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const obj=JSON.parse(await f.text());if(!Array.isArray(obj.chats)||!Array.isArray(obj.projects))throw Error('Not a Rizwan AI backup.');if(!confirm('Replace the chats and projects saved in this browser with this backup?'))return;state={...defaultState(),...obj};save();renderChats();renderProjects();toast('Backup restored for this session. Export a new backup before closing.')}catch(err){toast('Could not import backup: '+err.message)}};
$('profile-name').value=state.profile.name;$('profile-color').value=state.profile.color;$('profile-bio').value=state.profile.bio;
$('profile-save').onclick=()=>{state.profile={name:$('profile-name').value.trim()||'Guest',color:$('profile-color').value,bio:$('profile-bio').value};save();applyTheme();toast('Profile updated for this session. It resets when you reopen.')};
renderChats();renderProjects();checkStatus();
