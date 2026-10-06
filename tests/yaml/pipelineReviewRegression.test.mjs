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
  const result=spawnSync('benthos',['run',config],{input:JSON.stringify(input)+'\n',encoding:'utf8',timeout:10000,env:{...process.env,...env}});
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
 assert.equal(cases[0].check,'this.final_priority == "critical"');
 assert.deepEqual(cases[0].output.http_client.batching,{count:20,period:'2s',byte_size:524288});
 assert.deepEqual(cases[1].output.http_client.batching,{count:100,period:'10s',byte_size:2097152});
 const archive=pipeline.output.broker.outputs[1].switch.cases[0].output;
 const regions=archive.switch.cases;
 assert.equal(regions.length,5);
 for(const residency of ['eu_west','us_west','us_east','asia_pacific']){
  const region=regions.find(x=>x.check==='this.data_residency == "'+residency+'"');
  assert.ok(region);
  const output=region.output;
  const upper=residency.toUpperCase();
  assert.equal(output.aws_s3.bucket,'${S3_BUCKET_PREFIX}-'+residency);
  assert.equal(output.aws_s3.region,'${AWS_REGION_'+upper+'}');
  assert.equal(output.aws_s3.kms_key_id,'${S3_KMS_KEY_ARN_'+upper+'}');
  const value=run(output.processors,{data_residency:residency,s3_event:{data_residency:residency,retention_years:7}});
  assert.deepEqual(value,[{data_residency:residency,retention_years:7}]);
 }
 const elapsed=pipeline.processors.find(x=>x.mapping?.includes('root.processing_duration_ms ='));
 const result=run([pipeline.processors[0],elapsed],{host:'fixture'})[0];
 assert.equal(typeof result.processing_duration_ms,'number');assert.ok(result.processing_duration_ms>=0);assert.ok(result.metric_event_id);
});
