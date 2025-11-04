const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const CheckIn = require('../models/CheckIn');
const WalkIn = require('../models/WalkIn');
const Waitlist = require('../models/Waitlist');
const { ROLES } = require('../models/Role');

const router = express.Router();

let checkIns = [];
let walkIns = [];
let waitlists = [];
let nextCheckInId = 1;
let nextWalkInId = 1;
let nextWaitlistId = 1;

router.post('/check-in', authenticate, async (req, res) => {
  try {
    const {
      patientId,
      appointmentId,
      clinicId,
      providerId,
      reason,
      triageLevel
    } = req.body;

    if (!patientId || !clinicId) {
      return res.status(400).json({ error: 'Patient ID and Clinic ID are required' });
    }

    const queuePosition = checkIns.filter(
      c => c.clinicId === clinicId && c.status === 'waiting'
    ).length + 1;

    const estimatedWaitTime = queuePosition * 15;

    const checkIn = new CheckIn({
      id: String(nextCheckInId++),
      patientId,
      appointmentId,
      clinicId,
      providerId,
      reason,
      triageLevel: triageLevel || 'routine',
      queuePosition,
      estimatedWaitTime,
      status: 'waiting'
    });

    checkIns.push(checkIn);

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'CHECK_IN',
      resourceId: checkIn.id,
      userId: req.user.userId
    });

    res.status(201).json(checkIn.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/check-ins', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN, ROLES.DOCTOR), async (req, res) => {
  try {
    const { clinicId, status, providerId } = req.query;

    let filtered = checkIns;

    if (clinicId) {
      filtered = filtered.filter(c => c.clinicId === clinicId);
    }

    if (status) {
      filtered = filtered.filter(c => c.status === status);
    }

    if (providerId) {
      filtered = filtered.filter(c => c.providerId === providerId);
    }

    filtered.sort((a, b) => a.queuePosition - b.queuePosition);

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'CHECK_IN_LIST',
      userId: req.user.userId
    });

    res.json(filtered.map(c => c.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/check-ins/:id/status', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN, ROLES.DOCTOR), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['waiting', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const checkIn = checkIns.find(c => c.id === id);

    if (!checkIn) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    checkIn.status = status;
    checkIn.updatedAt = new Date();

    if (status === 'completed' || status === 'cancelled') {
      checkIns.forEach(c => {
        if (c.clinicId === checkIn.clinicId && c.status === 'waiting' && c.queuePosition > checkIn.queuePosition) {
          c.queuePosition--;
          c.estimatedWaitTime = c.queuePosition * 15;
        }
      });
    }

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'CHECK_IN',
      resourceId: id,
      userId: req.user.userId,
      details: { newStatus: status }
    });

    res.json(checkIn.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/walk-ins', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN), async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      patientEmail,
      patientPhone,
      clinicId,
      providerId,
      reason,
      triageLevel,
      notes
    } = req.body;

    if (!patientName || !clinicId) {
      return res.status(400).json({ error: 'Patient name and Clinic ID are required' });
    }

    const queuePosition = walkIns.filter(
      w => w.clinicId === clinicId && w.status === 'waiting'
    ).length + 1;

    const baseWaitTime = queuePosition * 15;
    const triagePriority = triageLevel === 'urgent' ? -30 : triageLevel === 'high' ? -15 : 0;
    const estimatedWaitTime = Math.max(0, baseWaitTime + triagePriority);

    const walkIn = new WalkIn({
      id: String(nextWalkInId++),
      patientId,
      patientName,
      patientEmail,
      patientPhone,
      clinicId,
      providerId,
      reason,
      triageLevel: triageLevel || 'routine',
      queuePosition,
      estimatedWaitTime,
      notes,
      status: 'waiting'
    });

    walkIns.push(walkIn);

    if (triageLevel === 'urgent' || triageLevel === 'high') {
      walkIns
        .filter(w => w.clinicId === clinicId && w.status === 'waiting' && w.id !== walkIn.id)
        .forEach(w => {
          if (w.triageLevel === 'routine' || (triageLevel === 'urgent' && w.triageLevel === 'high')) {
            w.queuePosition++;
            w.estimatedWaitTime = w.queuePosition * 15;
          }
        });

      const priorityPosition = walkIns
        .filter(w =>
          w.clinicId === clinicId &&
          w.status === 'waiting' &&
          (w.triageLevel === 'urgent' || (triageLevel === 'high' && w.triageLevel === 'high'))
        )
        .length;

      walkIn.queuePosition = priorityPosition;
      walkIn.estimatedWaitTime = priorityPosition * 15;
    }

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'WALK_IN',
      resourceId: walkIn.id,
      userId: req.user.userId
    });

    res.status(201).json(walkIn.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/walk-ins', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN, ROLES.DOCTOR), async (req, res) => {
  try {
    const { clinicId, status, triageLevel } = req.query;

    let filtered = walkIns;

    if (clinicId) {
      filtered = filtered.filter(w => w.clinicId === clinicId);
    }

    if (status) {
      filtered = filtered.filter(w => w.status === status);
    }

    if (triageLevel) {
      filtered = filtered.filter(w => w.triageLevel === triageLevel);
    }

    filtered.sort((a, b) => {
      const triagePriority = { urgent: 0, high: 1, routine: 2 };
      const aPriority = triagePriority[a.triageLevel] || 2;
      const bPriority = triagePriority[b.triageLevel] || 2;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.queuePosition - b.queuePosition;
    });

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'WALK_IN_LIST',
      userId: req.user.userId
    });

    res.json(filtered.map(w => w.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/walk-ins/:id/status', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN, ROLES.DOCTOR), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['waiting', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const walkIn = walkIns.find(w => w.id === id);

    if (!walkIn) {
      return res.status(404).json({ error: 'Walk-in not found' });
    }

    walkIn.status = status;
    walkIn.updatedAt = new Date();

    if (status === 'completed' || status === 'cancelled') {
      walkIns.forEach(w => {
        if (w.clinicId === walkIn.clinicId && w.status === 'waiting' && w.queuePosition > walkIn.queuePosition) {
          w.queuePosition--;
          w.estimatedWaitTime = w.queuePosition * 15;
        }
      });
    }

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'WALK_IN',
      resourceId: id,
      userId: req.user.userId,
      details: { newStatus: status }
    });

    res.json(walkIn.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/waitlist', authenticate, async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      patientEmail,
      patientPhone,
      clinicId,
      providerId,
      preferredDate,
      preferredTimeSlot,
      reason,
      priority,
      notes
    } = req.body;

    if (!patientName || !clinicId) {
      return res.status(400).json({ error: 'Patient name and Clinic ID are required' });
    }

    const daysToWait = waitlists.filter(
      w => w.clinicId === clinicId && w.providerId === providerId && w.status === 'active'
    ).length;

    const estimatedCallbackDate = new Date();
    estimatedCallbackDate.setDate(estimatedCallbackDate.getDate() + Math.ceil(daysToWait / 3));

    const waitlist = new Waitlist({
      id: String(nextWaitlistId++),
      patientId,
      patientName,
      patientEmail,
      patientPhone,
      clinicId,
      providerId,
      preferredDate,
      preferredTimeSlot,
      reason,
      priority: priority || 'normal',
      status: 'active',
      estimatedCallbackDate,
      notes
    });

    waitlists.push(waitlist);

    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'WAITLIST',
      resourceId: waitlist.id,
      userId: req.user.userId
    });

    res.status(201).json(waitlist.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/waitlist', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN, ROLES.DOCTOR), async (req, res) => {
  try {
    const { clinicId, providerId, status } = req.query;

    let filtered = waitlists;

    if (clinicId) {
      filtered = filtered.filter(w => w.clinicId === clinicId);
    }

    if (providerId) {
      filtered = filtered.filter(w => w.providerId === providerId);
    }

    if (status) {
      filtered = filtered.filter(w => w.status === status);
    }

    filtered.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return new Date(a.addedAt) - new Date(b.addedAt);
    });

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'WAITLIST',
      userId: req.user.userId
    });

    res.json(filtered.map(w => w.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/waitlist/:id', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['active', 'contacted', 'scheduled', 'cancelled', 'expired'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const waitlist = waitlists.find(w => w.id === id);

    if (!waitlist) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    if (status) {
      waitlist.status = status;
    }
    if (notes !== undefined) {
      waitlist.notes = notes;
    }
    waitlist.updatedAt = new Date();

    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'WAITLIST',
      resourceId: id,
      userId: req.user.userId,
      details: { newStatus: status }
    });

    res.json(waitlist.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/waitlist/:id', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN), async (req, res) => {
  try {
    const { id } = req.params;

    const index = waitlists.findIndex(w => w.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    waitlists.splice(index, 1);

    logAccess(req, AUDIT_ACTIONS.DELETE, {
      resourceType: 'WAITLIST',
      resourceId: id,
      userId: req.user.userId
    });

    res.json({ message: 'Waitlist entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/clinic-status/:clinicId', authenticate, requireRole(ROLES.CLINIC_STAFF, ROLES.CLINIC_ADMIN, ROLES.DOCTOR), async (req, res) => {
  try {
    const { clinicId } = req.params;

    const activeCheckIns = checkIns.filter(c => c.clinicId === clinicId && c.status !== 'completed' && c.status !== 'cancelled');
    const activeWalkIns = walkIns.filter(w => w.clinicId === clinicId && w.status !== 'completed' && w.status !== 'cancelled');
    const activeWaitlist = waitlists.filter(w => w.clinicId === clinicId && w.status === 'active');

    const totalWaiting = activeCheckIns.filter(c => c.status === 'waiting').length +
                        activeWalkIns.filter(w => w.status === 'waiting').length;
    const totalInProgress = activeCheckIns.filter(c => c.status === 'in-progress').length +
                           activeWalkIns.filter(w => w.status === 'in-progress').length;

    const avgWaitTime = totalWaiting > 0
      ? [...activeCheckIns, ...activeWalkIns]
          .filter(item => item.status === 'waiting')
          .reduce((sum, item) => sum + (item.estimatedWaitTime || 0), 0) / totalWaiting
      : 0;

    logAccess(req, AUDIT_ACTIONS.VIEW, {
      resourceType: 'CLINIC_STATUS',
      resourceId: clinicId,
      userId: req.user.userId
    });

    res.json({
      clinicId,
      timestamp: new Date(),
      checkIns: {
        total: activeCheckIns.length,
        waiting: activeCheckIns.filter(c => c.status === 'waiting').length,
        inProgress: activeCheckIns.filter(c => c.status === 'in-progress').length
      },
      walkIns: {
        total: activeWalkIns.length,
        waiting: activeWalkIns.filter(w => w.status === 'waiting').length,
        inProgress: activeWalkIns.filter(w => w.status === 'in-progress').length,
        urgent: activeWalkIns.filter(w => w.triageLevel === 'urgent').length,
        high: activeWalkIns.filter(w => w.triageLevel === 'high').length
      },
      waitlist: {
        total: activeWaitlist.length,
        urgent: activeWaitlist.filter(w => w.priority === 'urgent').length,
        high: activeWaitlist.filter(w => w.priority === 'high').length
      },
      overall: {
        totalWaiting,
        totalInProgress,
        averageWaitTime: Math.round(avgWaitTime)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
