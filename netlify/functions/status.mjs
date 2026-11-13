import {json} from './_common.mjs';
export const config={path:'/api/status'};
export default async function handler(request){
 if(request.method!=='GET')return json(405,{error:'Use GET.'});
 return json(200,{online:true,mode:'bring-your-own-key',environmentVariablesRequired:false,passwordRequired:false});
}
