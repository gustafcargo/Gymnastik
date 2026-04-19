# Gymnastik

App för att planera gymnastikpass, visualisera hall-layouten i 2D/3D och
köra ett spelläge med live-multiplayer.

## Komma igång lokalt

```sh
npm install
npm run dev
```

## Supabase-uppsättning (för auth, profiler, klubbar & molnpass)

Utan Supabase körs appen lokalt i single-player. När du sätter upp Supabase
aktiveras:

- Magic-link-inloggning (e-post → klicka länk).
- Profil, vänner och gymnast-stil som följer med dig mellan enheter.
- Föreningar, lag, hallar och utrustnings-inventarium.
- Pass som synkas till molnet och kan delas med klubb / lag / individer.
- Live-multiplayer i spelläget (Realtime Broadcast + Presence).

### 1. Skapa ett Supabase-projekt

1. Gå till [supabase.com](https://supabase.com) och skapa ett gratis projekt.
2. Project Settings → API: kopiera **Project URL** och **anon/public key**.
3. Authentication → URL Configuration: lägg till din app-URL som *Site URL*
   (t.ex. `http://localhost:5173` i dev, produktions-URL:en live). Magic-
   link-mejlet använder den för redirect.
4. Authentication → Providers: slå på **Email** (default). Magic-link är
   valt i koden — ingen lösenords-provider behövs.

### 2. Lägg till env-variabler

Skapa `.env.local` från `.env.local.example`:

```sh
cp .env.local.example .env.local
```

Fyll i:

```
VITE_SUPABASE_URL=https://<din-projekt-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Starta om dev-servern.

### 3. Kör databas-migrationen

Schemat ligger i `supabase/migrations/0001_init.sql`. Kör det *en* gång mot
projektet. Två alternativ:

**Via Supabase Dashboard (enklast)**

1. SQL Editor → New query.
2. Klistra in hela `supabase/migrations/0001_init.sql`.
3. Klicka **Run**.

**Via Supabase CLI**

```sh
npx supabase link --project-ref <din-projekt-ref>
npx supabase db push
```

### 4. Bekräfta att det funkar

- `npm run dev`
- Klicka **Konto** i toolbaren → ange e-post → kolla inkorgen → klicka
  länken → du är inloggad. Din profil (namn/färg/vänkod/gymnast-stil)
  laddas från molnet (eller pushas upp om det är din första enhet).
- Skapa en förening under fliken **Föreningar** → du blir automatiskt
  administratör. Skapa sedan lag och hallar, och fyll i redskap per hall.
- Spara ett pass (Ctrl/Cmd+S) → det dyker upp under fliken **Molnet** i
  "Mina pass"-dialogen och kan hämtas på en annan enhet efter inloggning.

### Schema-översikt

| Tabell | Innehåll |
|--------|----------|
| `profiles`             | En rad per auth-user (namn, färg, vänkod, gymnast-stil) |
| `friends`              | Symmetrisk vänrelation (user_id ↔ friend_user_id) |
| `clubs`                | Förening (blir admin-ägd av den som skapar) |
| `club_members`         | Klubbmedlemskap + roll (admin/coach/member) |
| `teams`                | Lag inom en klubb |
| `team_members`         | Lag-medlemskap + roll |
| `halls`                | Hall inom en klubb (namn + mått) |
| `equipment_inventory`  | Antal av varje redskapstyp per hall (flyttbart) |
| `plans`                | Pass ägda av user/team/klubb |
| `plan_shares`          | Delning av pass till klubb / lag / individ (+ can_edit) |
| `invites`              | Mejl-inbjudan till klubb eller lag (token, 14 d) |
| `member_capabilities`  | Per-medlems override av roll-baserade förmågor (admin-editor i klienten) |

Alla tabeller har Row Level Security. Översikten över policies finns som
kommentarer i migrationen.

### RPC-funktioner

- `move_inventory(source_id, target_hall_id, quantity)` — flyttar redskap
  mellan hallar inom samma klubb. Mergar kvantiteter om målhallen redan har
  samma typ, raderar källan vid full flytt.
- `accept_invite(token)` — matchar token + inloggad e-post mot en rad i
  `invites`, lägger in klubb/lag-medlemskap med angiven roll och markerar
  inbjudan som förbrukad.

### Byta till OAuth senare

Schemat är auth-provider-agnostiskt. Gå till Authentication → Providers och
aktivera Google/Apple/GitHub när du vill; lägg till en knapp som kallar
`supabase.auth.signInWithOAuth({ provider: "google" })` bredvid magic-link-
formuläret i `SignInForm.tsx`. Befintliga användare får samma `user_id` om
e-posten matchar (se "Link identities" i Auth-inställningarna).
