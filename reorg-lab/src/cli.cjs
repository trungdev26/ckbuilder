#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');
const {loadConfig,checkPorts}=require('./config.cjs');
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(!['doctor','run'].includes(command)||args.length!==2||args[0]!=='--config')throw new Error('Usage: node src/cli.cjs doctor|run --config <file.json>');
 if(Number(process.versions.node.split('.')[0])<22)throw new Error('Node 22 or later is required');
 const c=loadConfig(args[1]);await checkPorts(Object.values(c.ports));
 const env={...process.env,CKB_BIN:c.ckbBin,ALWAYS_SUCCESS:c.alwaysSuccess,CELLORA_BIN:c.celloraBin,PSQL:c.psqlBin,CELLORA_ADMIN_URL:c.adminUrl,CELLORA_METRICS_ADDR:`127.0.0.1:${c.ports.metrics}`,CELLORA_POLL_INTERVAL_MS:String(c.pollMs),POLL_MS:String(c.pollMs),DEADLINE_MS:String(c.deadlineMs),TRIALS:String(c.trials),CONTROLS:'1',REORG_PORTS:JSON.stringify(c.ports),PATH:path.dirname(c.psqlBin)+path.delimiter+process.env.PATH};
 function probe(executable,args){const r=spawnSync(executable,args,{env,encoding:'utf8',windowsHide:true,timeout:8000});if(r.error||r.status!==0)throw new Error(`Preflight failed for ${path.basename(executable)}`);return r.stdout.trim();}
 const ckbVersion=probe(c.ckbBin,['--version']);
 if(!/^ckb 0\.208\.0\b/.test(ckbVersion))throw new Error('This scenario currently requires verified CKB 0.208.0');
 const db=probe(c.psqlBin,['-d',c.adminUrl,'-At','-v','ON_ERROR_STOP=1','-c',"select rolsuper or rolcreatedb from pg_roles where rolname=current_user;"]);
 if(db!=='t')throw new Error('Dedicated PostgreSQL role needs CREATEDB permission');
 console.log(JSON.stringify({event:'doctor_passed',node:process.version,ckb:ckbVersion,ports:c.ports,target:'Cellora indexer',trials:c.trials}));
 if(command==='doctor')return;
 fs.mkdirSync(c.outputDir,{recursive:true});const dir=fs.mkdtempSync(path.join(c.outputDir,'run-'));env.REORG_RUN_DIR=dir;
 console.log('Artifacts: '+dir);
 const fd=fs.openSync(path.join(dir,'console.log'),'a');
 const child=spawn(process.execPath,[path.join(__dirname,'scenario.cjs')],{env,windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
 child.once('error',error=>{fs.writeFileSync(path.join(dir,'launch-error.json'),JSON.stringify({verdict:'ERROR',error:error.message}));});
 const exit=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('exit',code=>resolve(code??1));});
 const reports=fs.readdirSync(dir).filter(f=>/^evidence-service-.*\.json$/.test(f));
 const status={exitCode:exit,report:reports.length?reports[0]:null};
 if(!status.report){fs.writeFileSync(path.join(dir,'interrupted.json'),JSON.stringify({verdict:'ERROR',reason:'Scenario exited before final report; inspect journal and console.log'}));}
 fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(status,null,2));
 console.log(JSON.stringify({event:'run_finished',...status,directory:dir}));process.exitCode=exit;
}
main().catch(error=>{console.error(JSON.stringify({verdict:'ERROR',error:error.message}));process.exitCode=1;});
