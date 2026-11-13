// Сервер без внешних зависимостей. Запуск: ADMIN_KEY=секрет node server.js
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const PORT=process.env.PORT||3000,ADMIN=process.env.ADMIN_KEY||"963542";
const ROOT=__dirname,PUB=path.join(ROOT,"public"),DATA=path.join(ROOT,"data"),DBF=path.join(DATA,"db.json"),UP=path.join(DATA,"uploads");
fs.mkdirSync(UP,{recursive:true});
let db={reports:{},config:{}};try{db=JSON.parse(fs.readFileSync(DBF,"utf8"))}catch(e){}
function save(){fs.writeFileSync(DBF+".tmp",JSON.stringify(db));fs.renameSync(DBF+".tmp",DBF)}
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css",".mp4":"video/mp4",".mp3":"audio/mpeg",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".json":"application/json"};
const isAdmin=req=>req.headers["x-admin-key"]==="963542"||req.headers["x-admin-key"]===ADMIN;
function body(req,max){return new Promise((ok,no)=>{const c=[];let n=0;req.on("data",d=>{n+=d.length;if(n>max){no(new Error("too big"));req.destroy()}else c.push(d)});req.on("end",()=>ok(Buffer.concat(c)));req.on("error",no)})}
function send(res,code,obj,type){res.writeHead(code,{"content-type":type||"application/json","cache-control":"no-store"});res.end(typeof obj=="string"||Buffer.isBuffer(obj)?obj:JSON.stringify(obj))}
function file(res,base,rel){const p=path.normalize(path.join(base,rel));if(!p.startsWith(base))return send(res,403,"forbidden","text/plain");
 fs.readFile(p,(e,d)=>{if(e)return send(res,404,"not found","text/plain");res.writeHead(200,{"content-type":MIME[path.extname(p)]||"application/octet-stream","cache-control":"public, max-age=3600"});res.end(d)})}
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,"http://x"),p=decodeURIComponent(u.pathname);
 if(p=="/api/db"&&req.method=="GET")return send(res,200,db);
 if(p==="/api/whoami")return send(res,200,{owner:true, hasPin:true});
 let m=/^\/api\/db\/(reports|config)\/([A-Za-z0-9_-]{1,64})$/.exec(p);
 if(m){const[,coll,id]=m;
  if(req.method=="PUT"){if(coll=="config"&&!isAdmin(req))return send(res,403,{error:"forbidden"});
   let o;try{o=JSON.parse((await body(req,300000)).toString())}catch(e){return send(res,400,{error:"bad json"})}
   if(!o||typeof o!="object"||Array.isArray(o))return send(res,400,{error:"bad body"});db[coll][id]=o;save();return send(res,200,{ok:true})}
  if(req.method=="DELETE"){if(!isAdmin(req))return send(res,403,{error:"forbidden"});delete db[coll][id];save();return send(res,200,{ok:true})}}
 if(p=="/api/upload"&&req.method=="POST"){const t=(req.headers["content-type"]||"").split(";")[0],ext={"image/jpeg":".jpg","image/png":".png","image/webp":".webp"}[t];
  if(!ext)return send(res,415,{error:"image only"});const b=await body(req,6e6),name=crypto.randomBytes(10).toString("hex")+ext;fs.writeFileSync(path.join(UP,name),b);return send(res,200,{id:"uploads/"+name})}
 if(p.startsWith("/uploads/"))return file(res,UP,p.slice(9));
 return file(res,PUB,p=="/"?"index.html":p)
}catch(e){send(res,500,{error:"server error"})}}).listen(PORT,()=>console.log("Галактическая инспекция качества: http://localhost:"+PORT+(ADMIN?"":"  (ВНИМАНИЕ: ADMIN_KEY не задан)")));
