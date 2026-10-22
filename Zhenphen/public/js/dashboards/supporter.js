window.ZhenphenDashboardPages = window.ZhenphenDashboardPages || {};
window.ZhenphenDashboardPages.supporter = function () {
  const contributions = store.get('donations', []);
  const total = contributions.filter(row => row.type === 'Financial donation').reduce((sum, row) => {
    const amount = Number(String(row.value).replace(/[^\d]/g, ''));
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return dashboardShell(
    `${dashHeading('Community supporter space', `Welcome, ${esc(member().name.split(' ')[0])}.`, 'Manage your account and explore ways to support the community. Financial figures remain illustrative.', button('View financial transparency', 'money-dashboard.html', 'small'))}
    ${statCards([
      ['My contributions', String(contributions.length), 'Recorded this session', 'heart'],
      ['My recorded giving', nu(total), 'Fictional demo value only', 'wallet'],
      ['Financial records', 'Sample', 'No live account or payment data', 'chart']
    ])}
    <div class="dash-grid">
      <section class="dash-panel">
        <div class="panel-heading"><div><h2>Your contribution history</h2><p>Only demo contributions from this browser session</p></div>${icon('heart', 21)}</div>
        ${contributions.length ? donationTable([...contributions].reverse().slice(0, 5)) : `<div class="empty-state">${icon('heart', 32)}<h3>Your demo history is ready.</h3><p>Preview how a contribution would appear in your account.</p>${button('Explore giving options', 'donation.html', 'outline small')}</div>`}
      </section>
      <section class="dash-panel">
        <div class="panel-heading"><div><h2>Follow the funds</h2><p>Illustrative totals, not live accounting</p></div>${icon('shield', 21)}</div>
        <p>Review the sample allocation, transaction list, and evidence placeholders in the transparency preview.</p>
        ${button('Open financial transparency', 'money-dashboard.html', 'outline small')}
      </section>
    </div>`,
    'supporter-dashboard'
  );
};
