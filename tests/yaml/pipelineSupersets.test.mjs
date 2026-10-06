import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import YAML from 'yaml';
const root = path.resolve(import.meta.dirname, '../..');
const copies = JSON.parse(fs.readFileSync(path.join(root, 'content/public-pipeline-copies.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/explorer-stage-bindings-v1.json')));
function sources(id) {
  return [...new Set([manifest.explorers.find(e => e.exampleId === id).canonicalPipelinePath,
    ...copies.filter(c => c.exampleId === id && c.copyPath).map(c => c.copyPath)])];
}
function config(file) { const value = YAML.parse(fs.readFileSync(path.join(root, file), 'utf8')); return value.config ?? value; }
function scratch() { return fs.mkdtempSync(path.join(root, '.nm-superset-')); }
function run(cfg, input, dir, env = {}) {
  const file = path.join(dir, 'run.yaml');
  fs.writeFileSync(file, YAML.stringify({ ...cfg, http: { enabled: false }, input: { stdin: { codec: 'lines' } }, logger: { level: 'ERROR' } }, { lineWidth: 0 }));
  const result = spawnSync('benthos', ['run', file], {
    input: input.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n') + '\n',
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, RECORD_CODECS_SCRIPT: path.join(root, 'scripts/examples/record_codecs.py'), ...env },
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return result.stdout.trim() ? result.stdout.trim().split('\n').map(JSON.parse) : [];
}
const stdout = { stdout: { codec: 'lines' } };
function select(cases, event, dir) {
  return cases.find(c => !c.check || run({ pipeline: { processors: [{ mapping: 'root = ' + c.check }] }, output: stdout }, [event], dir)[0]);
}
test('all window copies group interleaved sensors and retain late records within the native window', () => {
  for (const source of sources('aggregate-time-windows')) {
    const dir = scratch();
    try {
      const cfg = config(source);
      const events = [
        { sensor_id: 'one', location: 'north', timestamp: '2026-10-05T00:00:00Z', temperature: 10 },
        { sensor_id: 'one', location: 'north', timestamp: '2026-10-05T00:01:00Z', temperature: 40 },
        { sensor_id: 'two', location: 'north', timestamp: '2026-10-05T00:00:59Z', temperature: 20 },
        { sensor_id: 'one', location: 'north', timestamp: '2026-10-05T00:00:15Z', temperature: 30 },
      ];
      cfg.buffer = { none: {} }; cfg.output = stdout;
      cfg.pipeline.processors.unshift({ mapping: 'root = ' + JSON.stringify(events) }, { unarchive: { format: 'json_array' } }, { mapping: 'root = this\nmeta window_end_timestamp = "2026-10-05T00:02:00Z"' });
      const results = run(cfg, [{}], dir);
      const tumbling = results.find(r => r.aggregation_type === 'tumbling' && r.sensor_id === 'one');
      assert.equal(tumbling.event_count, 1); assert.equal(tumbling.temperature_avg, 40);
      const late = results.find(r => r.aggregation_type === 'sliding' && r.sensor_id === 'two');
      assert.equal(late.event_count, 1);
      const location = results.find(r => r.aggregation_level === 'location');
      assert.equal(location.sensor_count, 1); assert.equal(location.event_count, 1);
      const sliding = results.find(r => r.aggregation_type === 'sliding' && r.sensor_id === 'one');
      assert.equal(sliding.event_count, 3); assert.equal(sliding.temperature_change, 30);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test('all deduplication copies commit native cache entries after delivery and namespace strategies', () => {
  for (const source of sources('deduplicate-events')) {
    const dir = scratch();
    try {
      const cfg = config(source);
      fs.mkdirSync(dir + '/cache');
      cfg.cache_resources = [{ label: 'delivered', file: { directory: dir + '/cache' } }];
      cfg.output.switch.cases[0].output.broker.outputs[0] = stdout;
      cfg.output.switch.cases[1].output = stdout;
      const event = { event_id: 'one', event_type: 'signup', source: 'fixture', timestamp: '2026-10-05T00:00:00Z' };
      assert.equal(run(cfg, [event], dir)[0].is_duplicate, false);
      assert.equal(run(cfg, [{ ...event, message: 'retry' }], dir)[0].is_duplicate, true);
      const collision = { ...event, event_id: 'signup:fixture:' + Math.floor(Date.parse(event.timestamp) / 60000) };
      assert.equal(run(cfg, [collision], dir)[0].is_duplicate, false);
      for (const fixture of [{ message: 'content-only' }, { ...event, event_id: 'two', dedup_strategy: 'composite' }]) {
        assert.equal(run(cfg, [fixture], dir)[0].is_duplicate, false);
        assert.equal(run(cfg, [fixture], dir)[0].is_duplicate, true);
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test('all parser copies parse JSON, Apache, syslog and quoted CSV and route unknown formats to the DLQ', () => {
  for (const source of sources('parse-logs')) {
    const dir = scratch();
    try {
      const cfg = config(source); const output = cfg.output; cfg.output = stdout;
      const results = run(cfg, [
        { timestamp: '2026-10-05T00:00:00Z', level: 'warn', message: 'fixture', error: 'failure', debug_info: 'remove' },
        '192.0.2.1 - - [05/Oct/2026:00:00:00 +0000] "GET / HTTP/1.1" 500 123',
        '<11>Oct  5 00:00:00 fixture app[12]: failure',
        '2026-10-05T00:00:00Z,WARN,fixture,"warning, quoted"',
        'unstructured fixture',
      ], dir);
      assert.deepEqual(results.map(r => r.format).sort(), ['access_log', 'csv', 'json', 'syslog', 'unknown']);
      const access = results.find(r => r.format === 'access_log');
      assert.equal(access.status, 500); assert.equal(access.client_ip, undefined); assert.equal(access.client_ip_hash.length, 12);
      assert.equal(results.find(r => r.format === 'syslog').facility, 1);
      assert.equal(results.find(r => r.format === 'csv').message, 'warning, quoted');
      const json = results.find(r => r.format === 'json'); assert.equal(json.debug_info, undefined); assert.equal(json.error_details.message, 'failure');
      assert.ok(select(output.switch.cases, results.find(r => r.format === 'unknown'), dir).output.file.path);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test('all format copies decode JSON CSV XML, negotiate response encoding, and retain Avro delivery', () => {
  for (const source of sources('transform-formats')) {
    const dir = scratch();
    try {
      const cfg = config(source);
      const response = cfg.output.broker.outputs[0];
      assert.deepEqual(response.sync_response, {});
      const encoders = response.processors.slice(0, 1);
      cfg.output = stdout;
      for (const raw of [{ sensor_id: 'one', temperature: 10 }, '<root><sensor_id>one</sensor_id><temperature>10</temperature></root>', 'sensor_id,temperature\none,10']) {
        const wire = typeof raw === 'string' && raw.includes('\n') ? JSON.stringify(raw) : raw;
        const [decoded] = run(cfg, [wire], dir);
        for (const accept of ['application/json', 'application/xml', 'text/csv']) {
          const [encoded] = run({ pipeline: { processors: [{ mapping: 'meta "Accept" = ' + JSON.stringify(accept) }, ...encoders] }, output: stdout }, [decoded], dir);
          assert.equal(encoded.transformation.target_format, accept.split('/')[1]);
          if (accept === 'application/json') assert.deepEqual(JSON.parse(encoded.data), decoded.data);
          if (accept === 'application/xml') assert.ok(encoded.data.startsWith('<root>'));
          if (accept === 'text/csv') assert.ok(encoded.data.startsWith('sensor_id,temperature'));
        }
      }
      const original = config(source);
      const sensor = { sensor_id: 'one', location: 'north', temperature: 10, humidity: 20, timestamp: '2026-10-05T00:00:00Z', metadata: { device_type: 'sensor', firmware_version: '1' } };
      const branch = original.output.broker.outputs[1].switch.cases[0].output;
      const avro = run({ pipeline: { processors: [...original.pipeline.processors, ...branch.processors, { mapping: 'root = {"bytes": content().encode("base64")}' }] }, output: stdout }, [sensor], dir)[0];
      const bytes = Buffer.from(avro.bytes, 'base64');
      let offset = 0;
      const string = () => {
        let length = 0, shift = 0, byte;
        do { byte = bytes[offset++]; length |= (byte & 127) << shift; shift += 7; } while (byte & 128);
        assert.equal(length & 1, 0);
        length >>= 1;
        const value = bytes.subarray(offset, offset + length).toString('utf8'); offset += length; return value;
      };
      assert.equal(string(), sensor.sensor_id); assert.equal(string(), sensor.location);
      assert.equal(bytes.readDoubleLE(offset), sensor.temperature); offset += 8;
      assert.equal(bytes.readDoubleLE(offset), sensor.humidity); offset += 8;
      assert.equal(string(), sensor.timestamp); assert.equal(string(), sensor.metadata.device_type); assert.equal(string(), sensor.metadata.firmware_version);
      assert.equal(offset, bytes.length);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test('all production copies retain computed metadata and remove credentials before every output', () => {
  for (const source of sources('production-pipeline')) {
    const dir = scratch();
    try {
      const cfg = config(source); cfg.output = stdout;
      const [actual] = run(cfg, [{ timestamp: '2026-10-05T00:00:00Z', level: 'ERROR', service: 'fixture', message: 'fixture@example.org 123-45-6789', password: 'synthetic', secret: 'synthetic', token: 'synthetic', api_key: 'synthetic', ip_address: '192.0.2.1' }], dir);
      for (const field of ['password', 'secret', 'token', 'api_key']) assert.equal(actual[field], undefined);
      assert.equal(actual.message, '[EMAIL] [SSN]'); assert.equal(actual.ip_address.length, 16);
      assert.equal(actual.is_high_priority, true); assert.equal(actual.hour, '00'); assert.equal(actual.day_of_week, 'Monday');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test('format copies honor HTTP Accept headers on both public input paths', async () => {
  for (const source of sources('transform-formats')) {
    const dir = scratch();
    const reserved = http.createServer();
    await new Promise(resolve => reserved.listen(0, '127.0.0.1', resolve));
    const port = reserved.address().port;
    await new Promise(resolve => reserved.close(resolve));
    const cfg = config(source);
    for (const input of cfg.input.broker.inputs) input.http_server.address = '';
    cfg.output = cfg.output.broker.outputs[0];
    cfg.http = { enabled: true, address: `127.0.0.1:${port}`, root_path: '/runtime' }; cfg.logger = { level: 'ERROR' };
    const file = path.join(dir, 'http.yaml');
    fs.writeFileSync(file, YAML.stringify(cfg));
    const child = spawn('benthos', ['run', file], { env: { ...process.env, RECORD_CODECS_SCRIPT: path.join(root, 'scripts/examples/record_codecs.py') } });
    let errors = '';
    child.stdout.on('data', data => errors += data);
    child.stderr.on('data', data => errors += data);
    const stopped = new Promise(resolve => child.on('close', resolve));
    try {
      const base = `http://127.0.0.1:${port}`;
      const deadline = Date.now() + 5000;
      for (;;) {
        try { await fetch(base + '/transform'); break; } catch {
          assert.ok(Date.now() < deadline, errors);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
      for (const route of ['/transform', '/sensors/ingest']) {
        const response = await fetch(base + route, { method: 'POST', headers: { Accept: 'text/csv', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'fixture', value: 'one' }), signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), 'text/csv');
        assert.equal(await response.text(), 'name,value\r\nfixture,one\r\n');
      }
    } finally { child.kill('SIGTERM'); await stopped; fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test('all circuit copies deliver through secondary, persistent-file and final fallback after failures', async () => {
  let failSecondary = false;
  const delivered = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      delivered.push({ path: request.url, event: JSON.parse(body) });
      response.statusCode = request.url === '/primary' || failSecondary ? 503 : 200;
      response.end();
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
  for (const source of sources('circuit-breakers')) {
    const outputs = config(source).output.fallback;
    assert.equal(outputs.length, 4);
    assert.equal(new URL(outputs[0].http_client.url.replace('${DOWNSTREAM_HTTPS_URL}', 'https://primary.invalid')).pathname, '/endpoint');
    assert.equal(new URL(outputs[1].http_client.url.replace('${SECONDARY_HTTPS_URL}', 'https://secondary.invalid')).pathname, '/process');
    assert.equal(outputs[2].file.codec, 'lines');
    assert.equal(outputs[3].kafka.topic, 'dlq-circuit-breaker-failures');
    assert.equal(outputs[3].kafka.tls.enabled, true);
    const dir = scratch();
    try {
      const cfg = config(source);
      const fallback = cfg.output.fallback;
      for (const [index, name] of ['primary', 'secondary'].entries()) {
        fallback[index].http_client.url = `http://127.0.0.1:${server.address().port}/${name}`;
        fallback[index].http_client.tls = { enabled: false };
        fallback[index].http_client.headers.Authorization = 'Bearer fixture';
        fallback[index].http_client.retries = 0;
      }
      fallback[2].file.path = path.join(dir, 'archive.jsonl');
      fallback[3] = { processors: [{ mapping: 'root = {"final_fallback": this}' }], ...stdout };
      const execute = async () => {
        const file = path.join(dir, 'fallback.yaml');
        fs.writeFileSync(file, YAML.stringify({ ...cfg, http: { enabled: false }, input: { stdin: { codec: 'lines' } }, logger: { level: 'ERROR' } }));
        const child = spawn('benthos', ['run', file]);
        let out = '', err = '';
        child.stdout.on('data', data => out += data);
        child.stderr.on('data', data => err += data);
        child.stdin.end('{"event_id":"fixture"}\n');
        const timer = setTimeout(() => child.kill('SIGTERM'), 10000);
        try {
          const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject); });
          assert.equal(code, 0, err);
          const messages = out.split('\n').filter(line => line.startsWith('{'));
          return messages.length ? JSON.parse(messages.at(-1)) : null;
        } finally { clearTimeout(timer); }
      };
      failSecondary = false;
      await execute();
      assert.equal(delivered.at(-1).path, '/secondary'); assert.equal(fs.existsSync(fallback[2].file.path), false);
      failSecondary = true;
      await execute();
      assert.deepEqual(JSON.parse(fs.readFileSync(fallback[2].file.path, 'utf8')), { event_id: 'fixture' });
      fallback[2].file.path = dir;
      assert.deepEqual(await execute(), { final_fallback: { event_id: 'fixture' } });
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('Splunk alert processors retain diagnostic metadata and warning severity', () => {
  const pipeline = config('static/pipelines/splunk-production-pipeline.yaml');
  const output = pipeline.output.broker.outputs[2].switch.cases[0].output;
  const dir = scratch();
  try {
    for (const priority of ['critical', 'high']) {
      const [actual] = run({ pipeline: { processors: output.processors }, output: stdout }, [{ final_priority: priority, event_category: 'application', host: 'fixture', message_masked: 'masked', source_file: 'app.log', data_classification: 'security', target_index: 'fixture', log_level: 'ERROR', risk_score: '42' }], dir);
      assert.equal(actual.severity, priority === 'critical' ? 'critical' : 'warning');
      assert.deepEqual(actual.metadata, { log_level: 'ERROR', event_category: 'application', risk_score: 42 });
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('canonical metadata preserves ERROR/WARN messages and enrichment user identity', () => {
  for (const file of sources('filter-severity')) {
    const dir = scratch();
    try {
      const cfg = config(file); cfg.output = stdout;
      for (const level of ['ERROR', 'WARN', 'WARNING']) {
        const [out] = run(cfg, [JSON.stringify({ level, message: 'retained', trace_id: 'one' })], dir);
        assert.equal(out.level, level === 'WARNING' ? 'WARN' : level);
        assert.equal(out.message, 'retained'); assert.equal(out.trace_id, 'one');
        assert.ok(out.processing_metadata.processed_at);
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  for (const file of sources('enrich-export')) {
    const dir = scratch();
    try {
      const cfg = config(file); cfg.output = stdout;
      assert.equal(run(cfg, [{user_id:'retained', level:'ERROR', message:'fixture'}], dir)[0].event.user_id, 'retained');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test('fan-out copies retain a local diagnostic archive', () => {
  for (const file of sources('fan-out-pattern')) {
    const dir = scratch();
    try {
      const cfg = config(file);
      cfg.output = cfg.output.broker.outputs.find(o => o.file);
      assert.ok(cfg.output, 'diagnostic archive output');
      run(cfg, [{sensor_id:'fixture', message:'diagnostic'}], dir, {FAN_OUT_DIAGNOSTIC_PATH:dir});
      assert.equal(JSON.parse(fs.readFileSync(dir+'/events.jsonl','utf8')).message, 'diagnostic');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

async function withRuntime(cfg, dir, env, operation) {
  const file = path.join(dir, 'live.yaml');
  fs.writeFileSync(file, YAML.stringify({ ...cfg, logger: { level: 'ERROR' } }));
  const child = spawn('benthos', ['run', file], { env: { ...process.env, ...env } });
  let output = '', errors = '';
  child.stdout.on('data', data => output += data); child.stderr.on('data', data => errors += data);
  const stopped = new Promise(resolve => child.on('close', resolve));
  try { await operation(child, () => output, () => errors); }
  finally { if (child.exitCode === null) child.kill('SIGTERM'); const timeout = setTimeout(() => child.kill('SIGKILL'), 3000); await stopped; clearTimeout(timeout); }
}
async function until(predicate, message) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  assert.fail(message);
}
test('native dedup cache remains empty during failed delivery and replay is delivered', async () => {
  const dir = scratch(); let accept = false, attempts = 0;
  const server = http.createServer((request, response) => { request.resume(); attempts++; response.writeHead(accept ? 200 : 503); response.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const cfg = config(sources('deduplicate-events')[0]);
    fs.mkdirSync(dir + '/cache');
    cfg.http = {enabled:false}; cfg.input = {stdin:{codec:'lines'}};
    cfg.cache_resources = [{label:'delivered',file:{directory:dir+'/cache'}}];
    cfg.output.switch.cases[0].output.broker.outputs[0] = {http_client:{url:'http://127.0.0.1:'+server.address().port,verb:'POST',retries:0}};
    cfg.output.switch.cases[1].output = stdout;
    const event = {event_id:'unacknowledged', message:'must deliver'};
    await withRuntime(cfg, dir, {}, async child => {
      child.stdin.write(JSON.stringify(event)+'\n');
      await until(() => attempts > 0, 'delivery attempted');
      assert.equal(fs.existsSync(dir+'/cache') ? fs.readdirSync(dir+'/cache').length : 0, 0);
    });
    accept = true;
    await withRuntime(cfg, dir, {}, async child => {
      child.stdin.write(JSON.stringify(event)+'\n');
      await until(() => fs.existsSync(dir+'/cache') && fs.readdirSync(dir+'/cache').length === 1, 'replay delivered and cached');
    });
    assert.ok(attempts >= 2);
    assert.equal(run(cfg, [event], dir)[0].is_duplicate, true);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(dir,{recursive:true,force:true}); }
});
test('native system windows accept interleaved timestamps and wait for delivery acknowledgment', async () => {
  const dir = scratch(); let delivered = false, pending;
  const server = http.createServer((request,response) => { let body=''; request.on('data',v=>body+=v); request.on('end',()=>{pending={response,body};}); });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const cfg = config(sources('aggregate-time-windows')[0]);
    cfg.http={enabled:false}; cfg.input={stdin:{codec:'lines'}};
    cfg.buffer.system_window = {...cfg.buffer.system_window,size:'2s',slide:'',allowed_lateness:'1s'};
    cfg.output={http_client:{url:'http://127.0.0.1:'+server.address().port,verb:'POST',batching:{count:100,period:'100ms',processors:[{archive:{format:'json_array'}}]}}};
    await withRuntime(cfg,dir,{},async child=>{
      const start=Math.floor(Date.now()/2000)*2000;
      child.stdin.write(JSON.stringify({sensor_id:'A',location:'north',temperature:10,timestamp:new Date(start+800).toISOString()})+'\n');
      child.stdin.write(JSON.stringify({sensor_id:'B',location:'north',temperature:20,timestamp:new Date(start+400).toISOString()})+'\n');
      await until(()=>pending, 'window closed after allowed lateness');
      const records=JSON.parse(pending.body);
      assert.ok(records.some(r=>r.sensor_id==='A')); assert.ok(records.some(r=>r.sensor_id==='B'));
      assert.equal(child.exitCode,null);
      delivered=true; pending.response.end();
    });
    assert.equal(delivered,true);
  } finally { pending?.response.end(); await new Promise(resolve=>server.close(resolve)); fs.rmSync(dir,{recursive:true,force:true}); }
});
test('schema copies expose both public sensor input paths', async () => {
  for (const file of sources('enforce-schema')) {
    const dir=scratch(); const reserved=http.createServer();
    await new Promise(resolve=>reserved.listen(0,'127.0.0.1',resolve));const port=reserved.address().port;
    await new Promise(resolve=>reserved.close(resolve));
    try {
      const cfg=config(file);cfg.output=stdout;cfg.http={enabled:true,address:'127.0.0.1:'+port,root_path:'/runtime'};
      const schema=dir+'/schema.json';fs.writeFileSync(schema,JSON.stringify({type:'object',required:['sensor_id']}));
      cfg.pipeline.processors.find(p=>p.try).try.find(p=>p.json_schema).json_schema.schema_path='file://'+schema;
      await withRuntime(cfg,dir,{},async (child,output,errors)=>{
        for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:'+port+'/runtime/ping');break;}catch{await new Promise(resolve=>setTimeout(resolve,30));}}
        for(const endpoint of ['/sensors','/sensor/readings']){
          const response=await fetch('http://127.0.0.1:'+port+endpoint,{method:'POST',body:JSON.stringify({sensor_id:endpoint})});
          assert.equal(response.status,200,errors());
        }
        await until(()=>output().trim().split('\n').length>=2,'sensor inputs delivered');
        assert.deepEqual(output().trim().split('\n').map(JSON.parse).map(r=>r.sensor_id).sort(),['/sensor/readings','/sensors']);
      });
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  }
});
