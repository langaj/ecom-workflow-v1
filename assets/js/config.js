// Ecom Workflow V1 - Config Page
document.addEventListener('DOMContentLoaded',async()=>{
  const c=document.getElementById('config-content');
  try{const d=await api.getConfig();c.innerHTML=renderForm(d.items);}
  catch(e){c.innerHTML='<div class="empty-state"><p>Load failed: '+e.message+'</p></div>';}
});
function esc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function renderForm(items){
  const desc={auth_password:'Login password, also JWT signing key.',r2_public_url:'R2 public bucket domain',n8n_workflow_title_url:'N8N title gen',n8n_workflow_plan_url:'N8N plan',n8n_workflow_main_url:'N8N main',n8n_workflow_detail_url:'N8N detail',n8n_workflow_sku_url:'N8N SKU'};
  let rows='';
  const ks=['auth_password','r2_public_url','n8n_workflow_title_url','n8n_workflow_plan_url','n8n_workflow_main_url','n8n_workflow_detail_url','n8n_workflow_sku_url'];
  for(const k of ks){
    const info=items[k];if(!info)continue;
    const isPwd=info.type==='password';
    const label=k.replace(/^n8n_workflow_/,'').replace(/_/g,' ').replace(/w/g,c=>c.toUpperCase());
    rows+='<div style="margin-bottom:12px"><label class="form-label">'+(isPwd?'Password':label)+'</label>'+
      '<input class="form-input" id="cfg-'+k.replace(/_/g,'-')+'" type="'+(isPwd?'password':'text')+'" value="'+(isPwd?'':esc(info.value))+'" placeholder="'+(isPwd?'set':'')+'">'+
      '<div style="font-size:0.8rem;color:#9ca3af;margin-top:2px">'+(desc[k]||info.description||'')+'</div></div>';
  }
  return '<div class="card"><div class="card-header"><span class="card-title">All Config</span></div>'+
    '<form id="config-form">'+rows+'<div style="margin-top:20px"><button type="submit" class="btn btn-primary">Save</button></div></form></div>';
}
document.addEventListener('click',async e=>{
  if(!e.target.closest('#config-form'))return;e.preventDefault();
  const form=document.getElementById('config-form');if(!form)return;
  const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Saving...';
  try{
    const items={};
    form.querySelectorAll('[id^="cfg-"]').forEach(inp=>{const key=inp.id.replace(/^cfg-/,'').replace(/-/g,'_');items[key]=inp.value;});
    await api.updateConfig(items);createToast('Config saved');
  }catch(e){createToast('Save failed: '+e.message,'error');}
  btn.disabled=false;btn.textContent='Save';
});
