// Ecom Workflow System V1 - Cloudflare Worker
// Single file. Config-based auth, SSE events, workflow orchestration.

let configCache = null;
let configCacheTime = 0;

async function getConfig(env) {
  if (configCache && Date.now() - configCacheTime < 60000) return configCache;
  await ensureConfigTable(env);
  try {
    const rows = await env.DB.prepare("SELECT config_key, config_value FROM ecom_config").all();
    configCache = {};
    for (const row of rows.results) configCache[row.config_key] = row.config_value;
    configCacheTime = Date.now();
  } catch { configCache = {}; }
  return configCache;
}
function invalidateConfig() { configCache = null; configCacheTime = 0; }

async function ensureConfigTable(env) {
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS ecom_config (id INTEGER PRIMARY KEY AUTOINCREMENT,config_key TEXT NOT NULL UNIQUE,config_value TEXT NOT NULL DEFAULT '',config_type TEXT NOT NULL DEFAULT 'string',description TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    await env.DB.prepare("INSERT OR IGNORE INTO ecom_config(config_key,config_value,config_type,description) VALUES('auth_password','admin123','password','Login password / JWT signing key'),('r2_public_url','','string','R2 public bucket domain'),('n8n_workflow_title_url','','url','N8N title workflow webhook'),('n8n_workflow_plan_url','','url','N8N plan workflow webhook'),('n8n_workflow_main_url','','url','N8N main image workflow webhook'),('n8n_workflow_detail_url','','url','N8N detail image workflow webhook'),('n8n_workflow_sku_url','','url','N8N SKU image workflow webhook'),('parallel_count','3','string','Parallel jobs per batch (3-5)')").run();
  } catch {}
}

const PHASE_ORDER = [
  "planning","title_generating","main_image",
  "detail_image","sku_image","exporting","completed"
];
const PHASE_CFG_KEY = {
  title_generating: "n8n_workflow_title_url",
  planning: "n8n_workflow_plan_url",
  main_image: "n8n_workflow_main_url",
  detail_image: "n8n_workflow_detail_url",
  sku_image: "n8n_workflow_sku_url",
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {"Content-Type":"application/json"} });
}
function generateBatchNo() {
  const d=new Date();
  const y=String(d.getFullYear()).slice(-2), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  const h=String(d.getHours()).padStart(2,"0"), mm=String(d.getMinutes()).padStart(2,"0"), ss=String(d.getSeconds()).padStart(2,"0");
  return "B"+y+m+dd+h+mm+ss+"-"+Math.random().toString(36).substring(2,8).toUpperCase();
}
function generateJobNo(bn,i){return bn+"-"+String(i).padStart(3,"0");}
function pjs(s,fb){try{return JSON.parse(s)}catch{return fb}}
function extractR2Key(u){if(!u)return null;try{return new URL(u).pathname.replace(/^\//,"")}catch{return null}}
function nowStr(){return new Date().toISOString().replace("T"," ").substring(0,19);}
function b64e(s){return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function b64d(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return atob(s);}
async function jwtCreate(payload,secret){
  const h=b64e(JSON.stringify({alg:"HS256",typ:"JWT"})), b=b64e(JSON.stringify(payload));
  const data=h+"."+b;
  const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return data+"."+b64e(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(data)))));
}
async function jwtVerify(token,secret){
  try{
    const p=token.split("."); if(p.length!==3)return null;
    const data=p[0]+"."+p[1];
    const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const sig=new Uint8Array(b64d(p[2]).split("").map(c=>c.charCodeAt(0)));
    if(!(await crypto.subtle.verify("HMAC",k,sig,new TextEncoder().encode(data))))return null;
    const pl=JSON.parse(b64d(p[1]));
    if(pl.exp&&pl.exp<Math.floor(Date.now()/1000))return null;
    return pl;
  }catch{return null}
}
async function handleGetConfig(env){
  const rows=await env.DB.prepare("SELECT config_key,config_value,config_type,description,updated_at FROM ecom_config ORDER BY id").all();
  const items={};
  for(const r of rows.results)items[r.config_key]={value:r.config_type==="password"?"********":r.config_value,type:r.config_type,description:r.description,updated_at:r.updated_at};
  return jsonResponse({items});
}
async function handleUpdateConfig(request,env){
  const body=await request.json(), updates=body.items||{}, n=nowStr();
  const s=env.DB.prepare("UPDATE ecom_config SET config_value=?,updated_at=? WHERE config_key=?");
  for(const[k,v]of Object.entries(updates))await s.bind(v,n,k).run();
  invalidateConfig();
  return jsonResponse({message:"Config updated"});
}
async function handleLogin(request,env,corsHeaders){
  const b=await request.json(), cfg=await getConfig(env), pwd=cfg.auth_password||"";
  if(!b.password||b.password!==pwd)return new Response(JSON.stringify({error:"Invalid password"}),{status:401,headers:corsHeaders});
  const tk=await jwtCreate({sub:"admin",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400},pwd);
  return new Response(JSON.stringify({token:tk}),{headers:corsHeaders});
}
async function handleDashboard(env){
  const db=env.DB;
  const[t,p,r,c,f,rc]=await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch").first(),
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch WHERE status='pending'").first(),
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch WHERE status='running'").first(),
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch WHERE status='completed'").first(),
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch WHERE status='failed'").first(),
    db.prepare("SELECT id,batch_no,task_name,status,created_at,updated_at FROM ecom_batch ORDER BY created_at DESC LIMIT 10").all(),
  ]);
  return jsonResponse({total:t.count,pending:p.count,running:r.count,completed:c.count,failed:f.count,recent:rc.results});
}
async function handleCreateBatch(request,env){
  const db=env.DB, body=await request.json(), bn=generateBatchNo(), n=nowStr();
  const r=await db.prepare("INSERT INTO ecom_batch(batch_no,task_name,platform,market,language,requirement,status,workflow_mode,batch_count,main_image_count,detail_image_count,sku_image_count,product_json,variant_json,spec_json,sku_json,title_json,stock,weight_kg,base_price,created_at,updated_at) VALUES(?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,'{}',?,?,?,?,?)").bind(
    bn,body.taskName||"",body.platform||"",body.market||"",body.language||"",body.requirement||"",
    body.workflowMode||"auto",body.batchCount||1,body.mainImageCount||1,body.detailImageCount||1,body.skuImageCount||1,
    JSON.stringify(body.productInfo||{}),JSON.stringify(body.variants||[]),JSON.stringify(body.specs||[]),JSON.stringify(body.skus||[]),
    n,n
  ).run();
  const bid=r.meta.last_row_id, skus=body.skus||[];
  if(skus.length>0){
    const s=db.prepare("INSERT INTO ecom_job(batch_id,job_no,status,progress,current_step,sku_info,created_at,updated_at) VALUES(?,?,'pending',0,'',?,?,?)");
    for(let i=0;i<skus.length;i++)await s.bind(bid,generateJobNo(bn,i+1),JSON.stringify(skus[i]),n,n).run();
  }else{
    await db.prepare("INSERT INTO ecom_job(batch_id,job_no,status,progress,current_step,sku_info,created_at,updated_at) VALUES(?,?,'pending',0,'','{}',?,?)").bind(bid,generateJobNo(bn,1),n,n).run();
  }
  return jsonResponse({id:bid,batch_no:bn,message:"Batch created"},201);
}
async function handleListBatches(request,env){
  const db=env.DB, url=new URL(request.url);
  const status=url.searchParams.get("status"), search=url.searchParams.get("search");
  const page=parseInt(url.searchParams.get("page"))||1, ps=parseInt(url.searchParams.get("pageSize"))||20, off=(page-1)*ps;
  let q="SELECT id,batch_no,task_name,status,created_at,updated_at FROM ecom_batch WHERE 1=1", cq="SELECT COUNT(*) as count FROM ecom_batch WHERE 1=1";
  const p=[],cp=[];
  if(status){q+=" AND status=?";cq+=" AND status=?";p.push(status);cp.push(status);}
  if(search){q+=" AND (task_name LIKE ? OR batch_no LIKE ?)";cq+=" AND (task_name LIKE ? OR batch_no LIKE ?)";const l="%"+search+"%";p.push(l,l);cp.push(l,l);}
  q+=" ORDER BY created_at DESC LIMIT ? OFFSET ?";p.push(ps,off);
  const[rows,cr]=await Promise.all([db.prepare(q).bind(...p).all(),db.prepare(cq).bind(...cp).first()]);
  return jsonResponse({data:rows.results,total:cr.count,page,pageSize:ps});
}
async function handleGetBatch(id,env){
  const db=env.DB;
  const b=await db.prepare("SELECT * FROM ecom_batch WHERE id=?").bind(id).first();
  if(!b)return jsonResponse({error:"Batch not found"},404);
  const jobs=await db.prepare("SELECT * FROM ecom_job WHERE batch_id=? ORDER BY job_no ASC").bind(id).all();
  return jsonResponse({...b,product_json:pjs(b.product_json,{}),variant_json:pjs(b.variant_json,[]),spec_json:pjs(b.spec_json,[]),sku_json:pjs(b.sku_json,[]),title_json:pjs(b.title_json,{}),result_json:pjs(b.result_json,{}),jobs:jobs.results.map(j=>({...j,sku_info:pjs(j.sku_info,{}),result_json:pjs(j.result_json,{})}))});
}
async function handleUpdateBatch(id,request,env){
  const db=env.DB, body=await request.json(), n=nowStr();
  if(!(await db.prepare("SELECT id FROM ecom_batch WHERE id=?").bind(id).first()))return jsonResponse({error:"Batch not found"},404);
  const up=[],p=[];
  const fm={taskName:"task_name",platform:"platform",market:"market",language:"language",requirement:"requirement",status:"status",workflowMode:"workflow_mode",batchCount:"batch_count",mainImageCount:"main_image_count",detailImageCount:"detail_image_count",skuImageCount:"sku_image_count",stock:"stock",weightKg:"weight_kg",basePrice:"base_price"};
  for(const[bk,dk]of Object.entries(fm))if(body[bk]!==undefined){up.push(dk+"=?");p.push(body[bk]);}
  if(body.productInfo){up.push("product_json=?");p.push(JSON.stringify(body.productInfo));}
  if(body.variants){up.push("variant_json=?");p.push(JSON.stringify(body.variants));}
  if(body.specs){up.push("spec_json=?");p.push(JSON.stringify(body.specs));}
  if(body.skus){up.push("sku_json=?");p.push(JSON.stringify(body.skus));}
  if(body.titleData){up.push("title_json=?");p.push(JSON.stringify(body.titleData));}
  if(body.result){up.push("result_json=?");p.push(JSON.stringify(body.result));}
  if(!up.length)return jsonResponse({message:"No fields to update"});
  up.push("updated_at=?");p.push(n);p.push(id);
  await db.prepare("UPDATE ecom_batch SET "+up.join(", ")+" WHERE id=?").bind(...p).run();
  return jsonResponse({message:"Batch updated"});
}
async function handleDeleteBatch(id,env){
  const db=env.DB;
  const batch=await db.prepare("SELECT * FROM ecom_batch WHERE id=?").bind(id).first();
  if(!batch)return jsonResponse({error:"Batch not found"},404);
  const keys=[];
  const pi=pjs(batch.product_json,{});
  for(const item of[...(pi.referenceImages||[]),...(pi.attachments||[])]){if(item.key)keys.push(item.key);}
  const jobs=await db.prepare("SELECT * FROM ecom_job WHERE batch_id=?").bind(id).all();
  for(const j of jobs.results){const r=pjs(j.result_json,{});const imgs=r.images||[];for(const img of imgs){const k=extractR2Key(img);if(k)keys.push(k);}}
  if(keys.length>0&&env.R2)await env.R2.delete(keys);
  await db.prepare("DELETE FROM ecom_job WHERE batch_id=?").bind(id).run();
  await db.prepare("DELETE FROM ecom_batch WHERE id=?").bind(id).run();
  return jsonResponse({message:"Batch deleted"});
}
async function callN8NPhase(env,phase,batchId){
  const cfg=await getConfig(env), urlKey=PHASE_CFG_KEY[phase], whUrl=cfg[urlKey];
  if(!whUrl)return {error:"No webhook for phase "+phase};
  const db=env.DB, batch=await db.prepare("SELECT * FROM ecom_batch WHERE id=?").bind(batchId).first();
  if(!batch)return {error:"Batch not found"};
  const jobs=await db.prepare("SELECT * FROM ecom_job WHERE batch_id=? ORDER BY job_no ASC").bind(batchId).all();
  const pi=pjs(batch.product_json,{}), vt=pjs(batch.variant_json,[]), sp=pjs(batch.spec_json,[]), sk=pjs(batch.sku_json,[]);
  const base={batch_id:batch.id,batch_no:batch.batch_no,task_name:batch.task_name,platform:batch.platform,market:batch.market,language:batch.language,requirement:batch.requirement,workflow_mode:batch.workflow_mode,product_info:pi,variants:vt,specs:sp,skus:sk,phase,callback_url:""};
  const parallel=parseInt(cfg.parallel_count)||3;
  let errors=[];
  for(let i=0;i<jobs.results.length;i+=parallel){
    const chunk=jobs.results.slice(i,i+parallel);
    const results=await Promise.all(chunk.map(job=>{
      const body={...base,jobs:[{job_no:job.job_no,status:job.status,sku_info:pjs(job.sku_info,{}),result_json:pjs(job.result_json,{})}]};
      return fetch(whUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.ok?null:r.text().then(t=>({job:job.job_no,error:t.substring(0,200)}))).catch(e=>({job:job.job_no,error:e.message}));
    }));
    for(const err of results)if(err)errors.push(err);
  }
  if(errors.length)return {error:"Parallel errors: "+errors.map(function(e){return e.job+":"+e.error;}).join("; ")};
  return {success:true};
}
async function handleBatchStart(id,env){
  const db=env.DB;
  const batch=await db.prepare("SELECT * FROM ecom_batch WHERE id=?").bind(id).first();
  if(!batch)return jsonResponse({error:"Batch not found"},404);
  if(batch.status!=="pending")return jsonResponse({error:'Cannot start batch with status "'+batch.status+'"'},400);
  const n=nowStr();
  await db.prepare("UPDATE ecom_batch SET status=?,updated_at=? WHERE id=?").bind("running",n,id).run();
  await seedEvent(env,id,"batch_update",{status:"running"});
  if(batch.workflow_mode==="auto"){
    const r=await callN8NPhase(env,"planning",id);
    if(r.error)return jsonResponse({message:"Batch started, N8N trigger failed",error:r.error},200);
    return jsonResponse({message:"Batch started, workflow triggered"});
  }
  return jsonResponse({message:"Batch started, waiting for manual push"});
}
async function handleBatchPushPhase(id,request,env){
  const db=env.DB, batch=await db.prepare("SELECT * FROM ecom_batch WHERE id=?").bind(id).first();
  if(!batch)return jsonResponse({error:"Batch not found"},404);
  if(batch.status!=="running")return jsonResponse({error:'Batch not running (status:"'+batch.status+'")'},400);
  const body=await request.json(), phase=body.phase;
  if(!phase||!PHASE_CFG_KEY[phase])return jsonResponse({error:'Invalid phase "'+phase+'"'},400);
  const r=await callN8NPhase(env,phase,id);
  if(r.error)return jsonResponse({error:r.error},502);
  return jsonResponse({message:'Phase "'+phase+'" triggered'});
}
async function handleListJobs(request,env){
  const db=env.DB, url=new URL(request.url);
  const bid=url.searchParams.get("batch_id"), status=url.searchParams.get("status");
  const page=parseInt(url.searchParams.get("page"))||1, ps=parseInt(url.searchParams.get("pageSize"))||50, off=(page-1)*ps;
  let q="SELECT j.*,b.task_name,b.batch_no FROM ecom_job j LEFT JOIN ecom_batch b ON j.batch_id=b.id WHERE 1=1", cq="SELECT COUNT(*) as count FROM ecom_job WHERE 1=1";
  const p=[],cp=[];
  if(bid){q+=" AND j.batch_id=?";cq+=" AND batch_id=?";p.push(bid);cp.push(bid);}
  if(status){q+=" AND j.status=?";cq+=" AND status=?";p.push(status);cp.push(status);}
  q+=" ORDER BY j.created_at DESC LIMIT ? OFFSET ?";p.push(ps,off);
  const[rows,cr]=await Promise.all([db.prepare(q).bind(...p).all(),db.prepare(cq).bind(...cp).first()]);
  return jsonResponse({data:rows.results,total:cr.count,page,pageSize:ps});
}
async function handleGetJob(id,env){
  const db=env.DB;
  const j=await db.prepare("SELECT j.*,b.task_name,b.batch_no FROM ecom_job j LEFT JOIN ecom_batch b ON j.batch_id=b.id WHERE j.id=?").bind(id).first();
  if(!j)return jsonResponse({error:"Job not found"},404);
  return jsonResponse({...j,sku_info:pjs(j.sku_info,{}),result_json:pjs(j.result_json,{})});
}
async function handleUpload(request,env){
  const fd=await request.formData(), file=fd.get("file"), cat=fd.get("category")||"reference";
  if(!file)return jsonResponse({error:"No file"},400);
  if(!["reference","attachment","main","detail","sku","excel"].includes(cat))return jsonResponse({error:"Invalid category"},400);
  const ext=file.name.includes(".")?file.name.split(".").pop():"";
  const key="ecom/"+cat+"/"+Date.now()+"-"+Math.random().toString(36).substring(2,8)+"."+ext;
  await env.R2.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
  const cfg=await getConfig(env);
  return jsonResponse({url:(cfg.r2_public_url||"")+"/"+key,key});
}
async function handleJobCallback(request,env){
  const db=env.DB, body=await request.json(), n=nowStr();
  const{job_no,status,current_step,progress,result,images,titles}=body;
  if(!job_no)return jsonResponse({error:"job_no required"},400);
  const job=await db.prepare("SELECT * FROM ecom_job WHERE job_no=?").bind(job_no).first();
  if(!job)return jsonResponse({error:"Job not found"},404);
  const nr={...(pjs(job.result_json,{}))};  const oldStatus=job.status;
  if(result)Object.assign(nr,result);
  if(images)nr.images=images;
  if(titles)nr.titles=titles;
  await db.prepare("UPDATE ecom_job SET status=?,current_step=?,progress=?,result_json=?,updated_at=? WHERE id=?")
    .bind(status||job.status,current_step||job.current_step,progress!==undefined?progress:job.progress,JSON.stringify(nr),n,job.id).run();
  await seedEvent(env,job.batch_id,"job_update",{job_id:job.id,job_no:job.job_no,status:status||job.status,progress:progress||job.progress,current_step:current_step||job.current_step});
  if(status==="failed"){
    await db.prepare("UPDATE ecom_batch SET status=?,updated_at=? WHERE id=? AND status!='failed'").bind("failed",n,job.batch_id).run();
    await seedEvent(env,job.batch_id,"batch_update",{status:"failed"});
  }else{
    if(status&&status!=="pending")
      await db.prepare("UPDATE ecom_batch SET status=?,updated_at=? WHERE id=? AND status IN ('pending','running')").bind("running",n,job.batch_id).run();
    const batch=await db.prepare("SELECT * FROM ecom_batch WHERE id=?").bind(job.batch_id).first();
    if(batch&&batch.workflow_mode==="auto"&&status&&status!==oldStatus){
      const newIdx=PHASE_ORDER.indexOf(status);
      const oldIdx=PHASE_ORDER.indexOf(oldStatus);
      if(newIdx>oldIdx&&newIdx>=0){
        const nxtIdx=newIdx+1;
        if(nxtIdx<PHASE_ORDER.length){
          const nextPhase=PHASE_ORDER[nxtIdx];
          if(nextPhase&&nextPhase!=="completed"&&PHASE_CFG_KEY[nextPhase]){
            const jobs=await db.prepare("SELECT * FROM ecom_job WHERE batch_id=?").bind(job.batch_id).all();
            const allReady=jobs.results.every(j=>PHASE_ORDER.indexOf(j.status)>=newIdx);
            const alreadyAdv=jobs.results.some(j=>PHASE_ORDER.indexOf(j.status)>newIdx);
            if(allReady&&!alreadyAdv){
              const r=await callN8NPhase(env,nextPhase,job.batch_id);
              if(r.error)await seedEvent(env,job.batch_id,"phase_error",{phase:nextPhase,error:r.error});
            }
          }
        }
      }
    }
  }
  return jsonResponse({message:"Job updated"});
}
async function seedEvent(env,batchId,evtType,payload){
  try{await env.DB.prepare("INSERT INTO ecom_event(batch_id,event_type,payload,created_at) VALUES(?,?,?,?)").bind(batchId,evtType,JSON.stringify(payload),nowStr()).run();}catch{}
}
async function handleEvents(request,env,corsHeaders){
  const url=new URL(request.url), batchId=url.searchParams.get("batch_id");
  try{await env.DB.prepare("CREATE TABLE IF NOT EXISTS ecom_event(id INTEGER PRIMARY KEY AUTOINCREMENT,batch_id INTEGER NOT NULL,event_type TEXT NOT NULL,payload TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();}catch{}
  const{readable,writable}=new TransformStream();
  const w=writable.getWriter(), enc=new TextEncoder();
  w.write(enc.encode(":connected\n\n"));
  let lastId=0;
  const poll=async()=>{
    try{
      let q="SELECT id,event_type,payload,created_at FROM ecom_event WHERE id>?";const p=[lastId];
      if(batchId){q+=" AND batch_id=?";p.push(parseInt(batchId));}
      q+=" ORDER BY id ASC LIMIT 50";
      const rows=await env.DB.prepare(q).bind(...p).all();
      for(const r of rows.results){lastId=r.id;w.write(enc.encode("id: "+r.id+"\nevent: "+r.event_type+"\ndata: "+r.payload+"\n\n"));}
    }catch{}
    try{await env.DB.prepare("DELETE FROM ecom_event WHERE id<=(SELECT MAX(id)-1000 FROM ecom_event)").run();}catch{}
    try{w.write(enc.encode(":ping\n\n"));}catch{clearInterval(iv);}
  };
  const iv=setInterval(poll,2000);poll();
  request.signal.addEventListener("abort",()=>{clearInterval(iv);w.close().catch(()=>{});});
  return new Response(readable,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive",...corsHeaders}});
}
export default {
  async fetch(request, env) {
    const url=new URL(request.url), method=request.method, path=url.pathname;
    const ch={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization","Access-Control-Max-Age":"86400"};
    if(method==="OPTIONS")return new Response(null,{headers:ch});
    try{
      if(method==="GET"&&path==="/api/events")return await handleEvents(request,env,ch);
      if(method==="POST"&&path==="/api/auth/login")return await handleLogin(request,env,ch);
      if(path.startsWith("/api/")&&path!=="/api/callback/job"&&path!=="/api/upload"){
        const cfg=await getConfig(env), secret=cfg.auth_password||"";
        const auth=request.headers.get("Authorization");
        if(!(await jwtVerify(auth?auth.replace("Bearer ",""):"",secret)))
          return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:ch});
      }
      const R=(f)=>f;
      let resp;
      if(method==="GET"&&path==="/api/dashboard")resp=await handleDashboard(env);
      else if(method==="GET"&&path==="/api/config")resp=await handleGetConfig(env);
      else if(method==="PUT"&&path==="/api/config")resp=await handleUpdateConfig(request,env);
      else if(method==="POST"&&path==="/api/batches")resp=await handleCreateBatch(request,env);
      else if(method==="GET"&&path==="/api/batches")resp=await handleListBatches(request,env);
      else if(method==="GET"&&/^\/api\/batches\/\d+$/.test(path))resp=await handleGetBatch(path.split("/")[3],env);
      else if(method==="PUT"&&/^\/api\/batches\/\d+$/.test(path))resp=await handleUpdateBatch(path.split("/")[3],request,env);
      else if(method==="DELETE"&&/^\/api\/batches\/\d+$/.test(path))resp=await handleDeleteBatch(path.split("/")[3],env);
      else if(method==="POST"&&/^\/api\/batches\/\d+\/start$/.test(path))resp=await handleBatchStart(path.split("/")[3],env);
      else if(method==="POST"&&/^\/api\/batches\/\d+\/push-phase$/.test(path))resp=await handleBatchPushPhase(path.split("/")[3],request,env);
      else if(method==="GET"&&path==="/api/jobs")resp=await handleListJobs(request,env);
      else if(method==="GET"&&/^\/api\/jobs\/\d+$/.test(path))resp=await handleGetJob(path.split("/")[3],env);
      else if(method==="POST"&&path==="/api/upload")resp=await handleUpload(request,env);
      else if(method==="POST"&&path==="/api/callback/job")resp=await handleJobCallback(request,env);
      else resp=jsonResponse({error:"Not Found"},404);
      return new Response(resp.body,{status:resp.status,headers:{...ch,...Object.fromEntries(resp.headers)}});
    }catch(err){return new Response(JSON.stringify({error:err.message}),{status:500,headers:ch});}
  },
};
