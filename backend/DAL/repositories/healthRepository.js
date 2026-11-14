'use strict';
const {query}=require('../database/connection');
async function ping(){await query('SELECT 1');return true;}
module.exports={ping};
