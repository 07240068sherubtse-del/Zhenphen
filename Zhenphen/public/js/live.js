window.liveSsuEvents = [];
window.liveSsuMetrics = null;
window.liveSsuMembers = [];

function bindSsuEvents() {
  if (window.liveSsuEventsBound) return;
  window.liveSsuEventsBound = true;
  document.addEventListener('click', async event => {
    const registerButton = event.target.closest('[data-ssu-register]');
    const statusButton = event.target.closest('[data-ssu-status]');
    const attendanceButton = event.target.closest('[data-ssu-attendance]');
    const exportButton = event.target.closest('[data-ssu-export]');
    const reportButton = event.target.closest('[data-ssu-report]');
    try {
      if (reportButton) {
        reportButton.disabled = true;
        try { await downloadSsuReport(reportButton.dataset.ssuReport); }
        finally { reportButton.disabled = false; }
      } else if (exportButton) {
        const eventRecord = window.liveSsuEvents.find(item => item.id === exportButton.dataset.ssuExport);
        if (!eventRecord) throw new Error('Attendance for this work could not be found. Refresh the dashboard and try again.');
        downloadSsuAttendance(eventRecord);
      } else if (registerButton) {
        if (memberRole() !== 'student' || !store.get('signed', false)) {
          location.href = 'login.html';
          return;
        }
        await apiRequest(`/api/ssu/events/${encodeURIComponent(registerButton.dataset.ssuRegister)}/register`, { method: 'POST', body: '{}' });
        toast('You are registered for this SSU opportunity.');
        await refreshSsuPublicOpportunities();
        if (document.body.dataset.page === 'ssu-admin-dashboard') await refreshSsuAdminData();
      } else if (statusButton) {
        const eventId = statusButton.dataset.ssuStatus;
        const current = window.liveSsuEvents.find(item => item.id === eventId);
        if (!current) throw new Error('This opportunity could not be found.');
        const status = current.status === 'Open' ? 'Closed' : 'Open';
        await apiRequest(`/api/ssu/events/${encodeURIComponent(eventId)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status })
        });
        await refreshSsuAdminData();
        toast(`Sign-up is now ${status.toLowerCase()}.`);
      } else if (attendanceButton) {
        const [eventId, userId] = attendanceButton.dataset.ssuAttendance.split('|');
        const event = window.liveSsuEvents.find(item => item.id === eventId);
        const attendee = event?.attendees?.find(item => item.userId === userId);
        if (!event || event.workStatus !== 'In progress' || !attendee) throw new Error('Set work to In progress and refresh before changing attendance.');
        const attendance = attendee.attendance === 'Checked in' ? 'Checked out' : 'Checked in';
        await apiRequest(`/api/ssu/events/${encodeURIComponent(eventId)}/attendance/${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ attendance })
        });
        await refreshSsuAdminData();
        toast(attendance === 'Checked in' ? 'Volunteer checked in.' : 'Volunteer checked out.');
      }
    } catch (requestError) {
      toast(requestError.message);
    }
  });

  document.addEventListener('change', async event => {
    const select = event.target.closest('[data-ssu-work-status]');
    if (!select) return;
    try {
      await apiRequest(`/api/ssu/events/${encodeURIComponent(select.dataset.ssuWorkStatus)}/work-status`, {
        method: 'PATCH',
        body: JSON.stringify({ workStatus: select.value })
      });
      await refreshSsuAdminData();
      toast('Volunteer work status updated.');
    } catch (requestError) {
      toast(requestError.message);
      await refreshSsuAdminData();
    }
  });

  document.querySelector('[data-refresh-ssu]')?.addEventListener('click', async () => {
    if (await refreshSsuAdminData()) toast('Live member and volunteer counts refreshed.');
  });
}

function buildSsuReport(report, type) {
  const { events, members, metrics } = report;
  const registrations = new Map();
  for (const event of events) {
    for (const attendee of event.attendees || []) {
      const id = String(attendee.userId);
      registrations.set(id, (registrations.get(id) || 0) + 1);
    }
  }
  if (type === 'summary') return [
    ['Metric', 'Count'],
    ['Total member accounts', members.length],
    ['Unique volunteers registered for events', registrations.size],
    ['Unique volunteers with recorded attendance', metrics.volunteersServed],
    ['Volunteers working now', metrics.activeVolunteers],
    ['Currently signed-in accounts (last 2 minutes)', metrics.activeUsers],
    ['Volunteer applications', members.reduce((sum, member) => sum + Number(member.volunteerApplications || 0), 0)],
    ['Total event registrations', events.reduce((sum, event) => sum + Number(event.registrationCount || 0), 0)],
    ['Total events', events.length],
    ['Open upcoming opportunities', metrics.openEvents]
  ];
  if (type === 'members') return [
    ['Member ID', 'Name', 'Email', 'Volunteer applications', 'Event registrations', 'Events attended', 'Current volunteer work'],
    ...members.map(member => [member.id, member.name, member.email, member.volunteerApplications,
      registrations.get(String(member.id)) || 0, member.participations, (member.activeWork || []).join('; ')])
  ];
  if (type === 'events') return [
    ['Event ID', 'Title', 'Date', 'Location', 'Capacity', 'Registrations', 'Attended', 'Sign-up status', 'Work status'],
    ...events.map(event => [event.id, event.title, event.date, event.location, event.capacity ?? 'No limit',
      event.registrationCount, event.attendedCount, event.status, event.workStatus])
  ];
  throw new Error('Choose a valid SSU report.');
}

async function downloadSsuReport(type) {
  // Fetch fresh authorized database data; never export a stale browser snapshot.
  const report = await apiRequest('/api/ssu/admin/overview');
  const rows = buildSsuReport(report, type);
  const cell = value => {
    const text = String(value ?? '');
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const csv = rows.map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Thimphu' }).format(new Date());
  link.download = `ssu-${type}-${date}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('SSU report downloaded.');
}

function downloadSsuAttendance(eventRecord) {
  const attendees = eventRecord.attendees || [];
  const attendedCount = eventRecord.attendedCount ?? attendees.filter(attendee => ['Checked in', 'Checked out'].includes(attendee.attendance)).length;
  const headers = ['Work title', 'Date', 'Location', 'Registered members', 'Members showed up', 'Member name', 'Member email', 'Attendance status'];
  const rows = attendees.length ? attendees.map(attendee => [
    eventRecord.title,
    eventRecord.date,
    eventRecord.location,
    eventRecord.registrationCount,
    attendedCount,
    attendee.name,
    attendee.email,
    attendee.attendance
  ]) : [[eventRecord.title, eventRecord.date, eventRecord.location, eventRecord.registrationCount, attendedCount, '', '', '']];
  const csvCell = value => {
    const text = String(value ?? '');
    const safeText = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const blobUrl = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  const safeTitle = String(eventRecord.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'work';
  link.href = blobUrl;
  link.download = `ssu-attendance-${safeTitle}-${eventRecord.date}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  toast(`Attendance report downloaded · ${attendedCount} showed up.`);
}

function navigateToRoleHome(user) {
  const destinations = {
    student: 'student-dashboard.html',
    supporter: 'supporter-dashboard.html',
    admin: 'admin-dashboard.html',
    ssuAdmin: 'ssu-admin-dashboard.html'
  };
  location.replace(destinations[user.role] || 'login.html');
}

function validServerUser(user) {
  return user && typeof user === 'object' && /^\d+$/.test(String(user.id))
    && typeof user.email === 'string' && user.email.includes('@')
    && ['student', 'supporter', 'admin', 'ssuAdmin'].includes(user.role);
}

function rememberSignedInUser(user) {
  if (!validServerUser(user)) throw new Error('The server returned an invalid sign-in response. Please try again.');
  if (!store.set('member', user) || !store.set('signed', true)) {
    throw new Error('This browser could not start your session. Enable session storage and try again.');
  }
}

function displayFormSuccess(form, title, message, destination, label = 'Continue') {
  if (['join', 'resend-verification'].includes(form.dataset.form)) {
    const email = form.elements.email.value.trim().toLowerCase();
    store.set('verificationEmail', email);
    location.assign('join.html?verify=1');
    return;
  }
  if (form.dataset.form === 'reset') {
    store.set('recoveryEmail', form.elements.email.value.trim().toLowerCase());
    location.assign('forgot-password.html?code=1');
    return;
  }
  if (form.dataset.form === 'reset-confirm') {
    const card = form.closest('.auth-card');
    card.innerHTML = `${authBrand()}<div class="recovery-success" tabindex="-1"><div class="success-icon" aria-hidden="true">${icon('check', 28)}</div><h1>Password updated</h1><p>Your new password is ready. Log in to return to your account.</p><a class="btn" href="login.html">Back to log in</a></div>`;
    card.querySelector('.recovery-success').focus();
    return;
  }
  form.innerHTML = `<div class="success-card" tabindex="-1"><div class="success-icon">${icon('check', 32)}</div>${eyebrow('Zhenphen community')}<h2>${esc(title)}</h2><p>${esc(message)}</p><div class="actions">${button(label, destination)}${button('Back to Home', 'index.html', 'outline')}</div></div>`;
  form.querySelector('.success-card').focus();
}

function showRequestError(form, errorMessage) {
  const target = form.querySelector('.form-error');
  if (target) {
    error(form, errorMessage);
    return;
  }
  toast(errorMessage);
}

async function refreshSsuPublicOpportunities() {
  const section = document.querySelector('.ssu-opportunities');
  if (!section) return;
  try {
    const response = await apiRequest('/api/ssu/events');
    window.liveSsuEvents = response.events;
    const replacement = document.createElement('div');
    replacement.innerHTML = ssuOpportunitySection(document.body.dataset.page === 'student-dashboard');
    section.replaceWith(replacement.firstElementChild);
    bindSsuEvents();
  } catch (requestError) {
    showLiveServiceUnavailable(section, requestError.message);
  }
}

function showLiveServiceUnavailable(element, message) {
  let notice = element.querySelector('[data-live-error]');
  if (!notice) {
    notice = document.createElement('p');
    notice.dataset.liveError = 'true';
  }
  notice.className = 'form-error';
  notice.setAttribute('role', 'alert');
  notice.textContent = `Live service data is temporarily unavailable: ${message}`;
  if (!notice.isConnected) element.prepend(notice);
}

async function refreshSsuAdminData() {
  if (document.body.dataset.page !== 'ssu-admin-dashboard') return;
  try {
    const response = await apiRequest('/api/ssu/admin/overview');
    window.liveSsuEvents = response.events;
    window.liveSsuMembers = response.members;
    window.liveSsuMetrics = response.metrics;
    window.liveSsuMembers = response.members;
    const memberTable = document.querySelector('[data-ssu-member-table]');
    const eventList = document.querySelector('[data-ssu-event-list]');
    if (memberTable) memberTable.innerHTML = ssuMemberTable(response.members.map(user => ({
      ...user,
      donationCount: null,
      donationTotal: null,
      applicationCount: user.volunteerApplications,
      participationCount: user.participations,
      activeWork: user.activeWork
    })));
    if (eventList) eventList.innerHTML = ssuAdminEventList(response.events, []);
    document.querySelector('[data-live-active-user-count]')?.replaceChildren(String(response.metrics.activeUsers));
    document.querySelector('[data-live-volunteer-count]')?.replaceChildren(String(response.metrics.activeVolunteers));
    document.querySelector('[data-live-served-volunteer-count]')?.replaceChildren(String(response.metrics.volunteersServed));
    document.querySelector('[data-live-open-event-count]')?.replaceChildren(String(response.metrics.openEvents));
    bindSsuEvents();
    return true;
  } catch (requestError) {
    const panel = document.querySelector('[data-ssu-member-table]');
    if (panel) {
      panel.innerHTML = `<p class="form-error" role="alert">Live member data could not be loaded: ${esc(requestError.message)}</p>`;
    }
    return false;
  }
}

function startPresenceTracking() {
  if (!store.get('signed', false)) return;
  const heartbeat = async () => {
    try {
      await apiRequest('/api/auth/heartbeat', { method: 'POST' });
      await refreshSsuAdminData();
    } catch (requestError) {
      if (document.body.dataset.page === 'ssu-admin-dashboard') {
        const panel = document.querySelector('[data-ssu-member-table]');
        if (panel && !panel.querySelector('[role="alert"]')) {
          showLiveServiceUnavailable(panel, requestError.message);
        }
      }
    }
  };
  void heartbeat();
  if (!window.livePresenceTimer) window.livePresenceTimer = setInterval(heartbeat, 15000);
}

async function loadMemberData() {
  store.set('donations', []);
  store.set('applications', []);
  const [profileResponse, activityResponse] = await Promise.all([
    apiRequest('/api/profile'),
    apiRequest('/api/member/activity')
  ]);
  store.set('member', { ...member(), ...profileResponse.profile, avatar: profileResponse.avatar || '' });
  store.set('donations', activityResponse.donations);
  const applications = activityResponse.applications.map(item => ({
    ...item,
    date: new Date(item.submittedAt).toLocaleDateString(),
    ssuCollaboration: item.ssuCollaboration
  }));
  const eventActivities = activityResponse.registrations.map(item => ({
    interest: `SSU event: ${item.title}`,
    availability: item.attendance,
    date: new Date(item.registeredAt).toLocaleDateString(),
    skills: item.location
  }));
  store.set('applications', [...applications, ...eventActivities]);
}

async function bootLiveApp() {
  store.set('signed', false);
  store.remove('member');
  let user = null;
  let sessionUnavailable = false;
  try {
    const result = await apiRequest('/api/auth/session');
    if (!result || !Object.hasOwn(result, 'user') || (result.user !== null && !validServerUser(result.user))) {
      throw new Error('Invalid session response');
    }
    user = result.user;
  } catch (requestError) {
    sessionUnavailable = true;
    console.error('Unable to verify the server session.');
  }
  if (user) {
    store.set('member', user);
    store.set('signed', true);
    if (document.body.dataset.page && [
      'overview', 'money', 'rations', 'donations', 'activity', 'profile',
      'student-dashboard', 'supporter-dashboard', 'admin-dashboard', 'ssu-admin-dashboard'
    ].includes(document.body.dataset.page)) {
      try {
        await loadMemberData();
      } catch (requestError) {
        console.error('Unable to load member records:', requestError);
      }
    }
  } else {
    store.set('signed', false);
    store.remove('member');
  }

  render();
  if (sessionUnavailable) {
    const notice = document.createElement('p');
    notice.className = 'form-error';
    notice.setAttribute('role', 'alert');
    notice.textContent = 'The sign-in service is unavailable. You are not signed in. Please try again shortly.';
    document.getElementById('app')?.prepend(notice);
  }
  if (document.body.dataset.page === 'login' && new URLSearchParams(location.search).get('verified') === '1') {
    const notice = document.createElement('p');
    notice.setAttribute('role', 'status');
    notice.textContent = 'Email verified successfully. You can now log in.';
    document.querySelector('.auth-card h1')?.insertAdjacentElement('afterend', notice);
  }
  if (['forgot', 'join'].includes(document.body.dataset.page) && new URLSearchParams(location.search).has('token')) {
    history.replaceState(null, '', location.pathname);
  }
  if (document.body.dataset.page === 'admin-dashboard' && user?.role === 'admin') {
    bindSuperAdminDashboard();
    await refreshSuperAdminDashboard();
  }
  if (document.body.dataset.page === 'home') {
    await refreshHomepageData();
    if (!window.liveHomepageTimer) window.liveHomepageTimer = setInterval(refreshHomepageData, 30000);
  }
  const siteFooter = document.querySelector('.dash-footer');
  if (siteFooter) {
    siteFooter.textContent = document.body.dataset.page === 'ssu-admin-dashboard'
      ? 'Joint SSU–Zhenphen activities, member records, and event registrations are stored in PostgreSQL. Donation reporting is disabled until BNB merchant payments can be verified.'
      : document.body.dataset.page === 'admin-dashboard'
        ? 'Super Admin account roles and homepage content are stored in PostgreSQL. Online donation records remain unavailable until BNB merchant payments can be verified.'
        : 'Your account and volunteer activity are stored in the Zhenphen database. Clothing and ration request workflows are not all connected yet.';
  }
  const contactForm = document.querySelector('form[data-form="contact"]');
  if (contactForm) {
    contactForm.elements.name.maxLength = 120;
    contactForm.elements.name.minLength = 2;
    contactForm.elements.name.autocomplete = 'name';
    contactForm.elements.email.maxLength = 254;
    contactForm.elements.email.autocomplete = 'email';
    contactForm.elements.message.minLength = 10;
    contactForm.elements.message.maxLength = 3000;
  }
  const joinForm = document.querySelector('form[data-form="join"]');
  const consent = joinForm?.querySelector('[name="demoConsent"]')?.closest('.check-row');
  if (joinForm && consent && !joinForm.elements.password) {
    consent.insertAdjacentHTML('beforebegin', field('Create password', 'password', 'password', 'At least 12 characters'));
    joinForm.elements.password.minLength = 12;
    joinForm.elements.password.autocomplete = 'new-password';
    joinForm.querySelector('button[type="submit"]').textContent = 'Create account';
    const formNote = joinForm.querySelector('.form-note');
    if (formNote) formNote.textContent = 'We will send a 6-digit verification code to activate your account before you log in.';
    const consentText = [...consent.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (consentText) consentText.textContent = 'I agree to create a Zhenphen community account.';
  }
  const studentEmail = joinForm?.elements.email;
  const memberTypeSelect = joinForm?.elements.memberType;
  if (studentEmail && memberTypeSelect) {
    const validateStudentEmail = () => {
      const requiresCollegeEmail = memberTypeSelect.value === 'Sherubtse College student';
      studentEmail.setCustomValidity(
        requiresCollegeEmail && !/^\d{8}\.sherubtse@rub\.edu\.bt$/i.test(studentEmail.value.trim())
          ? 'Use your 8-digit student number followed by .sherubtse@rub.edu.bt (for example, 07240068.sherubtse@rub.edu.bt).'
          : ''
      );
    };
    studentEmail.addEventListener('input', validateStudentEmail);
    memberTypeSelect.addEventListener('change', validateStudentEmail);
    validateStudentEmail();
  }
  const loginEmail = document.querySelector('form[data-form="login"] input[name="username"]');
  if (loginEmail) {
    loginEmail.type = 'email';
    loginEmail.placeholder = 'you@example.com';
    loginEmail.autocomplete = 'username';
  }
  const loginPassword = document.querySelector('form[data-form="login"] input[name="password"]');
  if (loginPassword) {
    loginPassword.placeholder = 'Enter your password';
    loginPassword.autocomplete = 'current-password';
  }
  const signoutHeading = [...document.querySelectorAll('h2')].find(heading => heading.textContent.includes('Sign out of your demo session'));
  if (signoutHeading) signoutHeading.textContent = 'Sign out of your account?';
  const signoutCopy = signoutHeading?.nextElementSibling;
  if (signoutCopy) signoutCopy.textContent = 'This will end your secure server session on this browser.';
  const emailField = document.querySelector('form[data-form="profile"] input[name="email"]');
  if (emailField) {
    emailField.readOnly = true;
    emailField.insertAdjacentHTML('afterend', '<small class="field-help">Contact the administrator if your account email needs to change.</small>');
  }
  document.querySelectorAll('.sample-badge').forEach(badge => {
    if (badge.textContent.trim() === 'DEMO MEMBER') badge.textContent = 'COMMUNITY MEMBER';
    if (badge.textContent.trim() === 'DEMO · SAMPLE DATA' && ['student-dashboard', 'supporter-dashboard', 'ssu-admin-dashboard'].includes(document.body.dataset.page)) {
      badge.textContent = 'SIGNED IN';
    }
  });
  document.querySelectorAll('.side-user small').forEach(label => {
    label.textContent = label.textContent.replace(' · demo only', '').replace(' · demo', '');
  });
  document.querySelectorAll('.dash-heading p, .dash-panel p, .stat-card small').forEach(element => {
    element.textContent = element.textContent
      .replace('in this demo session', 'in your account')
      .replace('Demo volunteer registrations', 'Saved volunteer applications and SSU registrations')
      .replace('Demo contributions this session', 'Online payments are not available yet')
      .replace('Volunteer and donation records', 'Saved applications; payments are not connected')
      .replace('Only demo contributions from this browser session', 'Online giving awaits an approved BNB payment gateway')
      .replace('Student volunteer interests recorded in this demo', 'Student applications and SSU registrations');
  });
  document.querySelectorAll('.form-note').forEach(note => {
    if (note.textContent.includes('Stored in this browser session only.')) {
      note.textContent = 'PNG, JPG or WebP · up to 1 MB. Stored securely with your profile.';
    }
  });
  const financialForm = document.querySelector('form[data-form="money"]');
  if (financialForm) {
    const notice = document.createElement('p');
    notice.className = 'form-note';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Online donations are unavailable. This is a preview; no payment or donation record will be created.';
    financialForm.prepend(notice);
  }
  for (const previewForm of document.querySelectorAll('form[data-form="clothes"], form[data-form="ration"], form[data-form="rations"]')) {
    const notice = document.createElement('p');
    notice.className = 'form-note';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Unavailable preview: requests are not sent to staff and no collection or handover is arranged.';
    previewForm.prepend(notice);
    const submit = previewForm.querySelector('button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Requests unavailable'; }
  }
  const eventFormNote = document.querySelector('.ssu-event-create .form-note');
  if (eventFormNote) eventFormNote.textContent = 'Published opportunities are stored in the shared SSU database.';
  const volunteerFormNote = document.querySelector('form[data-form="volunteer"] .form-note');
  if (volunteerFormNote) volunteerFormNote.textContent = 'Students: sign in to save your application. Submission records your interest; placement and staff review are not automated.';
  const privacyHeading = [...document.querySelectorAll('h2')].find(heading => heading.textContent.includes('Local session data'));
  if (privacyHeading?.nextElementSibling) {
    privacyHeading.nextElementSibling.textContent = 'Account and activity records are stored in the Zhenphen database. Sign-in cookies are HTTP-only and expire after eight hours. Online payments are not enabled, and no bank or card details are collected.';
  }
      const sampleHeading = [...document.querySelectorAll('h2')].find(heading => heading.textContent.includes('Use sample information'));
      if (sampleHeading?.nextElementSibling) {
        sampleHeading.nextElementSibling.textContent = 'Member accounts, profile details, SSU event registrations, and volunteer applications are saved to the hosted database. Online donations, clothing, and ration request workflows are not enabled.';
      }
      const reportingHeading = [...document.querySelectorAll('h2')].find(heading => heading.textContent.includes('SSU member reporting data'));
      if (reportingHeading?.nextElementSibling) {
        reportingHeading.nextElementSibling.textContent = 'Member profiles, SSU events and registrations, volunteer applications, and active sign-ins are stored in the hosted database and shared for authorized SSU reporting.';
      }
      const aboutPhoto = document.querySelector('.about-hero-visual img');
      if (aboutPhoto) {
        aboutPhoto.alt = 'Trashigang Dzong above Trashigang town in eastern Bhutan';
        aboutPhoto.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Tashigang_Dzong_111120.jpg/1280px-Tashigang_Dzong_111120.jpg';
        aboutPhoto.addEventListener('error', () => {
          aboutPhoto.src = 'assets/taktsahng.jpeg';
          aboutPhoto.alt = 'Paro Taktsang, a Bhutanese landmark';
        }, { once: true });
      }
      if (document.body.dataset.page === 'credits') {
        const firstCredit = document.querySelector('.legal-text .panel p');
        if (firstCredit) {
          firstCredit.insertAdjacentHTML('beforebegin', '<h2>Trashigang Dzong, eastern Bhutan</h2>');
          firstCredit.insertAdjacentHTML('afterend', '<p>Photo: Christopher J. Fynn, <a href="https://commons.wikimedia.org/wiki/File:Tashigang_Dzong_111120.jpg" target="_blank" rel="noopener">Tashigang Dzong 111120</a>, licensed under <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>. The photograph depicts the Dzong in Trashigang town.</p>');
        }
      }
      const aboutNotice = document.querySelector('.about-prototype-note');
      if (aboutNotice) aboutNotice.textContent = 'Sherubtse SSU opportunities and student registrations are stored in the Zhenphen database. Online donations are not enabled yet.';
      if (document.body.dataset.page === 'ssu-admin-dashboard') {
        const callout = document.querySelector('.dash-content .callout');
        if (callout) {
          const heading = callout.querySelector('h3');
          const paragraph = callout.querySelector('p');
          if (heading) heading.textContent = 'Joint SSU–Zhenphen service workspace';
          if (paragraph) paragraph.textContent = 'All work activities and events published here are collaborations between the Sherubtse Social Service Unit and Zhenphen Association. Published opportunities display this partnership to students and the community.';
        }
      }
      const privacyTitle = document.querySelector('.page-title h1');
      if (document.body.dataset.page === 'privacy' && privacyTitle) privacyTitle.textContent = 'Account data and payment safety.';
      if (document.body.dataset.page === 'home' || document.body.dataset.page === 'student-dashboard') {
        await refreshSsuPublicOpportunities();
        if (!window.liveOpportunityTimer) window.liveOpportunityTimer = setInterval(refreshSsuPublicOpportunities, 30000);
      }
  if (document.body.dataset.page === 'ssu-admin-dashboard') await refreshSsuAdminData();
  const dashboardBadge = document.querySelector('.sample-badge');
  if (dashboardBadge && document.body.dataset.page === 'ssu-admin-dashboard') dashboardBadge.textContent = 'LIVE MEMBER DATA';
  if (document.body.dataset.page === 'student-dashboard') {
    document.querySelectorAll('.stat-card small, .dash-panel p').forEach(element => {
      element.textContent = element.textContent
        .replace('Saved in this browser session', 'Saved to your account')
        .replace('recorded in this demo', 'saved to your account');
    });
  }
}

async function refreshHomepageData() {
  try {
    const { siteContent, metrics } = await apiRequest('/api/site-content');
    const headline = document.querySelector('.hero-content h1');
    const summary = document.querySelector('.hero-content .intro');
    const volunteers = document.querySelector('[data-live-volunteers]');
    if (headline) headline.textContent = siteContent.homepageTitle;
    if (summary) summary.textContent = siteContent.homepageSummary === 'We connect people who want to help with communities that need support. Through service, donations, volunteering, and solidarity, small acts become lasting change.' ? 'Students and supporters coming together to care for our community.' : siteContent.homepageSummary;
    if (volunteers) volunteers.textContent = Number(metrics.volunteersServed).toLocaleString();
  } catch (requestError) {
    console.error('Unable to load live homepage data:', requestError);
    const volunteers = document.querySelector('[data-live-volunteers]');
    if (volunteers) volunteers.textContent = 'Unavailable';
  }
}

async function submitLiveForm(form, event) {
  const type = form.dataset.form;
  if (!['login', 'join', 'profile', 'ssu-event', 'volunteer', 'money', 'clothes', 'ration', 'rations', 'contact', 'reset', 'reset-confirm', 'verify-email', 'resend-verification'].includes(type)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const values = Object.fromEntries(new FormData(form));
  form.querySelector('.form-error')?.setAttribute('hidden', '');

  try {
    if (type === 'verify-email' || type === 'resend-verification') {
      const result = await apiRequest('/api/auth/verification/' + (type === 'verify-email' ? 'confirm' : 'resend'), { method: 'POST', body: JSON.stringify(values) });
      if (type === 'verify-email') {
        store.remove('verificationEmail');
        location.replace('login.html?verified=1');
      } else displayFormSuccess(form, 'Check your inbox.', result.message, 'login.html');
      return;
    }
    if (type === 'login') {
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: values.username, password: values.password })
      });
      rememberSignedInUser(result.user);
      const returnTo = store.get('returnTo', '');
      store.remove('returnTo');
      const allowed = {
        student: ['student-dashboard.html', 'profile.html', 'volunteer-activity.html'],
        supporter: ['supporter-dashboard.html', 'profile.html', 'my-donations.html'],
        admin: ['admin-dashboard.html', 'profile.html', 'money-dashboard.html', 'ration-tracking.html'],
        ssuAdmin: ['ssu-admin-dashboard.html', 'profile.html']
      };
      location.replace(allowed[result.user.role]?.includes(returnTo) ? returnTo : ({
        student: 'student-dashboard.html',
        supporter: 'supporter-dashboard.html',
        admin: 'admin-dashboard.html',
        ssuAdmin: 'ssu-admin-dashboard.html'
      }[result.user.role] || 'login.html'));
      return;
    }

    if (type === 'join') {
      const result = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          memberType: values.memberType,
          interest: values.interest,
          ssuInterest: values.ssuInterest
        })
      });
      displayFormSuccess(form, 'Check your inbox.', result.message + ' Check your spam folder too, if you do not see it.', 'join.html?resend=1', 'Resend verification email');
      return;
    }

    if (type === 'profile') {
      const result = await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          bio: values.bio,
          skills: values.skills,
          avatar: values.avatar || undefined
        })
      });
      store.set('member', { ...member(), ...result.profile });
      displayFormSuccess(form, 'Profile saved.', 'Your profile updates are saved to your account.', 'profile.html');
      return;
    }

    if (type === 'ssu-event') {
      const result = await apiRequest('/api/ssu/events', {
        method: 'POST',
        body: JSON.stringify({
          title: values.title,
          date: values.date,
          location: values.location,
          description: values.description,
          capacity: values.capacity
        })
      });
      toast(`“${result.event.title}” has been published.`);
      await refreshSsuAdminData();
      form.reset();
      return;
    }

    if (type === 'volunteer') {
      if (!store.get('signed', false) || memberRole() !== 'student') throw new Error('Sign in with a student account to submit a volunteer application. Your application was not saved.');
      const result = await apiRequest('/api/volunteer-applications', {
        method: 'POST',
        body: JSON.stringify({
          interest: values.interest,
          availability: values.availability,
          skills: values.skills,
          ssuInterest: values.ssuInterest
        })
      });
      displayFormSuccess(form, 'Application received.', `Your volunteer application is saved with reference ${result.application.id}. The team still needs to review it.`, 'volunteer-activity.html');
      return;
    }

    if (type === 'contact') {
      const submit = form.querySelector('button[type="submit"]');
      if (submit.disabled) return;
      submit.disabled = true;
      submit.textContent = 'Sending...';
      try {
        const result = await apiRequest('/api/feedback', { method: 'POST', body: JSON.stringify(values) });
        displayFormSuccess(form, 'Thank you for reaching out', `Your message has been saved for the Zhenphen team. Your reference is ${result.reference}.`, 'contact.html', 'Send another message');
      } finally {
        if (submit.isConnected) { submit.disabled = false; submit.textContent = 'Send message'; }
      }
      return;
    }

    if (type === 'money') {
      await apiRequest('/api/donations/checkout', { method: 'POST', body: '{}' });
      return;
    }

    if (type === 'reset') {
      const result = await apiRequest('/api/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email: values.email })
      });
      displayFormSuccess(form, 'Check your inbox.', result.message, 'login.html', 'Back to Login');
      return;
    }

    if (type === 'reset-confirm') {
      const code = (values.code || '').trim();
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit verification code from your email.');
      if (values.password !== values.confirmPassword) throw new Error('The passwords do not match.');
      const result = await apiRequest('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ email: values.email, code, password: values.password })
      });
      displayFormSuccess(form, 'Password updated.', result.message, 'login.html', 'Sign in');
      return;
    }

    throw new Error('This request cannot be submitted yet. No information was saved.');
  } catch (requestError) {
    showRequestError(form, requestError.message);
  }
}

document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.form?.startsWith('super-admin-')) return;
  if (form.dataset.submitting === 'true') { event.preventDefault(); event.stopImmediatePropagation(); return; }
  form.dataset.submitting = 'true';
  const submit = form.querySelector('button[type="submit"]');
  const wasDisabled = submit?.disabled;
  void submitLiveForm(form, event).finally(() => {
    delete form.dataset.submitting;
    if (submit?.isConnected) submit.disabled = Boolean(wasDisabled);
  });
  if (submit?.isConnected) submit.disabled = true;
}, true);

document.addEventListener('click', async event => {
  const logoutButton = event.target.closest('[data-logout]');
  if (!logoutButton) return;
  event.preventDefault();
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    store.set('signed', false);
    store.remove('member');
    location.replace('login.html');
  } catch (requestError) {
    toast(`Sign-out failed: ${requestError.message}`);
  }
}, true);

void bootLiveApp().catch(requestError => {
  console.error('Unable to initialize live features:', requestError);
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.className = 'form-error';
  notice.textContent = 'Live data could not be loaded. Refresh the page and try again. Some features may be unavailable.';
  document.getElementById('app')?.prepend(notice);
});
