'use strict';
// Applies database/migrations/*.sql in name order. Each migration is idempotent.
require('dotenv').config();
const fs=require('fs');const path=require('path');const mysql=require('mysql2/promise');
const {databaseConfig}=require('../DAL/database/config');
async function main(){
  const conn=await mysql.createConnection({...databaseConfig(),multipleStatements:true});
  try{
    const dir=path.join(__dirname,'..','database','migrations');
    for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){await conn.query(fs.readFileSync(path.join(dir,file),'utf8'));console.log(`Applied migration: ${file}`);}
  }finally{await conn.end();}
}
main().catch(err=>{console.error('Migration failed:',err.message);process.exit(1);});
