const { pool } = require('../db');
const { httpError } = require('../middleware/api');

function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

exports.listEvents = async (req, res) => {
  const admin = req.user && ['admin', 'ssuAdmin'].includes(req.user.role);
  const result = await pool.query(
    `SELECT e.id::text, e.title, e.event_date::text AS date, e.location, e.description, e.capacity,
            e.status, e.work_status AS "workStatus", e.created_at AS "createdAt",
            COUNT(r.id)::integer AS "registrationCount",
            EXISTS(SELECT 1 FROM ssu_registrations mine
                   WHERE mine.event_id = e.id AND mine.user_id = $1::bigint) AS registered
     FROM ssu_events e LEFT JOIN ssu_registrations r ON r.event_id = e.id
     ${admin ? '' : "WHERE e.status = 'Open' AND e.event_date >= (NOW() AT TIME ZONE 'Asia/Thimphu')::date AND e.work_status = 'Upcoming'"}
     GROUP BY e.id ORDER BY e.event_date ASC`,
    [req.user?.id || null]
  );
  res.json({ events: result.rows });
};

exports.createEvent = async (req, res) => {
  const title = clean(req.body.title, 140);
  const date = clean(req.body.date, 10);
  const location = clean(req.body.location, 180);
  const description = clean(req.body.description, 500);
  const capacity = req.body.capacity === '' || req.body.capacity == null ? null : Number(req.body.capacity);
  const todayInBhutan = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Thimphu' }).format(new Date());
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  const validDate = dateValue && !Number.isNaN(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === date;
  if (title.length < 2 || !validDate || date < todayInBhutan
      || !location || !description || (capacity !== null && (!Number.isInteger(capacity) || capacity < 1))) {
    throw httpError(400, 'Enter a valid title, today-or-future date, location, description, and optional positive participant limit.');
  }
  const result = await pool.query(
    `INSERT INTO ssu_events (title, event_date, location, description, capacity, created_by)
     VALUES ($1, $2::date, $3, $4, $5, $6)
     RETURNING id::text, title, event_date::text AS date, location, description, capacity,
               status, work_status AS "workStatus", created_at AS "createdAt"`,
    [title, date, location, description, capacity, req.user.id]
  );
  res.status(201).json({ event: result.rows[0] });
};

exports.registerForEvent = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eventResult = await client.query(
      'SELECT id, status, event_date::text AS event_date, capacity, work_status FROM ssu_events WHERE id = $1 FOR UPDATE',
      [req.params.eventId]
    );
    const event = eventResult.rows[0];
    const todayInBhutan = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Thimphu' }).format(new Date());
    if (!event || event.status !== 'Open' || event.work_status !== 'Upcoming' || event.event_date < todayInBhutan) {
      throw httpError(409, 'This opportunity is no longer open for registration.');
    }
    const existing = await client.query('SELECT id FROM ssu_registrations WHERE event_id = $1 AND user_id = $2', [event.id, req.user.id]);
    if (existing.rowCount) throw httpError(409, 'You are already registered for this opportunity.');
    const countResult = await client.query(
      'SELECT COUNT(*)::integer AS count FROM ssu_registrations WHERE event_id = $1',
      [event.id]
    );
    if (event.capacity !== null && countResult.rows[0].count >= event.capacity) {
      throw httpError(409, 'This opportunity has reached its participant limit.');
    }
    const inserted = await client.query(
      'INSERT INTO ssu_registrations (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
      [event.id, req.user.id]
    );
    if (!inserted.rowCount) throw httpError(409, 'You are already registered for this opportunity.');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') throw httpError(404, 'This opportunity could not be found.');
    throw error;
  } finally {
    client.release();
  }
  res.status(201).json({ message: 'You are registered for this SSU opportunity.' });
};

exports.updateEventStatus = async (req, res) => {
  const status = req.body.status;
  if (!['Open', 'Closed'].includes(status)) throw httpError(400, 'Choose Open or Closed.');
  const result = await pool.query(
    'UPDATE ssu_events SET status = $1 WHERE id = $2 RETURNING id::text, status',
    [status, req.params.eventId]
  );
  if (!result.rowCount) throw httpError(404, 'This opportunity could not be found.');
  res.json({ event: result.rows[0] });
};

exports.updateWorkStatus = async (req, res) => {
  const workStatus = req.body.workStatus;
  if (!['Upcoming', 'In progress', 'Completed'].includes(workStatus)) {
    throw httpError(400, 'Choose a valid work status.');
  }
  const result = await pool.query(
    'UPDATE ssu_events SET work_status = $1 WHERE id = $2 RETURNING id::text, work_status AS "workStatus"',
    [workStatus, req.params.eventId]
  );
  if (!result.rowCount) throw httpError(404, 'This opportunity could not be found.');
  res.json({ event: result.rows[0] });
};

exports.updateAttendance = async (req, res) => {
  const attendance = req.body.attendance;
  if (!['Checked in', 'Checked out'].includes(attendance)) {
    throw httpError(400, 'Choose a valid attendance status.');
  }
  const result = await pool.query(
    `UPDATE ssu_registrations SET attendance = $1
     WHERE event_id = $2 AND user_id = $3
       AND (attendance = $1 OR ($1 = 'Checked in' AND attendance = 'Registered')
            OR ($1 = 'Checked out' AND attendance = 'Checked in'))
       AND EXISTS (SELECT 1 FROM ssu_events WHERE id = $2 AND work_status = 'In progress')
     RETURNING attendance`,
    [attendance, req.params.eventId, req.params.userId]
  );
  if (!result.rowCount) {
    throw httpError(409, 'Attendance cannot be updated. Check that the member is registered, the work is in progress, and check-in happens before check-out.');
  }
  res.json({ attendance: result.rows[0].attendance });
};

exports.getAdminOverview = async (req, res) => {
  const [events, members, counts] = await Promise.all([
    pool.query(
      `SELECT e.id::text, e.title, e.event_date::text AS date, e.location, e.description, e.capacity,
              e.status, e.work_status AS "workStatus", e.created_at AS "createdAt",
              COUNT(r.id)::integer AS "registrationCount",
              (COUNT(r.id) FILTER (WHERE r.attendance IN ('Checked in', 'Checked out')))::integer AS "attendedCount",
              COALESCE(json_agg(json_build_object(
                'userId', u.id::text, 'name', u.name, 'email', u.email, 'attendance', r.attendance
              )) FILTER (WHERE r.id IS NOT NULL), '[]') AS attendees
       FROM ssu_events e LEFT JOIN ssu_registrations r ON r.event_id = e.id
       LEFT JOIN users u ON u.id = r.user_id
       GROUP BY e.id ORDER BY e.event_date ASC`
    ),
    pool.query(
      `SELECT u.id::text AS id, u.name, u.email,
              (COUNT(DISTINCT r.id) FILTER (WHERE r.attendance IN ('Checked in', 'Checked out')))::integer AS participations,
              COUNT(DISTINCT a.id)::integer AS "volunteerApplications",
              COALESCE(json_agg(DISTINCT e.title) FILTER (WHERE r.attendance = 'Checked in' AND e.work_status = 'In progress'), '[]') AS "activeWork"
       FROM users u
       LEFT JOIN ssu_registrations r ON r.user_id = u.id
       LEFT JOIN ssu_events e ON e.id = r.event_id
       LEFT JOIN volunteer_applications a ON a.user_id = u.id
       WHERE u.role IN ('student', 'supporter')
       GROUP BY u.id ORDER BY u.name`
    ),
    pool.query(
      `SELECT (SELECT COUNT(DISTINCT user_id)::integer FROM user_presence WHERE last_seen > NOW() - INTERVAL '2 minutes') AS "activeUsers",
              (SELECT COUNT(DISTINCT r.user_id)::integer FROM ssu_registrations r JOIN ssu_events e ON e.id = r.event_id
               WHERE r.attendance = 'Checked in' AND e.work_status = 'In progress') AS "activeVolunteers",
              (SELECT COUNT(DISTINCT user_id)::integer FROM ssu_registrations
               WHERE attendance IN ('Checked in', 'Checked out')) AS "volunteersServed",
              (SELECT COUNT(*)::integer FROM ssu_events WHERE status = 'Open' AND event_date >= (NOW() AT TIME ZONE 'Asia/Thimphu')::date AND work_status = 'Upcoming') AS "openEvents"`
    )
  ]);
  res.json({ events: events.rows, members: members.rows, metrics: counts.rows[0] });
};
