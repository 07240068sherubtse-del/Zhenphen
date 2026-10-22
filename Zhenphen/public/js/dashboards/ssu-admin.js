window.ZhenphenDashboardPages = window.ZhenphenDashboardPages || {};
window.ZhenphenDashboardPages['ssu-admin'] = function () {
  const events = sharedSsuEvents();
  const registrations = sharedSsuRegistrations();
  const users = sharedStore.get('members', []);
  const donations = sharedStore.get('donations', []);
  const activities = sharedStore.get('volunteerActivities', []);
  const openEvents = events.filter(event => event.status === 'Open');
  const activeUserTotal = activeUserCount();
  const activeVolunteerTotal = ssuLiveVolunteerCount();
  const contributionMembers = buildContributionMembers(users, donations, registrations, activities, events);

  return dashboardShell(
    `${dashHeading('Sherubtse Social Service Unit × Zhenphen Association', 'SSU member & work overview', 'Manage collaborative service work, member participation, and current volunteer activity.', '')}
    <nav class="workspace-nav" aria-label="SSU workspace sections"><a href="#ssu-reports">${icon('download',17)}Reports</a><a href="#ssu-members">${icon('people',17)}Members</a><a href="#ssu-publish">${icon('calendar',17)}Publish activity</a><a href="#ssu-activities">${icon('check',17)}Manage activities</a></nav>
    <p class="ssu-workspace-note">${icon('leaf',18)}A shared service workspace for the Sherubtse Social Service Unit and Zhenphen Association.</p>
    ${statCards([
      ['Open opportunities', `<span data-live-open-event-count>${openEvents.length}</span>`, 'Available for student sign-up', 'calendar'],
      ['Currently signed in', `<span data-live-active-user-count>${activeUserTotal}</span>`, 'Unique accounts · last 2 minutes', 'people'],
      ['Volunteers working now', `<span data-live-volunteer-count>${activeVolunteerTotal}</span>`, 'Checked in to work marked in progress', 'check'],
      ['Volunteers served so far', '<span data-live-served-volunteer-count>0</span>', 'Unique volunteers with recorded attendance', 'people']
    ])}
    <section class="dash-panel ssu-reports-panel" id="ssu-reports" aria-labelledby="ssu-reports-title">
      <div class="panel-heading"><div><h2 id="ssu-reports-title">Download SSU reports</h2><p>Choose a report. Each download uses current database records and opens in Excel.</p></div><span class="report-format">CSV</span></div>
      <div class="ssu-report-grid">
        <button class="ssu-report-card" type="button" data-ssu-report="summary">${icon('chart',24)}<span><strong>Volunteer totals</strong><small>Registrations, recorded attendance, and applications.</small><span class="report-download">Download CSV ${icon('download',16)}</span></span></button>
        <button class="ssu-report-card" type="button" data-ssu-report="members">${icon('people',24)}<span><strong>Member activity</strong><small>Names, emails, participation, and current work.</small><span class="report-download">Download CSV ${icon('download',16)}</span></span></button>
        <button class="ssu-report-card" type="button" data-ssu-report="events">${icon('calendar',24)}<span><strong>Event totals</strong><small>Activity dates, capacity, and attendance counts.</small><span class="report-download">Download CSV ${icon('download',16)}</span></span></button>
      </div>
      <p class="field-help">Member reports include names and email addresses. Share them only with authorized SSU staff. Financial records are not included because payments are unavailable.</p>
    </section>
    <section class="dash-panel ssu-members-panel" id="ssu-members">
      <div class="panel-heading"><div><h2>Member participation & donations</h2><p>Per-user contribution totals and current volunteer work.</p></div><button class="btn outline small" type="button" data-refresh-ssu>Refresh live counts</button></div>
      <div data-ssu-member-table>${ssuMemberTable(contributionMembers)}</div>
    </section>
    <section class="dash-panel ssu-event-create" id="ssu-publish">
      <div class="panel-heading"><div><h2>Publish a joint service activity</h2><p>Every activity published here is a collaboration between SSU and Zhenphen. Students can see open opportunities on the website and student dashboard.</p></div>${icon('calendar', 21)}</div>
      <form data-form="ssu-event">
        <div class="field-grid">
          ${field('Work or event title', 'title', 'text', 'e.g. Community clean-up', true, true)}
          ${field('Date', 'date', 'date', '', true)}
          ${field('Location', 'location', 'text', 'Where volunteers should meet', true)}
          ${field('Participant limit', 'capacity', 'number', 'Leave blank for no limit', false)}
          <div class="field full"><label for="description">Description <span>*</span></label><textarea id="description" name="description" rows="3" maxlength="500" placeholder="Describe the activity and what volunteers should know." required></textarea><small class="field-help">Up to 500 characters.</small></div>
        </div>
        ${formEnd('Publish opportunity')}
      </form>
    </section>
    <section class="dash-panel ssu-event-admin-list" id="ssu-activities">
      <div class="panel-heading"><div><h2>Published SSU–Zhenphen collaborations</h2><p>Review registration totals and manage whether sign-up is open.</p></div></div>
      <div data-ssu-event-list>${ssuAdminEventList(events, registrations)}</div>
    </section>`,
    'ssu-admin-dashboard'
  );
};

function ssuLiveVolunteerCount() {
  const events = sharedSsuEvents();
  const registrations = sharedSsuRegistrations();
  return new Set(registrations
    .filter(registration => registration.attendance === 'Checked in' && events.some(event => event.id === registration.eventId && event.workStatus === 'In progress'))
    .map(registration => registration.memberEmail)).size;
}

function buildContributionMembers(users, donations, registrations, activities, events) {
  const byEmail = new Map();
  const addMember = (email, name) => {
    if (!email) return null;
    const key = email.toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, {
      email: key, name: name || key, donationTotal: 0, donationCount: 0,
      participationCount: 0, activeWork: new Set()
    });
    const record = byEmail.get(key);
    if (name) record.name = name;
    return record;
  };
  users.forEach(user => addMember(user.email, user.name));
  donations.forEach(donation => {
    const user = addMember(donation.memberEmail, donation.memberName);
    if (user) {
      user.donationTotal += Number(donation.amount || 0);
      user.donationCount += 1;
    }
  });
  activities.forEach(activity => {
    const user = addMember(activity.memberEmail, activity.memberName);
    if (user) user.participationCount += 1;
  });
  registrations.forEach(registration => {
    const user = addMember(registration.memberEmail, registration.memberName);
    if (!user) return;
    user.participationCount += 1;
    const event = events.find(item => item.id === registration.eventId);
    if (event?.workStatus === 'In progress' && registration.attendance === 'Checked in') user.activeWork.add(event.title);
  });
  return [...byEmail.values()].map(user => ({...user, activeWork: [...user.activeWork]}))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function ssuMemberTable(users) {
  if (!users.length) {
    return `<div class="empty-state compact-empty"><h3>No member activity recorded yet.</h3><p>Members will appear here after they create accounts, register for an SSU event, or submit a volunteer application.</p></div>`;
  }
  return `<div class="table-scroll ssu-member-table" tabindex="0" aria-label="Member participation and donations"><table><thead><tr><th>Member</th><th>Applications</th><th>Participations</th><th>Donations</th><th>Amount donated</th><th>Currently volunteering</th></tr></thead><tbody>${users.map(user => `<tr><td><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small></td><td>${user.applicationCount ?? '—'}</td><td>${user.participationCount}</td><td>${user.donationCount == null ? '—' : user.donationCount}</td><td>${user.donationTotal == null ? 'Not connected' : `Nu. ${user.donationTotal.toLocaleString('en-US')}`}</td><td>${user.activeWork.length ? user.activeWork.map(work => esc(work)).join(', ') : '—'}</td></tr>`).join('')}</tbody></table></div><p class="field-help">Participation counts members with a recorded check-in or check-out for an SSU event. Online donation records will appear only after BNB merchant payment verification is configured.</p>`;
}

function ssuAdminEventList(events, registrations) {
  if (!events.length) {
    return `<div class="empty-state"><h3>No opportunities published yet.</h3><p>Use the form above to publish the first joint SSU–Zhenphen service activity or event.</p></div>`;
  }

  return `<div class="ssu-admin-events">${events.slice().sort((a, b) => a.date.localeCompare(b.date)).map(event => {
    const attendees = event.attendees || registrations.filter(registration => registration.eventId === event.id);
    const uniqueAttendees = [...new Map(attendees.map(attendee => [attendee.email || attendee.memberEmail, attendee])).values()];
    const attendedCount = uniqueAttendees.filter(attendee => ['Checked in', 'Checked out'].includes(attendee.attendance)).length;
    const limit = event.capacity ? ` of ${esc(event.capacity)} places` : '';
    return `<article class="ssu-admin-event">
      <div class="ssu-admin-event-heading"><div><span class="ssu-collaboration-label">SSU × Zhenphen joint activity</span><br><span class="status ${event.status === 'Open' ? 'pending' : 'no'}">${esc(event.status)}</span><h3>${esc(event.title)}</h3></div><div class="ssu-event-admin-actions"><button type="button" class="btn outline small" data-ssu-export="${esc(event.id)}">Export attendance</button><button type="button" class="btn outline small" data-ssu-status="${esc(event.id)}">${event.status === 'Open' ? 'Close sign-up' : 'Reopen sign-up'}</button><label class="ssu-work-status">Work status<select data-ssu-work-status="${esc(event.id)}"><option ${event.workStatus === 'Upcoming' ? 'selected' : ''}>Upcoming</option><option ${event.workStatus === 'In progress' ? 'selected' : ''}>In progress</option><option ${event.workStatus === 'Completed' ? 'selected' : ''}>Completed</option></select></label></div></div>
      <p>${esc(event.description)}</p>
      <div class="ssu-event-meta"><span>${esc(event.date)}</span><span>${esc(event.location)}</span><strong>${uniqueAttendees.length}${limit} registered · ${attendedCount} showed up</strong></div>
      ${uniqueAttendees.length ? `<details class="ssu-attendee-details"><summary>View members and attendance (${attendedCount} showed up)</summary><ul>${uniqueAttendees.map(attendee => `<li>${esc(attendee.name || attendee.memberName)} <span>${esc(attendee.email || attendee.memberEmail)}</span><strong>${esc(attendee.attendance||'Registered')}</strong><button type="button" class="btn outline small" data-ssu-attendance="${esc(`${event.id}|${attendee.userId || attendee.memberEmail}`)}" ${event.workStatus !== 'In progress'?'disabled':''}>${attendee.attendance==='Checked in'?'Check out':'Check in'}</button></li>`).join('')}</ul>${event.workStatus!=='In progress'?'<small class="field-help">Set work status to In progress before checking volunteers in.</small>':''}</details>` : '<small class="field-help">No members have registered yet.</small>'}
    </article>`;
  }).join('')}</div>`;
}
