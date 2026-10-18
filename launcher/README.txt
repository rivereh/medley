RUNNING MEDLEY (WINDOWS)
------------------------

1. Double-click Medley.exe. A console window opens and Medley opens in your
   browser at http://localhost:3000
2. Close the console window to stop Medley and add your API keys (see below)


ADDING YOUR API KEYS
--------------------

Anime search works straight away. Movies, TV and games need free API keys,
which go in config.env. That file is created the first time you run Medley.

1. Close Medley.
2. Open config.env (next to Medley.exe) in Notepad.
3. Paste in your keys, using the steps below:

     TMDB_READ_TOKEN=...
     TWITCH_CLIENT_ID=...
     TWITCH_CLIENT_SECRET=...

4. Save the file and start Medley again.

Movies & TV: TMDB
  1. Create a free account at https://www.themoviedb.org/signup
  2. Go to Settings > API (https://www.themoviedb.org/settings/api) and
     request an API key.
  3. On the same page, copy the long API Read Access Token.
  4. Paste it after TMDB_READ_TOKEN=

Games: IGDB (via Twitch)
  1. Log in at https://dev.twitch.tv/console with a Twitch account.
  2. Click Register Your Application and fill out the form.
  3. Click Create, then Manage on your new app.
  4. Copy the Client ID into TWITCH_CLIENT_ID=
  5. Click New Secret, then copy it into TWITCH_CLIENT_SECRET=

Anime: AniList
  No key needed.


UPDATING
--------

Download the new release and replace Medley.exe and the app folder. Keep
data\ and config.env. Medley updates your database automatically the next
time it starts.

To be safe, back up first with Settings > Your data > Download export, or by
copying data\medley.db.
