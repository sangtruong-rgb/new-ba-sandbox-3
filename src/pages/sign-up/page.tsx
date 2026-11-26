// /dang-ky: the ink brand panel and the form column holding the sign-up-form slot.
import { Slot } from '../../app/slots';
import s from './page.module.css';

export const TAGLINE = 'Ghi việc, đặt hạn chót, đánh dấu xong. Mở trên máy nào cũng thấy như nhau.';

/** `ready`: the session is known and nobody is signed in, so the slot mounts. */
export function SignUpPage({ ready }: { ready: boolean }) {
  return (
    <div className={s.auth}>
      <div className={s.brand}>
        <p className={s.logo}>Việc</p>
        <p className={s.tagline}>{TAGLINE}</p>
      </div>
      {ready ? <Slot name="sign-up-form" page="sign-up" className={s.form} /> : <div className={s.form} />}
    </div>
  );
}
