// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, Field } from './Field';

afterEach(cleanup);

describe('Field', () => {
  test('C8 · draws a label tied to a text input with the given id, value and placeholder', () => {
    render(<Field id="add-title" label="Việc mới" value="Rửa xe" placeholder="Thêm một việc…" onChange={() => {}} />);
    const input = screen.getByLabelText('Việc mới') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.id).toBe('add-title');
    expect(input.type).toBe('text');
    expect(input.value).toBe('Rửa xe');
    expect(input.placeholder).toBe('Thêm một việc…');
  });

  test('C8 · passes type, autoComplete and inputMode to the input', () => {
    render(
      <Field id="in-email" label="Email" type="email" autoComplete="email" inputMode="email" value="" onChange={() => {}} />,
    );
    const input = screen.getByLabelText('Email') as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.getAttribute('autocomplete')).toBe('email');
    expect(input.getAttribute('inputmode')).toBe('email');
  });

  test('C8 · onChange receives the new value as a string', () => {
    const onChange = vi.fn();
    render(<Field id="t" label="Tên việc" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Tên việc'), { target: { value: 'Mua thuốc' } });
    expect(onChange).toHaveBeenCalledWith('Mua thuốc');
  });

  test('C8 · onKeyDown is called on key presses', () => {
    const onKeyDown = vi.fn();
    render(<Field id="t" label="Tên việc" value="" onChange={() => {}} onKeyDown={onKeyDown} />);
    fireEvent.keyDown(screen.getByLabelText('Tên việc'), { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown.mock.calls[0][0].key).toBe('Enter');
  });

  test('C8 · multiline draws a text area with the given rows', () => {
    const onChange = vi.fn();
    render(<Field id="ed-title" label="Tên việc" multiline rows={3} value="Họp nhóm" onChange={onChange} />);
    const area = screen.getByLabelText('Tên việc') as HTMLTextAreaElement;
    expect(area.tagName).toBe('TEXTAREA');
    expect(area.rows).toBe(3);
    expect(area.value).toBe('Họp nhóm');
    fireEvent.change(area, { target: { value: 'Họp nhóm quý 1' } });
    expect(onChange).toHaveBeenCalledWith('Họp nhóm quý 1');
  });

  test('C8 · without error or invalid the input is not marked invalid', () => {
    render(<Field id="t" label="Tên việc" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Tên việc');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  test('C8 · an error shows under the input, sets aria-invalid and aria-describedby pointing at it', () => {
    const { container } = render(
      <Field id="add-title" label="Việc mới" value="" onChange={() => {}} error="Nhập tên việc" />,
    );
    const input = screen.getByLabelText('Việc mới');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = container.ownerDocument.getElementById(describedBy!);
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toBe('Nhập tên việc');
    // under it: the error comes after the input in the document
    expect(input.compareDocumentPosition(errorEl!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('C8 · the error may hold a link', () => {
    render(
      <Field
        id="up-email"
        label="Email"
        value="thu.ha@example.com"
        onChange={() => {}}
        error={
          <>
            Email này đã có tài khoản. <a href="/dang-nhap">Đăng nhập</a>
          </>
        }
      />,
    );
    const link = screen.getByRole('link', { name: 'Đăng nhập' });
    expect(link.getAttribute('href')).toBe('/dang-nhap');
    const input = screen.getByLabelText('Email');
    const errorEl = document.getElementById(input.getAttribute('aria-describedby')!);
    expect(errorEl!.contains(link)).toBe(true);
  });

  test('C8 · invalid without an error sets aria-invalid and no aria-describedby', () => {
    render(<Field id="add-date" label="Ngày hạn" value="" onChange={() => {}} invalid />);
    const input = screen.getByLabelText('Ngày hạn');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('Button', () => {
  test('C8 · every variant draws a button with its children and calls onClick', () => {
    for (const variant of ['primary', 'quiet', 'link'] as const) {
      const onClick = vi.fn();
      render(
        <Button variant={variant} onClick={onClick}>
          {`Nút ${variant}`}
        </Button>,
      );
      const btn = screen.getByRole('button', { name: `Nút ${variant}` });
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  test('C8 · type is passed to the button', () => {
    render(
      <Button variant="primary" type="submit">
        Thêm
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Thêm' }).getAttribute('type')).toBe('submit');
  });

  test('C8 · a disabled button is disabled and does not call onClick', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Lưu
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
