import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import YAML from 'yaml';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'../..');
const read=p=>YAML.parse(fs.readFileSync(path.join(root,p),'utf8'));
function run(processors,input,env={}){
 const scratch=fs.mkdtempSync(path.join(root,'.nm-review-'));
 try{
  const config=path.join(scratch,'pipeline.yaml');
  fs.writeFileSync(config,YAML.stringify({http:{enabled:false},input:{stdin:{codec:'lines'}},pipeline:{processors},output:{stdout:{codec:'lines'}},logger:{level:'ERROR'}},{lineWidth:0}));
  const result=spawnSync(process.execPath,[path.join(root,'scripts/edge-contract-runtime.mjs'),config],{input:JSON.stringify(input)+'\n',encoding:'utf8',timeout:10000,env:{...process.env,...env}});
  assert.equal(result.status,0,result.stderr||String(result.error));
  return result.stdout.trim()?result.stdout.trim().split('\n').map(JSON.parse):[];
 }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}
function normalize(value){
 if(Array.isArray(value))return value.map(normalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!k.endsWith('_encrypted')&&!k.endsWith('_nonce')).map(([k,v])=>[k,normalize(v)]));
 return value;
}
test('encryption patterns preserve stage behavior and decrypt every encrypted field',async()=>{
 const pipeline=read('static/files/data-security/encryption-patterns.yaml').config;
 const sample=JSON.parse(fs.readFileSync(path.join(root,'examples/data-security/encryption-patterns/sample-input.json')));
 const env=JSON.parse(fs.readFileSync(path.join(root,'examples/data-security/encryption-patterns/fixture-environment.json')));
 const modulePath=path.join(root,'docs/data-security/encryption-patterns-full.stages.ts');
 const js=ts.transpileModule(fs.readFileSync(modulePath,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {encryptionPatternsStages:stages}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 for(let i=1;i<6;i++){
  const result=run(pipeline.pipeline.processors.slice(0,i),sample,env)[0];
  const expected=JSON.parse(stages[i].outputLines.map(l=>'  '.repeat(l.indent)+l.content).join('\n'));
  assert.deepEqual(normalize(result),normalize(expected));
 }
 const result=run(pipeline.pipeline.processors,sample,env)[0];
 assert.equal(result.payment.cvv,undefined);assert.equal(result.payment.cvv_encrypted,undefined);
 function decryptFields(actual,original){for(const [name,value]of Object.entries(actual)){if(name.endsWith('_encrypted')){const field=name.slice(0,-10),nonce=Buffer.from(actual[field+'_nonce'],'hex'),cipher=Buffer.from(value,'base64');assert.equal(nonce.length,12);const d=crypto.createDecipheriv('aes-256-gcm',Buffer.alloc(32,1),nonce);d.setAuthTag(cipher.subarray(-16));assert.equal(Buffer.concat([d.update(cipher.subarray(0,-16)),d.final()]).toString(),original[field]);}else if(value&&typeof value==='object'&&original?.[name])decryptFields(value,original[name]);}}
 decryptFields(result,sample);
 assert.deepEqual(run(pipeline.pipeline.processors,sample,{...env,CARD_ENCRYPTION_KEY_HEX:'bad-key'}),[]);
 assert.deepEqual(run(pipeline.pipeline.processors,sample,{...env,CARD_ENCRYPTION_KEY_HEX:'01'.repeat(16)}),[]);
 const audit=run([...pipeline.pipeline.processors,...pipeline.output.broker.outputs[1].processors],sample,env)[0];
 assert.equal(audit.selected_field_count,12);
});
test('public encryption walkthrough processors preserve earlier ciphertext and deletions',()=>{
 const sample=JSON.parse(fs.readFileSync(path.join(root,'examples/data-security/encryption-patterns/sample-input.json')));
 const env=JSON.parse(fs.readFileSync(path.join(root,'examples/data-security/encryption-patterns/fixture-environment.json')));
 const canonical=read('static/files/data-security/encryption-patterns.yaml').config.pipeline.processors;
 const pages=['step-1-encrypt-payment-data.mdx','step-2-encrypt-pii-fields.mdx','step-3-encrypt-addresses.mdx','step-4-encrypt-dates.mdx'];
 const processors=[];
 for(const [index,page]of pages.entries()){
  const published=fs.readFileSync(path.join(root,'docs/data-security/encryption-patterns',page),'utf8');
  const block=published.match(/```yaml\n([\s\S]*?)```/)[1];
  processors.push(...YAML.parse(block).pipeline.processors);
  const [actual]=run(processors,sample,env);
  const [expected]=run(canonical.slice(0,index+1),sample,env);
  assert.deepEqual(normalize(actual),normalize(expected));
  assert.equal(actual.payment.card_number,undefined);
  assert.equal(actual.payment.cvv,undefined);
  assert.ok(actual.payment.card_number_encrypted);
 }
});
test('GDPR error boundary rejects global output and retains the EU archive',()=>{
 const pipeline=read('examples/data-security/cross-border-gdpr/cross-border-gdpr.yaml');
 const sample={transaction_id:'fixture',customer_id:'fixture-person',customer_name:'Synthetic',customer_email:'fixture@example.org',customer_dob:'invalid-date',customer_address:'synthetic-address',iban:'DE123456',transaction_amount:100,transaction_currency:'EUR',merchant_country:'DE',transaction_timestamp:'2026-10-05T00:00:00Z',ip_address:'10.1.2.3'};
 const env={GDPR_CUSTOMER_HMAC_KEY:'fixture-only'};
 assert.deepEqual(run([...pipeline.pipeline.processors,...pipeline.output.broker.outputs[0].processors],sample,env),[]);
 const archive=run([...pipeline.pipeline.processors,...pipeline.output.broker.outputs[1].processors],sample,env)[0];
 for(const[k,v]of Object.entries(sample))assert.deepEqual(archive[k],v);
});
test('Splunk preserves regional routing and critical delivery policy',()=>{
 const pipeline=read('static/pipelines/splunk-production-pipeline.yaml');
 const cases=pipeline.output.broker.outputs[0].fallback[0].switch.cases;
 function select(cases,input){
  for(const item of cases){
   if(!item.check||run([{mapping:'root = '+item.check}],input)[0]===true)return item.output;
  }
  assert.fail('No destination selected');
 }
 assert.deepEqual(select(cases,{final_priority:'critical'}).http_client.batching,{count:20,period:'2s',byte_size:524288});
 assert.deepEqual(select(cases,{final_priority:'normal'}).http_client.batching,{count:100,period:'10s',byte_size:2097152});
 const archive=select(pipeline.output.broker.outputs[1].switch.cases,{data_classification:'pii'});
 const regions=archive.switch.cases;
 assert.equal(regions.length,5);
 for(const residency of ['eu_west','us_west','us_east','asia_pacific']){
  const output=select(regions,{data_residency:residency});
  const upper=residency.toUpperCase();
  assert.equal(output.aws_s3.bucket,'${S3_BUCKET_PREFIX}-'+residency.replaceAll('_','-'));
  assert.equal(output.aws_s3.region,'${AWS_REGION_'+upper+'}');
  assert.equal(output.aws_s3.kms_key_id,'${S3_KMS_KEY_ARN_'+upper+'}');
  const event={data_residency:residency,retention_years:7,data_classification:'pii',pipeline_version:'1.0.0'};
  const value=run([...output.processors,{mapping:'root = {"event": this, "metadata": meta()}'}],{data_residency:residency,s3_event:event});
  assert.deepEqual(value,[{event,metadata:{'data-classification':'pii','retention-years':'7','pipeline-version':'1.0.0'}}]);
 }
 assert.deepEqual(select(regions,{data_residency:'unknown'}),{drop:{}});
 assert.deepEqual(select(pipeline.output.broker.outputs[1].switch.cases,{data_classification:'general'}),{drop:{}});
 const elapsed=pipeline.processors.find(x=>x.mapping?.includes('root.processing_duration_ms ='));
 const result=run([pipeline.processors[0],elapsed],{host:'fixture'})[0];
 assert.equal(typeof result.processing_duration_ms,'number');assert.ok(result.processing_duration_ms>=0);assert.ok(result.metric_event_id);
});
async function stageModule(p){
 const source=fs.readFileSync(path.join(root,p),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
test('encrypt-data enforces AES-256 keys and retains national phone area codes',async()=>{
 const {encryptDataStages:stages}=await stageModule('docs/data-security/encrypt-data-full.stages.ts');
 const sample=JSON.parse(stages[0].inputLines.map(l=>l.content).join('\n'));
 const processors=read('static/files/data-security/encrypt-data.yaml').config.pipeline.processors;
 const keys=['CARD_ENCRYPTION_KEY_HEX','PII_ENCRYPTION_KEY_HEX','ADDRESS_ENCRYPTION_KEY_HEX'];
 const env={...Object.fromEntries(keys.map(k=>[k,'01'.repeat(32)])),KEY_VERSION:'fixture-v1',NODE_ID:'fixture-node'};
 for(const phone of ['+1-415-555-0123','415-555-0123']){
  const fixture=structuredClone(sample);fixture.customer.phone=phone;
  const [actual]=run(processors,fixture,env);
  assert.equal(actual.customer.phone_area_code,'415');
 }
 for(let i=1;i<stages.length;i++){
  const actual=run(processors.slice(0,i+1),sample,env)[0];
  const expected=JSON.parse(stages[i].outputLines.map(l=>l.content).join('\n'));
  if(actual.encryption_metadata){
   assert.ok(Number.isFinite(Date.parse(actual.encryption_metadata.encryption_timestamp)));
   expected.encryption_metadata.encryption_timestamp=actual.encryption_metadata.encryption_timestamp;
  }
  assert.deepEqual(normalize(actual),normalize(expected));
 }
 for(const key of keys)for(const invalid of ['01'.repeat(16),'01'.repeat(24),'bad-key'])
  assert.deepEqual(run(processors,sample,{...env,[key]:invalid}),[]);
});
test('encryption explorers render plaintext and ciphertext change states',async()=>{
 const {normalizeExplorerStages}=await stageModule('src/components/ExplorerV2/normalize.ts');
 for(const [file,exportName]of [['encrypt-data','encryptDataStages'],['encryption-patterns','encryptionPatternsStages']]){
  const stages=(await stageModule('docs/data-security/'+file+'-full.stages.ts'))[exportName];
  const rendered=normalizeExplorerStages(stages,'authored','diff');
  assert.equal(rendered[0].inputLines.find(l=>l.content.startsWith('"card_number":')).state,'changed');
  assert.equal(rendered[1].inputLines.find(l=>l.content.startsWith('"card_number":')).state,'removed');
  assert.equal(rendered[1].outputLines.find(l=>l.content.startsWith('"card_number_encrypted":')).state,'added');
  assert.equal(rendered[1].outputLines.find(l=>l.content.startsWith('"card_number_nonce":')).state,'added');
  const highlights=normalizeExplorerStages(stages,'authored','highlights');
  assert.equal(highlights[1].outputLines.find(l=>l.content.startsWith('"card_number_encrypted":')).state,'changed');
 }
});
