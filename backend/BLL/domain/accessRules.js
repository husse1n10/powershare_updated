'use strict';
const permissions={
  admin:['platform:manage','users:manage','owners:manage','reports:all','support:manage','audit:view'],
  owner:['generators:manage','meters:manage','subscribers:manage','plans:manage','billing:manage','payments:manage','collectors:manage','outages:manage','reports:owner','support:create'],
  collector:['assigned-subscribers:view','meter-readings:manage','bills:view','payments:collect','settlements:request','support:create'],
  subscriber:['self:view','bills:view','payments:view','payments:simulated','outages:view','notifications:view','support:create'],
};
function hasPermission(role,permission){ return !!permissions[role]?.includes(permission); }
module.exports={permissions,hasPermission};
