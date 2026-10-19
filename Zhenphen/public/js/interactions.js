function toast(message){let el=document.getElementById('toast');el.innerHTML=icon('check',20)+`<span>${esc(message)}</span>`;el.hidden=false;clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>{el.hidden=true},4500)}
let modalReturn=null;
function modal(title,body,actions=''){const d=document.getElementById('modal');modalReturn=document.activeElement;d.innerHTML=`<button class="dialog-close" aria-label="Close dialog" data-close>×</button><h2 id="modal-title">${title}</h2>${body}<div class="dialog-actions">${actions||'<button class="btn outline small" data-close>Close</button>'}</div>`;d.showModal();d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.addEventListener('close',()=>modalReturn?.focus(),{once:true})}
function error(form,message){let target=form.querySelector('.form-error');target.textContent=message;target.hidden=false;target.tabIndex=-1;target.focus()}
function success(form,title,message,link='dashboard.html',label='Visit your member space'){form.innerHTML=`<div class="success-card" tabindex="-1"><div class="success-icon">${icon('check',32)}</div>${eyebrow('Kindness starts with you')}<h2>${title}</h2><p>${message}</p><div class="sample-badge" style="display:inline-block">DEMO CONFIRMATION · NOTHING SENT</div><div class="actions">${button(label,link)}${button('Back to Home','index.html','outline')}</div></div>`;form.querySelector('.success-card').focus();form.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
function dateNow(){return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date())}
function saveDonation(type,value,amount=0,anonymous=false){let rows=store.get('donations',[]);let id='ZH-DEMO-'+String(rows.length+1).padStart(3,'0');const current=store.get('signed',false)?member():null;const record={id,date:dateNow(),type,value,amount:Number(amount)||0,memberEmail:anonymous?'':current?.email||'',memberName:anonymous?'Anonymous':current?.name||'Guest donor'};if(!store.set('donations',[...rows,record]))throw Error('Session storage is unavailable. Enable browser storage to save a demo contribution.');if(!record.memberEmail)return id;if(!recordSharedDonation(record))throw Error('Your contribution was saved in this tab, but not in the browser-wide member report. Enable local browser storage and try again.');return id}
function setBusy(form,busy){const b=form.querySelector('button[type=submit]');if(!b)return;if(busy){b.dataset.label=b.innerHTML;b.disabled=true;b.innerHTML='<span class="spinner" aria-hidden="true"></span> Saving preview…';form.setAttribute('aria-busy','true')}else{b.disabled=false;b.innerHTML=b.dataset.label||b.innerHTML;form.removeAttribute('aria-busy')}}
async function submitForm(form){const type=form.dataset.form;const data=Object.fromEntries(new FormData(form));form.querySelector('.form-error')?.setAttribute('hidden','');for(const input of form.querySelectorAll('input[required],textarea[required]')){if(input.type==='checkbox'&&!input.checked){error(form,'Please confirm the required checkbox before continuing.');input.focus();return}if(input.type!=='checkbox'&&!input.value.trim()){error(form,'Please complete all required fields.');input.focus();return}}
if(type==='login'){const accounts=[{username:'demo@zhenphen.org',password:'Together2026!',role:'supporter',memberType:'Community supporter / donor',name:'Dechen'},{username:'student@zhenphen.org',password:'StudentPreview2026!',role:'student',memberType:'Sherubtse College student',name:'Sherubtse Student'},{username:'admin@zhenphen.org',password:'AdminPreview2026!',role:'admin',memberType:'Administrator',name:'Zhenphen Admin'}];const username=data.username.trim().toLowerCase();const account=accounts.find(item=>item.username===username&&item.password===data.password);if(!account){error(form,'Use one of the sample accounts shown here to explore the prototype.');return}if(!store.set('member',{name:account.name,email:account.username,phone:'',skills:'',memberType:account.memberType,role:account.role})){error(form,'Browser session storage is unavailable. Enable it to explore the demo.');return}if(!store.set('signed',true)){error(form,'Browser session storage is unavailable. Enable it to explore the demo.');return}try{data.remember?localStorage.setItem('zh-demo-username',data.username):localStorage.removeItem('zh-demo-username')}catch{}const target=store.get('returnTo','');const targetPage={'dashboard.html':'overview','student-dashboard.html':'student-dashboard','supporter-dashboard.html':'supporter-dashboard','admin-dashboard.html':'admin-dashboard','money-dashboard.html':'money','ration-tracking.html':'rations','my-donations.html':'donations','volunteer-activity.html':'activity','profile.html':'profile'}[target];store.remove('returnTo');location.href=targetPage&&canAccessMemberPage(account.role,targetPage)?target:roleDashboardPath[account.role];return}
if(type==='join'){const memberType=data.memberType;const interest=data.interest;const isStudent=memberType==='Sherubtse College student';const role=isStudent?'student':'supporter';const ssuInterest=data.ssuInterest==='yes';const memberRecord={name:data.name.trim(),email:data.email.trim(),phone:'',skills:'',memberType,role,volunteerInterest:interest,ssuInterest};if(!store.set('member',memberRecord)){error(form,'Browser session storage is unavailable. Enable it to create a demo profile.');return}if(isStudent&&(interest!=='Not applying for a volunteer role yet'||ssuInterest)){const applications=store.get('applications',[]);const recordedInterest=interest==='Not applying for a volunteer role yet'?'Social Service Unit coordination interest':interest;if(!store.set('applications',[...applications,{interest:recordedInterest,availability:'To be confirmed',skills:'',date:dateNow(),ssuCollaboration:ssuInterest,source:'sign-up'}])){error(form,'Your profile was saved, but the volunteer interest could not be saved. Please try again with browser storage enabled.');return}}if(!store.set('signed',true)){error(form,'Your profile was saved, but this browser could not start the demo session. Enable browser session storage and try again.');return}location.href=roleDashboardPath[role];return}
if(type==='money'){const amount=data.amount==='custom'?Number(data.customAmount):Number(data.amount);if(!Number.isFinite(amount)||amount<1||amount>10000000||!Number.isInteger(amount)){error(form,'Enter a whole amount between Nu. 1 and Nu. 10,000,000.');return}modal('Review your contribution',`<p>You are previewing a contribution of <strong>${nu(amount)}</strong>${data.anonymous?' as an anonymous donor':''}.</p><p>No payment will be taken. Confirming adds this amount to your demo donation history.</p>`,`<button class="btn outline small" data-close>Go back</button><button class="btn small" id="confirm-donation">Confirm demo contribution</button>`);document.getElementById('confirm-donation').onclick=()=>{try{let id=saveDonation('Financial donation',nu(amount),amount,Boolean(data.anonymous));document.getElementById('modal').close();success(form,'Thank you for showing up.',`${nu(amount)} has been added to your demo history. Reference ${id}. No money was charged.`)}catch(e){document.getElementById('modal').close();error(form,e.message)}};return}
setBusy(form,true);await new Promise(r=>setTimeout(r,450));setBusy(form,false);try{
if(type==='clothes'){let id=saveDonation('Clothing · '+data.item,data.quantity+' items');success(form,'A little warmth, shared.',`Your ${data.quantity}-item contribution is registered in this demo. Handover preference: ${data.handover.toLowerCase()}. Reference ${id}. No collection has been scheduled.`)}
if(type==='rations'){let id=saveDonation('Ration support · '+data.item,data.quantity);success(form,'Thank you for sharing essentials.',`Your ration contribution is registered in this demo. Reference ${id}. No handover has been arranged.`)}
if(type==='volunteer'){let rows=store.get('applications',[]);const current=store.get('signed',false)?member():null;const application={interest:data.interest,availability:data.availability,skills:data.skills,date:dateNow(),ssuCollaboration:data.ssuInterest==='yes',source:'volunteer form',memberEmail:current?.email||'',memberName:current?.name||data.name||'Guest volunteer'};if(!store.set('applications',[...rows,application]))throw Error('Unable to save this demo. Please enable browser session storage.');if(application.memberEmail&&!recordSharedVolunteer(application))throw Error('Your application was saved in this tab, but not in the browser-wide member report. Enable local browser storage and try again.');success(form,'There’s a place for you here.',data.ssuInterest==='yes'?'Your demo volunteer interest and request to explore SSU coordination have been recorded in this browser session. No application was sent and no partnership is confirmed.':'Your demo volunteer interest has been recorded in this browser session. No application was sent.','volunteer-activity.html','View volunteer activity')}
if(type==='contact')success(form,'Thank you for reaching out.','Your message preview is complete. No email has been sent and your message has not been stored.','community.html','Explore the community');
if(type==='profile'){const updated={...member(),name:data.name.trim(),email:data.email.trim(),phone:data.phone.trim(),skills:data.skills.trim(),bio:data.bio.trim(),avatar:data.avatar||member().avatar||''};if(!store.set('member',updated))throw Error('Unable to save your demo profile. The photo may be too large for browser storage; try an image under 1 MB.');if(store.get('signed',false)&&!upsertCommunityMember(updated))throw Error('Your profile was saved in this tab, but not in the browser-wide member report. Check local browser storage.');render();toast('Your demo profile has been updated.');}
}catch(e){error(form,e.message)}}
function updateRationTable(){const q=(document.getElementById('ration-search')?.value||'').toLowerCase().trim();const f=document.getElementById('ration-filter')?.value||'all';let rows=store.get('rations',initialRations);const filtered=rows.filter(r=>(f==='all'||r.status===f)&&[r.name,r.area,r.id].some(v=>v.toLowerCase().includes(q)));document.getElementById('ration-table').innerHTML=rationRows(filtered);document.getElementById('result-count').textContent=`${filtered.length} of ${rows.length} sample members · October 2026`;document.getElementById('ration-stats').innerHTML=rationStats(rows);bindRationActions()}
function bindRationActions(){document.querySelector('[data-clear-filters]')?.addEventListener('click',()=>{document.getElementById('ration-search').value='';document.getElementById('ration-filter').value='all';updateRationTable()});document.querySelectorAll('[data-ration]').forEach(b=>b.onclick=()=>{const record=store.get('rations',initialRations).find(r=>r.id===b.dataset.ration);modal('Distribution details',`<p><strong>${esc(record.name)}</strong><br>${record.id} · ${record.area}<br>${record.qty} · ${record.date}</p><label class="field">Distribution status<select id="edit-status">${['Received','Pending','Not Received'].map(v=>`<option ${record.status===v?'selected':''}>${v}</option>`).join('')}</select></label><p class="form-note">This updates a fictional record in this session only.</p>`,`<button class="btn outline small" data-close>Cancel</button><button class="btn small" id="save-status">Save demo status</button>`);document.getElementById('save-status').onclick=()=>{let rows=store.get('rations',initialRations);rows.find(r=>r.id===record.id).status=document.getElementById('edit-status').value;if(store.set('rations',rows)){document.getElementById('modal').close();updateRationTable();toast('Demo distribution status updated.')}else toast('Unable to save. Please enable browser session storage.')}})}
function exportCSV(kind){const data=kind==='money'?[['Date','Category','Amount (Nu.)','Status','Type','Bill / receipt evidence'],...baseTransactions.map(r=>[r.date,r.category,r.amount,r.status,r.kind,'Not attached - sample'])]:[['Member ID','Member','Area','Distribution Status','Date','Quantity'],...store.get('rations',initialRations).map(r=>[r.id,r.name,r.area,r.status,r.date,r.qty])];let csv=data.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');let url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`zhenphen-${kind}-SAMPLE.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Sample report downloaded.');}

document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const formType = form.dataset.form;
  if (['login', 'join', 'ssu-event'].includes(formType)) return;
  const data = Object.fromEntries(new FormData(form));

  if (formType === 'login' && String(data.username).trim().toLowerCase() === 'ssu.admin@zhenphen.org') {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (data.password !== 'SSUAdmin2026!') {
      error(form, 'The SSU admin demo password is incorrect.');
      return;
    }
    const account = {name:'SSU Coordinator',email:'ssu.admin@zhenphen.org',phone:'',skills:'',memberType:'Sherubtse Social Service Unit administrator',role:'ssuAdmin'};
    if (!store.set('member', account) || !store.set('signed', true)) {
      error(form, 'Browser session storage is unavailable. Enable it to explore the demo.');
      return;
    }
    store.remove('returnTo');
    location.href = roleDashboardPath.ssuAdmin;
    return;
  }

  if (formType !== 'ssu-event') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!store.get('signed', false) || memberRole() !== 'ssuAdmin') {
    error(form, 'Sign in with the SSU administrator demo account to publish opportunities.');
    return;
  }
  const eventDate = new Date(`${data.date}T23:59:59`);
  if (Number.isNaN(eventDate.getTime()) || eventDate < new Date()) {
    error(form, 'Choose today or a future date for this opportunity.');
    return;
  }
  const capacity = data.capacity ? Number(data.capacity) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    error(form, 'Participant limit must be a positive whole number, or leave it blank.');
    return;
  }
  const events = sharedSsuEvents();
  const record = {
    id: `SSU-${Date.now().toString(36)}`,
    title: String(data.title).trim(),
    date: data.date,
    location: String(data.location).trim(),
    description: String(data.description).trim(),
    capacity,
    status: 'Open',
    workStatus: 'Upcoming',
    createdAt: dateNow()
  };
  if (!saveSharedSsuEvents([...events, record])) {
    error(form, 'Unable to publish this opportunity. Please enable local browser storage and try again.');
    return;
  }
  render();
  toast('SSU opportunity published in this browser session.');
}, true);
