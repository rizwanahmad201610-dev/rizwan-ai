import {json,validKey,postProvider} from './_common.mjs';
export const config={path:'/api/voice-token',rateLimit:{windowLimit:1,windowSize:180,aggregateBy:['ip','domain']}};
export default async function handler(request){
 if(request.method!=='POST')return json(405,{error:'Use POST.'});
 let body;try{body=await request.json()}catch{return json(400,{error:'Invalid voice request.'})}
 if(body?.provider!=='openai')return json(400,{error:'Live voice currently supports OpenAI keys only.'});
 if(!validKey(body.apiKey))return json(400,{error:'Enter your OpenAI API key in AI Settings before using voice.'});
 try{
  const result=await postProvider('https://api.openai.com/v1/realtime/client_secrets',body.apiKey,{
   expires_after:{anchor:'created_at',seconds:60},
   session:{type:'realtime',model:'gpt-realtime-mini',instructions:'You are Rizwan AI. Be friendly, clear, and age-appropriate.',audio:{output:{voice:'marin'}},max_output_tokens:180}
  });
  if(!result.ok)return json(result.status,{error:result.error});
  if(!result.data?.value)return json(502,{error:'OpenAI did not provide a voice session token. Check Realtime API access.'});
  return json(200,{value:result.data.value});
 }catch{return json(502,{error:'Could not reach OpenAI live voice. Check the API key, Realtime model access and billing.'})}
}
