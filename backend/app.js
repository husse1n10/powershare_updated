'use strict';
require('dotenv').config();
const express=require('express');
const helmet=require('helmet');
const cors=require('cors');
const cookieParser=require('cookie-parser');
const path=require('path');
const fs=require('fs');
const rateLimit=require('express-rate-limit');
const authRoutes=require('./PL/routes/authRoutes');
const adminRoutes=require('./PL/routes/adminRoutes');
const ownerRoutes=require('./PL/routes/ownerRoutes');
const collectorRoutes=require('./PL/routes/collectorRoutes');
const subscriberRoutes=require('./PL/routes/subscriberRoutes');
const commonRoutes=require('./PL/routes/commonRoutes');
const {notFound,errorHandler}=require('./middleware/errorHandler');
const health=require('./BLL/services/healthService');

const app=express();
if(process.env.DYNO) app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin:process.env.FRONTEND_ORIGIN||'http://localhost:3000',credentials:true}));
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true,limit:'2mb'}));
app.use(cookieParser());
app.use(rateLimit({windowMs:60*1000,max:300,standardHeaders:true,legacyHeaders:false}));
app.get('/api/health',(_req,res)=>res.json({status:'ok',service:'PowerShare API',architecture:'PL-BLL-DAL',time:new Date().toISOString()}));
app.get('/api/ready',async(_req,res)=>{
  const ready=await health.isDatabaseReady();
  if(ready)return res.json({status:'ready',database:'ok',time:new Date().toISOString()});
  return res.status(503).json({status:'not_ready',database:'unavailable',time:new Date().toISOString()});
});
app.use('/api/auth',authRoutes);
app.use('/api/admin',adminRoutes);
app.use('/api/owner',ownerRoutes);
app.use('/api/collector',collectorRoutes);
app.use('/api/subscriber',subscriberRoutes);
app.use('/api',commonRoutes);

// Optional single-service deployment: after `npm run build` in frontend/, set
// SERVE_FRONTEND=true and Express will serve the current React production build.
// API and Socket.IO paths remain reserved for backend traffic.
if(String(process.env.SERVE_FRONTEND||'').toLowerCase()==='true'){
  const frontendBuild=path.resolve(__dirname,'..','frontend','build');
  const frontendIndex=path.join(frontendBuild,'index.html');
  if(!fs.existsSync(frontendIndex)){
    throw new Error('SERVE_FRONTEND=true but frontend/build/index.html was not found. Run the frontend production build first.');
  }
  app.use(express.static(frontendBuild,{index:false,maxAge:process.env.NODE_ENV==='production'?'1h':0}));
  app.get(/^(?!\/(?:api|socket\.io)(?:\/|$)).*/,(_req,res)=>res.sendFile(frontendIndex));
}

app.use(notFound);
app.use(errorHandler);
module.exports=app;
