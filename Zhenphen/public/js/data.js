const sharedStore = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(`zh-shared-${key}`)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`zh-shared-${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};

function upsertCommunityMember(record) {
  if (!record.email || ['admin', 'ssuAdmin'].includes(record.role)) return true;
  const users = sharedStore.get('members', []);
  const email = record.email.trim().toLowerCase();
  const existing = users.find(user => user.email === email);
  const updated = {
    email,
    name: record.name,
    role: record.role,
    memberType: record.memberType,
    bio: record.bio || existing?.bio || '',
    skills: record.skills || existing?.skills || '',
    registeredAt: existing?.registeredAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  const next = existing ? users.map(user => user.email === email ? updated : user) : [...users, updated];
  return sharedStore.set('members', next);
}

function recordSharedDonation(record) {
  const donations = sharedStore.get('donations', []);
  return sharedStore.set('donations', [...donations, record]);
}

function recordSharedVolunteer(record) {
  const activities = sharedStore.get('volunteerActivities', []);
  return sharedStore.set('volunteerActivities', [...activities, record]);
}

function refreshActiveSessions() {
  const now = Date.now();
  const activeSessions = sharedStore.get('activeSessions', []).filter(session => now - session.lastSeen < 120000);
  if (store.get('signed', false)) {
    const current = member();
    let sessionId = sessionStorage.getItem('zh-presence-id');
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('zh-presence-id', sessionId);
    }
    const session = {
      id: sessionId,
      email: current.email.trim().toLowerCase(),
      name: current.name,
      role: memberRole(),
      lastSeen: now
    };
    const index = activeSessions.findIndex(item => item.id === sessionId);
    if (index === -1) activeSessions.push(session);
    else activeSessions[index] = session;
  }
  sharedStore.set('activeSessions', activeSessions);
  return activeSessions;
}

function activeUserCount() {
  const sessions = sharedStore.get('activeSessions', []).filter(session => Date.now() - session.lastSeen < 120000);
  return new Set(sessions.filter(session => session.email).map(session => session.email)).size;
}

function removeCurrentActiveSession() {
  const sessionId = sessionStorage.getItem('zh-presence-id');
  if (!sessionId) return;
  const sessions = sharedStore.get('activeSessions', []).filter(session => session.id !== sessionId);
  sharedStore.set('activeSessions', sessions);
  sessionStorage.removeItem('zh-presence-id');
}

function sharedSsuEvents() {
  const events = sharedStore.get('ssuEvents', []);
  if (!events.length) {
    const legacyEvents = store.get('ssuEvents', []);
    if (legacyEvents.length) saveSharedSsuEvents(legacyEvents);
    return legacyEvents;
  }
  return events;
}

function saveSharedSsuEvents(events) {
  return sharedStore.set('ssuEvents', events);
}

function sharedSsuRegistrations() {
  const registrations = sharedStore.get('ssuRegistrations', []);
  if (!registrations.length) {
    const legacyRegistrations = store.get('ssuRegistrations', []);
    if (legacyRegistrations.length) saveSharedSsuRegistrations(legacyRegistrations);
    return legacyRegistrations;
  }
  return registrations;
}

function saveSharedSsuRegistrations(registrations) {
  return sharedStore.set('ssuRegistrations', registrations);
}
