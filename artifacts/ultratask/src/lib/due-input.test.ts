import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueFromInputs, istInputParts, isFutureIso, isValidDateInput, isValidTimeInput } from './due-input.ts';

const NOW = Date.UTC(2025, 0, 15, 6, 0); // 11:30 IST, 15 Jan 2025

test('IST input -> UTC ISO', () => {
  assert.deepEqual(dueFromInputs('2025-01-15', '18:00', NOW), { ok: true, iso: '2025-01-15T12:30:00.000Z' });
  assert.deepEqual(dueFromInputs('2025-01-16', '00:00', NOW), { ok: true, iso: '2025-01-15T18:30:00.000Z' });
  assert.deepEqual(dueFromInputs('2025-01-16', '05:29', NOW), { ok: true, iso: '2025-01-15T23:59:00.000Z' });
  assert.deepEqual(dueFromInputs('2025-12-31', '23:59', NOW), { ok: true, iso: '2025-12-31T18:29:00.000Z' });
  assert.deepEqual(dueFromInputs('2028-02-29', '10:00', NOW), { ok: true, iso: '2028-02-29T04:30:00.000Z' });
});
test('rejects blank/malformed/past', () => {
  for (const [d, t] of [['', '18:00'], ['2025-01-16', ''], ['2025-02-30', '10:00'], ['2027-02-29', '10:00'], ['2025-1-16', '10:00'], ['2025-01-16', '24:00'], ['2025-01-16', '9:00'], ['2025-01-16', '10:60'], ['2025-01-15', '11:30'], ['2025-01-14', '18:00']]) {
    assert.equal(dueFromInputs(d, t, NOW).ok, false, `${d} ${t}`);
  }
  assert.equal(dueFromInputs('2025-01-15', '11:31', NOW).ok, true);
});
test('ISO -> IST parts round trip', () => {
  assert.deepEqual(istInputParts('2025-01-15T18:30:00.000Z'), { date: '2025-01-16', time: '00:00' });
  assert.deepEqual(istInputParts('2025-01-15T12:30:00Z'), { date: '2025-01-15', time: '18:00' });
  assert.deepEqual(istInputParts(''), { date: '', time: '' });
  assert.deepEqual(istInputParts(null), { date: '', time: '' });
  assert.deepEqual(istInputParts('garbage'), { date: '', time: '' });
  const r = dueFromInputs('2026-03-01', '07:45', NOW);
  assert.ok(r.ok && istInputParts(r.iso).date === '2026-03-01' && istInputParts(r.iso).time === '07:45');
});
test('validators and future check', () => {
  assert.ok(isValidDateInput('2024-02-29') && !isValidDateInput('2023-02-29'));
  assert.ok(isValidTimeInput('00:00') && isValidTimeInput('23:59') && !isValidTimeInput('23:5'));
  assert.ok(isFutureIso('2025-01-15T06:01:00Z', NOW));
  assert.ok(!isFutureIso('2025-01-15T06:00:00Z', NOW) && !isFutureIso('', NOW) && !isFutureIso('x', NOW));
});
