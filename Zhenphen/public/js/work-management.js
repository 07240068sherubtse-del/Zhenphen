/* Both administrators manage the same collaborative work records. */
async function refreshJointWorkViews() {
  if (document.body.dataset.page === 'admin-dashboard') await refreshSuperAdminDashboard();
  else await refreshSsuAdminData();
  await refreshSsuPublicOpportunities();
}

function openJointWorkEditor(work = null) {
  const editing = Boolean(work);
  const control = (label, name, type, value, extra = '') => `<div class="field"><label for="work-${name}">${label}</label><input id="work-${name}" name="${name}" type="${type}" value="${esc(value ?? '')}" ${extra}></div>`;
  const options = (name, label, values, selected) => `<div class="field"><label for="work-${name}">${label}</label><select id="work-${name}" name="${name}">${values.map(value => `<option ${value === selected ? 'selected' : ''}>${value}</option>`).join('')}</select></div>`;
  modal(editing ? 'Edit joint activity' : 'Add joint activity',
    `<p>Social Services Unit, in collaboration with Zhenphen Association. Both administrators can manage this work.</p>
    <form id="joint-work-editor" data-joint-work-form ${editing ? `data-work-id="${esc(work.id)}"` : ''}>
      <div class="joint-work-fields">
      ${control('Activity title', 'title', 'text', work?.title, 'required minlength="2" maxlength="140"')}
      ${control('Date', 'date', 'date', work?.date, `required ${editing ? '' : `min="${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Thimphu' }).format(new Date())}"`}`)}
      ${control('Location', 'location', 'text', work?.location, 'required maxlength="180"')}
      ${control('Participant limit (optional)', 'capacity', 'number', work?.capacity, 'min="1" step="1"')}
      <div class="field joint-work-description"><label for="work-description">Description</label><textarea id="work-description" name="description" rows="4" maxlength="500" required>${esc(work?.description || '')}</textarea></div>
      ${editing ? options('status', 'Sign-up status', ['Open', 'Closed'], work.status) + options('workStatus', 'Work status', ['Upcoming', 'In progress', 'Completed'], work.workStatus) : ''}
      </div><p class="form-error" data-work-error role="alert" hidden></p>
    </form>`,
    `<button class="btn outline small" type="button" data-close>Cancel</button><button class="btn small" type="submit" form="joint-work-editor">${editing ? 'Save changes' : 'Publish joint activity'}</button>`);
}

document.addEventListener('click', async event => {
  const add = event.target.closest('[data-joint-work-add]');
  const edit = event.target.closest('[data-joint-work-edit]');
  const remove = event.target.closest('[data-joint-work-delete]');
  if (!add && !edit && !remove) return;
  if (!['admin', 'ssuAdmin'].includes(memberRole())) return;
  if (add) { openJointWorkEditor(); return; }
  const id = edit?.dataset.jointWorkEdit || remove.dataset.jointWorkDelete;
  const work = window.liveSsuEvents?.find(item => String(item.id) === id);
  if (!work) { toast('Refresh the dashboard to load this activity.'); return; }
  if (edit) { openJointWorkEditor(work); return; }
  if (remove.disabled || !window.confirm(`Delete "${work.title}"? This removes the joint activity and its registrations and attendance records for both organizations.`)) return;
  remove.disabled = true;
  try {
    await apiRequest(`/api/ssu/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast('Joint activity deleted.');
    await refreshJointWorkViews();
  } catch (error) { toast(error.message); remove.disabled = false; }
});

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-joint-work-form]');
  if (!form) return;
  event.preventDefault();
  const submit = document.querySelector('button[form="joint-work-editor"]');
  if (submit.disabled) return;
  const errorBox = form.querySelector('[data-work-error]');
  errorBox.hidden = true;
  submit.disabled = true;
  try {
    const id = form.dataset.workId;
    await apiRequest(`/api/ssu/events${id ? `/${encodeURIComponent(id)}` : ''}`, {
      method: id ? 'PATCH' : 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    document.getElementById('modal').close();
    toast(id ? 'Joint activity updated.' : 'Joint activity published.');
    await refreshJointWorkViews();
  } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
  finally { submit.disabled = false; }
});
