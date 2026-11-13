// Keys are provided by each visitor for this request only; never stored on the server.
export const PROVIDERS=Object.freeze({
 openai:'https://api.openai.com/v1/chat/completions',
 openrouter:'https://openrouter.ai/api/v1/chat/completions',
 groq:'https://api.groq.com/openai/v1/chat/completions',
 together:'https://api.together.xyz/v1/chat/completions',
 deepseek:'https://api.deepseek.com/chat/completions',
 mistral:'https://api.mistral.ai/v1/chat/completions',
 gemini:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
});
export function json(status,body){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export function validKey(key){return typeof key==='string'&&key.length>=8&&key.length<=500&&!/[\r\n]/.test(key)}
export async function postProvider(endpoint,apiKey,payload){
 const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 let data;try{data=await response.json()}catch{return {ok:false,status:502,error:'The selected provider did not return valid JSON.'}}
 if(!response.ok){const raw=data?.error?.message||data?.message||'Provider rejected this request. Check its API key, model and billing.';return {ok:false,status:response.status>=500?502:422,error:String(raw).slice(0,260)}}
 return {ok:true,data};
}
