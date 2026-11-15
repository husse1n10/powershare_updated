'use strict';
module.exports=function publicUser(user){
  if(!user)return user;
  const {password_hash,...safe}=user;
  return safe;
};
