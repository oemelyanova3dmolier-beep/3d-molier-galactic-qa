/* Адаптер хранилища для размещения на своём сайте.
   Если рядом работает server.js, данные общие для всех (серверный режим).
   Если страница лежит на обычном статическом хостинге, данные хранятся только в браузере (демо-режим). */
(function(){
var LS=window.localStorage,KEY="gqa_db_v1",mode="local",cache={reports:{},config:{}},subs=[],last="";
function ls(k,v){try{if(v===undefined)return LS.getItem(k);LS.setItem(k,v)}catch(e){}return null}
function rid(){return Math.random().toString(36).slice(2,12)+Date.now().toString(36).slice(-4)}
var m=/[?&]admin=([^&#]*)/.exec(location.search);if(m)ls("gqa_key",decodeURIComponent(m[1]));
var adminKey=ls("gqa_key")||"",uid=ls("gqa_uid")||(function(){var x=rid();ls("gqa_uid",x);return x})(),owner=false;
function clone(o){return JSON.parse(JSON.stringify(o))}
function mk(coll,id){return{id:id,exists:true,data:function(){return clone(cache[coll][id])}}}
function none(id){return{id:id,exists:false,data:function(){return undefined}}}
function notify(){subs.forEach(function(s){
 if(s.doc){var v=cache[s.coll][s.id],j=JSON.stringify(v||null);if(s.prev!==j){s.prev=j;s.cb(v?mk(s.coll,s.id):none(s.id))}}
 else{var cur=cache[s.coll],ch=[],ids=Object.keys(cur);
  ids.forEach(function(id){var j=JSON.stringify(cur[id]);if(s.prev===null||!(id in s.prev))ch.push({type:"added",doc:mk(s.coll,id)});else if(s.prev[id]!==j)ch.push({type:"modified",doc:mk(s.coll,id)})});
  if(s.prev)Object.keys(s.prev).forEach(function(id){if(!(id in cur))ch.push({type:"removed",doc:none(id)})});
  var np={};ids.forEach(function(id){np[id]=JSON.stringify(cur[id])});
  if(s.prev===null||ch.length){s.prev=np;s.cb({docs:ids.map(function(id){return mk(s.coll,id)}),docChanges:function(){return ch}})}}})}
function setCache(d){cache={reports:d.reports||{},config:d.config||{}};notify()}
function fail(msg,code){var e=new Error(msg);e.code=code||"error";return e}
function put(coll,id,data){
 if(mode=="server")return fetch("api/db/"+coll+"/"+id,{method:data?"PUT":"DELETE",headers:{"content-type":"application/json","x-admin-key":adminKey},body:data?JSON.stringify(data):undefined}).then(function(r){if(!r.ok)throw fail(r.status==403?"нет прав (нужен ключ администратора)":"ошибка сервера "+r.status,r.status==403?"permission_denied":"error");if(data)cache[coll][id]=data;else delete cache[coll][id];notify()});
 if(data)cache[coll][id]=data;else delete cache[coll][id];ls(KEY,JSON.stringify(cache));notify();return Promise.resolve()}
var db={collection:function(c){return{
 add:function(d){var id=rid();return put(c,id,clone(d)).then(function(){return{id:id}})},
 onSnapshot:function(cb){var s={doc:false,coll:c,cb:cb,prev:null};subs.push(s);setTimeout(notify,0);return function(){subs.splice(subs.indexOf(s),1)}}}},
 doc:function(p){var a=p.split("/"),c=a[0],id=a[1];return{
 set:function(d){return put(c,id,clone(d))},
 update:function(d){var cur=cache[c][id];if(!cur)return Promise.reject(fail("документ не найден","not_found"));return put(c,id,Object.assign({},cur,clone(d)))},
 get:function(){return Promise.resolve(cache[c][id]?mk(c,id):none(id))},
 onSnapshot:function(cb){var s={doc:true,coll:c,id:id,cb:cb,prev:undefined};subs.push(s);setTimeout(notify,0);return function(){subs.splice(subs.indexOf(s),1)}}}}};
var ready=fetch("api/db",{cache:"no-store"}).then(function(r){var t=r.headers.get("content-type")||"";if(!r.ok||t.indexOf("json")<0)throw 0;return r.json()}).then(function(d){
 mode="server";last=JSON.stringify(d);setCache(d);
 setInterval(function(){fetch("api/db",{cache:"no-store"}).then(function(r){return r.json()}).then(function(d){var j=JSON.stringify(d);if(j!==last){last=j;setCache(d)}}).catch(function(){})},2500);
 return fetch("api/whoami",{headers:{"x-admin-key":adminKey}}).then(function(r){return r.json()}).then(function(j){owner=!!j.owner}).catch(function(){})
}).catch(function(){
 mode="local";try{setCache(JSON.parse(ls(KEY)||"{}"))}catch(e){}
 owner=!!adminKey;window.addEventListener("storage",function(e){if(e.key==KEY){try{setCache(JSON.parse(e.newValue||"{}"))}catch(x){}}});
 var b=document.getElementById("banner");if(b)b.textContent="Демо-режим: данные хранятся только в этом браузере. Для общей игры запустите server.js (см. README)."});
window.claude={use:function(n){return ready.then(function(){
 if(n=="db")return db;
 if(n=="user")return{isOwner:function(){return owner},id:function(){return Promise.resolve(uid)}};
 if(n=="assets")return{upload:function(blob){
  if(mode=="server")return fetch("api/upload",{method:"POST",headers:{"content-type":blob.type||"image/jpeg"},body:blob}).then(function(r){if(!r.ok)throw fail("не удалось загрузить файл");return r.json()});
  return new Promise(function(ok,no){var f=new FileReader();f.onload=function(){ok({id:f.result})};f.onerror=function(){no(fail("не удалось прочитать файл"))};f.readAsDataURL(blob)})}};
 return null})}};
})();
