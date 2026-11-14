'use strict';
require('dotenv').config();
const http=require('http');
const {validateProductionSecurityConfig}=require('./BLL/domain/securityConfigRules');
const securityConfig=validateProductionSecurityConfig(process.env);
if(!securityConfig.valid){throw new Error(`Security configuration invalid: ${securityConfig.errors.join('; ')}`);}
const app=require('./app');
const {attachSocketServer}=require('./PL/realtime/socketServer');
const port=Number(process.env.PORT||5000);
const server=http.createServer(app);
const io=attachSocketServer(server,{origin:process.env.FRONTEND_ORIGIN||'http://localhost:3000'});
app.set('io',io);
server.listen(port,()=>console.log(`PowerShare API running on http://localhost:${port}`));
