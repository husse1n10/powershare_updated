'use strict';
const {Server}=require('socket.io');
const tokenAuth=require('../../BLL/services/accessTokenService');
const notificationService=require('../../BLL/services/notificationService');

// A socket may join only the room that belongs to its verified access token.
// Clients cannot supply another user's ID to subscribe to their notifications.
function attachSocketServer(httpServer,{origin}={}){
  const io=new Server(httpServer,{cors:{origin:origin||'http://localhost:3000',credentials:true}});
  io.use(async(socket,next)=>{
    try{socket.user=await tokenAuth.authenticateAccessToken(socket.handshake.auth?.token);next();}
    catch(_){next(new Error('unauthorized'));}
  });
  io.on('connection',socket=>{socket.join(`user:${socket.user.id}`);});
  notificationService.setRealtimeEmitter((userId,notification)=>{
    io.to(`user:${userId}`).emit('notification:new',notification);
  });
  return io;
}
module.exports={attachSocketServer};
