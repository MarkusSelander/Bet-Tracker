import { Link } from 'react-router-dom';

const CONTACT_EMAIL = 'markus.alexander.selander@gmail.com';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA]">
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-text-secondary">Bet Tracker</p>
        <h1 className="mt-2 text-3xl font-bold" data-testid="privacy-title">
          Personvern
        </h1>
        <p className="mt-2 text-sm text-text-secondary">Sist oppdatert 26. oktober 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-6 text-text-secondary">
          <section>
            <h2 className="text-base font-semibold text-[#FAFAFA]">Hvem som har ansvaret</h2>
            <p className="mt-2">
              Bet Tracker er en personlig oversikt over spill. Spørsmål om opplysningene dine sendes til{' '}
              <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#FAFAFA]">Innlogging med Google</h2>
            <p className="mt-2">
              Innlogging skjer med Google-kontoen din via Firebase Authentication. Vi tar vare på e-post, navn,
              profilbilde og Google-kontoens bruker-ID, slik at spillene dine kan knyttes til deg neste gang du logger
              inn.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#FAFAFA]">Det du selv legger inn</h2>
            <p className="mt-2">
              Spill, innsats, odds, resultat, bookmaker, sport, notater, tipster, favoritter og bankroll lagres for å
              vise oversikten din. Økten varer i sju dager. Nettstedet lagrer en session-token i en informasjonskapsel
              og i nettleserens lokale lagring. Chrome-utvidelsen lagrer den samme tokenen lokalt på maskinen din.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#FAFAFA]">Chrome-utvidelsen og Coolbet</h2>
            <p className="mt-2">
              Utvidelsen leser spillhistorikken på Coolbet i fanen der du allerede er innlogget, og sender kupongene til
              Bet Tracker. Coolbet-passordet blir ikke lagret.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#FAFAFA]">Hvem som behandler opplysningene</h2>
            <p className="mt-2">
              Google behandler innloggingen. Nettstedet ligger på Vercel, API-et på Render, og kontoen og spillene i en
              database. Opplysningene brukes til å drive din egen oversikt og selges ikke videre.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#FAFAFA]">Sletting</h2>
            <p className="mt-2">
              Send en e-post til{' '}
              <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{' '}
              hvis du vil ha kontoen og spillene slettet.
            </p>
          </section>
        </div>

        <p className="mt-10">
          <Link to="/login" className="text-sm text-primary underline">
            Til innlogging
          </Link>
        </p>
      </main>
    </div>
  );
}
