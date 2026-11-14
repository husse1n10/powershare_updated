'use strict';
const auth=require('../../BLL/services/authService');
const registration=require('../../BLL/services/registrationService');
async function registrationDestinations(_req,res){res.json(await registration.listDestinations());}
const REFRESH_COOKIE='powershare_refresh';

function cookieOptions(){
  const production=process.env.NODE_ENV==='production';
  return {
    httpOnly:true,
    secure:production,
    sameSite:process.env.COOKIE_SAME_SITE||'lax',
    path:'/api/auth',
    maxAge:Number(process.env.REFRESH_TOKEN_DAYS||7)*24*60*60*1000,
  };
}
function tokenFromRequest(req){return req.cookies?.[REFRESH_COOKIE]||req.body?.refreshToken||null;}
function setRefreshCookie(res,token){res.cookie(REFRESH_COOKIE,token,cookieOptions());}
function clearRefreshCookie(res){const {maxAge,...opts}=cookieOptions();res.clearCookie(REFRESH_COOKIE,opts);}
function publicAuthResult(result){return {accessToken:result.accessToken,user:result.user};}

async function login(req,res){
  const result=await auth.login(req.body.username||req.body.identifier,req.body.password,req);
  setRefreshCookie(res,result.refreshToken);
  res.json(publicAuthResult(result));
}
async function register(req,res){const user=await auth.registerSubscriber(req.body,req);res.status(201).json(user);}
async function refresh(req,res){
  const result=await auth.refresh(tokenFromRequest(req));
  setRefreshCookie(res,result.refreshToken);
  res.json(publicAuthResult(result));
}
async function logout(req,res){await auth.logout(tokenFromRequest(req));clearRefreshCookie(res);res.json({message:'Logged out'});}
async function me(req,res){res.json(await auth.me(req.user.id));}
async function changePassword(req,res){await auth.changePassword(req.user.id,req.body.current_password,req.body.new_password,req);clearRefreshCookie(res);res.json({message:'Password changed. Please log in again.'});}
async function updateProfile(req,res){res.json(await auth.updateProfile(req.user.id,req.body,req));}
module.exports={registrationDestinations,login,register,refresh,logout,me,changePassword,updateProfile,cookieOptions};
