import test from 'node:test';
import assert from 'node:assert/strict';
import {route, validateInput, buildRequest, validateAnswers} from './route.mjs';

const models = ['gpt-6-luna','gpt-6-sol','gpt-6-astra'].map(id => ({id, efforts:['low','medium','high','xhigh','max']}));
const input = (extra={}) => ({summary:'Implement an accessible form with field validation.', sanitized:true,
  privacy:'public', complexity:'standard', uncertain:true, availableModels:models, allowDelegation:true,
  independentUnits:1, skills:[{id:'frontend-engineering',description:'Build accessible web interfaces.',selected:true},
    {id:'spreadsheets',description:'Create and analyze workbooks.'}], ...extra});
function response(body, tier='standard', overrides={}) {
  const answers = {tier:{type:'choice',choice:tier,confidence:0.98,
    probabilities:Object.fromEntries(['focused','standard','frontier','unknown'].map(x=>[x,x===tier?0.99:0.01/3]))}};
  for (const [id,q] of Object.entries(body.questions)) {
    if(q.type==='noul') answers[id]={type:'noul',noul:id==='skill_0'?0.98:0.01};
    else if(id !== 'tier') answers[id]={type:'choice',choice:'standard',confidence:0.98,
      probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k==='standard'?1:0]))};
  }
  return {model:'jev-1.0.0', answers:{...answers,...overrides}, usage:{input_tokens:500,output_tokens:80}};
}
const deps = (tier='standard', overrides={}) => ({getApiKey:()=> 'test-key', fetchImpl:async (url,options)=>{
  assert.equal(url,'https://api.typesafe.ai/v1/systemone'); assert.equal(options.redirect,'error');
  const body=JSON.parse(options.body); assert.ok(!JSON.stringify(body).includes('test-key'));
  return new Response(JSON.stringify(response(body,tier,overrides)));
}});

test('tiny task bypasses credentials and service entirely',async()=>{
  const r=await route(input({size:'tiny',complexity:'routine'}),{getApiKey:()=>{throw Error('must not run')}});
  assert.equal(r.execution,'continue_in_primary'); assert.equal(r.maxWorkers,0); assert.equal(r.typesafe.status,'skipped');
});
test('clear task uses local policy and no service',async()=>{
  const r=await route(input({uncertain:false}),{getApiKey:()=>{throw Error('must not run')}});
  assert.equal(r.recommendedModel,'gpt-6-sol'); assert.equal(r.source,'local_policy');
});
test('private input bypasses external service and preserves local skill selections',async()=>{
  const r=await route(input({privacy:'private',summary:''}),{getApiKey:()=>{throw Error('must not run')}});
  assert.equal(r.typesafe.reason,'private_or_unsanitized'); assert.deepEqual(r.skillIds,['frontend-engineering']);
});
test('unsanitized input cannot invoke provider',async()=>{
  const r=await route(input({sanitized:false}),{getApiKey:()=>{throw Error('must not run')}});
  assert.equal(r.typesafe.reason,'private_or_unsanitized');
});
test('actual typed answers select relevant skills and worker capability',async()=>{
  const r=await route(input(),deps());
  assert.equal(r.source,'typesafe_and_policy'); assert.equal(r.recommendedModel,'gpt-6-sol');
  assert.deepEqual(r.skillIds,['frontend-engineering']); assert.equal(r.maxWorkers,1);
  assert.equal(r.executionReceipt.dispatched,false); assert.equal(r.currentModelChanged,false);
});
test('critical risk cannot be downgraded by a confident focused answer',async()=>{
  const r=await route(input({risk:'critical'}),deps('focused'));
  assert.equal(r.recommendedModel,'gpt-6-astra'); assert.equal(r.reasoningEffort,'high');
  assert.equal(r.verification,'independent_review_and_task_specific_evidence');
});
test('explicit unavailable model blocks dispatch with no substitution',async()=>{
  const r=await route(input({requestedModel:'gpt-absent'}),deps());
  assert.equal(r.status,'blocked_explicit_choice'); assert.equal(r.recommendedModel,null); assert.equal(r.maxWorkers,0);
});
test('unsupported explicit effort blocks dispatch',async()=>{
  const r=await route(input({requestedModel:'gpt-6-luna',requestedEffort:'ultra'}),deps());
  assert.equal(r.status,'blocked_explicit_choice'); assert.equal(r.reason,'requested_effort_not_supported');
});
test('available explicit model remains selected with visible risk mismatch',async()=>{
  const r=await route(input({risk:'critical',requestedModel:'gpt-6-luna'}),deps('frontier'));
  assert.equal(r.recommendedModel,'gpt-6-luna'); assert.equal(r.explicitModelBelowPolicy,true); assert.equal(r.primaryMustReview,true);
});
test('required skills survive model rejection',async()=>{
  const r=await route(input({skills:[{id:'frontend-engineering',description:'Implement web interfaces.',required:true}]}),deps());
  assert.deepEqual(r.skillIds,['frontend-engineering']);
  assert.ok(!Object.hasOwn(buildRequest(validateInput(input({skills:[{id:'frontend-engineering',description:'Web interfaces.',required:true}]}))).questions,'skill_0'));
});
test('uncertain tier uses local floor and remains truthful about abstention',async()=>{
  const r=await route(input({complexity:'routine'}),deps('unknown'));
  assert.equal(r.source,'typesafe_abstained_policy'); assert.equal(r.recommendedModel,'gpt-6-sol'); assert.equal(r.primaryMustReview,true);
  assert.equal(r.execution,'continue_in_primary'); assert.equal(r.maxWorkers,0);
});
test('worker concurrency needs actual independent units and is capped',async()=>{
  const d=deps('standard',{parallel:{type:'noul',noul:0.99}});
  assert.equal((await route(input({independentUnits:3}),d)).maxWorkers,2);
  assert.equal((await route(input({independentUnits:0}),d)).maxWorkers,0);
  assert.equal((await route(input({allowDelegation:false}),d)).maxWorkers,0);
});
test('missing credential continues locally without network',async()=>{
  const r=await route(input(),{getApiKey:()=>'',fetchImpl:()=>{throw Error('must not run')}});
  assert.equal(r.typesafe.reason,'credential_unavailable'); assert.equal(r.recommendedModel,'gpt-6-sol');
});
test('HTTP failures are bounded and do not expose server text',async()=>{
  let calls=0;
  const r=await route(input(),{getApiKey:()=> 'test-key',fetchImpl:async()=>{calls++;return {ok:false,status:429,text:async()=>'secret-body'}}});
  assert.equal(calls,1); assert.equal(r.typesafe.reason,'http_429'); assert.ok(!JSON.stringify(r).includes('secret-body'));
});
test('invalid provider output and out-of-range Noul cause safe fallback',async()=>{
  for(const overrides of [{reasoning:{type:'choice',choice:'deep',confidence:2,probabilities:{deep:1}}},{tier:{type:'choice',choice:'evil',confidence:1,probabilities:{evil:1}}}]) {
    const r=await route(input(),deps('standard',overrides));
    assert.equal(r.typesafe.status,'unavailable'); assert.equal(r.source,'local_policy');
  }
});
test('timeout aborts one request without retries or key leakage',async()=>{
  let calls=0;
  const r=await route(input({timeoutMs:100}),{getApiKey:()=> 'test-key',fetchImpl:async(url,{signal})=>{
    calls++; return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('test-key'))));
  }});
  assert.equal(calls,1); assert.equal(r.typesafe.status,'unavailable'); assert.ok(!JSON.stringify(r).includes('test-key'));
});
test('reject dangerous input fields, obvious identifiers, and oversized shortlists',async()=>{
  for(const extra of [{apiKey:'do-not-print'},{endpoint:'https://evil.test'},{summary:'Read /Users/person/private.txt'},
    {summary:'Use api_key=abc'},{summary:'Contact me@example.com'}, {allowDelegation:'false'},
    {skills:Array.from({length:9},(_,i)=>({id:`skill-${i}`,description:'A capability.'}))}]) {
    await assert.rejects(route(input(extra),deps()));
  }
});
test('receipt does not contain the task summary or full skill metadata',async()=>{
  const source=input();const r=await route(source,deps());
  const json=JSON.stringify(r);assert.ok(!json.includes(source.summary));assert.ok(!json.includes(source.skills[0].description));
});
test('two failures force frontier; lack of frontier never silently lowers capability',async()=>{
  const r=await route(input({failedAttempts:2,availableModels:[models[0]]}),deps('focused'));
  assert.equal(r.recommendedModel,null); assert.equal(r.execution,'continue_in_primary');
});
test('explicit effort selects an eligible alternative when model is not pinned',async()=>{
  const r=await route(input({complexity:'routine',uncertain:false,requestedEffort:'xhigh',
    availableModels:[{id:'gpt-6-luna',efforts:['low','medium','high']},models[1]]}));
  assert.equal(r.recommendedModel,'gpt-6-sol');assert.equal(r.reasoningEffort,'xhigh');assert.equal(r.status,'planned');
});
test('a pinned lower-capability model for hard work gets review and a policy warning',async()=>{
  const r=await route(input({complexity:'hard',uncertain:false,requestedModel:'gpt-6-luna'}));
  assert.equal(r.explicitModelBelowPolicy,true);assert.equal(r.primaryMustReview,true);
});
test('known unavailable explicit choice bypasses credentials and API',async()=>{
  const r=await route(input({requestedModel:'gpt-unavailable'}),{getApiKey:()=>{throw Error('must not run')}});
  assert.equal(r.status,'blocked_explicit_choice');assert.equal(r.typesafe.reason,'explicit_choice_unavailable');
});

function demandChoice(demand,confidence=0.99) {
  return {type:'choice',choice:demand,confidence,
    probabilities:Object.fromEntries(['light','standard','deep','exceptional','unknown'].map(k=>[k,k===demand?1:0]))};
}
test('hard work cannot be downgraded by confident light focused judgments',async()=>{
  const r=await route(input({complexity:'hard'}),deps('focused',{reasoning:demandChoice('light')}));
  assert.equal(r.recommendedModel,'gpt-6-astra');assert.equal(r.reasoningEffort,'high');
});
test('typed reasoning independently selects high and extra high',async()=>{
  const deep=await route(input(),deps('standard',{reasoning:demandChoice('deep')}));
  assert.equal(deep.recommendedModel,'gpt-6-sol');assert.equal(deep.reasoningEffort,'high');
  const exceptional=await route(input(),deps('standard',{reasoning:demandChoice('exceptional')}));
  assert.equal(exceptional.recommendedModel,'gpt-6-astra');assert.equal(exceptional.reasoningEffort,'xhigh');
});
test('clear local demands produce deterministic supported efforts',async()=>{
  for(const [reasoningDemand,model,effort] of [['light','gpt-6-sol','low'],['standard','gpt-6-sol','medium'],['deep','gpt-6-sol','high'],['exceptional','gpt-6-astra','xhigh']]) {
    const r=await route(input({uncertain:false,reasoningDemand}));
    assert.equal(r.recommendedModel,model);assert.equal(r.reasoningEffort,effort);
  }
});
test('explicit low effort is preserved and reviewed against a deep floor',async()=>{
  const r=await route(input({uncertain:false,complexity:'hard',requestedEffort:'low'}));
  assert.equal(r.reasoningEffort,'low');assert.equal(r.explicitEffortBelowPolicy,true);assert.equal(r.primaryMustReview,true);
});
test('uncertain reasoning uses local demand without discarding a clear tier',async()=>{
  const r=await route(input({reasoningDemand:'deep'}),deps('standard',{reasoning:demandChoice('unknown')}));
  assert.equal(r.reasoningEffort,'high');assert.equal(r.reasoningDecision.abstained,true);assert.equal(r.primaryMustReview,true);
});
test('supported effort choice is independent of catalogue order',async()=>{
  const r=await route(input({uncertain:false,availableModels:[{id:'gpt-6-sol',efforts:['max','xhigh','high','low']}]}));
  assert.equal(r.reasoningEffort,'high');
});
test('automatic effort never expands into max or ultra',async()=>{
  const r=await route(input({uncertain:false,availableModels:[{id:'gpt-6-sol',efforts:['max','ultra']}]}));
  assert.equal(r.execution,'continue_in_primary');assert.equal(r.reasoningEffort,null);
});
test('a model without adequate effort yields to an eligible model',async()=>{
  const r=await route(input({uncertain:false,availableModels:[{id:'gpt-6-sol',efforts:['low']},models[2]]}));
  assert.equal(r.recommendedModel,'gpt-6-astra');assert.equal(r.reasoningEffort,'low');
});
test('pinned model cannot silently lower nominal effort',async()=>{
  const r=await route(input({uncertain:false,requestedModel:'gpt-6-sol',availableModels:[{id:'gpt-6-sol',efforts:['low']}]}));
  assert.equal(r.reasoningEffort,null);assert.equal(r.dispatch,null);
});
test('unsupported exact effort is null, with no alternate dispatch',async()=>{
  const r=await route(input({requestedModel:'gpt-6-luna',requestedEffort:'ultra'}));
  assert.equal(r.reasoningEffort,null);assert.equal(r.dispatch,null);assert.equal(r.status,'blocked_explicit_choice');
});
test('older supported model identifiers containing dots are accepted',async()=>{
  const r=await route(input({uncertain:false,availableModels:[{id:'gpt-5.6-sol',efforts:['medium','high']}]}));
  assert.equal(r.recommendedModel,'gpt-5.6-sol');assert.equal(r.reasoningEffort,'medium');
});
test('new model needs explicit selection until capability policy is reviewed',async()=>{
  const availableModels=[{id:'gpt-future',efforts:['low','medium','high']}];
  const r=await route(input({uncertain:false,availableModels}));
  assert.equal(r.recommendedModel,null);assert.equal(r.dispatch,null);
  const pinned=await route(input({uncertain:false,availableModels,requestedModel:'gpt-future'}));
  assert.equal(pinned.recommendedModel,'gpt-future');assert.equal(pinned.unverifiedModelCapability,true);assert.equal(pinned.primaryMustReview,true);
});
test('local selected skills stay selected on disagreement and require review',async()=>{
  for(const noul of [0.19,0.5,0.8]) {
    const r=await route(input(),deps('standard',{skill_0:{type:'noul',noul}}));
    assert.ok(r.skillIds.includes('frontend-engineering'));
    assert.equal(r.skillCandidatesForLocalReview.includes('frontend-engineering'),noul<0.8);
  }
});
test('required Jev browser skill is preserved and dispatch maps exact effort',async()=>{
  const r=await route(input({uncertain:false,skills:[{id:'typesafe-computer-browser',description:'Scan public pages.',required:true}]}));
  assert.deepEqual(r.skillIds,['typesafe-computer-browser']);
  assert.deepEqual(r.dispatch,{model:'gpt-6-sol',reasoning_effort:'medium',fork_turns:'none'});
  assert.equal(r.currentThinkingEffortChanged,false);
});
test('credential helper failures fall back without exposing details',async()=>{
  const r=await route(input(),{getApiKey:()=>{throw Error('credential-secret');}});
  assert.equal(r.typesafe.reason,'credential_unavailable');assert.ok(!JSON.stringify(r).includes('credential-secret'));
});
test('oversized HTTP bodies are rejected before JSON parsing',async()=>{
  const r=await route(input(),{getApiKey:()=> 'test-key',fetchImpl:async()=>new Response('x'.repeat(65537))});
  assert.equal(r.typesafe.status,'unavailable');assert.equal(r.dispatch,null);
});
test('deadline also bounds a transport that ignores abort',async()=>{
  const started=performance.now();
  const r=await route(input({timeoutMs:100}),{getApiKey:()=> 'test-key',fetchImpl:()=>new Promise(()=>{})});
  assert.ok(performance.now()-started<700);assert.equal(r.typesafe.status,'unavailable');
});
test('deadline covers stalled response body',async()=>{
  const r=await route(input({timeoutMs:100}),{getApiKey:()=> 'test-key',fetchImpl:async()=>new Response(new ReadableStream({start(){}}))});
  assert.equal(r.typesafe.status,'unavailable');
});
test('short hard problem does not enter the tiny fast path',async()=>{
  const r=await route(input({size:'tiny',complexity:'hard'}),deps('focused'));
  assert.equal(r.typesafe.status,'evaluated');assert.equal(r.recommendedModel,'gpt-6-astra');
});
test('tiny ambiguous or standard work does not skip assessment merely because it is short',async()=>{
  for(const complexity of ['unknown','standard']) {
    const r=await route(input({size:'tiny',complexity}),deps());
    assert.equal(r.typesafe.status,'evaluated');
  }
});
test('impossible explicit effort for the capability floor skips credential access',async()=>{
  const r=await route(input({complexity:'hard',requestedEffort:'ultra',availableModels:[{id:'gpt-6-sol',efforts:['ultra']},{id:'gpt-6-astra',efforts:['low','high']}]}),{getApiKey:()=>{throw Error('must not run')}});
  assert.equal(r.status,'blocked_explicit_choice');assert.equal(r.typesafe.reason,'explicit_choice_unavailable');
});
test('locally selected skill disagreement sets the review requirement',async()=>{
  const r=await route(input(),deps('standard',{skill_0:{type:'noul',noul:0.1}}));
  assert.equal(r.primaryMustReview,true);assert.ok(r.skillIds.includes('frontend-engineering'));
});
test('array-valued provider choice is rejected rather than coerced to a tier',async()=>{
  const request=buildRequest(validateInput(input()));
  const provider=response(request);
  provider.answers.tier.choice=['standard'];
  assert.throws(()=>validateAnswers(provider,request));
  const r=await route(input(),deps('standard',{tier:provider.answers.tier}));
  assert.equal(r.typesafe.status,'unavailable');assert.equal(r.dispatch,null);
});
