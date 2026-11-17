const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
function loadConfig(file){
 const base=path.dirname(path.resolve(file));const c=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
 for(const key of ['ckbBin','alwaysSuccess','celloraBin','psqlBin']){
  if(typeof c[key]!=='string')throw new Error(`${key} is required`);
  c[key]=path.resolve(base,c[key]);if(!fs.existsSync(c[key])||!fs.statSync(c[key]).isFile())throw new Error(`${key} must point to a file`);
 }
 const url=new URL(c.adminUrl);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Database must be local PostgreSQL');
 for(const key of ['rpcA','p2pA','rpcB','p2pB','metrics'])if(!Number.isInteger(c.ports?.[key])||c.ports[key]<1024||c.ports[key]>65535)throw new Error(`Invalid port ${key}`);
 if(new Set(Object.values(c.ports)).size!==5||Object.values(c.ports).includes(Number(url.port||5432)))throw new Error('Ports must be distinct');
 c.trials??=1;if(!Number.isInteger(c.trials)||c.trials<1||c.trials>10)throw new Error('trials must be 1..10');
 c.pollMs??=1000;c.deadlineMs??=30000;
 if(!Number.isInteger(c.pollMs)||c.pollMs<100||c.pollMs>5000)throw new Error('pollMs must be 100..5000');
 if(!Number.isInteger(c.deadlineMs)||c.deadlineMs<10000||c.deadlineMs>120000)throw new Error('deadlineMs must be 10000..120000');
 c.outputDir=path.resolve(base,c.outputDir||'runs');return c;
}
async function checkPorts(ports){for(const port of ports)await new Promise((resolve,reject)=>{
 const server=net.createServer();server.once('error',()=>reject(new Error(`Port ${port} is in use or unavailable`)));
 server.listen({host:'127.0.0.1',port,exclusive:true},()=>server.close(resolve));
});}
module.exports={loadConfig,checkPorts};
