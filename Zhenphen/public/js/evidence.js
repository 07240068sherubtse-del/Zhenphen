/* Completed community work: actual attachments are loaded from the server. */
function openEvidencePhoto(trigger) {
  let viewer = document.getElementById('evidence-photo-viewer');
  if (!viewer) {
    viewer = document.createElement('dialog');
    viewer.id = 'evidence-photo-viewer';
    viewer.className = 'evidence-photo-viewer';
    viewer.setAttribute('aria-labelledby', 'evidence-photo-caption');
    viewer.innerHTML = `<div class="evidence-photo-viewer-layout"><header class="evidence-photo-viewer-header"><button type="button" class="evidence-photo-back" data-evidence-viewer-close><span aria-hidden="true">&larr;</span> Back to Evidence</button><p id="evidence-photo-caption"></p></header><div class="evidence-photo-stage"><img data-evidence-viewer-image alt=""><p class="evidence-photo-error" role="alert" hidden>This photo could not be loaded. Return to Evidence and try again.</p></div></div>`;
    document.body.append(viewer);
    viewer.querySelector('[data-evidence-viewer-close]').addEventListener('click', () => viewer.close());
    // Native dialog cancellation handles Escape; both close paths restore the gallery.
    viewer.addEventListener('close', () => {
      document.body.classList.remove('evidence-viewer-open');
      viewer.returnFocusTarget?.focus({ preventScroll: true });
    });
    const image = viewer.querySelector('[data-evidence-viewer-image]');
    image.addEventListener('error', () => {
      image.hidden = true;
      viewer.querySelector('.evidence-photo-error').hidden = false;
    });
  }
  const image = viewer.querySelector('[data-evidence-viewer-image]');
  const caption = trigger.querySelector('img').alt;
  viewer.returnFocusTarget = trigger;
  viewer.querySelector('#evidence-photo-caption').textContent = caption;
  image.hidden = false;
  viewer.querySelector('.evidence-photo-error').hidden = true;
  image.alt = caption;
  image.src = trigger.dataset.evidencePhoto;
  document.body.classList.add('evidence-viewer-open');
  if (!viewer.open) viewer.showModal();
}

async function mountProjectEvidence() {
  if (!['student-dashboard', 'supporter-dashboard', 'admin-dashboard', 'ssu-admin-dashboard', 'money'].includes(page)) return;
  const main = document.querySelector('.dash-content');
  if (!main || document.getElementById('project-evidence')) return;
  const section = document.createElement('section');
  section.id = 'project-evidence';
  section.className = 'dash-panel project-evidence';
  section.setAttribute('aria-labelledby', 'evidence-title');
  section.innerHTML = '<h2 id="evidence-title">Evidence</h2><p role="status">Loading completed community work…</p>';
  const footer = main.querySelector('.dash-footer');
  main.insertBefore(section, footer);
  const canUpload = ['admin', 'ssuAdmin'].includes(memberRole());
  const status = (message, failed = false) => {
    const notice = section.querySelector('[data-evidence-status]');
    notice.textContent = message;
    notice.classList.toggle('form-error', failed);
  };
  try {
    const result = await apiRequest('/api/evidence');
    const project = result.project;
    section.innerHTML = `<div class="panel-heading"><div><h2 id="evidence-title">Evidence</h2><p>Completed community work and supporting records.</p></div><span class="evidence-completed">Successfully completed</span></div>
      <article><h3>${esc(project.title)}</h3><dl class="evidence-facts"><div><dt>Date completed</dt><dd><time datetime="${esc(project.completed)}">${esc(project.completedLabel)}</time></dd></div><div><dt>Location</dt><dd>${esc(project.location)}</dd></div><div><dt>Duration</dt><dd>${esc(project.duration)}<br><span class="form-note">${esc(project.schedule)}</span></dd></div><div><dt>Student involvement</dt><dd>${esc(project.studentInvolvement)}</dd></div><div><dt>Activity cost (estimate from bills)</dt><dd><strong>Nu. ${(project.costEstimate.netChhetrum / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><br><span class="form-note">After deducting the credit note. Funding received is not recorded in the supplied bills.</span></dd></div><div><dt>Organizers</dt><dd>${esc(project.organizers)}</dd></div></dl>
      <details class="evidence-cost-breakdown"><summary>View cost calculation</summary><div class="table-scroll" tabindex="0" aria-label="Activity cost calculation"><table><thead><tr><th>Document</th><th>Description</th><th>Amount (Nu.)</th></tr></thead><tbody>${project.costEstimate.entries.map(entry => `<tr><td>${entry.document}</td><td>${esc(entry.label)}${entry.note ? `<br><span class="form-note">${esc(entry.note)}</span>` : ''}</td><td>${(entry.amountChhetrum / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="2">Net estimated cost</th><td>Nu. ${(project.costEstimate.netChhetrum / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot></table></div><p class="form-note">${esc(project.costEstimate.reconciliationNote)}</p></details><div class="evidence-details">
        <h4>Work location &amp; completed work</h4><p class="form-note">Completed-work photos supplied in the project documentation.</p><p class="form-note" data-evidence-count></p><div class="evidence-photos" data-evidence-photos></div>
        <details class="evidence-receipts"><summary>Bills &amp; receipts <span data-receipt-count></span></summary><p class="form-note">All bills and receipts are combined into one PDF, with each original document on its own page.</p><ul data-evidence-receipts></ul></details>
      </div>
      ${canUpload ? `<details class="evidence-upload"><summary>Manage evidence</summary><p class="form-note">Upload actual project photos or bills. These files will be visible to signed-in members; remove private account details before uploading.</p>
        <form data-evidence-upload><div class="evidence-upload-fields"><label>Evidence type<select name="kind"><option value="photo">Project photo</option><option value="receipt">Bill or receipt</option></select></label><label>File<input type="file" name="file" accept="image/jpeg,image/png" required></label><label>Caption (optional)<input name="caption" maxlength="300" placeholder="Describe this evidence"></label></div><p class="form-note">JPG or PNG; bills may also be PDF. Maximum 1 MB per file.</p><button type="submit" class="btn small">Upload evidence</button></form></details>` : ''}
      <p data-evidence-status role="status" aria-live="polite"></p></article>`;
    const display = files => {
      const photos = files.filter(file => file.kind === 'photo');
      const receipts = files.filter(file => file.kind === 'receipt');
      section.querySelector('[data-evidence-count]').textContent = `(${photos.length} photos · ${receipts.length} bills / receipts)`;
      section.querySelector('[data-receipt-count]').textContent = `(${receipts.length})`;
      const remove = file => canUpload ? `<button type="button" class="btn outline small" data-remove-evidence="${esc(file.id)}" aria-label="Remove ${esc(file.filename)}">Remove</button>` : '';
      const link = file => `/api/evidence/${encodeURIComponent(file.id)}/file`;
      section.querySelector('[data-evidence-photos]').innerHTML = photos.length ? photos.map(file => `<figure><button type="button" class="evidence-photo-trigger" data-evidence-photo="${link(file)}" aria-haspopup="dialog" aria-label="View full photo: ${esc(file.caption || file.filename)}"><img loading="lazy" src="${link(file)}" alt="${esc(file.caption || file.filename)}"></button><figcaption>${esc(file.caption || file.filename)}</figcaption>${remove(file)}</figure>`).join('') : '<p class="form-note">No project photos uploaded yet.</p>';
      section.querySelector('[data-evidence-receipts]').innerHTML = receipts.length ? `<li><div><strong>Activity bills &amp; receipts</strong><p class="form-note">${receipts.length} original documents in one PDF, including any credit notes.</p></div><div class="actions"><a class="btn outline small" href="/api/evidence/receipts.pdf" target="_blank" rel="noopener">Open bills PDF</a><a class="btn outline small" href="/api/evidence/receipts.pdf?download=1">Download PDF</a></div></li>${canUpload ? `<li><details><summary>Manage individual receipt files</summary>${receipts.map(file => `<p>${esc(file.caption || file.filename)} ${remove(file)}</p>`).join('')}</details></li>` : ''}` : '<li class="form-note">No bills or receipts uploaded yet.</li>';
    };
    const refresh = async () => display((await apiRequest('/api/evidence')).files);
    display(result.files);
    const uploadForm = section.querySelector('form');
    if (uploadForm) uploadForm.elements.kind.addEventListener('change', () => {
      uploadForm.elements.file.accept = uploadForm.elements.kind.value === 'photo'
        ? 'image/jpeg,image/png' : 'image/jpeg,image/png,application/pdf';
    });
    uploadForm?.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      if (submit.disabled) return;
      const file = form.elements.file.files[0];
      if (!file) return;
      if (file.size > 1048576) { status('Choose a file up to 1 MB.', true); return; }
      const kind = form.elements.kind.value;
      const caption = form.elements.caption.value;
      if (!['image/jpeg', 'image/png', ...(kind === 'receipt' ? ['application/pdf'] : [])].includes(file.type)) {
        status('Photos must be JPG or PNG. Bills and receipts may also be PDF.', true);
        return;
      }
      submit.disabled = true;
      status('Uploading evidence…');
      try {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('The file could not be read.'));
          reader.readAsDataURL(file);
        });
        await apiRequest('/api/evidence', { method: 'POST', body: JSON.stringify({ kind, filename: file.name, caption, data }) });
        form.reset();
        form.elements.file.accept = 'image/jpeg,image/png';
        status('Evidence saved.');
        await refresh();
      } catch (error) { status(error.message, true); }
      finally { submit.disabled = false; }
    });
    section.addEventListener('click', async event => {
      const photo = event.target.closest('[data-evidence-photo]');
      if (photo) {
        event.preventDefault();
        openEvidencePhoto(photo);
        return;
      }
      const button = event.target.closest('[data-remove-evidence]');
      if (!button || button.disabled) return;
      if (!window.confirm('Remove this evidence file?')) return;
      button.disabled = true;
      try {
        await apiRequest(`/api/evidence/${encodeURIComponent(button.dataset.removeEvidence)}`, { method: 'DELETE' });
        status('Evidence removed.');
        await refresh();
      } catch (error) { status(error.message, true); button.disabled = false; }
    });
  } catch (error) {
    section.innerHTML = '<h2 id="evidence-title">Evidence</h2><p role="alert"></p><button type="button" class="btn outline small">Retry</button>';
    section.querySelector('p').textContent = error.message;
    section.querySelector('button').onclick = () => { section.remove(); void mountProjectEvidence(); };
  }
}
