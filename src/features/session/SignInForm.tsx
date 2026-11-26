// sign-in-form on /dang-nhap: the heading, a line above the first field (session ended,
// wrong credentials, no answer), Email, Mật khẩu, Đăng nhập and the link to sign up.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../app/session';
import { createLogger } from '../../app/log';
import { api, ApiError } from '../../shared/api';
import { Button, Field } from '../../shared/ui/Field';
import s from './SignInForm.module.css';

export const WRONG = 'Email hoặc mật khẩu không đúng.';
export const ENDED = 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.';
export const FAILED = 'Không đăng nhập được. Thử lại.';
export const NEED_EMAIL = 'Nhập email';
export const NEED_PASSWORD = 'Nhập mật khẩu';

const EMAIL_ID = 'in-email';
const PASSWORD_ID = 'in-pass';

const log = createLogger('[session]');

export function SignInForm() {
  const [params] = useSearchParams();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Which field gets focus after the next render, and a counter so the same field can be asked twice.
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);

  const ended = params.get('het-phien') === '1' && !sent;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: { email?: string; password?: string } = {};
    if (email.trim() === '') next.email = NEED_EMAIL;
    if (password === '') next.password = NEED_PASSWORD;
    setErrors(next);
    if (next.email || next.password) {
      setFocus((f) => ({ id: next.email ? EMAIL_ID : PASSWORD_ID, n: (f?.n ?? 0) + 1 }));
      return;
    }

    setSent(true);
    setFailure(null);
    setBusy(true);
    try {
      await api('POST', '/api/auth/sign-in', { email: email.trim(), password });
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 401) {
        setFailure(WRONG);
        setPassword('');
        setFocus((f) => ({ id: PASSWORD_ID, n: (f?.n ?? 0) + 1 }));
      } else {
        log.error('sign-in failed', err);
        setFailure(FAILED);
      }
      return;
    }
    // The session now has the user: the gate goes to /.
    await refresh();
    setBusy(false);
  }

  return (
    <form className={s.form} noValidate onSubmit={(e) => void submit(e)}>
      <h1 className={s.heading}>Đăng nhập</h1>
      {ended ? (
        <p className={s.note} role="status">
          {ENDED}
        </p>
      ) : null}
      {failure ? (
        <p className={`${s.note} ${s.bad}`} role="alert">
          {failure}
        </p>
      ) : null}
      <div className={s.field}>
        <Field
          id={EMAIL_ID}
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />
      </div>
      <div className={s.field}>
        <Field
          id={PASSWORD_ID}
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />
      </div>
      <Button variant="primary" type="submit" disabled={busy}>
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
      <p className={s.alt}>
        Chưa có tài khoản? <Link to="/dang-ky">Tạo tài khoản</Link>
      </p>
    </form>
  );
}
