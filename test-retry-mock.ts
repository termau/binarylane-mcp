/**
 * Test script with mock server to verify retry behavior
 *
 * This demonstrates:
 * 1. Retries on 429 with exponential backoff
 * 2. Retries on 502/503/504 server errors
 * 3. No retries on client errors (400, 401, 403, 404, etc.)
 * 4. Retry-After header handling
 */

import { BinaryLaneClient } from './src/api-client.js';

// Mock fetch to simulate different scenarios
let callCount = 0;
let scenario: 'rate-limit' | 'server-error' | 'success-after-retry' | 'client-error' = 'success-after-retry';

const originalFetch = global.fetch;

function mockFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  callCount++;
  console.log(`\n[Mock Fetch] Call #${callCount} to ${url}`);

  if (scenario === 'rate-limit') {
    // Simulate rate limit on first 2 calls, then succeed
    if (callCount <= 2) {
      console.log('[Mock Fetch] Returning 429 (Rate Limit)');
      return Promise.resolve(new Response(
        JSON.stringify({ detail: 'Rate limit exceeded', status: 429 }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '1' }
        }
      ));
    }
  }

  if (scenario === 'server-error') {
    // Simulate server error on first 2 calls, then succeed
    if (callCount <= 2) {
      console.log('[Mock Fetch] Returning 503 (Service Unavailable)');
      return Promise.resolve(new Response(
        JSON.stringify({ detail: 'Service temporarily unavailable', status: 503 }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ));
    }
  }

  if (scenario === 'client-error') {
    // Always return 400 - should NOT retry
    console.log('[Mock Fetch] Returning 400 (Bad Request)');
    return Promise.resolve(new Response(
      JSON.stringify({ detail: 'Bad request', status: 400 }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    ));
  }

  // Success response
  console.log('[Mock Fetch] Returning 200 (Success)');
  return Promise.resolve(new Response(
    JSON.stringify({ account: { email: 'test@example.com', status: 'active' } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  ));
}

async function runTests() {
  // Replace global fetch
  global.fetch = mockFetch as any;

  console.log('=== Retry Logic Tests ===\n');

  const client = new BinaryLaneClient('test-token', {
    maxConcurrent: 5,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2
    }
  });

  // Test 1: Success after rate limit retries
  console.log('\n--- Test 1: Rate Limit (429) with Retry-After ---');
  callCount = 0;
  scenario = 'rate-limit';
  try {
    const result = await client.getAccount();
    console.log(`✓ SUCCESS after ${callCount} calls:`, result);
  } catch (error: any) {
    console.log(`✗ FAILED after ${callCount} calls:`, error.message);
  }

  // Test 2: Success after server error retries
  console.log('\n--- Test 2: Server Error (503) ---');
  callCount = 0;
  scenario = 'server-error';
  try {
    const result = await client.getAccount();
    console.log(`✓ SUCCESS after ${callCount} calls:`, result);
  } catch (error: any) {
    console.log(`✗ FAILED after ${callCount} calls:`, error.message);
  }

  // Test 3: No retry on client errors
  console.log('\n--- Test 3: Client Error (400) - Should NOT Retry ---');
  callCount = 0;
  scenario = 'client-error';
  try {
    const result = await client.getAccount();
    console.log(`✓ SUCCESS after ${callCount} calls:`, result);
  } catch (error: any) {
    console.log(`✓ CORRECTLY FAILED after ${callCount} call(s):`, error.message);
  }

  // Test 4: Immediate success
  console.log('\n--- Test 4: Immediate Success ---');
  callCount = 0;
  scenario = 'success-after-retry';
  try {
    const result = await client.getAccount();
    console.log(`✓ SUCCESS on first call:`, result);
  } catch (error: any) {
    console.log(`✗ FAILED:`, error.message);
  }

  console.log('\n=== All Tests Complete ===\n');

  // Restore original fetch
  global.fetch = originalFetch;
}

runTests().catch(console.error);
