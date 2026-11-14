'use strict';
require('dotenv').config();
const fs=require('fs');
const path=require('path');
const mysql=require('mysql2/promise');

async function main(){
  if(String(process.env.NODE_ENV||'development').toLowerCase()==='production'){
    throw new Error('Demo seed is disabled when NODE_ENV=production');
  }
  const dbName=String(process.env.DB_NAME||'powershare');
  if(!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME may contain only letters, numbers and underscore');
  const conn=await mysql.createConnection({
    host:process.env.DB_HOST||'localhost',
    port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER||'root',
    password:process.env.DB_PASSWORD||'',
    database:dbName,
    multipleStatements:true,
    charset:'utf8mb4',
  });
  try{
    const seed=fs.readFileSync(path.join(__dirname,'..','database','demo-seed.sql'),'utf8');
    await conn.query(seed);
    console.log(`PowerShare demo data seeded into: ${dbName}`);
    console.log('Demo users: admin, owner, collector, subscriber / password: Admin@123456');
  }finally{await conn.end();}
}

main().catch(err=>{console.error('Demo seed failed:',err.message);process.exit(1);});
