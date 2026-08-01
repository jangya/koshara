import {describe, expect, it} from 'vitest';

import {createFinancialAccountSchema, createPersonSchema} from './models';

describe('createPersonSchema', () => {
  it('trims a valid household person', () => {
    expect(createPersonSchema.parse({displayName: '  Mira  ', type: 'member'})).toEqual({
      displayName: 'Mira',
      type: 'member',
    });
  });

  it('rejects blank names', () => {
    expect(() => createPersonSchema.parse({displayName: ' ', type: 'member'})).toThrow();
  });

  it('strips server-owned Clerk identity fields from client input', () => {
    expect(
      createPersonSchema.parse({
        displayName: 'Household member',
        type: 'member',
        linkedClerkUserId: 'user_spoofed',
      }),
    ).toEqual({displayName: 'Household member', type: 'member'});
  });
});

describe('createFinancialAccountSchema', () => {
  it('accepts only supported account types and ISO-style currencies', () => {
    const input = {
      institutionName: 'HDFC Bank',
      displayName: 'Household savings',
      accountType: 'savings',
      currency: 'inr',
      primaryPersonId: '0f9f1ad3-6a52-4f06-8f42-7f650fab5ae2',
      joint: false,
      additionalPersonIds: [],
    };

    expect(createFinancialAccountSchema.parse(input).currency).toBe('INR');
    expect(() => createFinancialAccountSchema.parse({...input, accountType: 'loan'})).toThrow();
  });

  it('rejects complete-looking account references', () => {
    expect(() =>
      createFinancialAccountSchema.parse({
        institutionName: 'Example Bank',
        displayName: 'Primary',
        accountType: 'current',
        currency: 'INR',
        primaryPersonId: '0f9f1ad3-6a52-4f06-8f42-7f650fab5ae2',
        maskedReference: '123456789012',
        joint: false,
        additionalPersonIds: [],
      }),
    ).toThrow();
  });

  it('requires another holder for a joint account', () => {
    expect(() =>
      createFinancialAccountSchema.parse({
        institutionName: 'Example Bank',
        displayName: 'Joint savings',
        accountType: 'savings',
        currency: 'INR',
        primaryPersonId: '0f9f1ad3-6a52-4f06-8f42-7f650fab5ae2',
        joint: true,
        additionalPersonIds: [],
      }),
    ).toThrow('A joint account requires at least one additional holder');
  });
});
