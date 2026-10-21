const express = require('express');
const { requireAuth, requireRole, asyncRoute } = require('../middleware/api');
const ssuController = require('../controllers/ssuController');

const router = express.Router();
router.param('eventId', require('../middleware/api').validateId);
router.param('userId', require('../middleware/api').validateId);

router.get('/events', asyncRoute(ssuController.listEvents));
router.post('/events', requireAuth, requireRole('admin', 'ssuAdmin'), asyncRoute(ssuController.createEvent));
router.post('/events/:eventId/register', requireAuth, requireRole('student'), asyncRoute(ssuController.registerForEvent));
router.patch('/events/:eventId/status', requireAuth, requireRole('admin', 'ssuAdmin'), asyncRoute(ssuController.updateEventStatus));
router.patch('/events/:eventId/work-status', requireAuth, requireRole('admin', 'ssuAdmin'), asyncRoute(ssuController.updateWorkStatus));
router.patch('/events/:eventId/attendance/:userId', requireAuth, requireRole('admin', 'ssuAdmin'), asyncRoute(ssuController.updateAttendance));
router.get('/admin/overview', requireAuth, requireRole('admin', 'ssuAdmin'), asyncRoute(ssuController.getAdminOverview));

module.exports = router;
