import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateGoal,
  isValidIsoDay,
  normalizeRecords,
  normalizeWeight,
  shouldSendReminder,
} from '../lib/water.ts';

void test('คำนวณเป้าหมายตามน้ำหนักและกิจกรรม', () => {
  assert.equal(calculateGoal(60, 'medium'), 2450);
  assert.equal(calculateGoal(70, 'high'), 3150);
  assert.equal(calculateGoal(50, 'low'), 1750);
});

void test('จำกัดน้ำหนักให้อยู่ในช่วงที่รองรับ', () => {
  assert.equal(normalizeWeight(10), 30);
  assert.equal(normalizeWeight(300), 250);
  assert.equal(normalizeWeight(Number.NaN), 60);
});

void test('ตรวจสอบวันที่จริงและปฏิเสธวันที่ที่ไม่มีอยู่', () => {
  assert.equal(isValidIsoDay('2026-08-31'), true);
  assert.equal(isValidIsoDay('2026-02-29'), false);
  assert.equal(isValidIsoDay('31-08-2026'), false);
});

void test('ทำความสะอาดข้อมูลที่เสียโดยไม่ทำให้แอปล่ม', () => {
  const records = normalizeRecords([
    {
      date: '2026-08-31',
      goal: 2450,
      logs: [
        { id: 'ok', amount: 250, at: '2026-08-31T01:00:00.000Z' },
        { id: 'bad', amount: 6000, at: '2026-08-31T02:00:00.000Z' },
      ],
    },
    { date: '2026-02-30', goal: 2000, logs: [] },
  ]);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.logs.length, 1);
  assert.equal(records[0]?.logs[0]?.amount, 250);
});

void test('แจ้งเตือนเฉพาะช่วงเวลาและเมื่อดื่มช้ากว่าแผน', () => {
  const atTen = new Date(2026, 7, 31, 10, 0);
  assert.equal(
    shouldSendReminder({
      now: atTen,
      consumed: 0,
      goal: 3000,
      lastReminderAt: 0,
    }),
    true,
  );
  assert.equal(
    shouldSendReminder({
      now: atTen,
      consumed: 3000,
      goal: 3000,
      lastReminderAt: 0,
    }),
    false,
  );
  assert.equal(
    shouldSendReminder({
      now: atTen,
      consumed: 0,
      goal: 3000,
      lastReminderAt: atTen.getTime() - 30 * 60 * 1000,
    }),
    false,
  );
});
