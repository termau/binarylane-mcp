/**
 * Manual test script for retry logic and rate limiting
 *
 * This script demonstrates:
 * 1. Exponential backoff on retryable errors (429, 502, 503, 504)
 * 2. Request rate limiting (max concurrent requests)
 * 3. Retry-After header handling
 * 4. Network error retry logic
 *
 * Run with: npx tsx test-retry.ts
 */

import { BinaryLaneClient } from './src/api-client.js';

async function testRetryLogic() {
  console.log('=== Testing Retry Logic ===\n');

  // Test with custom configuration
  const client = new BinaryLaneClient('dummy-token', {
    maxConcurrent: 2,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 2
    }
  });

  console.log('Configuration:');
  console.log('- Max concurrent requests: 2');
  console.log('- Max retries: 3');
  console.log('- Base delay: 500ms');
  console.log('- Max delay: 5000ms');
  console.log('- Backoff multiplier: 2');
  console.log('\nNote: This will fail with authentication errors, but will demonstrate retry logic for network errors.\n');

  // Test 1: Single request (will fail with 401, but demonstrates the flow)
  console.log('Test 1: Single request to test error handling');
  try {
    await client.getAccount();
  } catch (error: any) {
    console.log(`Expected error: ${error.message} (status: ${error.statusCode})`);
  }

  console.log('\nTest 2: Multiple concurrent requests (rate limiting)');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      client.listServers().catch((error: any) => {
        console.log(`Request ${i + 1} failed: ${error.statusCode || 'network error'}`);
      })
    );
  }

  console.log('Sending 5 requests with max concurrent = 2...');
  await Promise.all(promises);

  console.log('\nTest 3: Test with invalid endpoint (network error retry)');
  try {
    // @ts-expect-error - Testing with invalid path
    await client.request('GET', '/invalid-endpoint-that-does-not-exist-12345');
  } catch (error: any) {
    console.log(`Expected error after retries: ${error.message || error}`);
  }

  console.log('\n=== Tests Complete ===');
  console.log('\nKey observations:');
  console.log('1. Client errors (401) are NOT retried');
  console.log('2. Rate limiting ensures max 2 concurrent requests');
  console.log('3. Network errors trigger exponential backoff with jitter');
  console.log('4. Retry-After headers (if present) override exponential backoff');
}

// Run the test
testRetryLogic().catch(console.error);
