import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import chat, {config as chatConfig} from '../netlify/functions/chat.mjs';
import voice from '../netlify/functions/voice-token.mjs';
import status from '../netlify/functions/status.mjs';
import {PROVIDERS} from '../netlify/functions/_common.mjs';
const originalFetch=globalThis.fetch;
function req(path,data){return new Request('https://my-site.netlify.app'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})}
const creds={provider:'groq',model:'llama-3.3-70b-versatile',apiKey:'test-key-1234567',messages:[{role:'user',content:'Hi'}]};
test('status says BYOK and no environment variables',async()=>{
 const r=await status(new Request('https://my-site.netlify.app/api/status')); const d=await r.json();assert.equal(d.online,true);assert.equal(d.environmentVariablesRequired,false);assert.equal(d.passwordRequired,false);
});
test('supported providers point to fixed HTTPS destinations',()=>{for(const u of Object.values(PROVIDERS))assert.match(u,/^https:\/\//);assert.equal(chatConfig.rateLimit.aggregateBy[0],'ip')});
test('forward provider key to only selected provider',async()=>{
 let target='',auth='',payload;
 globalThis.fetch=async(url,options)=>{target=url;auth=options.headers.Authorization;payload=JSON.parse(options.body);return Response.json({choices:[{message:{content:'Hello from Groq!'}}]})};
 const r=await chat(req('/api/chat',creds)); assert.equal(r.status,200);assert.equal((await r.json()).reply,'Hello from Groq!');assert.equal(target,PROVIDERS.groq);assert.equal(auth,'Bearer '+creds.apiKey);assert.equal(payload.model,creds.model);
});
test('arbitrary provider cannot trick server into fetching arbitrary URL',async()=>{
 const r=await chat(req('/api/chat',{...creds,provider:'http://127.0.0.1:80/secret'}));assert.equal(r.status,400);assert.match((await r.json()).error,/supported/i)
});
test('chat does not use site owner key',async()=>{
 delete process.env.OPENAI_API_KEY;
 const r=await chat(req('/api/chat',{...creds,apiKey:''}));assert.equal(r.status,400);assert.match((await r.json()).error,/key/i);
});
test('OpenAI voice token uses visitor key',async()=>{
 let auth='';globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/realtime/client_secrets');auth=options.headers.Authorization;return Response.json({value:'temporary-voice-token'})};
 const r=await voice(req('/api/voice-token',{provider:'openai',apiKey:'visitor-openai-key-123'}));assert.equal(r.status,200);assert.equal((await r.json()).value,'temporary-voice-token');assert.equal(auth,'Bearer visitor-openai-key-123');
});
test('voice refuses other providers',async()=>{const r=await voice(req('/api/voice-token',{provider:'groq',apiKey:'test-key-1234567'}));assert.equal(r.status,400)});
after(()=>{globalThis.fetch=originalFetch});
