// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DueFields, dueToFields } from './DueFields';

afterEach(cleanup);

describe('DueFields', () => {
  test("C8 · draws the Field 'Ngày hạn' (dd/mm/yyyy, <prefix>-date) and the Field 'Giờ' (hh:mm, <prefix>-time)", () => {
    render(<DueFields idPrefix="add" value={{ date: '27/11/2026', time: '09:30' }} onChange={() => {}} />);
    const date = screen.getByLabelText('Ngày hạn') as HTMLInputElement;
    const time = screen.getByLabelText('Giờ') as HTMLInputElement;
    expect(date.id).toBe('add-date');
    expect(date.placeholder).toBe('dd/mm/yyyy');
    expect(date.value).toBe('27/11/2026');
    expect(time.id).toBe('add-time');
    expect(time.placeholder).toBe('hh:mm');
    expect(time.value).toBe('09:30');
    expect(date.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('C8 · the fields are siblings with no wrapper: two children without an error, three with one', () => {
    const { container, rerender } = render(
      <div data-testid="form">
        <DueFields idPrefix="edit" value={{ date: '', time: '' }} onChange={() => {}} />
      </div>,
    );
    const form = container.querySelector('[data-testid="form"]')!;
    expect(form.children).toHaveLength(2);
    expect(form.children[0].contains(screen.getByLabelText('Ngày hạn'))).toBe(true);
    expect(form.children[1].contains(screen.getByLabelText('Giờ'))).toBe(true);

    rerender(
      <div data-testid="form">
        <DueFields idPrefix="edit" value={{ date: '', time: '9:30' }} onChange={() => {}} error="Chọn ngày cho hạn chót" />
      </div>,
    );
    expect(form.children).toHaveLength(3);
    const p = form.children[2];
    expect(p.tagName).toBe('P');
    expect(p.id).toBe('edit-due-error');
    expect(p.textContent).toBe('Chọn ngày cho hạn chót');
  });

  test('C8 · onChange gets the whole { date, time } with the edited part', () => {
    const onChange = vi.fn();
    render(<DueFields idPrefix="add" value={{ date: '27/11/2026', time: '' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Giờ'), { target: { value: '17:00' } });
    expect(onChange).toHaveBeenLastCalledWith({ date: '27/11/2026', time: '17:00' });
    fireEvent.change(screen.getByLabelText('Ngày hạn'), { target: { value: '28/11/2026' } });
    expect(onChange).toHaveBeenLastCalledWith({ date: '28/11/2026', time: '' });
  });

  test('C8 · an error marks both fields invalid and shows in <p id="<prefix>-due-error">', () => {
    render(<DueFields idPrefix="add" value={{ date: '31/02/2026', time: '' }} onChange={() => {}} error="Ngày theo dạng dd/mm/yyyy" />);
    expect(screen.getByLabelText('Ngày hạn').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Giờ').getAttribute('aria-invalid')).toBe('true');
    const p = document.getElementById('add-due-error');
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe('Ngày theo dạng dd/mm/yyyy');
  });

  test('C8 · invalid marks both fields with no message', () => {
    render(<DueFields idPrefix="add" value={{ date: '', time: '' }} onChange={() => {}} invalid />);
    expect(screen.getByLabelText('Ngày hạn').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Giờ').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('add-due-error')).toBeNull();
  });

  test('C8 · with neither, no field is invalid and there is no message', () => {
    render(<DueFields idPrefix="add" value={{ date: '', time: '' }} onChange={() => {}} />);
    expect(screen.getByLabelText('Ngày hạn').getAttribute('aria-invalid')).not.toBe('true');
    expect(screen.getByLabelText('Giờ').getAttribute('aria-invalid')).not.toBe('true');
    expect(document.getElementById('add-due-error')).toBeNull();
  });
});

describe('dueToFields', () => {
  test('C8 · null gives empty date and time', () => {
    expect(dueToFields(null)).toEqual({ date: '', time: '' });
  });

  test('C8 · an ISO due gives the local date as dd/mm/yyyy and time as hh:mm', () => {
    expect(dueToFields(new Date(2026, 10, 27, 9, 5).toISOString())).toEqual({ date: '27/11/2026', time: '09:05' });
    expect(dueToFields(new Date(2027, 0, 5, 23, 59).toISOString())).toEqual({ date: '05/01/2027', time: '23:59' });
  });
});
