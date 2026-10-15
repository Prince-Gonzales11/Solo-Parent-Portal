import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node environment
const mockStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => store,
  };
})();
globalThis.localStorage = mockStorage;

// Import target modules
import { getSafeStoredUser } from '../src/lib/session.js';
import { getErrorMessage } from '../src/lib/api.js';

test('Task 1: getSafeStoredUser handles missing, undefined, and null gracefully', () => {
  mockStorage.clear();
  assert.equal(getSafeStoredUser(), null);

  mockStorage.setItem('user', 'undefined');
  assert.equal(getSafeStoredUser(), null);

  mockStorage.setItem('user', 'null');
  assert.equal(getSafeStoredUser(), null);

  mockStorage.setItem('user', '');
  assert.equal(getSafeStoredUser(), null);
});

test('Task 1: getSafeStoredUser handles malformed JSON without crashing and clears storage', () => {
  mockStorage.clear();
  mockStorage.setItem('user', '{broken: json syntax,');
  mockStorage.setItem('token', 'stale_token_123');

  // Must not throw an unhandled exception
  const user = getSafeStoredUser();
  assert.equal(user, null);
  // Stale corrupted tokens should be cleaned up
  assert.equal(mockStorage.getItem('user'), null);
  assert.equal(mockStorage.getItem('token'), null);
});

test('Task 1: getSafeStoredUser parses valid user sessions and nested data wrappers', () => {
  mockStorage.clear();
  const validUser = { id: 'u-1', email: 'applicant@test.com', role: 'applicant' };
  mockStorage.setItem('user', JSON.stringify(validUser));
  assert.deepEqual(getSafeStoredUser(), validUser);

  // Nested wrapper from old session format
  const nestedUser = { data: { id: 'u-2', email: 'admin@test.com', role: 'admin' } };
  mockStorage.setItem('user', JSON.stringify(nestedUser));
  assert.deepEqual(getSafeStoredUser(), nestedUser.data);
});

test('Task 2: getErrorMessage handles 403 authorization messages without claiming session expired', () => {
  // Case A: Detail starts with "Unauthorized. Only super administrators..."
  const err1 = {
    response: {
      status: 403,
      data: {
        detail: 'Unauthorized. Only super administrators can modify user roles.',
      },
    },
  };
  const msg1 = getErrorMessage(err1);
  assert.equal(msg1, 'Only super administrators can modify user roles.');
  assert.ok(!msg1.includes('session has expired'));

  // Case B: Standard Laravel authorization message
  const err2 = {
    response: {
      status: 403,
      data: {
        message: 'This action is unauthorized.',
      },
    },
  };
  const msg2 = getErrorMessage(err2);
  assert.equal(msg2, 'This action is unauthorized.');
  assert.ok(!msg2.includes('session has expired'));

  // Case C: Generic 403 without detail
  const err3 = {
    response: {
      status: 403,
      data: {},
    },
  };
  const msg3 = getErrorMessage(err3);
  assert.equal(msg3, 'You do not have permission to perform this action.');
  assert.ok(!msg3.includes('session has expired'));
});

test('Task 2: getErrorMessage handles 403 account deactivation appropriately', () => {
  const err = {
    response: {
      status: 403,
      data: {
        detail: 'This account has been deactivated.',
      },
    },
  };
  assert.equal(getErrorMessage(err), 'This account has been deactivated. Please contact the CSWDD office for assistance.');
});

test('Task 2: getErrorMessage handles 401 session expiration and credentials correctly', () => {
  const expiredErr = {
    response: {
      status: 401,
      data: {
        detail: 'Token has expired',
      },
    },
  };
  assert.equal(getErrorMessage(expiredErr), 'Your session has expired. Please sign in again.');

  const credsErr = {
    response: {
      status: 401,
      data: {
        detail: 'Invalid email, mobile number, or password.',
      },
    },
  };
  assert.equal(getErrorMessage(credsErr), 'Invalid email, mobile number, or password.');
});

test('Task 2: getErrorMessage extracts Laravel 422 validation errors bag', () => {
  const validationErr = {
    response: {
      status: 422,
      data: {
        message: 'The given data was invalid.',
        errors: {
          phone_number: ['The mobile number must be a valid Philippine mobile number.'],
        },
      },
    },
  };
  const msg = getErrorMessage(validationErr);
  assert.equal(msg, 'The mobile number must be a valid Philippine mobile number.');
});
