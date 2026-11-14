'use strict';
const AppError=require('../../utils/AppError');
function calculateCollectorBalance(transactions=[]){
  return Math.round(transactions.reduce((sum,tx)=>{
    const amount=Number(tx.amount_lbp||0);
    if(tx.tx_type==='bill_collection'||tx.tx_type==='adjustment') return sum+amount;
    if(tx.tx_type==='owner_settlement') return sum-amount;
    return sum;
  },0)*100)/100;
}
function validateSettlement(amount,balance){ const a=Number(amount), b=Number(balance); if(!Number.isFinite(a)||a<=0) throw new AppError('Settlement amount must be greater than zero',422,'INVALID_SETTLEMENT'); if(a>b+0.01) throw new AppError('Settlement amount exceeds collector balance',422,'SETTLEMENT_EXCEEDS_BALANCE'); return true; }
module.exports={calculateCollectorBalance,validateSettlement};
