/* Feature modules are loaded in dependency order from js/. */
(() => {
  const page = document.body.dataset.page || 'home';
  if (['home', 'student-dashboard', 'ssu-admin-dashboard'].includes(page)) {
    const ssuStyles = document.createElement('link');
    ssuStyles.rel = 'stylesheet';
    ssuStyles.href = 'css/ssu-events.css';
    document.head.appendChild(ssuStyles);
  }
  const scripts = [
    'js/core.js',
    'js/data.js',
    'js/pages/public.js',
    'js/pages/member.js',
    'js/interactions.js',
    'js/work-management.js'
  ];
  if (page === 'donation') scripts.splice(2, 0, 'js/donation-preview.js');
  const dashboardScript = {
    'student-dashboard': 'js/dashboards/student.js',
    'supporter-dashboard': 'js/dashboards/supporter.js',
    'admin-dashboard': 'js/dashboards/admin.js',
    'ssu-admin-dashboard': 'js/dashboards/ssu-admin.js'
  }[page];

  if (dashboardScript) scripts.push(dashboardScript);
  scripts.push('js/site.js', 'js/evidence.js', 'js/live.js');
  let index = 0;
  const loadNext = () => {
    if (index === scripts.length) return;
    const source = scripts[index++];
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.onload = loadNext;
    script.onerror = () => {
      console.error(`Unable to load application module: ${source}`);
      const root = document.getElementById('app');
      if (root) root.innerHTML = '<main class="dash-content"><p role="alert">The website could not load one of its application files. Check the js folder and reload the page.</p></main>';
    };
    document.head.appendChild(script);
  };

  loadNext();
})();
