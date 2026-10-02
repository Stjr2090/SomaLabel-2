import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRawExpiryString, analyzeExpiry, getLastDayOfMonth } from '../src/lib/expiry.ts';

// Reference date for deterministic tests: October 2, 2026
const FIXED_NOW = new Date('2026-10-02T12:00:00.000Z');

test('Expiry Parser - All User Specified Formats', async (t) => {
  await t.test('Format 1: "EXP 03/2027"', () => {
    const parsed = parseRawExpiryString('EXP 03/2027');
    assert.ok(parsed);
    assert.equal(parsed.year, 2027);
    assert.equal(parsed.month, 3);
    assert.equal(parsed.isMonthOnly, true);

    const result = analyzeExpiry('EXP 03/2027', FIXED_NOW);
    assert.equal(result.status, 'valid');
    assert.equal(result.badgeLabel, 'Valid');
    assert.equal(result.color, 'green');
    assert.equal(result.words, 'Expires end of March 2027');
    // March has 31 days
    assert.ok(result.parsedDate?.startsWith('2027-03-31'));
  });

  await t.test('Format 2: "03/27"', () => {
    const parsed = parseRawExpiryString('03/27');
    assert.ok(parsed);
    assert.equal(parsed.year, 2027);
    assert.equal(parsed.month, 3);
    assert.equal(parsed.isMonthOnly, true);

    const result = analyzeExpiry('03/27', FIXED_NOW);
    assert.equal(result.status, 'valid');
    assert.equal(result.words, 'Expires end of March 2027');
  });

  await t.test('Format 3: "2027-03"', () => {
    const parsed = parseRawExpiryString('2027-03');
    assert.ok(parsed);
    assert.equal(parsed.year, 2027);
    assert.equal(parsed.month, 3);
    assert.equal(parsed.isMonthOnly, true);

    const result = analyzeExpiry('2027-03', FIXED_NOW);
    assert.equal(result.status, 'valid');
    assert.equal(result.words, 'Expires end of March 2027');
  });

  await t.test('Format 4: "MAR 2027"', () => {
    const parsed = parseRawExpiryString('MAR 2027');
    assert.ok(parsed);
    assert.equal(parsed.year, 2027);
    assert.equal(parsed.month, 3);
    assert.equal(parsed.isMonthOnly, true);

    const result = analyzeExpiry('MAR 2027', FIXED_NOW);
    assert.equal(result.status, 'valid');
    assert.equal(result.words, 'Expires end of March 2027');
  });

  await t.test('Format 5: "12.05.2026" (Expired relative to Oct 2, 2026)', () => {
    const parsed = parseRawExpiryString('12.05.2026');
    assert.ok(parsed);
    assert.equal(parsed.year, 2026);
    assert.equal(parsed.month, 5);
    assert.equal(parsed.day, 12);
    assert.equal(parsed.isMonthOnly, false);

    const result = analyzeExpiry('12.05.2026', FIXED_NOW);
    assert.equal(result.status, 'expired');
    assert.equal(result.badgeLabel, 'Expired');
    assert.equal(result.color, 'red');
    assert.equal(result.words, 'Expired 12 May 2026');
  });

  await t.test('Format 6: "EXP: 2027/03/31"', () => {
    const parsed = parseRawExpiryString('EXP: 2027/03/31');
    assert.ok(parsed);
    assert.equal(parsed.year, 2027);
    assert.equal(parsed.month, 3);
    assert.equal(parsed.day, 31);
    assert.equal(parsed.isMonthOnly, false);

    const result = analyzeExpiry('EXP: 2027/03/31', FIXED_NOW);
    assert.equal(result.status, 'valid');
    assert.equal(result.badgeLabel, 'Valid');
    assert.equal(result.words, 'Expires 31 March 2027');
  });
});

test('Expiry Parser - Badge States & Boundaries', async (t) => {
  await t.test('Expired badge (red) - Month only date in past', () => {
    const result = analyzeExpiry('02/2026', FIXED_NOW);
    assert.equal(result.status, 'expired');
    assert.equal(result.color, 'red');
    assert.equal(result.badgeLabel, 'Expired');
    assert.equal(result.words, 'Expired end of February 2026');
  });

  await t.test('Expires within 90 days badge (amber)', () => {
    // FIXED_NOW is Oct 2, 2026. Nov 30, 2026 is ~59 days away (within 90 days)
    const result = analyzeExpiry('NOV 2026', FIXED_NOW);
    assert.equal(result.status, 'expiring_soon');
    assert.equal(result.color, 'amber');
    assert.equal(result.badgeLabel, 'Expires within 90 days');
    assert.equal(result.words, 'Expires end of November 2026');
  });

  await t.test('Valid badge (green) - more than 90 days ahead', () => {
    // May 2027 is ~7 months away (> 90 days)
    const result = analyzeExpiry('05/2027', FIXED_NOW);
    assert.equal(result.status, 'valid');
    assert.equal(result.color, 'green');
    assert.equal(result.badgeLabel, 'Valid');
    assert.equal(result.words, 'Expires end of May 2027');
  });

  await t.test('Expiry date not found badge (grey) - null / empty / unparseable', () => {
    const nullResult = analyzeExpiry(null, FIXED_NOW);
    assert.equal(nullResult.status, 'not_found');
    assert.equal(nullResult.color, 'grey');
    assert.equal(nullResult.badgeLabel, 'Expiry date not found');
    assert.equal(nullResult.words, 'Expiry date not found on label');

    const emptyResult = analyzeExpiry('', FIXED_NOW);
    assert.equal(emptyResult.status, 'not_found');

    const unparseable = analyzeExpiry('NOT_A_DATE', FIXED_NOW);
    assert.equal(unparseable.status, 'not_found');
  });

  await t.test('Leap year end of February calculation', () => {
    // 2028 is a leap year -> 29 days
    assert.equal(getLastDayOfMonth(2028, 2), 29);
    // 2027 is not a leap year -> 28 days
    assert.equal(getLastDayOfMonth(2027, 2), 28);
  });
});
