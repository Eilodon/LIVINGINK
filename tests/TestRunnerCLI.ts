/**
 * COMMAND LINE INTERFACE FOR AUTOMATED TESTING
 * Run tests without manual gameplay
 */

import { automatedTestRunner } from './AutomatedTestRunner';
import { gameFlowTest } from './integration/GameFlowTest';
import { visualRegressionTest } from './e2e/VisualRegressionTest';

/**
 * CLI interface for running tests
 */
interface TestCLIOptions {
  type?: 'integration' | 'visual' | 'unit' | 'performance' | 'all';
  output?: 'console' | 'json' | 'junit';
  verbose?: boolean;
  timeout?: number;
  continuous?: boolean;
}

/**
 * Main CLI function
 */
async function runTestsCLI(options: TestCLIOptions = {}): Promise<void> {
  console.log('🧪 COLOR JELLY RUSH - AUTOMATED TESTING SUITE');
  console.log('=====================================');
  
  try {
    if (options.continuous) {
      console.log('🔄 Running in continuous mode...');
      await runContinuousTests(options);
    } else {
      console.log('🚀 Running single test suite...');
      await runSingleTestSuite(options);
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

/**
 * Run single test suite
 */
async function runSingleTestSuite(options: TestCLIOptions = {}): Promise<void> {
  const startTime = performance.now();
  
  switch (options.type) {
    case 'integration':
      console.log('🧪 Running Integration Tests...');
      const integrationResult = await gameFlowTest.runCompleteTestSuite();
      outputResults(integrationResult, options.output, options.verbose);
      break;
      
    case 'visual':
      console.log('📸 Running Visual Regression Tests...');
      const visualResult = await visualRegressionTest.runVisualTests();
      outputResults(visualResult, options.output, options.verbose);
      break;
      
    case 'unit':
      console.log('🔬 Running Unit Tests...');
      const unitResult = await automatedTestRunner.runUnitTests();
      outputResults(unitResult, options.output, options.verbose);
      break;
      
    case 'performance':
      console.log('⚡ Running Performance Tests...');
      const performanceResult = await automatedTestRunner.runPerformanceTests();
      outputResults(performanceResult, options.output, options.verbose);
      break;
      
    case 'all':
    default:
      console.log('🚀 Running Complete Test Suite...');
      const completeResult = await automatedTestRunner.runCompleteTestSuite();
      outputResults(completeResult, options.output, options.verbose);
      break;
  }
  
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log(`\n✅ Tests completed in ${duration.toFixed(2)}s`);
}

/**
 * Run tests in continuous mode
 */
async function runContinuousTests(options: TestCLIOptions = {}): Promise<void> {
  const interval = options.timeout || 30000; // Default 30 seconds
  
  console.log(`🔄 Starting continuous testing (interval: ${interval}ms)`);
  
  while (true) {
    try {
      const result = await automatedTestRunner.runCompleteTestSuite();
      
      console.log(`\n📊 Test Results (${new Date().toLocaleTimeString()}):`);
      console.log(`Status: ${result.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Success Rate: ${((result.passedTests / result.totalTests) * 100).toFixed(1)}%`);
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
      
      if (!result.overallPassed) {
        console.log('⚠️ Tests failed - Stopping continuous mode');
        break;
      }
      
      console.log(`⏳ Next test run in ${(interval / 1000).toFixed(1)}s...`);
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      console.error('❌ Continuous test error:', error);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

/**
 * Output test results in specified format
 */
function outputResults(result: any, format: string, verbose: boolean): void {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(result, null, 2));
      break;
    case 'junit':
      console.log('📊 JUnit XML Output:');
      console.log('<testsuite name="ColorJellyRushTests">');
      
      if (result.suites) {
        result.suites.forEach((suite: any) => {
          console.log(`  <testsuite name="${suite.name}">`);
          
          if (suite.results) {
            suite.results.forEach((test: any) => {
              console.log(`    <testcase name="${test.name}" classname="${test.passed ? 'passed' : 'failed'}">`);
              console.log(`      <failure message="${test.details}"/>`);
              console.log('    </testcase>');
            });
          }
          
          console.log('  </testsuite>');
        });
      }
      
      console.log('</testsuite>');
      break;
      
    case 'console':
    default:
      if (verbose) {
        console.log('📊 Detailed Results:');
        if (result.suites) {
          result.suites.forEach((suite: any) => {
            console.log(`\n${suite.passed ? '✅' : '❌'} ${suite.name} (${suite.type})`);
            console.log(`  Tests: ${suite.passedTests}/${suite.totalTests}`);
            
            if (suite.results) {
              suite.results.forEach((test: any) => {
                console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}`);
                if (verbose) {
                  console.log(`    Details: ${test.details}`);
                }
              });
            }
          });
        }
      } else {
        console.log(result.summary);
      }
      break;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): TestCLIOptions {
  const args = process.argv.slice(2);
  const options: TestCLIOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--type':
        options.type = args[++i] as any;
        break;
      case '--output':
        options.output = args[++i] as any;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]);
        break;
      case '--continuous':
        options.continuous = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }
  
  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  runTestsCLI(options).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { runTestsCLI, runContinuousTests, parseArgs };
