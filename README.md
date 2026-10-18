# Medley | All in One Media Tracker

<img src="https://i.imgur.com/Eja82RH.png" width="700px" />

An all-in-one tracker for **movies, TV shows, anime and games**, inspired by Letterboxd and AniList. It runs on your own computer, and your list stays in a single database file next to the app.

- **Search** movies and TV (TMDB), anime (AniList) and games (IGDB) from one search box, and click any result for details.
- **Log completions** with a date and a rating, either out of 10 or as 5 stars with half stars. Rewatches and replays become their own posts, numbered #1, #2…
- **Track shows and anime episode by episode.** In-progress shows sit at the top of your list: press **+** to log the next episode, saved with its episode name.
- **Mark 100% achievements** on games to give their post a gold glow.
- **Search, filter and sort** your list by status, type, completion date, rating and more.
- **Export and import** your whole list as one file, from Settings.

Everything Medley saves stays in its folder:

```
Medley/
├─ Medley.exe
├─ app/            the app itself
├─ config.env      your API keys and settings (created on first run)
└─ data/
   └─ medley.db    your data
```

## Running Medley (Windows)

1. Download the latest `Medley.zip` from the [Releases page](https://github.com/rivereh/medley/releases).
2. Unzip it anywhere, e.g. your Documents folder or a USB drive.
3. Double-click **`Medley.exe`**. A console window opens and Medley opens in your browser at <http://localhost:3000>.
4. Close the console window to stop Medley and add your API keys (see below)

## Adding your API keys

Anime search works straight away. **Movies, TV and games need free API keys**, which go in `config.env`. That file is created the first time you run Medley.

1. Close Medley.
2. Open `config.env` (next to `Medley.exe`) in Notepad.
3. Paste in your keys, using the steps below:

   ```env
   TMDB_READ_TOKEN=...
   TWITCH_CLIENT_ID=...
   TWITCH_CLIENT_SECRET=...
   ```

4. Save the file and start Medley again.

### Movies & TV: TMDB

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/signup).
2. Go to **Settings → API** ([direct link](https://www.themoviedb.org/settings/api)) and request an API key.
3. On the same page, copy the long **API Read Access Token**.
4. Paste it after `TMDB_READ_TOKEN=`.

### Games: IGDB (via Twitch)

1. Log in at [dev.twitch.tv/console](https://dev.twitch.tv/console) with a Twitch account.
2. Click **Register Your Application** and fill out the form.
3. Click **Create**, then **Manage** on your new app.
4. Copy the **Client ID** into `TWITCH_CLIENT_ID=`.
5. Click **New Secret**, then copy it into `TWITCH_CLIENT_SECRET=`.

### Anime: AniList

No key needed.

## Updating

Download the new release and replace **`Medley.exe`** and the **`app`** folder. Keep `data/` and `config.env`. Medley updates your database automatically the next time it starts.

To be safe, back up first with **Settings → Your data → Download export**, or by copying `data/medley.db`.

## Running from source

Requires [Node.js](https://nodejs.org) 24 or newer.

```bash
npm install
```

Create a `.env` file in the project folder with your keys:

```env
DATABASE_URL="file:./prisma/dev.db"
TMDB_READ_TOKEN=""
TWITCH_CLIENT_ID=""
TWITCH_CLIENT_SECRET=""
```

Set up the database and start the dev server at <http://localhost:3000>:

```bash
npx prisma migrate dev
npm run dev
```

### Building the release

```bash
npm run package
```

This builds the portable app into `dist/Medley/`. Zip that folder to publish it as a release. Your own `.env` keys and database are never included.

Built with [Next.js](https://nextjs.org), [Prisma](https://www.prisma.io) and SQLite.
