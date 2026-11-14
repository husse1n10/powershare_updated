import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: true,
});

let refreshPromise = null;
async function refreshAccessToken(){
  if(!refreshPromise){
    refreshPromise=axios.post('/api/auth/refresh',{}, {withCredentials:true,timeout:30000})
      .then(res=>{
        const token=res.data?.accessToken;
        if(!token)throw new Error('No access token returned');
        api.defaults.headers.common.Authorization=`Bearer ${token}`;
        return token;
      })
      .finally(()=>{refreshPromise=null;});
  }
  return refreshPromise;
}

// Refresh a short-lived access token by using the HttpOnly refresh cookie.
// The refresh token is never readable by frontend JavaScript.
api.interceptors.response.use(
  response=>response,
  async error=>{
    const {response,config}=error;
    const isRefresh=String(config?.url||'').includes('/auth/refresh');
    const canRefresh=response?.status===401 && ['TOKEN_EXPIRED','INVALID_TOKEN','SESSION_INVALIDATED'].includes(response?.data?.code);
    if(canRefresh&&!isRefresh&&!config?._retry){
      config._retry=true;
      try{
        const token=await refreshAccessToken();
        config.headers=config.headers||{};
        config.headers.Authorization=`Bearer ${token}`;
        return api(config);
      }catch(_){
        delete api.defaults.headers.common.Authorization;
        if(window.location.pathname!=='/login')window.location.href='/login';
      }
    }
    return Promise.reject(error);
  }
);

export { refreshAccessToken };
export default api;
