/**
 * PRODUCTION ANALYTICS SYSTEM
 Player behavior tracking, A/B testing, retention metrics
 */

export interface AnalyticsEvent {
  type: string;
  timestamp: number;
  sessionId: string;
  playerId: string;
  data: Record<string, any>;
  context: {
    deviceType: string;
    platform: string;
    version: string;
    quality: string;
  };
}

export interface PlayerMetrics {
  sessionId: string;
  startTime: number;
  totalPlayTime: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  favoriteShape: string;
  favoriteTattoo: string;
  averageSessionLength: number;
  retentionDay: number;
  lastActiveTime: number;
  spendMetrics: {
    totalSpent: number;
    purchases: number;
    averagePurchaseValue: number;
    lastPurchaseTime: number;
  };
  engagementMetrics: {
    dailyStreak: number;
    achievementsUnlocked: number;
    socialInteractions: number;
    tutorialCompleted: boolean;
    featureUsage: Record<string, number>;
  };
  performanceMetrics: {
    averageFPS: number;
    crashCount: number;
    networkLatency: number;
    deviceLoadTime: number;
  };
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficSplit: number[];
  startDate: number;
  endDate?: number;
  targetAudience?: string;
  metrics: string[];
}

export interface ABTestVariant {
  id: string;
  name: string;
  config: Record<string, any>;
  weight: number;
}

export interface FunnelStep {
  name: string;
  description: string;
  required: boolean;
  conversionRate: number;
  dropoffReasons: string[];
}

export class AnalyticsSystem {
  private events: AnalyticsEvent[] = [];
  private playerMetrics: PlayerMetrics;
  private abTests: ABTest[] = [];
  private activeTests: Map<string, string> = new Map(); // testId -> variantId
  private funnelSteps: FunnelStep[] = [];
  private isInitialized = false;
  private batchSize = 50;
  private flushInterval = 30000; // 30 seconds
  private sessionId: string;
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.playerMetrics = this.initializePlayerMetrics();
    this.initializeABTests();
    this.initializeFunnel();
    this.startBatchFlush();
    this.isInitialized = true;
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private initializePlayerMetrics(): PlayerMetrics {
    return {
      sessionId: this.sessionId,
      startTime: Date.now(),
      totalPlayTime: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      favoriteShape: 'circle',
      favoriteTattoo: '',
      averageSessionLength: 0,
      retentionDay: 1,
      lastActiveTime: Date.now(),
      spendMetrics: {
        totalSpent: 0,
        purchases: 0,
        averagePurchaseValue: 0,
        lastPurchaseTime: 0,
      },
      engagementMetrics: {
        dailyStreak: 0,
        achievementsUnlocked: 0,
        socialInteractions: 0,
        tutorialCompleted: false,
        featureUsage: {},
      },
      performanceMetrics: {
        averageFPS: 60,
        crashCount: 0,
        networkLatency: 0,
        deviceLoadTime: 0,
      },
    };
  }

  private initializeABTests() {
    this.abTests = [
      {
        id: 'tutorial_flow',
        name: 'Tutorial Flow Optimization',
        description: 'Test different tutorial approaches',
        variants: [
          { id: 'interactive', name: 'Interactive Tutorial', config: { style: 'interactive', duration: 300 }, weight: 50 },
          { id: 'video', name: 'Video Tutorial', config: { style: 'video', duration: 120 }, weight: 30 },
          { id: 'skip', name: 'Skip Option', config: { style: 'skip', duration: 60 }, weight: 20 },
        ],
        trafficSplit: [50, 30, 20],
        startDate: Date.now(),
        metrics: ['tutorial_completion_rate', 'time_to_first_game', 'retention_day_1'],
      },
      {
        id: 'onboarding_rewards',
        name: 'Onboarding Rewards',
        description: 'Test different reward structures for new players',
        variants: [
          { id: 'generous', name: 'Generous Rewards', config: { bonusMultiplier: 2.0 }, weight: 33 },
          { id: 'standard', name: 'Standard Rewards', config: { bonusMultiplier: 1.0 }, weight: 34 },
          { id: 'minimal', name: 'Minimal Rewards', config: { bonusMultiplier: 0.5 }, weight: 33 },
        ],
        trafficSplit: [33, 34, 33],
        startDate: Date.now(),
        metrics: ['day_7_retention', 'first_purchase_rate', 'session_length'],
      },
      {
        id: 'ui_layout',
        name: 'UI Layout Optimization',
        description: 'Test different UI layouts for better engagement',
        variants: [
          { id: 'compact', name: 'Compact Layout', config: { style: 'compact', buttonSize: 'small' }, weight: 50 },
          { id: 'spacious', name: 'Spacious Layout', config: { style: 'spacious', buttonSize: 'large' }, weight: 50 },
        ],
        trafficSplit: [50, 50],
        startDate: Date.now(),
        metrics: ['click_through_rate', 'session_length', 'error_rate'],
      },
    ];

    // Assign variants for this session
    this.assignTestVariants();
  }

  private assignTestVariants() {
    for (const test of this.abTests) {
      const variant = this.selectVariant(test);
      this.activeTests.set(test.id, variant.id);
      console.log(`🧪 A/B Test: ${test.name} - Assigned to ${variant.name}`);
    }
  }

  private selectVariant(test: ABTest): ABTestVariant {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < test.variants.length; i++) {
      cumulative += test.trafficSplit[i];
      if (random <= cumulative) {
        return test.variants[i];
      }
    }
    
    return test.variants[test.variants.length - 1];
  }

  private initializeFunnel() {
    this.funnelSteps = [
      {
        name: 'app_launch',
        description: 'Application launched',
        required: true,
        conversionRate: 100,
        dropoffReasons: ['app_crash', 'device_incompatible'],
      },
      {
        name: 'main_menu',
        description: 'Reached main menu',
        required: true,
        conversionRate: 95,
        dropoffReasons: ['long_load_time', 'connection_error'],
      },
      {
        name: 'tutorial_start',
        description: 'Started tutorial',
        required: false,
        conversionRate: 80,
        dropoffReasons: ['skip_tutorial', 'tutorial_bugs'],
      },
      {
        name: 'first_game',
        description: 'Played first game',
        required: true,
        conversionRate: 70,
        dropoffReasons: ['difficulty_frustration', 'performance_issues'],
      },
      {
        name: 'first_win',
        description: 'Achieved first win',
        required: false,
        conversionRate: 50,
        dropoffReasons: ['skill_gap', 'bad_luck'],
      },
      {
        name: 'social_feature',
        description: 'Used social feature',
        required: false,
        conversionRate: 30,
        dropoffReasons: ['privacy_concerns', 'no_friends'],
      },
      {
        name: 'first_purchase',
        description: 'Made first purchase',
        required: false,
        conversionRate: 15,
        dropoffReasons: ['price_sensitivity', 'payment_issues'],
      },
      {
        name: 'day_7_retention',
        description: 'Returned after 7 days',
        required: true,
        conversionRate: 25,
        dropoffReasons: ['lost_interest', 'found_alternative'],
      },
    ];
  }

  // Event tracking
  trackEvent(type: string, data: Record<string, any> = {}) {
    const event: AnalyticsEvent = {
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      playerId: this.getPlayerId(),
      data,
      context: this.getEventContext(),
    };

    this.events.push(event);
    this.updatePlayerMetrics(event);
    
    // Auto-flush if batch is full
    if (this.events.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  private getPlayerId(): string {
    // In a real implementation, this would get the actual player ID
    return localStorage.getItem('cjr_player_id') || 'anonymous';
  }

  private getEventContext() {
    return {
      deviceType: this.getDeviceType(),
      platform: this.getPlatform(),
      version: this.getVersion(),
      quality: this.getQualityLevel(),
    };
  }

  private getDeviceType(): string {
    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) return 'mobile';
    return 'desktop';
  }

  private getPlatform(): string {
    const userAgent = navigator.userAgent;
    if (/windows/i.test(userAgent)) return 'windows';
    if (/mac/i.test(userAgent)) return 'macos';
    if (/linux/i.test(userAgent)) return 'linux';
    if (/android/i.test(userAgent)) return 'android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
    return 'unknown';
  }

  private getVersion(): string {
    // In a real implementation, this would get the actual app version
    return '1.0.0';
  }

  private getQualityLevel(): string {
    // In a real implementation, this would get the current quality setting
    return 'high';
  }

  private updatePlayerMetrics(event: AnalyticsEvent) {
    switch (event.type) {
      case 'game_start':
        this.playerMetrics.gamesPlayed++;
        this.playerMetrics.engagementMetrics.featureUsage['games'] = 
          (this.playerMetrics.engagementMetrics.featureUsage['games'] || 0) + 1;
        break;
        
      case 'game_win':
        this.playerMetrics.wins++;
        break;
        
      case 'game_loss':
        this.playerMetrics.losses++;
        break;
        
      case 'purchase':
        this.playerMetrics.spendMetrics.purchases++;
        this.playerMetrics.spendMetrics.totalSpent += event.data.amount || 0;
        this.playerMetrics.spendMetrics.lastPurchaseTime = Date.now();
        break;
        
      case 'tutorial_complete':
        this.playerMetrics.engagementMetrics.tutorialCompleted = true;
        break;
        
      case 'achievement_unlock':
        this.playerMetrics.engagementMetrics.achievementsUnlocked++;
        break;
        
      case 'social_interaction':
        this.playerMetrics.engagementMetrics.socialInteractions++;
        break;
        
      case 'performance_issue':
        this.playerMetrics.performanceMetrics.crashCount++;
        break;
    }

    // Update last active time
    this.playerMetrics.lastActiveTime = Date.now();
    
    // Calculate total play time
    this.playerMetrics.totalPlayTime = Date.now() - this.playerMetrics.startTime;
  }

  // A/B Testing interface
  getTestVariant(testId: string): ABTestVariant | null {
    const variantId = this.activeTests.get(testId);
    if (!variantId) return null;
    
    const test = this.abTests.find(t => t.id === testId);
    if (!test) return null;
    
    return test.variants.find(v => v.id === variantId) || null;
  }

  getTestConfig(testId: string): Record<string, any> {
    const variant = this.getTestVariant(testId);
    return variant?.config || {};
  }

  // Funnel tracking
  trackFunnelStep(stepName: string, completed: boolean, reason?: string) {
    const step = this.funnelSteps.find(s => s.name === stepName);
    if (!step) return;

    this.trackEvent('funnel_step', {
      step: stepName,
      completed,
      reason,
      stepIndex: this.funnelSteps.indexOf(step),
    });

    if (reason && !step.dropoffReasons.includes(reason)) {
      step.dropoffReasons.push(reason);
    }
  }

  getFunnelAnalysis() {
    return this.funnelSteps.map(step => ({
      ...step,
      totalEvents: this.events.filter(e => e.type === 'funnel_step' && e.data.step === step.name).length,
      completedEvents: this.events.filter(e => e.type === 'funnel_step' && e.data.step === step.name && e.data.completed).length,
      actualConversionRate: 0, // Would calculate from events
    }));
  }

  // Batch processing
  private startBatchFlush() {
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);
  }

  private flushEvents() {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    // In a real implementation, this would send to analytics server
    console.log(`📊 Flushing ${eventsToSend.length} analytics events`);
    
    // Simulate network send
    this.sendToAnalyticsServer(eventsToSend);
  }

  private sendToAnalyticsServer(events: AnalyticsEvent[]) {
    // In a real implementation, this would use fetch/axios to send to server
    // For demo purposes, we'll just log and store locally
    const storedEvents = JSON.parse(localStorage.getItem('cjr_analytics') || '[]');
    storedEvents.push(...events);
    
    // Keep only last 1000 events to prevent storage bloat
    if (storedEvents.length > 1000) {
      storedEvents.splice(0, storedEvents.length - 1000);
    }
    
    localStorage.setItem('cjr_analytics', JSON.stringify(storedEvents));
  }

  // Retention analysis
  calculateRetentionMetrics() {
    const now = Date.now();
    const day1Retention = this.calculateRetention(1);
    const day7Retention = this.calculateRetention(7);
    const day30Retention = this.calculateRetention(30);

    return {
      day1: day1Retention,
      day7: day7Retention,
      day30: day30Retention,
      currentStreak: this.playerMetrics.engagementMetrics.dailyStreak,
      averageSessionLength: this.calculateAverageSessionLength(),
    };
  }

  private calculateRetention(days: number): number {
    const now = Date.now();
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    const playersActiveAtStart = this.getUniquePlayersAtTime(cutoff - (24 * 60 * 60 * 1000));
    const playersActiveNow = this.getUniquePlayersAtTime(cutoff);
    
    if (playersActiveAtStart === 0) return 0;
    return (playersActiveNow / playersActiveAtStart) * 100;
  }

  private getUniquePlayersAtTime(timestamp: number): number {
    // In a real implementation, this would query the analytics database
    // For demo purposes, we'll return a simulated value
    return Math.floor(Math.random() * 1000) + 100;
  }

  private calculateAverageSessionLength(): number {
    const sessionEvents = this.events.filter(e => e.type === 'session_end');
    if (sessionEvents.length === 0) return 0;
    
    const totalLength = sessionEvents.reduce((sum, event) => sum + (event.data.duration || 0), 0);
    return totalLength / sessionEvents.length;
  }

  // Performance analytics
  trackPerformance(metrics: {
    fps: number;
    memoryUsage: number;
    networkLatency: number;
    loadTime: number;
  }) {
    this.trackEvent('performance', metrics);
    
    // Update player performance metrics
    this.playerMetrics.performanceMetrics.averageFPS = 
      (this.playerMetrics.performanceMetrics.averageFPS + metrics.fps) / 2;
    this.playerMetrics.performanceMetrics.networkLatency = metrics.networkLatency;
    this.playerMetrics.performanceMetrics.deviceLoadTime = metrics.loadTime;
  }

  // Monetization analytics
  trackMonetization(event: 'purchase' | 'view' | 'click', data: {
    itemType: string;
    itemId?: string;
    amount?: number;
    currency?: string;
  }) {
    this.trackEvent(`monetization_${event}`, data);
  }

  // Get comprehensive analytics report
  generateReport(): {
    overview: PlayerMetrics;
    retention: any;
    funnel: any;
    abTests: any;
    performance: any;
  } {
    return {
      overview: this.playerMetrics,
      retention: this.calculateRetentionMetrics(),
      funnel: this.getFunnelAnalysis(),
      abTests: this.getABTestResults(),
      performance: this.getPerformanceReport(),
    };
  }

  private getABTestResults() {
    return this.abTests.map(test => ({
      id: test.id,
      name: test.name,
      variants: test.variants.map(variant => ({
        ...variant,
        participants: this.getTestParticipants(test.id, variant.id),
        conversionRate: this.getTestConversionRate(test.id, variant.id),
      })),
    }));
  }

  private getTestParticipants(testId: string, variantId: string): number {
    // In a real implementation, this would query the analytics database
    return Math.floor(Math.random() * 1000) + 100;
  }

  private getTestConversionRate(testId: string, variantId: string): number {
    // In a real implementation, this would calculate actual conversion rates
    return Math.random() * 100;
  }

  private getPerformanceReport() {
    const performanceEvents = this.events.filter(e => e.type === 'performance');
    if (performanceEvents.length === 0) return this.playerMetrics.performanceMetrics;

    const avgFPS = performanceEvents.reduce((sum, e) => sum + (e.data.fps || 0), 0) / performanceEvents.length;
    const avgLatency = performanceEvents.reduce((sum, e) => sum + (e.data.networkLatency || 0), 0) / performanceEvents.length;
    const avgMemory = performanceEvents.reduce((sum, e) => sum + (e.data.memoryUsage || 0), 0) / performanceEvents.length;

    return {
      averageFPS: Math.round(avgFPS),
      averageLatency: Math.round(avgLatency),
      averageMemory: Math.round(avgMemory),
      crashCount: this.playerMetrics.performanceMetrics.crashCount,
      deviceLoadTime: this.playerMetrics.performanceMetrics.deviceLoadTime,
    };
  }

  // Cleanup
  dispose() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushEvents();
  }
}

export const analyticsSystem = new AnalyticsSystem();
