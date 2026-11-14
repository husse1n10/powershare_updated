'use strict';
// PL authentication middleware. Token verification, account status and session
// version checks live in the BLL accessTokenService (DEF-062: PL must not use DAL).
const {authenticateAccessToken}=require('../BLL/services/accessTokenService');

async function authenticate(req,res,next){
  const header=req.headers.authorization||'';
  const token=header.startsWith('Bearer ')?header.slice(7):null;
  try{
    req.user=await authenticateAccessToken(token);
    return next();
  }catch(err){
    // Controlled auth failures (401/403) are answered here; infrastructure errors
    // (e.g. database down) go to the central error handler instead of being
    // misreported as an invalid token.
    if(err?.statusCode&&err.statusCode<500)return res.status(err.statusCode).json({success:false,error:err.message,code:err.code});
    return next(err);
  }
}
function allowRoles(...roles){ return (req,res,next)=> roles.includes(req.user?.role)?next():res.status(403).json({success:false,error:'Access denied',code:'FORBIDDEN'}); }
const requireAdmin=allowRoles('admin');
const requireOwner=allowRoles('owner');
const requireCollector=allowRoles('collector');
const requireSubscriber=allowRoles('subscriber');
module.exports={authenticate,allowRoles,requireAdmin,requireOwner,requireCollector,requireSubscriber};
