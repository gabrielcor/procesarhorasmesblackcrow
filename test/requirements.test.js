const assert = require('node:assert/strict');
const { test } = require('node:test');
const { computeRequiredMinutes, calculateDayWorkedMinutes } = require('../src/services/time');

const weekly = { requirement_mode: 'weekly', work_days_mask: 114, daily_required_minutes: 480, required_minutes: 7200 };
const slots = [{ slotIndex: 1, currentStartTime: '09:00', currentEndTime: '17:00' }];

test('fixed quotas stay constant across month lengths and holidays, for any employee number', () => {
  for (const month of ['2026-02', '2026-10', '2028-02']) {
    assert.equal(computeRequiredMinutes({ requirement_mode: 'monthly', employee_number: 2, required_minutes: 7215 }, month, new Set([`${month}-01`])), 7215);
  }
});

test('weekly quotas count calendar weekdays and exclude only holidays on selected days', () => {
  assert.equal(computeRequiredMinutes(weekly, '2026-10'), 19 * 480);
  assert.equal(computeRequiredMinutes(weekly, '2026-10', new Set(['2026-10-12', '2026-10-06', '2026-09-28'])), 18 * 480);
  assert.equal(computeRequiredMinutes(weekly, '2027-02', new Set(['2027-02-08'])), 15 * 480);
  assert.equal(computeRequiredMinutes({ ...weekly, work_days_mask: 4, daily_required_minutes: 390 }, '2028-02'), 5 * 390);
  assert.equal(computeRequiredMinutes({ ...weekly, work_days_mask: 127, daily_required_minutes: 1 }, '2028-02'), 29);
});

test('migrated Sunday to Thursday rule reproduces the former number 2 calculation', () => {
  const migrated = { requirement_mode: 'weekly', work_days_mask: 31, daily_required_minutes: 480 };
  assert.equal(computeRequiredMinutes(migrated, '2026-10', new Set(['2026-10-12'])), 20 * 480);
  assert.equal(computeRequiredMinutes(migrated, '2026-02'), 20 * 480);
  assert.equal(computeRequiredMinutes(migrated, '2028-02'), 21 * 480);
});

test('actual work on unselected days contributes fully, without a daily cap from the rule', () => {
  const employee = { ...weekly, daily_required_minutes: 390 };
  assert.equal(calculateDayWorkedMinutes({ workDate: '2026-10-06', dayType: 'N', isHoliday: false, slots }, employee), 480);
  assert.equal(calculateDayWorkedMinutes({ workDate: '2026-10-25', dayType: 'N', isHoliday: false, slots }, employee), 480);
  assert.equal(calculateDayWorkedMinutes({ workDate: '2026-10-12', dayType: 'N', isHoliday: true, slots }, employee), 960);
});

test('leave and vacation credit the configured daily obligation; monthly rules retain eight hours', () => {
  for (const dayType of ['V', 'L']) {
    const employee = { ...weekly, daily_required_minutes: 390 };
    assert.equal(calculateDayWorkedMinutes({ workDate: '2026-10-08', dayType, isHoliday: false, slots: [] }, employee), 390);
    assert.equal(calculateDayWorkedMinutes({ workDate: '2026-10-06', dayType, isHoliday: false, slots: [] }, employee), 0);
    assert.equal(calculateDayWorkedMinutes({ workDate: '2026-10-12', dayType, isHoliday: true, slots: [] }, employee), 0);
    assert.equal(calculateDayWorkedMinutes({ workDate: '2026-10-06', dayType, isHoliday: false, slots: [] }, { requirement_mode: 'monthly' }), 480);
  }
});

test('deleted marks stay excluded and the existing lunch deduction still applies', () => {
  const day = { workDate: '2026-10-06', dayType: 'N', isHoliday: false,
    slots: [{ slotIndex: 2, currentStartTime: '18:00', currentEndTime: '20:00', isDeleted: true },
      { slotIndex: 1, currentStartTime: '09:00', currentEndTime: '19:00' }] };
  assert.equal(calculateDayWorkedMinutes(day, weekly), 540);
});
