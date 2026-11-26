// TaskRules: the title and due rules, their messages and the due text. Used by the
// client and the server routes.

export const TITLE_MAX = 200;

export function validateTitle(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.replace(/\r\n|\r|\n/g, ' ').trim();
  if (value === '') return { ok: false, message: 'Nhập tên việc' };
  if ([...value].length > TITLE_MAX) return { ok: false, message: 'Tên việc tối đa 200 ký tự' };
  return { ok: true, value };
}

const DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const TIME = /^(\d{1,2}):(\d{2})$/;

export function parseDue(date: string, time: string): { ok: true; value: string | null } | { ok: false; message: string } {
  const d = date.trim();
  const t = time.trim();
  if (d === '' && t === '') return { ok: true, value: null };
  if (d === '') return { ok: false, message: 'Chọn ngày cho hạn chót' };

  const dm = DATE.exec(d);
  if (!dm) return { ok: false, message: 'Ngày theo dạng dd/mm/yyyy' };
  const [day, month, year] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const probe = new Date(year, month - 1, day);
  if (month < 1 || month > 12 || probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return { ok: false, message: 'Ngày theo dạng dd/mm/yyyy' };
  }

  let hour = 23;
  let minute = 59;
  if (t !== '') {
    const tm = TIME.exec(t);
    if (!tm || Number(tm[1]) > 23 || Number(tm[2]) > 59) return { ok: false, message: 'Giờ theo dạng hh:mm' };
    hour = Number(tm[1]);
    minute = Number(tm[2]);
  }
  return { ok: true, value: new Date(year, month - 1, day, hour, minute).toISOString() };
}

export const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const pad = (n: number) => String(n).padStart(2, '0');
const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());

export function formatDue(dueAt: string, now: Date): string {
  const x = new Date(dueAt);
  const days = Math.round((startOfDay(x).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const hm = `${pad(x.getHours())}:${pad(x.getMinutes())}`;
  if (days === 0) return `Hôm nay · ${hm}`;
  if (days === -1) return `Hôm qua · ${hm}`;
  if (days === 1) return `Ngày mai · ${hm}`;
  if (days > 1 && days <= 6) return `${WEEKDAYS[x.getDay()]} · ${hm}`;
  const dm = `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
  return x.getFullYear() === now.getFullYear() ? `${dm} · ${hm}` : `${dm}/${x.getFullYear()} · ${hm}`;
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isDueAt(value: unknown): boolean {
  if (value === null) return true;
  return typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
}
