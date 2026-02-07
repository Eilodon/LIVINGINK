/**
 * PHASE 1 EMERGENCY: Monitoring Routes
 * Endpoints for metrics, alerts, and health monitoring
 */

import express from 'express';
import { authMiddleware } from '../auth/AuthService';
import { monitoringService } from './MonitoringService';

const router = express.Router();

// EIDOLON-V PHASE1: Get current metrics
router.get('/metrics', (req, res) => {
  try {
    const metrics = monitoringService.collectMetrics();
    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('📊 PHASE1: Metrics error:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// EIDOLON-V PHASE1: Get recent metrics
router.get('/metrics/history', (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.query.count as string) || 10, 1), 1000);
    const metrics = monitoringService.getRecentMetrics(count);
    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('📊 PHASE1: Metrics history error:', error);
    res.status(500).json({ error: 'Failed to get metrics history' });
  }
});

// EIDOLON-V PHASE1: Get active alerts
router.get('/alerts', (req, res) => {
  try {
    const alerts = monitoringService.getActiveAlerts();
    res.json({
      success: true,
      alerts,
    });
  } catch (error) {
    console.error('📊 PHASE1: Alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// EIDOLON-V PHASE1: Resolve an alert
router.post('/alerts/:alertId/resolve', (req, res) => {
  try {
    const { alertId } = req.params;
    const resolved = monitoringService.resolveAlert(alertId);

    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully',
      });
    } else {
      res.status(404).json({
        error: 'Alert not found or already resolved',
      });
    }
  } catch (error) {
    console.error('📊 PHASE1: Alert resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// EIDOLON-V PHASE1: Get health summary
router.get('/health', (req, res) => {
  try {
    const health = monitoringService.getHealthSummary();

    // Set HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'warning' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status !== 'critical',
      status: health.status,
      issues: health.issues,
      metrics: health.metrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('📊 PHASE1: Health check error:', error);
    res.status(500).json({
      error: 'Failed to get health status',
      status: 'critical',
      issues: ['Health check failed'],
    });
  }
});

// EIDOLON-V PHASE1: Record a security event (authenticated only)
router.post('/security-event', authMiddleware, (req, res) => {
  try {
    const { type, details } = req.body;

    if (!type || !details) {
      return res.status(400).json({
        error: 'Type and details are required',
      });
    }

    monitoringService.recordSecurityEvent(type, details);

    res.json({
      success: true,
      message: 'Security event recorded',
    });
  } catch (error) {
    console.error('📊 PHASE1: Security event error:', error);
    res.status(500).json({ error: 'Failed to record security event' });
  }
});

// EIDOLON-V PHASE1: Middleware to record requests
router.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  monitoringService.recordRequest(ip);
  next();
});

export default router;
