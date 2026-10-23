window.ZhenphenDashboardPages = window.ZhenphenDashboardPages || {};

const superAdminRoles = [
  ['student', 'Student'],
  ['supporter', 'Supporter'],
  ['ssuAdmin', 'SSU administrator'],
  ['admin', 'Site administrator']
];

window.ZhenphenDashboardPages.admin = function () {
  return `<a class="skip" href="#main">Skip to content</a>
    <div class="dash-layout">
      <aside class="sidebar" id="sidebar">
        ${brand()}
        <span class="side-label">Super Admin</span>
        <nav class="side-links" aria-label="Super Admin navigation">
          <a class="active" aria-current="page" href="admin-dashboard.html">${icon('grid', 19)}Super Admin overview</a>
          <a href="ssu-admin-dashboard.html">${icon('calendar', 19)}SSU workspace</a>
        </nav>
        <div class="side-bottom"><nav class="side-links" aria-label="Account navigation">
          <a href="community.html">${icon('leaf', 19)}Back to community</a>
          <a href="logout.html">${icon('logout', 19)}Logout</a>
        </nav><div class="side-user"><div class="avatar">${avatarContent(member())}</div>
          <div><strong>${esc(member().name)}</strong><small>Super Administrator</small></div></div></div>
      </aside>
      <div class="dash-main">
        <header class="dash-topbar">
          <button class="menu-toggle" data-sidebar aria-label="Open Super Admin navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu', 23)}</button>
          <div class="crumb">Super Admin &nbsp; / &nbsp; <strong>Overview</strong></div>
          <div class="topbar-end"><span class="sample-badge">LIVE DATABASE</span><a class="avatar" href="profile.html" aria-label="Your profile">${avatarContent(member())}</a></div>
        </header>
        <main id="main" class="dash-content">
          ${dashHeading('Zhenphen Association', 'Super Admin', 'Manage accounts, site presentation, and organization-wide activity.')}
          <p class="super-admin-error form-error" data-admin-error role="alert" hidden></p>
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-label">Member accounts${icon('people', 19)}</div><strong data-admin-total-users>—</strong><small>All registered accounts</small></div>
            <div class="stat-card"><div class="stat-label">SSU opportunities${icon('calendar', 19)}</div><strong data-admin-events>—</strong><small>Published service activities</small></div>
            <div class="stat-card"><div class="stat-label">Volunteer applications${icon('check', 19)}</div><strong data-admin-applications>—</strong><small>Applications on record</small></div>
            <div class="stat-card"><div class="stat-label">SSU administrators${icon('shield', 19)}</div><strong data-admin-ssu-admins>—</strong><small>Separate SSU access</small></div>
          </div>
          <section class="dash-panel super-admin-panel" id="feedback-inbox">
            <div class="panel-heading"><div><h2>Community inbox</h2><p>Feedback and enquiries, with sender details so you know who to contact.</p></div></div>
            <p class="form-error" data-feedback-error role="alert" hidden></p>
            <div class="feedback-inbox" data-feedback-inbox aria-live="polite">Loading messages...</div>
          </section>
          <section class="dash-panel super-admin-panel">
            <div class="panel-heading"><div><h2>Joint community work</h2><p>Social Services Unit in collaboration with Zhenphen Association. Add, edit, delete and report on shared activities.</p></div><button type="button" class="btn small" data-joint-work-add>Add joint activity</button></div>
            <p class="form-error" data-admin-ssu-error role="alert" hidden></p>
            <div class="table-scroll" tabindex="0" aria-label="SSU work attendance reports">
              <table><thead><tr><th>Work</th><th>Date</th><th>Registered</th><th>Showed up</th><th>Work status</th><th>Manage work</th></tr></thead>
                <tbody data-admin-ssu-reports><tr><td colspan="6">Loading attendance…</td></tr></tbody>
              </table>
            </div>
          </section>
          <section class="dash-panel super-admin-panel">
            <div class="panel-heading"><div><h2>Member accounts and roles</h2><p>Change access for registered accounts. Your own administrator role is protected.</p></div></div>
            <div class="field super-admin-search"><label for="admin-user-search">Find an account</label><input id="admin-user-search" type="search" placeholder="Search by name or email" data-admin-search></div>
            <div class="table-scroll" tabindex="0" aria-label="Member accounts">
              <table><thead><tr><th>Name</th><th>Email</th><th>Account type</th><th>Access role</th></tr></thead>
                <tbody data-admin-users><tr><td colspan="4">Loading accounts…</td></tr></tbody>
              </table>
            </div>
          </section>
          <section class="dash-panel super-admin-panel">
            <div class="panel-heading"><div><h2>Homepage content</h2><p>Update the public homepage headline and introduction.</p></div></div>
            <form data-form="super-admin-content" class="super-admin-content-form">
              <div class="field"><label for="admin-home-title">Homepage headline</label><input id="admin-home-title" name="homepageTitle" maxlength="120" required></div>
              <div class="field"><label for="admin-home-summary">Homepage introduction</label><textarea id="admin-home-summary" name="homepageSummary" rows="4" maxlength="500" required></textarea></div>
              <button class="btn" type="submit">Save homepage content</button>
              <p class="form-note" data-admin-content-message aria-live="polite"></p>
            </form>
          </section>
          <section class="dash-panel super-admin-panel">
            <div class="panel-heading"><div><h2>Donations</h2><p>Payment and donation record status</p></div>${icon('wallet', 21)}</div>
            <div class="super-admin-notice" data-admin-donations role="status">Checking donation service…</div>
          </section>
          <p class="dash-footer">Super Admin changes are stored in the database. SSU event operations remain in the separate SSU workspace. Online donation records remain unavailable until BNB merchant payment verification is configured.</p>
        </main>
      </div>
    </div>`;
};

function renderSuperAdminUsers(users) {
  const currentUserId = String(member().id || '');
  const rows = users.map(user => {
    const isSelf = String(user.id) === currentUserId;
    const options = superAdminRoles.map(([value, label]) =>
      `<option value="${value}" ${user.role === value ? 'selected' : ''}>${label}</option>`
    ).join('');
    return `<tr data-admin-user-row>
      <td>${esc(user.name)}${isSelf ? ' <span class="status">You</span>' : ''}</td>
      <td>${esc(user.email)}</td>
      <td>${esc(user.memberType)}</td>
      <td><select aria-label="Access role for ${esc(user.name)}" data-admin-user-role="${esc(user.id)}" ${isSelf ? 'disabled' : ''}>${options}</select></td>
    </tr>`;
  });
  return rows.length ? rows.join('') : '<tr><td colspan="4">No accounts have been registered.</td></tr>';
}

async function refreshSuperAdminDashboard() {
  if (document.body.dataset.page !== 'admin-dashboard') return;
  void refreshFeedbackInbox();
  const errorBox = document.querySelector('[data-admin-error]');
  try {
    const [data, ssuData] = await Promise.all([
      apiRequest('/api/admin/overview'),
      apiRequest('/api/ssu/admin/overview')
    ]);
    document.querySelector('[data-admin-total-users]').textContent = data.metrics.totalUsers;
    document.querySelector('[data-admin-events]').textContent = data.metrics.serviceEvents;
    document.querySelector('[data-admin-applications]').textContent = data.metrics.volunteerApplications;
    document.querySelector('[data-admin-ssu-admins]').textContent = data.metrics.ssuAdmins;
    document.querySelector('[data-admin-users]').innerHTML = renderSuperAdminUsers(data.users);
    document.querySelector('[name="homepageTitle"]').value = data.siteContent.homepageTitle;
    document.querySelector('[name="homepageSummary"]').value = data.siteContent.homepageSummary;
    document.querySelector('[data-admin-donations]').textContent = data.donations.available
      ? 'Donation records are available.'
      : `${data.donations.reason} No payments or donation records have been created.`;
    window.liveSsuEvents = ssuData.events;
    document.querySelector('[data-admin-ssu-reports]').innerHTML = renderSuperAdminSsuReports(ssuData.events);
    document.querySelector('[data-admin-ssu-error]').hidden = true;
    errorBox.hidden = true;
  } catch (error) {
    errorBox.textContent = `Super Admin data could not be loaded: ${error.message}`;
    errorBox.hidden = false;
    const reportError = document.querySelector('[data-admin-ssu-error]');
    reportError.textContent = `SSU attendance reports could not be loaded: ${error.message}`;
    reportError.hidden = false;
  }
}

function renderSuperAdminSsuReports(events) {
  if (!events.length) return '<tr><td colspan="6">No SSU work has been published yet.</td></tr>';
  return events.map(event => `<tr>
    <td><strong class="joint-work-title">${esc(event.title)}</strong><small class="joint-work-location">${esc(event.location)}</small><small class="joint-work-collaboration">SSU in collaboration with Zhenphen Association</small></td>
    <td>${esc(event.date)}</td>
    <td>${event.registrationCount}</td>
    <td><strong>${event.attendedCount}</strong></td>
    <td>${esc(event.workStatus)}</td>
    <td><div class="joint-work-actions"><button type="button" class="btn outline small" data-joint-work-edit="${esc(event.id)}">Edit</button><button type="button" class="btn outline small joint-work-delete" data-joint-work-delete="${esc(event.id)}">Delete</button><button type="button" class="btn outline small" data-ssu-export="${esc(event.id)}">Export CSV</button></div></td>
  </tr>`).join('');
}

function bindSuperAdminDashboard() {
  if (window.superAdminDashboardBound) return;
  window.superAdminDashboardBound = true;

  document.addEventListener('change', async event => {
    const select = event.target.closest('[data-admin-user-role]');
    if (!select) return;
    select.disabled = true;
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(select.dataset.adminUserRole)}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: select.value })
      });
      toast('Account role updated.');
      await refreshSuperAdminDashboard();
    } catch (error) {
      toast(error.message);
      await refreshSuperAdminDashboard();
    }
  });

  document.addEventListener('input', event => {
    if (!event.target.matches('[data-admin-search]')) return;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('[data-admin-user-row]').forEach(row => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    });
  });

  document.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-form="super-admin-content"]');
    if (!form) return;
    event.preventDefault();
    const message = form.querySelector('[data-admin-content-message]');
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    message.textContent = '';
    try {
      const values = Object.fromEntries(new FormData(form));
      await apiRequest('/api/admin/site-content', {
        method: 'PUT',
        body: JSON.stringify(values)
      });
      message.textContent = 'Homepage content saved.';
      toast('Homepage content saved.');
    } catch (error) {
      message.textContent = error.message;
      message.setAttribute('role', 'alert');
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function refreshFeedbackInbox() {
  const inbox = document.querySelector('[data-feedback-inbox]');
  const errorBox = document.querySelector('[data-feedback-error]');
  try {
    const { messages } = await apiRequest('/api/admin/feedback');
    inbox.innerHTML = messages.length ? messages.map(item => `<article class="feedback-entry"><div class="feedback-sender"><div class="feedback-initial" aria-hidden="true">${esc(item.name.slice(0, 1).toUpperCase())}</div><div><h3>${esc(item.name)}</h3><a href="mailto:${esc(item.email)}">${esc(item.email)}</a><small>${item.userId ? 'Sent from a member account' : 'Guest submission; email not verified'}</small></div><time datetime="${esc(item.createdAt)}">${esc(new Date(item.createdAt).toLocaleString())}</time></div><span class="feedback-topic">${esc(item.subject)}</span><p class="feedback-message">${esc(item.message)}</p><small>Reference ${esc(item.id)}</small></article>`).join('') : '<p class="feedback-empty">No messages yet. New feedback and enquiries will appear here.</p>';
    errorBox.hidden = true;
  } catch (error) {
    inbox.textContent = '';
    errorBox.textContent = `Messages could not be loaded: ${error.message}`;
    errorBox.hidden = false;
  }
}
