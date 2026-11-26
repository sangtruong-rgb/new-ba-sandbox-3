// The sign-up-form slot: heading, Email, Mật khẩu, Tạo tài khoản and the link to sign in.
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../../../app/session';
import { createLogger } from '../../../../app/log';
import { ApiError, api } from '../../../../shared/api';
import { Button, Field } from '../../../../shared/ui/Field';
import { isLongEnough, isValidEmail } from './rules';
import s from './SignUpForm.module.css';

const log = createLogger('[sign-up/sign-up]');

export const INVALID_EMAIL = 'Email không hợp lệ';
export const SHORT_PASSWORD = 'Mật khẩu cần ít nhất 8 ký tự';
export const FAILED = 'Không tạo được tài khoản. Thử lại.';

const EMAIL_ID = 'up-email';
const PASSWORD_ID = 'up-pass';

type Errors = { email?: ReactNode; password?: ReactNode };

const taken = (
  <>
    Email này đã có tài khoản. <Link to="/dang-nhap">Đăng nhập</Link>
  </>
);

export function SignUpForm() {
  const { refresh } = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const focus = (id: string) => formRef.current?.querySelector<HTMLInputElement>(`#${id}`)?.focus();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Errors = {};
    if (!isValidEmail(email)) next.email = INVALID_EMAIL;
    if (!isLongEnough(password)) next.password = SHORT_PASSWORD;
    setErrors(next);
    setFailed(false);
    if (next.email || next.password) {
      focus(next.email ? EMAIL_ID : PASSWORD_ID);
      return;
    }

    setBusy(true);
    try {
      await api('POST', '/api/auth/sign-up', { email: email.trim(), password });
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : 'network';
      if (code === 'email_taken') {
        setErrors({ email: taken });
        focus(EMAIL_ID);
      } else if (code === 'invalid_email') {
        setErrors({ email: INVALID_EMAIL });
        focus(EMAIL_ID);
      } else if (code === 'password_too_short') {
        setErrors({ password: SHORT_PASSWORD });
        focus(PASSWORD_ID);
      } else {
        log.error('sign-up failed', err);
        setFailed(true);
      }
      return;
    }
    // Signed in: the session loads the user and the gate takes them to /.
    await refresh();
  }

  return (
    <form ref={formRef} className={s.form} noValidate onSubmit={submit}>
      <h1 className={s.heading}>Tạo tài khoản</h1>
      <div className={s.field}>
        <Field
          id={EMAIL_ID}
          label="Email"
          type="email"
          autoComplete="email"
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
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />
      </div>
      <Button variant="primary" type="submit" disabled={busy}>
        {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
      </Button>
      {failed ? (
        <p className={s.failed} role="alert">
          {FAILED}
        </p>
      ) : null}
      <p className={s.alt}>
        Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link>
      </p>
    </form>
  );
}
