import { describe, expect, test } from 'vitest';
import { formatDue, isDueAt, parseDue, validateTitle } from './rules';

// Local time, as the user sees it; the expected ISO values are computed by the
// platform's Date, not by the code under test.
const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);
const iso = (y: number, m: number, d: number, h = 0, mi = 0) => local(y, m, d, h, mi).toISOString();

describe('validateTitle', () => {
  test('C8 · trims the title', () => {
    expect(validateTitle('  Rửa xe  ')).toEqual({ ok: true, value: 'Rửa xe' });
  });

  test('C8 · line breaks become spaces, then trim', () => {
    expect(validateTitle('Mua thuốc\nhuyết áp cho bố')).toEqual({ ok: true, value: 'Mua thuốc huyết áp cho bố' });
    expect(validateTitle('\nHọp nhóm\n')).toEqual({ ok: true, value: 'Họp nhóm' });
  });

  test('C8 · an empty title answers "Nhập tên việc"', () => {
    expect(validateTitle('')).toEqual({ ok: false, message: 'Nhập tên việc' });
    expect(validateTitle('   ')).toEqual({ ok: false, message: 'Nhập tên việc' });
    expect(validateTitle('\n \n')).toEqual({ ok: false, message: 'Nhập tên việc' });
  });

  test('C8 · 200 characters pass, over 200 answer "Tên việc tối đa 200 ký tự"', () => {
    const t200 = 'ệ'.repeat(200);
    expect(validateTitle(t200)).toEqual({ ok: true, value: t200 });
    expect(validateTitle('  ' + 'a'.repeat(200) + '  ')).toEqual({ ok: true, value: 'a'.repeat(200) });
    expect(validateTitle('a'.repeat(201))).toEqual({ ok: false, message: 'Tên việc tối đa 200 ký tự' });
  });
});

describe('parseDue', () => {
  test('C8 · both empty give null', () => {
    expect(parseDue('', '')).toEqual({ ok: true, value: null });
    expect(parseDue('  ', ' ')).toEqual({ ok: true, value: null });
  });

  test('C8 · a date d/m/yyyy and a time h:mm in local time give ISO UTC', () => {
    expect(parseDue('27/11/2026', '09:30')).toEqual({ ok: true, value: iso(2026, 11, 27, 9, 30) });
    expect(parseDue('5/1/2027', '8:05')).toEqual({ ok: true, value: iso(2027, 1, 5, 8, 5) });
    expect(parseDue('05/01/2027', '18:00')).toEqual({ ok: true, value: iso(2027, 1, 5, 18, 0) });
    expect(parseDue('31/12/2026', '0:00')).toEqual({ ok: true, value: iso(2026, 12, 31, 0, 0) });
    expect(parseDue('31/12/2026', '23:59')).toEqual({ ok: true, value: iso(2026, 12, 31, 23, 59) });
  });

  test('C8 · the value is an ISO 8601 UTC string', () => {
    const r = parseDue('27/11/2026', '09:30');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
  });

  test('C8 · spaces around date and time are ignored', () => {
    expect(parseDue(' 27/11/2026 ', ' 9:30 ')).toEqual({ ok: true, value: iso(2026, 11, 27, 9, 30) });
  });

  test('C8 · a date without a time is 23:59 that day', () => {
    expect(parseDue('28/11/2026', '')).toEqual({ ok: true, value: iso(2026, 11, 28, 23, 59) });
    expect(parseDue('28/11/2026', '   ')).toEqual({ ok: true, value: iso(2026, 11, 28, 23, 59) });
  });

  test('C8 · a time without a date answers "Chọn ngày cho hạn chót"', () => {
    expect(parseDue('', '09:30')).toEqual({ ok: false, message: 'Chọn ngày cho hạn chót' });
    expect(parseDue('  ', '9:30')).toEqual({ ok: false, message: 'Chọn ngày cho hạn chót' });
  });

  test('C8 · a date not of the form d/m/yyyy answers "Ngày theo dạng dd/mm/yyyy"', () => {
    for (const date of ['2026-11-27', '27/11/26', '27.11.2026', '27/11', 'mai', '123/11/2026', '27/111/2026', '27/11/20266']) {
      expect(parseDue(date, '09:30'), date).toEqual({ ok: false, message: 'Ngày theo dạng dd/mm/yyyy' });
    }
  });

  test('C8 · a date that is not a real day answers "Ngày theo dạng dd/mm/yyyy"', () => {
    for (const date of ['31/02/2026', '29/02/2026', '32/1/2027', '0/1/2027', '15/13/2026', '15/0/2026', '31/11/2026']) {
      expect(parseDue(date, '09:30'), date).toEqual({ ok: false, message: 'Ngày theo dạng dd/mm/yyyy' });
    }
    expect(parseDue('29/02/2028', '09:30')).toEqual({ ok: true, value: iso(2028, 2, 29, 9, 30) });
  });

  test('C8 · a time not of the form h:mm (24-hour) answers "Giờ theo dạng hh:mm"', () => {
    for (const time of ['9h30', '930', '9:5', '09:300', '24:00', '25:00', '9:60', '123:00', 'sáng', '9:30 PM']) {
      expect(parseDue('27/11/2026', time), time).toEqual({ ok: false, message: 'Giờ theo dạng hh:mm' });
    }
  });
});

describe('formatDue', () => {
  const friday = local(2026, 11, 27, 10, 20); // Thứ Sáu, 27 tháng 11

  test('C8 · today: "Hôm nay · 09:30"', () => {
    expect(formatDue(iso(2026, 11, 27, 9, 30), friday)).toBe('Hôm nay · 09:30');
    expect(formatDue(iso(2026, 11, 27, 23, 59), friday)).toBe('Hôm nay · 23:59');
    expect(formatDue(iso(2026, 11, 27, 0, 0), friday)).toBe('Hôm nay · 00:00');
  });

  test('C8 · yesterday: "Hôm qua · 17:00"', () => {
    expect(formatDue(iso(2026, 11, 26, 17, 0), friday)).toBe('Hôm qua · 17:00');
  });

  test('C8 · tomorrow: "Ngày mai · 08:00"', () => {
    expect(formatDue(iso(2026, 11, 28, 8, 0), friday)).toBe('Ngày mai · 08:00');
    expect(formatDue(iso(2026, 11, 28, 0, 0), friday)).toBe('Ngày mai · 00:00');
  });

  test('C8 · within the next 6 days, the weekday: "Thứ Bảy · 11:00"', () => {
    const monday = local(2026, 11, 23, 9, 0);
    expect(formatDue(iso(2026, 11, 28, 11, 0), monday)).toBe('Thứ Bảy · 11:00');
    expect(formatDue(iso(2026, 11, 29, 11, 0), friday)).toBe('Chủ Nhật · 11:00');
    expect(formatDue(iso(2026, 11, 30, 7, 5), friday)).toBe('Thứ Hai · 07:05');
    expect(formatDue(iso(2026, 12, 1, 7, 5), friday)).toBe('Thứ Ba · 07:05');
    expect(formatDue(iso(2026, 12, 2, 7, 5), friday)).toBe('Thứ Tư · 07:05');
    expect(formatDue(iso(2026, 12, 3, 7, 5), friday)).toBe('Thứ Năm · 07:05');
    expect(formatDue(iso(2026, 11, 27, 7, 5), local(2026, 11, 22, 9, 0))).toBe('Thứ Sáu · 07:05');
  });

  test('C8 · otherwise day and month with two digits: "05/12 · 20:00"', () => {
    expect(formatDue(iso(2026, 12, 4, 20, 0), friday)).toBe('04/12 · 20:00'); // 7 days ahead
    expect(formatDue(iso(2026, 12, 5, 20, 0), friday)).toBe('05/12 · 20:00');
    expect(formatDue(iso(2026, 11, 25, 16, 30), friday)).toBe('25/11 · 16:30'); // 2 days ago
    expect(formatDue(iso(2026, 1, 5, 9, 0), friday)).toBe('05/01 · 09:00');
  });

  test('C8 · another year: "05/12/2027 · 20:00"', () => {
    expect(formatDue(iso(2027, 12, 5, 20, 0), friday)).toBe('05/12/2027 · 20:00');
    expect(formatDue(iso(2025, 3, 9, 6, 45), friday)).toBe('09/03/2025 · 06:45');
  });

  test('C8 · across a new year, the relative words and weekdays still apply', () => {
    expect(formatDue(iso(2026, 12, 31, 21, 0), local(2027, 1, 1, 8, 0))).toBe('Hôm qua · 21:00');
    expect(formatDue(iso(2027, 1, 1, 9, 0), local(2026, 12, 31, 8, 0))).toBe('Ngày mai · 09:00');
    expect(formatDue(iso(2027, 1, 2, 9, 0), local(2026, 12, 30, 8, 0))).toBe('Thứ Bảy · 09:00');
  });
});

describe('isDueAt', () => {
  test('C8 · null is a valid due', () => {
    expect(isDueAt(null)).toBe(true);
  });

  test('C8 · an ISO 8601 date-time with a time and Z or ±hh:mm is valid', () => {
    expect(isDueAt('2026-11-27T09:30:00.000Z')).toBe(true);
    expect(isDueAt('2026-11-27T09:30:00Z')).toBe(true);
    expect(isDueAt('2026-11-27T09:30:00+07:00')).toBe(true);
    expect(isDueAt('2026-11-27T09:30:00.000-05:30')).toBe(true);
  });

  test('C8 · anything else is not', () => {
    for (const v of ['2026-11-27', '2026-11-27T09:30:00', '27/11/2026', '', 'mai', '09:30Z']) {
      expect(isDueAt(v), v).toBe(false);
    }
    for (const v of [undefined, 0, 1764212400000, true, {}, []]) {
      expect(isDueAt(v)).toBe(false);
    }
  });
});
