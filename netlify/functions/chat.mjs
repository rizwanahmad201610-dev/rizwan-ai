import {PROVIDERS,json,validKey,postProvider} from './_common.mjs';
export const config={path:'/api/chat',rateLimit:{windowLimit:6,windowSize:60,aggregateBy:['ip','domain']}};
export default async function handler(request){
 if(request.method!=='POST')return json(405,{error:'Use POST.'});
 let body;try{body=await request.json()}catch{return json(400,{error:'Invalid chat request.'})}
 const {provider,apiKey}=body||{};
 if(!Object.hasOwn(PROVIDERS,provider))return json(400,{error:'Choose a supported AI provider in Settings.'});
 if(!validKey(apiKey))return json(400,{error:'Enter a valid API key for your chosen provider.'});
 const model=String(body.model||'').trim();
 if(!model||model.length>120||/[\r\n]/.test(model))return json(400,{error:'Enter a valid model name.'});
 const input=Array.isArray(body.messages)?body.messages:[];
 if(!input.length||input.length>20)return json(400,{error:'Send between 1 and 20 messages.'});
 const messages=input.slice(-10).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,1200)})).filter(m=>m.content.trim());
 if(!messages.length||messages.at(-1).role!=='user')return json(400,{error:'Enter a message first.'});
 try{
  const result=await postProvider(PROVIDERS[provider],apiKey,{model,messages:[{role:'system',content:'You are Rizwan AI, an independent, kind and useful everyday assistant. Be honest and family-friendly.'},...messages],max_tokens:400,stream:false});
  if(!result.ok)return json(result.status,{error:result.error});
  const reply=result.data?.choices?.[0]?.message?.content;
  const text=typeof reply==='string'?reply:Array.isArray(reply)?reply.map(c=>c.text||'').join(''):'';
  return json(200,{reply:text.trim()||'The provider returned no text. Check that the selected model supports text chat.'});
 }catch{return json(502,{error:'Could not reach your chosen provider. Check the key, model, provider status and billing.'})}
}
