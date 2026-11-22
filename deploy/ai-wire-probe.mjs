// Offline probe of the exact OpenAI-compatible wire shape Kept sends (synthetic data only).
// Run inside the built image with no network, see deploy/AI-ADAPTER.md.
import http from 'node:http';
import { createRequire } from 'node:module';
const req = createRequire('/app/apps/server/package.json');
const { generateText, tool, jsonSchema, embedMany } = await import(req.resolve('ai'));
const { createOpenAICompatible } = await import(req.resolve('@ai-sdk/openai-compatible'));
const seen = []; let n = 0;
const srv = http.createServer((q, r) => { let b=''; q.on('data',c=>b+=c); q.on('end',()=>{
  const body = b ? JSON.parse(b) : null; seen.push({ method:q.method, url:q.url, auth:q.headers.authorization?'present':'absent', body }); n++;
  r.setHeader('content-type','application/json');
  if (q.url.endsWith('/embeddings')) return r.end(JSON.stringify({object:'list',data:body.input.map((_,i)=>({object:'embedding',index:i,embedding:[0.1,0.2,0.3]})),model:body.model,usage:{prompt_tokens:3,total_tokens:3}}));
  if (n===1) return r.end(JSON.stringify({id:'x1',object:'chat.completion',created:1,model:body.model,choices:[{index:0,finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id:'call_1',type:'function',function:{name:'search_things',arguments:'{"query":"rød skruetrækker"}'}}]}}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}}));
  r.end(JSON.stringify({id:'x2',object:'chat.completion',created:1,model:body.model,choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'Den ligger i [Rød skruetrækker](kept:thing/00000000-0000-0000-0000-000000000001).'}}],usage:{prompt_tokens:20,completion_tokens:9,total_tokens:29}}));
});});
await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
const base = `http://127.0.0.1:${srv.address().port}/v1`;
const p = createOpenAICompatible({ name:'custom', baseURL:base, apiKey:'synthetic', includeUsage:true, supportsStructuredOutputs:false });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const tools = { search_things: tool({ description:'Søg i brugerens ting', inputSchema: jsonSchema({type:'object',properties:{query:{type:'string'}},required:['query']}) }) };
const r1 = await generateText({ model:p('tf-chat'), system:'Du er Tingfinder.', messages:[{role:'user',content:[{type:'text',text:'Hvor er min røde skruetrækker?'},{type:'file',data:png,mediaType:'image/png'}]}], tools, toolChoice:'auto', maxRetries:0, maxOutputTokens:1200, providerOptions:{custom:{strictJsonSchema:false}} });
const tc = r1.toolCalls[0];
const r2 = await generateText({ model:p('tf-chat'), system:'Du er Tingfinder.', messages:[
  {role:'user',content:'Hvor er min røde skruetrækker?'},
  {role:'assistant',content:[{type:'tool-call',toolCallId:tc.toolCallId,toolName:tc.toolName,input:tc.input}]},
  {role:'tool',content:[{type:'tool-result',toolCallId:tc.toolCallId,toolName:tc.toolName,output:{type:'json',value:[{id:'00000000-0000-0000-0000-000000000001',title:'Rød skruetrækker',place:'Værksted, skuffe 2'}]}}]}],
  tools, toolChoice:'none', maxRetries:0 });
const e = await embedMany({ model:p.embeddingModel('tf-embed'), values:['rød skruetrækker','hammer'], maxRetries:0 });
const trim = s => JSON.stringify(s, (k,v)=> typeof v==='string'&&v.startsWith('data:')? v.slice(0,30)+'…':v);
for (const s of seen) console.log(trim(s));
console.log('RESULT tool:', trim(tc.input), '| text:', r2.text, '| finish:', r1.finishReason, r2.finishReason, '| usage:', r2.usage.inputTokens, r2.usage.outputTokens, '| emb:', e.embeddings.length, e.embeddings[0].length);
srv.close();
