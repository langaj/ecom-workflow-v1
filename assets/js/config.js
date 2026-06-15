// Ecom Workflow V1 - Config Page
document.addEventListener('DOMContentLoaded',async()=>{
  const c=document.getElementById('config-content');
  try{const d=await api.getConfig();c.innerHTML=renderForm(d.items);attachFormHandler();}
  catch(e){c.innerHTML='<div class="empty-state"><p>Load failed: '+e.message+'</p></div>';}
});
function esc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function renderForm(items){
  const desc={auth_password:'留空则保持当前值。',r2_public_url:'R2 公开域名',n8n_workflow_title_url:'N8N 标题生成',n8n_workflow_plan_url:'N8N 规划',n8n_workflow_main_url:'N8N 主图',n8n_workflow_detail_url:'N8N 详情图',n8n_workflow_sku_url:'N8N SKU'};
  let rows='';
  const ks=['auth_password','r2_public_url','n8n_workflow_title_url','n8n_workflow_plan_url','n8n_workflow_main_url','n8n_workflow_detail_url','n8n_workflow_sku_url'];
  for(const k of ks){
    const info=items[k];if(!info)continue;
    const isPwd=info.type==='password';
    const label=k.replace(/^n8n_workflow_/,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    if(isPwd){
      rows+='<div style="margin-bottom:12px"><label class="form-label">Password</label>'+
        '<input class="form-input" id="pwd-new" type="password" placeholder="新密码" autocomplete="new-password">'+
        '<input class="form-input" id="pwd-confirm" type="password" placeholder="确认新密码" autocomplete="new-password" style="margin-top:6px">'+
        '<div style="font-size:0.8rem;color:#9ca3af;margin-top:2px">Enter twice to change. Leave both blank to keep current.</div></div>';
    }else{
      rows+='<div style="margin-bottom:12px"><label class="form-label">'+label+'</label>'+
        '<input class="form-input" id="cfg-'+k.replace(/_/g,'-')+'" type="text" value="'+esc(info.value)+'" placeholder="">'+
        '<div style="font-size:0.8rem;color:#9ca3af;margin-top:2px">'+(desc[k]||info.description||'')+'</div></div>';
    }
  }
  return '<div class="card"><div class="card-header"><span class="card-title">所有配置项</span></div>'+
    '<form id="config-form">'+rows+'<div style="margin-top:20px"><button type="submit" class="btn btn-primary">保存</button></div></form>'+
    '<div id="config-modal" class="modal-overlay"><div class="modal"><div class="modal-header"><span class="modal-title">确认</span></div>'+
    '<p style="font-size:0.9rem;color:var(--gray-600);margin-bottom:12px">输入当前密码以保存变更：</p>'+
    '<input id="cfg-auth-pwd" type="password" placeholder="当前密码" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:0.9rem;box-sizing:border-box">'+
    '<div id="config-modal-error" style="color:var(--red-600);font-size:0.85rem;margin-top:8px;display:none"></div>'+
    '<div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal()">取消</button><button class="btn btn-primary" type="button" onclick="doSave()">确认</button></div></div></div>';
}
function closeModal(){
  const m=document.getElementById('config-modal');if(m)m.classList.remove('active');
  const inp=document.getElementById('cfg-auth-pwd');if(inp)inp.value='';
}
function attachFormHandler(){
  const form=document.getElementById('config-form');
  if(!form)return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const pwd=document.getElementById('pwd-new'), confirm=document.getElementById('pwd-confirm');
    if(pwd&&confirm&&pwd.value!==confirm.value){
      createToast('两次密码不一致','error');return;
    }
    document.getElementById('config-modal').classList.add('active');
    document.getElementById('cfg-auth-pwd').focus();
  });
}
async function doSave(){
  const authPwd=document.getElementById('cfg-auth-pwd').value;
  if(!authPwd){showModalError('当前密码 required');return;}
  try{
    const r=await fetch(API_BASE+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:authPwd})});
    const d=await r.json();
    if(!r.ok){showModalError(d.error||'密码错误');return;}
  }catch(e){showModalError('验证失败');return;}
  const btn=document.querySelector('#config-form button[type="submit"]');if(!btn)return;
  btn.disabled=true;btn.textContent='保存中...';
  try{
    const items={};
    document.querySelectorAll('#config-form input[id^="cfg-"]').forEach(inp=>{
      const key=inp.id.replace(/^cfg-/,'').replace(/-/g,'_');
      items[key]=inp.value;
    });
    const pwd=document.getElementById('pwd-new'), confirm=document.getElementById('pwd-confirm');
    if(pwd&&confirm&&pwd.value&&pwd.value===confirm.value)items.auth_password=pwd.value;
    await api.updateConfig(items);
    createToast('配置已保存');
    closeModal();
    setTimeout(()=>location.reload(),600);
  }catch(e){createToast('保存失败: '+e.message,'error');btn.disabled=false;btn.textContent='Save';closeModal();}
}
function showModalError(msg){
  const el=document.getElementById('config-modal-error');
  if(!el)return;el.textContent=msg;el.style.display='block';
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
