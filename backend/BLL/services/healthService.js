'use strict';
const healthRepo=require('../../DAL/repositories/healthRepository');
// Readiness is a BLL decision so the PL never touches the DAL directly (DEF-062).
async function isDatabaseReady(){try{await healthRepo.ping();return true;}catch(_){return false;}}
module.exports={isDatabaseReady};
