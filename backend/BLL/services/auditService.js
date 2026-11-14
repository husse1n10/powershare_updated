'use strict';
const repo=require('../../DAL/repositories/auditRepository');
async function logFromRequest(req,action,entityType=null,entityId=null,details=null){return repo.log({user_id:req.user?.id||null,action,entity_type:entityType,entity_id:entityId,method:req.method,route:req.originalUrl,ip_address:req.ip,details});}
module.exports={logFromRequest,list:repo.list};
