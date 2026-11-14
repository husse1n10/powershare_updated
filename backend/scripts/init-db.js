'use strict';
require('dotenv').config();
const fs=require('fs');
const path=require('path');
const mysql=require('mysql2/promise');
const {databaseConfig}=require('../DAL/database/config');

async function main(){
  const {database:dbName,...options}=databaseConfig();
  const useExistingDatabase=Boolean(process.env.JAWSDB_URL);
  if(!useExistingDatabase&&!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME may contain only letters, numbers and underscore');
  const conn=await mysql.createConnection({
    ...options,
    ...(useExistingDatabase?{database:dbName}:{}),
    multipleStatements:true,
  });
  try{
    if(!useExistingDatabase){
      await conn.query(`CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(dbName,true)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.query(`USE ${mysql.escapeId(dbName,true)}`);
    }
    const schema=fs.readFileSync(path.join(__dirname,'..','database','schema.sql'),'utf8');
    await conn.query(schema);
    console.log(`PowerShare database initialized: ${dbName}`);
    console.log('Core schema initialized without demo accounts. Use `npm run db:seed:demo` only for local/QA environments.');
  }finally{await conn.end();}
}

main().catch(err=>{console.error('Database initialization failed:',err.message);process.exit(1);});
