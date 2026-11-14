'use strict';
const AppError=require('../../utils/AppError');

function validateSubscriberHardDelete(context){
  if(!context)throw new AppError('Subscriber not found',404,'SUBSCRIBER_NOT_FOUND');
  if(context.user_id)throw new AppError('Subscriber has a linked login account. Deactivate the subscription instead of permanently deleting the record.',409,'SUBSCRIBER_ACCOUNT_LINKED');
  const historical=Number(context.bill_count||0)+Number(context.payment_count||0)+Number(context.reading_count||0);
  if(historical>0)throw new AppError('Subscriber has historical meter, billing or payment records and cannot be permanently deleted.',409,'SUBSCRIBER_HISTORY_PROTECTED');
  return true;
}
module.exports={validateSubscriberHardDelete};
