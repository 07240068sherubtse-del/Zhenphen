window.ZhenphenDashboardPages = window.ZhenphenDashboardPages || {};
window.ZhenphenDashboardPages.student = function () {
  const currentMember = member();
  const applications = store.get('applications', []);
  const hasSsuInterest = Boolean(currentMember.ssuInterest || applications.some(application => application.ssuCollaboration));

  return dashboardShell(
    `${dashHeading('Sherubtse student space', `Welcome, ${esc(currentMember.name.split(' ')[0])}.`, 'Explore service opportunities and keep track of your volunteer interests.', button('Explore volunteering', 'volunteer.html', 'small'))}
    ${statCards([
      ['Volunteer interests', String(applications.length), 'Saved in this browser session', 'people'],
      ['SSU coordination', hasSsuInterest ? 'Interested' : 'Not selected', hasSsuInterest ? 'Your interest is saved for SSU review' : 'No SSU coordination interest is saved yet', 'leaf']
    ])}
    <div class="dash-grid">
      <section class="dash-panel">
        <div class="panel-heading"><div><h2>Your service activity</h2><p>Student volunteer interests recorded in this demo</p></div>${icon('people', 21)}</div>
        <p>View your volunteer activity, or explore opportunities in outreach, event support, logistics, and communications.</p>
        <div class="actions">${button('View volunteer activity', 'volunteer-activity.html', 'outline small')}${button('Explore roles', 'volunteer.html', 'small')}</div>
      </section>
      <section class="dash-panel">
        <div class="panel-heading"><div><h2>Social Service Unit</h2><p>Volunteer coordination at Sherubtse</p></div>${icon('leaf', 21)}</div>
        <p>${hasSsuInterest ? 'Your session records an interest in exploring coordination with the SSU.' : 'Students may express interest in exploring volunteer coordination with the SSU.'}</p>
        <p class="form-note">Your interest is saved with your account. The SSU team coordinates registered activities.</p>
        ${button('Learn about the proposal', 'index.html', 'text')}
      </section>
    </div>
    ${ssuOpportunitySection(true)}`,
    'student-dashboard'
  );
};
