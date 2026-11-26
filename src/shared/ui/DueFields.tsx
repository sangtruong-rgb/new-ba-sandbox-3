// DueFields: the date and time fields of a due, as three siblings the form lays out.
import type { ReactNode } from 'react';
import { Field } from './Field';
import s from './Field.module.css';

export type DueValue = { date: string; time: string };

export function DueFields({
  idPrefix,
  value,
  onChange,
  error,
  invalid,
}: {
  idPrefix: string;
  value: DueValue;
  onChange: (v: DueValue) => void;
  error?: ReactNode;
  invalid?: boolean;
}) {
  const hasError = error !== undefined && error !== null && error !== false && error !== '';
  const bad = hasError || !!invalid;
  return (
    <>
      <Field
        id={`${idPrefix}-date`}
        label="Ngày hạn"
        placeholder="dd/mm/yyyy"
        inputMode="numeric"
        value={value.date}
        onChange={(date) => onChange({ ...value, date })}
        invalid={bad}
      />
      <Field
        id={`${idPrefix}-time`}
        label="Giờ"
        placeholder="hh:mm"
        inputMode="numeric"
        value={value.time}
        onChange={(time) => onChange({ ...value, time })}
        invalid={bad}
      />
      {hasError ? (
        <p className={s.error} id={`${idPrefix}-due-error`}>
          {error}
        </p>
      ) : null}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A due as the two fields show it: local dd/mm/yyyy and hh:mm, or empty. */
export function dueToFields(dueAt: string | null): DueValue {
  if (dueAt === null) return { date: '', time: '' };
  const x = new Date(dueAt);
  return {
    date: `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`,
    time: `${pad(x.getHours())}:${pad(x.getMinutes())}`,
  };
}
