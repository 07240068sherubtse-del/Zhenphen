window.ZhenphenDashboardPages = window.ZhenphenDashboardPages || {};
window.ZhenphenDashboardPages.admin = function () {
  const applications = store.get('applications', []);
  const rationRows = store.get('rations', initialRations);
  const contributions = store.get('donations', []);

  return dashboardShell(
    `${dashHeading('Administration · preview only', 'Admin dashboard', 'A sample operations overview for reviewing community activity. This is not a secured admin system.', button('Review ration register', 'ration-tracking.html', 'small'))}
    <div class="callout"><h3>Demo administrator access</h3><p>This page uses fictional sample data and browser session storage. There is no real authentication, permission enforcement, database, or live member information.</p></div>
    ${statCards([
      ['Volunteer interests', String(applications.length), 'Session-only demo entries', 'people'],
      ['Distribution records', String(rationRows.length), 'Fictional sample register', 'box'],
      ['Contributions', String(contributions.length), 'Created in this browser session', 'heart'],
      ['Fund ledger', 'Illustrative', 'Not connected to live records', 'wallet']
    ])}
    <section class="dash-panel admin-action-panel">
      <div class="panel-heading"><div><h2>Administration tools</h2><p>Open a sample workspace</p></div>${icon('grid', 21)}</div>
      <div class="admin-action-grid">
        <a class="activity-row" href="ration-tracking.html"><span class="trust-icon">${icon('box', 19)}</span><div><h3>Ration distribution</h3><p>Search and update fictional handover statuses.</p></div></a>
        <a class="activity-row" href="volunteer-activity.html"><span class="trust-icon">${icon('people', 19)}</span><div><h3>Volunteer activity</h3><p>Preview interest entries in this browser session.</p></div></a>
        <a class="activity-row" href="money-dashboard.html"><span class="trust-icon">${icon('wallet', 19)}</span><div><h3>Financial transparency</h3><p>Review the illustrative fund ledger and sample entries.</p></div></a>
      </div>
    </section>`,
    'admin-dashboard'
  );
};
