'use strict';
const {spawnSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const mysql=require('mysql2');
const db=require('../DAL/database/connection');

async function main(){
  if(process.env.NODE_ENV!=='test'||process.env.DB_HOST!=='127.0.0.1'||!['powershare_round2_qa','gms_final_qa'].includes(process.env.DB_NAME)||process.env.JAWSDB_URL)throw new Error('This privileged regression is restricted to the isolated local QA database.');
  const username='gms_budget_'+Date.now().toString(36),password=randomBytes(18).toString('hex');
  const account=mysql.escape(username)+"@'127.0.0.1'";
  try{
    await db.query(`CREATE USER ${account} IDENTIFIED BY ${mysql.escape(password)} WITH MAX_USER_CONNECTIONS 3`);
    await db.query(`GRANT SELECT ON ${mysql.escapeId(process.env.DB_NAME)}.* TO ${account}`);
    const owner=await db.queryOne("SELECT id FROM users WHERE role='owner' AND is_active=1 LIMIT 1");
    if(!owner)throw new Error('Seed a local QA owner first');
    const code="const s=require('./BLL/services/ownerService');const db=require('./DAL/database/connection');Promise.all(Array.from({length:6},()=>s.report(Number(process.env.QA_OWNER_ID),{month:11,year:2026}))).then(rows=>console.log(JSON.stringify({ok:true,reports:rows.length}))).catch(e=>{console.log(JSON.stringify({ok:false,code:e.code}));process.exitCode=1}).finally(()=>db.pool.end());";
    const observations=[];
    for(const budget of ['10','2']){
      const result=spawnSync(process.execPath,['-e',code],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,DB_USER:username,DB_PASSWORD:password,DB_POOL_SIZE:budget,QA_OWNER_ID:String(owner.id)},encoding:'utf8',timeout:60000});
      if(result.error)throw result.error;
      const last=result.stdout.trim().split('\n').at(-1);const value=JSON.parse(last);observations.push({pool_size:Number(budget),account_connection_limit:3,...value});
    }
    if(observations[0].ok||!['ER_USER_LIMIT_REACHED','ER_TOO_MANY_USER_CONNECTIONS'].includes(observations[0].code))throw new Error('The unbounded control did not reproduce the expected account resource error');
    if(!observations[1].ok||observations[1].reports!==6)throw new Error('The bounded connection pool did not complete the report workload');
    console.log(JSON.stringify({result:'Pass',observations}));
  }finally{await db.query(`DROP USER IF EXISTS ${account}`);await db.pool.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
