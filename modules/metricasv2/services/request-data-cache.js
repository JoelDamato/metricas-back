const {AsyncLocalStorage}=require('node:async_hooks');
const scope=new AsyncLocalStorage();
function once(key,load){const cache=scope.getStore();if(!cache)return load();if(!cache.has(key))cache.set(key,Promise.resolve().then(load));return cache.get(key);}
module.exports={once,run:fn=>scope.run(new Map(),fn)};
