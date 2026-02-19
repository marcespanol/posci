import styles from "@/app/login/login.module.css";
import { signInAction, signUpAction } from "@/app/login/actions";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;
  const message = params.message;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>Posci Poster Builder</h1>
        <p className={styles.subtitle}>Sign in or create an account to manage your posters.</p>
        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p>{message}</p> : null}

        <form className={styles.form}>
          <label className={styles.label}>
            Email
            <input className={styles.input} type="email" name="email" required autoComplete="email" />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              name="password"
              required
              autoComplete="current-password"
              minLength={8}
            />
          </label>

          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.primary}`} formAction={signInAction} type="submit">
              Sign in
            </button>
            <button className={styles.button} formAction={signUpAction} type="submit">
              Sign up
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
