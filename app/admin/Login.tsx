export default function Login({ failed }: { failed: boolean }) {
  return (
    <main className="login">
      <form action="/api/login" method="post" className="login__form">
        <h1 className="login__title">Anoniem</h1>
        <label className="login__label" htmlFor="password">
          Wachtwoord
        </label>
        <input id="password" name="password" type="password" autoFocus className="login__input" />
        {failed ? <p className="login__error">Verkeerd wachtwoord.</p> : null}
        <button type="submit" className="login__button">
          Aanmelden
        </button>
      </form>
    </main>
  )
}
