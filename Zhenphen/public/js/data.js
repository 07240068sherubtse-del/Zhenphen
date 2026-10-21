// Read-only adapters for the initial SSU layout. Server responses are authoritative.
// Historical browser-local member/donation data is never used for reporting.
const sharedStore = {
  get(key, fallback) { return key === 'members' ? (window.liveSsuMembers || []) : fallback; }
};
function sharedSsuEvents() { return window.liveSsuEvents || []; }
function sharedSsuRegistrations() { return []; }
function activeUserCount() { return window.liveSsuMetrics?.activeUsers || 0; }
