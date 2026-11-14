'use strict';
const notifications=require('../../BLL/services/notificationService');
const support=require('../../BLL/services/supportService');
async function listNotifications(req,res){res.json({items:await notifications.list(req.user.id,req.query.limit||50),unread:await notifications.unreadCount(req.user.id)});}
async function readNotification(req,res){res.json(await notifications.markRead(req.user.id,req.params.id));}
async function readAllNotifications(req,res){await notifications.markAllRead(req.user.id);res.json({message:'All notifications marked read'});}
async function listTickets(req,res){res.json(await support.list(req.user));}
async function createTicket(req,res){res.status(201).json(await support.create(req.user,req.body,req));}
async function ticket(req,res){res.json(await support.detail(req.user,req.params.id));}
async function reply(req,res){res.status(201).json(await support.reply(req.user,req.params.id,req.body.message,req));}
async function status(req,res){res.json(await support.updateStatus(req.user,req.params.id,req.body.status,req));}
module.exports={listNotifications,readNotification,readAllNotifications,listTickets,createTicket,ticket,reply,status};
