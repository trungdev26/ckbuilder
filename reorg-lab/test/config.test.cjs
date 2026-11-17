const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {loadConfig,checkPorts}=require('../src/config.cjs');
function fixture(overrides={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reorg-config-'));
 const config={ckbBin:process.execPath,alwaysSuccess:process.execPath,celloraBin:process.execPath,psqlBin:process.execPath,adminUrl:'postgres://cellora@127.0.0.1:5435/postgres',ports:{rpcA:19114,p2pA:19115,rpcB:19214,p2pB:19215,metrics:19100},...overrides};
 const file=path.join(dir,'config.json');fs.writeFileSync(file,JSON.stringify(config));return {dir,file};
}
test('relative output is resolved beside config',()=>{const {dir,file}=fixture({outputDir:'runs'});assert.equal(loadConfig(file).outputDir,path.join(dir,'runs'));});
test('reject duplicate ports',()=>{const {file}=fixture({ports:{rpcA:19114,p2pA:19114,rpcB:19214,p2pB:19215,metrics:19100}});assert.throws(()=>loadConfig(file),/distinct/);});
test('reject remote database',()=>{const {file}=fixture({adminUrl:'postgres://user@example.com:5432/postgres'});assert.throws(()=>loadConfig(file),/local/);});
test('reject non-file binary',()=>{const {file}=fixture({ckbBin:'missing'});assert.throws(()=>loadConfig(file),/ckbBin/);});
test('reject invalid trial count',()=>{const {file}=fixture({trials:0});assert.throws(()=>loadConfig(file),/trials/);});
test('occupied port fails preflight',async()=>{const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await assert.rejects(checkPorts([server.address().port]),/in use/);}finally{await new Promise(r=>server.close(r));}});
