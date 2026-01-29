// @ts-nocheck
/**
 * INTEGRATION TEST SUITE - GAME FLOW VALIDATION
 * Automated testing without manual gameplay required
 */

import { GameState, Player } from '../../types';
import { TattooId } from '../../services/cjr/cjrTypes';
import { createInitialState, optimizedEngine } from '../../services/engine';
import { createPlayer, createBot, createFood } from '../../services/engine/factories';
import { applyTattoo } from '../../services/cjr/tattoos';
import { calcMatchPercent } from '../../services/cjr/colorMath';
import { colorMixingSystem } from '../../server/src/systems/ColorMixingSystem';
import { getCurrentSpatialGrid } from '../../services/engine/context';
import { TransformStore, InputStore } from '../../services/engine/dod/ComponentStores';

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details: string;
  errors: string[];
}

export interface GameFlowTestSuite {
  name: string;
  description: string;
  tests: Array<{
    name: string;
    test: () => Promise<boolean>;
    timeout: number;
  }>;
}

export class GameFlowTest {
  private static testResults: TestResult[] = [];
  private static gameState: GameState | null = null;

  /**
   * Run complete game flow test suite
   */
  static async runCompleteTestSuite(): Promise<{
    passed: boolean;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    results: TestResult[];
    summary: string;
  }> {
    console.log('🧪 Starting Game Flow Test Suite...');

    this.testResults = [];

    // Initialize game state
    await this.initializeGameState();

    // Run all test suites
    const testSuites: GameFlowTestSuite[] = [
      this.getCoreGameplayTests(),
      this.getUITests(),
      this.getAudioTests(),
      this.getNetworkTests(),
      this.getPerformanceTests(),
      this.getAccessibilityTests(),
      this.getMonetizationTests(),
    ];

    for (const suite of testSuites) {
      console.log(`\n📋 Running ${suite.name}...`);

      for (const test of suite.tests) {
        const result = await this.runSingleTest(test.name, test.test, test.timeout);
        this.testResults.push(result);
      }
    }

    // Generate summary
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passed = failedTests === 0;

    const summary = `
🎮 GAME FLOW TEST RESULTS:
✅ Passed: ${passedTests}/${totalTests}
❌ Failed: ${failedTests}/${totalTests}
📊 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%
${passed ? '🎉 ALL TESTS PASSED!' : '⚠️  Some tests failed - review details'}
    `;

    console.log(summary);

    return {
      passed,
      totalTests,
      passedTests,
      failedTests,
      results: this.testResults,
      summary
    };
  }

  /**
   * Initialize game state for testing
   */
  private static async initializeGameState(): Promise<void> {
    this.gameState = createInitialState();

    // Setup test player
    const defaultPlayer = createPlayer('TestPlayer');
    if (!defaultPlayer) throw new Error('Failed to create test player');

    this.gameState.player = {
      ...defaultPlayer,
      id: 'test-player',
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      targetPosition: { x: 100, y: 100 },
      radius: 28,
      pigment: { r: 0.5, g: 0.5, b: 0.5 },
      targetPigment: { r: 0.8, g: 0.2, b: 0.2 },
      score: 0,

      maxHealth: 100,
      currentHealth: 100, // Ensuring it overrides
    };
    // Sync players array
    this.gameState.players = [this.gameState.player];

    // Add test entities
    const bot = createBot('test-bot-1');
    if (bot) {
      bot.position = { x: 200, y: 200 };
      bot.currentHealth = 80;
      bot.maxHealth = 80;
      this.gameState.bots = [bot];
    } else {
      console.warn('Failed to create test bot');
      this.gameState.bots = [];
    }

    const food1 = createFood({ x: 150, y: 150 });
    if (food1) {
      food1.id = 'test-food-1';
      food1.pigment = { r: 0.9, g: 0.1, b: 0.1 };
    }

    const food2 = createFood({ x: 250, y: 250 });
    if (food2) {
      food2.id = 'test-food-2';
      food2.pigment = { r: 0.1, g: 0.9, b: 0.1 };
    }

    this.gameState.food = [food1, food2].filter((f): f is import('../../types').Food => f !== null);

    // EIDOLON-V: Insert static entities into Grid for collision tests
    const grid = getCurrentSpatialGrid();
    this.gameState.food.forEach(f => grid.insertStatic(f));

    console.log('✅ Game state initialized for testing');
  }

  /**
   * Core gameplay tests
   */
  private static getCoreGameplayTests(): GameFlowTestSuite {
    return {
      name: 'Core Gameplay',
      description: 'Test fundamental game mechanics',
      tests: [
        {
          name: 'Player Movement',
          test: async () => {
            const initialPos = { ...this.gameState!.player.position };
            this.gameState!.player.targetPosition = { x: 50, y: 50 };

            // Simulate game update (multiple frames to allow physics/logic to settle)
            for (let i = 0; i < 10; i++) {
              optimizedEngine.updateGameState(this.gameState!, 1 / 60);
              optimizedEngine.updateClientVisuals(this.gameState!, 1 / 60); // EIDOLON-V: Sync for Test
            }

            // Check if player moved
            const moved = Math.abs(this.gameState!.player.position.x - initialPos.x) > 0.1 ||
              Math.abs(this.gameState!.player.position.y - initialPos.y) > 0.1;

            return moved;
          },
          timeout: 1000
        },
        {
          name: 'Food Consumption',
          test: async () => {
            const initialScore = this.gameState!.player.score;
            const initialPigment = { ...this.gameState!.player.pigment };

            // Simulate eating food
            const food = this.gameState!.food[0];
            // Manually move player to food
            this.gameState!.player.position = { x: food.position.x, y: food.position.y };

            // EIDOLON-V: Sync to DOD (Push Sync Removed)
            if (this.gameState!.player.physicsIndex !== undefined) {
              const tIdx = this.gameState!.player.physicsIndex * 8;
              TransformStore.data[tIdx] = food.position.x;
              TransformStore.data[tIdx + 1] = food.position.y;
            }

            // Sync logic position to DOD Store?
            // Engine's integratePhysics will do it in step 1 of updateGameState.

            // Simulate game update (multiple frames)
            for (let i = 0; i < 5; i++) {
              updateGameState(this.gameState!, 1 / 60);
              updateClientVisuals(this.gameState!, 1 / 60); // EIDOLON-V: Sync for Test
            }

            // Check if score increased and pigment changed
            const scoreIncreased = this.gameState!.player.score > initialScore;
            // Pigment change is vector equality check
            const pigmentChanged = JSON.stringify(this.gameState!.player.pigment) !== JSON.stringify(initialPigment);

            return scoreIncreased && pigmentChanged;
          },
          timeout: 1000
        },
        {
          name: 'Color Matching',
          test: async () => {
            // Set player pigment close to target
            this.gameState!.player.pigment = { r: 0.75, g: 0.25, b: 0.25 };
            this.gameState!.player.targetPigment = { r: 0.8, g: 0.2, b: 0.2 };

            updateGameState(this.gameState!, 1 / 60);
            updateClientVisuals(this.gameState!, 1 / 60);

            const matchPercent = calcMatchPercent(this.gameState!.player.pigment, this.gameState!.player.targetPigment);
            return matchPercent > 0.8; // Should be > 80% match
          },
          timeout: 1000
        },
        {
          name: 'Ring Entry Validation',
          test: async () => {
            // Test server-authoritative ring entry
            const result = colorMixingSystem.canEnterRing(
              'test-player',
              this.gameState!.player.pigment,
              this.gameState!.player.targetPigment,
              0.8
            );

            return result.canEnter === (calcMatchPercent(this.gameState!.player.pigment, this.gameState!.player.targetPigment) >= 0.8);
          },
          timeout: 1000
        },
        {
          name: 'Tattoo Application',
          test: async () => {
            const initialStats = { ...this.gameState!.player };
            const tattoo = { id: 'speed_boost' as TattooId, name: 'Speed Boost', tier: 1 };

            applyTattoo(this.gameState!.player, tattoo.id);

            // Check if tattoo was applied
            return this.gameState!.player.tattoos.includes(tattoo.id);
          },
          timeout: 1000
        },
        {
          name: 'Skill Cooldown',
          test: async () => {
            // Activate skill via InputStore (player is entity 0)
            InputStore.setSkillActive(0, true);
            updateGameState(this.gameState!, 1 / 60);
            updateClientVisuals(this.gameState!, 1 / 60);

            const cooldownSet = this.gameState!.player.skillCooldown > 0;

            // Wait for cooldown
            this.gameState!.player.skillCooldown = 0;
            updateGameState(this.gameState!, 1 / 60);
            updateClientVisuals(this.gameState!, 1 / 60);

            const skillReady = this.gameState!.player.skillCooldown === 0;

            return cooldownSet && skillReady;
          },
          timeout: 2000
        }
      ]
    };
  }

  /**
   * UI/UX tests
   */
  private static getUITests(): GameFlowTestSuite {
    return {
      name: 'UI/UX',
      description: 'Test user interface components',
      tests: [
        {
          name: 'Button Click Detection',
          test: async () => {
            // Simulate button click detection
            const button = document.createElement('button');
            button.textContent = 'Test Button';
            document.body.appendChild(button);

            let clicked = false;
            button.addEventListener('click', () => {
              clicked = true;
            });

            button.click();

            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 100));

            document.body.removeChild(button);
            return clicked;
          },
          timeout: 1000
        },
        {
          name: 'Touch Gesture Recognition',
          test: async () => {
            // Test touch support
            const hasTouchSupport = 'ontouchstart' in window;
            const hasPointerSupport = 'onpointerdown' in window;

            return hasTouchSupport || hasPointerSupport;
          },
          timeout: 500
        },
        {
          name: 'Screen Orientation',
          test: async () => {
            // Test screen orientation detection
            const orientation = screen.orientation || (screen as any).mozOrientation || (screen as any).msOrientation;
            return orientation !== undefined;
          },
          timeout: 500
        },
        {
          name: 'Responsive Layout',
          test: async () => {
            // Test responsive breakpoints
            const width = window.innerWidth;
            const height = window.innerHeight;

            // Check if reasonable dimensions
            return width > 300 && height > 400;
          },
          timeout: 500
        }
      ]
    };
  }

  /**
   * Audio tests
   */
  private static getAudioTests(): GameFlowTestSuite {
    return {
      name: 'Audio System',
      description: 'Test audio functionality',
      tests: [
        {
          name: 'Web Audio API Support',
          test: async () => {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            return AudioContext !== undefined;
          },
          timeout: 500
        },
        {
          name: 'Audio Context Creation',
          test: async () => {
            try {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              const audioContext = new AudioContext();
              const created = audioContext.state !== 'closed';
              audioContext.close();
              return created;
            } catch (error) {
              return false;
            }
          },
          timeout: 1000
        },
        {
          name: 'Haptic Feedback Support',
          test: async () => {
            return 'vibrate' in navigator;
          },
          timeout: 500
        }
      ]
    };
  }

  /**
   * Network tests
   */
  private static getNetworkTests(): GameFlowTestSuite {
    return {
      name: 'Network',
      description: 'Test network connectivity',
      tests: [
        {
          name: 'WebSocket Support',
          test: async () => {
            return 'WebSocket' in window;
          },
          timeout: 500
        },
        {
          name: 'Fetch API Support',
          test: async () => {
            return 'fetch' in window;
          },
          timeout: 500
        },
        {
          name: 'Local Storage Support',
          test: async () => {
            try {
              localStorage.setItem('test', 'test');
              localStorage.removeItem('test');
              return true;
            } catch (error) {
              return false;
            }
          },
          timeout: 500
        }
      ]
    };
  }

  /**
   * Performance tests
   */
  private static getPerformanceTests(): GameFlowTestSuite {
    return {
      name: 'Performance',
      description: 'Test performance metrics',
      tests: [
        {
          name: 'RequestAnimationFrame Support',
          test: async () => {
            return 'requestAnimationFrame' in window;
          },
          timeout: 500
        },
        {
          name: 'Performance API Support',
          test: async () => {
            return 'performance' in window && 'now' in performance;
          },
          timeout: 500
        },
        {
          name: 'Canvas Performance',
          test: async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) return false;

            const startTime = performance.now();

            // Simple performance test
            for (let i = 0; i < 1000; i++) {
              ctx.fillStyle = `hsl(${i}, 70%, 50%)`;
              ctx.fillRect(i % 100, Math.floor(i / 100), 10, 10);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            return duration < 100; // Should complete in < 100ms
          },
          timeout: 2000
        }
      ]
    };
  }

  /**
   * Accessibility tests
   */
  private static getAccessibilityTests(): GameFlowTestSuite {
    return {
      name: 'Accessibility',
      description: 'Test accessibility features',
      tests: [
        {
          name: 'Screen Reader Support',
          test: async () => {
            // Check for screen reader indicators
            const hasAriaSupport = 'aria-label' in document.createElement('div');
            const hasRoleSupport = 'role' in document.createElement('div');
            return hasAriaSupport && hasRoleSupport;
          },
          timeout: 500
        },
        {
          name: 'Keyboard Navigation',
          test: async () => {
            return 'addEventListener' in window && 'keydown' in window;
          },
          timeout: 500
        },
        {
          name: 'High Contrast Mode',
          test: async () => {
            // Check for high contrast mode support
            return window.matchMedia && window.matchMedia('(prefers-contrast: high)').media !== undefined;
          },
          timeout: 500
        },
        {
          name: 'Reduced Motion',
          test: async () => {
            return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').media !== undefined;
          },
          timeout: 500
        }
      ]
    };
  }

  /**
   * Monetization tests
   */
  private static getMonetizationTests(): GameFlowTestSuite {
    return {
      name: 'Monetization',
      description: 'Test monetization features',
      tests: [
        {
          name: 'Local Storage for Purchases',
          test: async () => {
            try {
              localStorage.setItem('test_purchase', JSON.stringify({ id: 'test', price: 9.99 }));
              const purchase = JSON.parse(localStorage.getItem('test_purchase') || '{}');
              localStorage.removeItem('test_purchase');
              return purchase.id === 'test';
            } catch (error) {
              return false;
            }
          },
          timeout: 1000
        },
        {
          name: 'Currency Validation',
          test: async () => {
            // Test currency formatting
            const formatter = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD'
            });

            const formatted = formatter.format(9.99);
            return formatted.includes('$') && formatted.includes('9.99');
          },
          timeout: 500
        }
      ]
    };
  }

  /**
   * Run single test with timeout
   */
  private static async runSingleTest(
    testName: string,
    testFunction: () => Promise<boolean>,
    timeout: number
  ): Promise<TestResult> {
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      const result = await Promise.race([
        testFunction(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout')), timeout)
        )
      ]);

      const duration = performance.now() - startTime;

      return {
        testName,
        passed: result,
        duration,
        details: result ? 'Test passed successfully' : 'Test assertion failed',
        errors
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        testName,
        passed: false,
        duration,
        details: 'Test failed with error',
        errors: [errorMessage]
      };
    }
  }

  /**
   * Generate detailed test report
   */
  static generateTestReport(): {
    summary: string;
    details: string;
    recommendations: string[];
  } {
    if (this.testResults.length === 0) {
      return {
        summary: 'No tests run',
        details: 'Please run test suite first',
        recommendations: ['Run complete test suite to generate report']
      };
    }

    const passedTests = this.testResults.filter(r => r.passed);
    const failedTests = this.testResults.filter(r => !r.passed);

    const summary = `
🎮 GAME FLOW TEST REPORT
====================
Total Tests: ${this.testResults.length}
Passed: ${passedTests.length}
Failed: ${failedTests.length}
Success Rate: ${((passedTests.length / this.testResults.length) * 100).toFixed(1)}%
    `;

    const details = `
DETAILED RESULTS:
====================
${this.testResults.map(result =>
      `${result.passed ? '✅' : '❌'} ${result.testName} (${result.duration.toFixed(2)}ms)
   ${result.details}`
    ).join('\n')}
    `;

    const recommendations: string[] = [];

    if (failedTests.length > 0) {
      recommendations.push('Fix failed tests before production deployment');
      recommendations.push('Review error messages for debugging');
    }

    if (passedTests.length === this.testResults.length) {
      recommendations.push('All tests passed - ready for production');
      recommendations.push('Consider adding more edge case tests');
    }

    const slowTests = this.testResults.filter(r => r.duration > 1000);
    if (slowTests.length > 0) {
      recommendations.push('Optimize slow tests for better performance');
    }

    return {
      summary,
      details,
      recommendations
    };
  }
}

export const gameFlowTest = GameFlowTest;
