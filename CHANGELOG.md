# Changelog

All notable changes to VocabFlow. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/): a fix raises the last number, a new feature or a change
in how the app is used raises the middle one, and a change that breaks what was stored or how it is run raises the
first. Each release is a `vX.Y.Z` tag; the number is shown at the bottom of Settings.

## [1.16.4] - 2026-11-12

### Added

- **Cue sounds in Speak this scene**: a soft rising blip when **Speak now** shows, and a falling one when the phone has stopped listening by itself. They follow the sound switch in Settings. They are made with Web Audio, which is reported not to disturb the iPhone's speech recognition (an audio element does).

## [1.16.3] - 2026-11-12

### Changed

- **Speak this scene in the app's own look.** The chat-style layout from 1.16.2 stays, but its colours and buttons now match the rest of VocabFlow (indigo buttons and progress bar as in the games, white cards, the green, amber or red result bar of Listen and choose, a big indigo microphone like its play button) instead of a look of its own.
- **A simpler start.** Speak this scene now opens full screen like the games: "Who do you play?" with the two speakers as round initials, and one **Start speaking** button. Listen first, Read my line to me first, Self-rate and the note on the microphone are folded under **Options**.

## [1.16.2] - 2026-11-12

### Changed

- **Speak this scene looks like a chat now.** Once you start, it fills the screen: a progress bar and a close button at the top, the conversation as chat bubbles (the other person on the left with a round initial, you on the right, highlighted while it is your turn), and everything to do at the bottom. While the other person speaks, little sound bars move in their bubble; a speaker button in each of their bubbles plays the line again whenever nothing is listening. Your turn shows a big microphone: grey with **Get ready…**, then green and pulsing with **Speak now**, with what the phone hears under it. Your line is then coloured word by word inside your bubble, and a green, amber or red panel slides up ("Great!", "Almost there", "Keep practising") with what was heard, the line, **Continue** and **Try again**. The end shows the stars over the whole conversation. Choosing who you play now shows each speaker with their initial.
- How the practice works is unchanged; only the frontend changed.

## [1.16.1] - 2026-11-12

### Changed

- **Speak this scene no longer reads your own line to you.** When no line of the other person comes just before yours (you speak first, you have two lines in a row, or you try again), the phone now says only "Your turn. Go ahead." before it listens (it still has to say something first, or an iPhone does not hear you). To repeat after a model instead, turn on **Read my line to me first** before you start.

## [1.16.0] - 2026-11-12

### Changed

- **Speak this scene now speaks the other person's lines aloud and listens after each one.** iPhones running iOS 27 hear only the first recognizer of a session ([WebKit bug 321436](https://bugs.webkit.org/show_bug.cgi?id=321436)); what works there, and was confirmed on our iPhone with way H of the speech test, is to let the phone speak, start a new recognizer 0.4 s later, and never cut it. So each turn now goes: the phone reads the line before yours (or, when you speak first or try again, your own line as a model), **Get ready…** shows while the microphone opens, **Speak now** shows half a second after it is open (words said earlier were often lost), and when you pause the phone stops listening by itself and the line is scored. There is no Done button any more. **Skip** while listening waits for the listening to end instead of cutting it, and so does **Stop practising**. If nothing was heard you can try again, skip, or rate yourself; a refused microphone offers self-rating. Self-rating now also reads the other person's lines aloud.
- Starting while **Listen first** is reading stops that reading first, so it no longer cuts off the scene's first line.
- Only the frontend changed.

## [1.15.1] - 2026-11-12

### Added

- **Experimental page, way of listening H** (Settings → Speech test, One sentence): the phone first reads the sentence aloud, then listens, starting 0.4 s after its voice ends; listening is never cut by the page (it ends by itself when you pause, and **Done** only waits for that). This is the one workaround reported to work for an iPhone problem (WebKit bug 321436, iOS 27): after the first time, the microphone opens but hears nothing, and a recognizer that is cut is said to leave all later ones deaf until the app is closed. Close the app completely before testing H. The log now shows the time since the last recognizer ended and the audio session state. Nothing else changed.

## [1.15.0] - 2026-11-11

### Added

- **Speak this scene**: a Canada scenario that has a conversation now has a **Speak this scene** button under "Tap any word…". You choose who you play; **Listen first** reads the whole conversation aloud (a different pitch for each speaker, the microphone off); then **Start speaking** asks for the microphone and begins. The other person's lines are shown, not spoken (the phone's own voice would drown out yours), and move on after a reading time or when you tap **I read it**. Say only your own lines. When it is your turn, say the line and tap **Done**, or stop for a moment after the phone has heard it; the page waits up to a second and a half for the last words, scores only what you said in that turn, and shows each word green, red (a different word) or struck through (left out). **Retry this line** tries it again without restarting the microphone. At the end you get a percentage and 1 to 3 stars, as in the games. The score is not saved and nothing is recorded or sent by VocabFlow (the browser's speech service may send the sound to Apple or Google).
- **How a line is scored**: capitals and punctuation do not count; "I'd" and "I would", "can't" and "cannot" are the same; "$6.50", "six fifty" and "six dollars and fifty cents" are the same; small words (a, the, to, of, …) may be left out; a plural, or a one-letter spelling difference in a long word, is accepted.
- **If the microphone does not work**: a refused or slow microphone is explained, with "Try again" or **Self-rate**. If the phone stops listening in the middle (an iPhone sometimes does), the page says so and offers to let you rate the remaining lines yourself (Went well, So-so, Need practice); it does not try to start listening again, because that often fails on an iPhone.
- Only the frontend changed: the recognizer and the word comparison moved from the experimental page into `shared/speech`. No backend change, no migration.

## [1.14.3] - 2026-11-11

### Fixed

- **Speech test, conversation: the first microphone question cut the speech off and the page stopped.** The microphone is now asked for first, and the phone does not speak until the recognizer has really started. If the microphone is refused or cannot start, the page says so and offers "Try again" or the way back to the one-sentence test. A spoken line that the system interrupts or that never starts is tried once more and then skipped (the text stays on the screen), and every step has a watchdog: after 10 seconds without progress the page shows Retry and Skip (or Cancel while waiting for the microphone) and the log says where it stopped. The log also records the start of the microphone question, when the page loses and regains focus or is hidden, and for each spoken line its start, end and any error. A real log from an iPhone showed the speech starting and then neither ending nor failing once the microphone began listening, so: a line that is spoken must end within a time that fits its length (at most 9 s), otherwise the speech is cancelled, the log says **TTS BLOCKED**, and the other person's lines are shown as text for the rest of the conversation ("I read it" or a wait that fits the length moves on). A new **Partner lines** choice, Speak or Text only, lets the conversation be done that way from the start. The log records the speech state (speaking, paused, pending) before each line, at every change and when the microphone starts, and the speech's pause and resume. Experimental page only; not yet checked on a real iPhone.

## [1.14.2] - 2026-11-11

### Added

- **Speech test: a conversation prototype (experimental)**. The test page (`/app/labs/speech-test`) has a second tab, **Conversation**: two built-in conversations of eight lines (a coffee shop, asking the way) where you play one side and the phone speaks the other with the browser's voice. On an iPhone a recognizer started again after Stop did not hear, so here **one continuous recognizer is started once and kept for the whole conversation**. A line is judged when its result is final, or when you tap **Done**; **Skip** moves on. Results that arrive while the phone is speaking, or in the second after, are dropped as its own voice and noted in the log. If the phone ends the listening by itself, the page says so, shows how long it lasted, and offers one try at listening again without promising that it works. The diagnostic log also records the speaking, the start and end of each line and how long the listening lasts. Nothing is stored or sent; no backend change.

## [1.14.1] - 2026-11-11

### Added

- **Speech test: diagnostics and five ways of listening (experimental)**. On the iPhone home-screen app a second Start after Stop showed the microphone but returned no text. The test page now has a collapsed **Diagnostic log** that records, with a time, every event of every recognizer (start, audio start, sound, speech, result with its final flag, no match, error with its code, speech end, audio end, end) and every `start()`, `stop()` and `abort()` call, with a Copy button. A new **Way of listening** choice, A (as before) to E: A a new recognizer each time and Stop = `stop()`; B Stop = `abort()`; C one recognizer reused; D continuous, started once, with a Clear button; E a new recognizer only 0.5 s after the last one ended. It is to learn which way the phone handles reliably. Nothing is stored or sent; no backend change.

## [1.14.0] - 2026-11-11

### Added

- **Life in Canada**: a new fourth section in Reading, **Canada** (next to Passages, Videos and Articles), with short scenes of everyday life written for the app: **Renting an Apartment** and **Parent-Teacher Meeting** (CLB 6), **Opening a Bank Account**, **A Job Interview** and **Filing Your Taxes** (CLB 7). Each is a natural dialogue (about 450 words) plus a **short piece of formal writing** (a lease clause, a fee notice, a school newsletter, a job posting, a tax letter) and a tip, **17 to 19 keywords and phrases with Chinese meanings and an example sentence each**, a short note about Canada in Chinese, and a **five-question quiz**. It opens in the same reader as passages and articles: tap any word to add it (the sentence and a link back to the scene are kept), listen to it read aloud, or press **Add all** to put every keyword in your list (words you already have are skipped). A scene counts as finished when you reach the end or check the quiz; the best quiz score is kept.
- **Under the hood**: the scenes are stored in the app (`scenarios/catalog.json`, checked at startup: every keyword must appear in the text, and a price or a number that looks like a phone number is refused) and written to be read, not generated, so they cost nothing to run and can be reviewed. Practical facts differ between provinces, so the text keeps to what holds in general and each scene carries a list of facts to check (`verify`, never shown to a learner). New table `scenario_progress` (V21); `GET /api/v1/scenarios`, `GET /api/v1/scenarios/{id}`, `PUT /api/v1/scenarios/{id}/complete`. Daily tasks and the progress page do not use scenes yet.

## [1.13.3] - 2026-11-11

### Fixed

- **Speech test: Start did nothing after Stop** (seen on the iPhone home-screen app). A late `end` or `error` from the earlier recognizer could reset the new one, and the phone can fail silently when a new recognizer starts while the old one is still stopping. Now every event is checked against the current recognizer, Stop shows "Wait…" until the recognizer has ended (or 3 seconds have passed), an error resets the button, and a start that throws shows its message. Experimental page only; not yet checked on a real iPhone.

## [1.13.2] - 2026-11-11

### Added

- **A way into the speech test from the home-screen app**: the bottom of Settings, under the version number, has a small "Speech test (experimental)" link to `/app/labs/speech-test`, because an app opened from the home screen has no address bar. The test page has a "← Back to Settings" link. Nothing else changes.

## [1.13.1] - 2026-11-10

### Added

- **Speech test (experimental)**: a small test page at `/app/labs/speech-test` (reached only by its address, not in the menu) that checks whether this phone or computer can hear you read a sentence. Pick one of seven sentences (easy to hard, with everyday Canadian ones), tap Start speaking, read it, tap Stop. The page shows what was heard and compares it word by word with the sentence (right, left out, or a different word; capitals and punctuation ignored), whether the page is on https, whether the browser has speech recognition, and a clear message when the microphone is refused or the speech service cannot be reached. It uses the browser's own recognizer; VocabFlow records, stores and sends nothing. It exists to learn how well recognition works on the iPhone before any speaking practice is designed. No backend change, no migration.

## [1.13.0] - 2026-11-10

### Added

- **Daily reminder**: Settings has a new "Daily reminder" card with a switch ("Remind me to study") and a time (19:00 to begin with). When it is on, the device gets **one short notification a day** at that time in the learner's time zone (the one chosen in Settings, else the device's), **only if that day's study is not finished**; tapping it opens the Study page. With a streak it says "Your N-day streak is waiting"; otherwise "Today's words are ready whenever you are." Nothing is sent to someone who has not switched it on, it can be switched off at any time, and it is kept per device. Switching it on after the time has passed does not send one at once, and a reminder more than 3 hours late (the server was down) is dropped.
- **It needs three things** that no earlier version needed: the app opened over **https** (a browser allows a service worker and notifications on https only), on an iPhone or iPad the app **added to the Home Screen**, and VAPID keys in `.env` (`scripts/generate_vapid_keys.sh mailto:you@example.com`). Settings says which one is missing. Without the keys the feature is simply off: the server starts as before and the card says reminders are not set up.
- **Under the hood**: a service worker (`/sw.js`) that only shows the notification and opens the app when it is tapped (no caching and no fetch handler, so updates and `NewVersionNotice` work as before); a `push_subscriptions` table (V20); `GET /api/v1/push/config`, `GET/POST/DELETE /api/v1/push/subscription`; a once-a-minute job inside the backend. A reminder is claimed with one conditional update before it is sent, so it cannot go out twice; a push service answering 404 or 410 deletes the subscription. Web Push (RFC 8291 encryption and VAPID) is written with the JDK's own crypto instead of a library (the usual one brings BouncyCastle and Apache HttpClient); a test reproduces the RFC's worked example byte for byte. The Caddy policy needed no change (`worker-src` falls back to `script-src 'self'`).

## [1.12.2] - 2026-11-10

### Added

- **Five new video albums, 208 more videos** (431 in 15 albums), all from the official channels, played in YouTube's own player. **English at Work** (BBC, CLB 5-7, 46 short workplace scenes: interviews, meetings, phone calls, polite requests), **Real Easy English** (BBC, CLB 4-6, 36 easy everyday chats), **TALK2US: English conversation** (VOA, CLB 5-7, 32 long live shows: conversation starters, idioms, pronunciation), **English @ the Movies** (VOA, CLB 5-7, 30 two-minute phrase lessons) and **English in a Minute** (VOA, CLB 5-7, 32 one-minute idiom lessons). The album **The English We Speak** grows from 2 to 34 videos.
- No code, API or database change: only `videos/catalog.json`.

## [1.12.1] - 2026-11-11

### Added

- **Five new article albums** from VOA Learning English, so the library grows from 120 to **303 articles in 8 albums**: Everyday Grammar (40, CLB 4-6), Education Tips (35, CLB 5-7), Health & Lifestyle (40, CLB 5-7), Science & Technology (40, CLB 6-8) and Arts & Culture (28, CLB 6-8). The aim was more to read at CLB 4-5: articles at CLB 4 go from 80 to 120 (long ones, 5 reading minutes or more, from 7 to 39) and at CLB 5 from 120 to 235.
- Same rules as before: VOA's own text only (public domain, credit and link back), nothing from AP, Reuters, AFP or other wire services (most news items were left out for that reason, so As It Is, whose items almost all carry one, was not added), no images, audio only linked. Nothing in the API or the database changes; no migration.
- `scripts/article_catalog.py harvest --only <zone,...>` adds the given programs and leaves the other albums as they are.

## [1.12.0] - 2026-11-10

### Changed

- **More varied daily tasks**: the same kind of task now comes in different strengths, so a day is no longer "the same thing with one task left out". Reading 1, 2 or 3 articles (4, 5 or 7 points), watching 1 or 2 videos (3 or 5), 1, 2 or 3 practice games (2, 3 or 5), playing one game 1 or 2 times (3 or 5), adding a few more words (3, 4 or 6), tapping 1 or 3 words in articles (4 or 6) and rating half as many cards again (3 or 5). More points always go with more work. A day has **at most one hard task** (the strongest strength of a kind). The new kinds below make the reading and video tasks more than one kind each.
- **New kinds of task**: read a **long** article (5 reading minutes or more, 5 points); watch a **grammar** video (Everyday Grammar or 6 Minute Grammar, 4); win **3 stars in Spell it** (6, hard); play a game with **no mistakes** (5); play **3 different games** (6, hard).
- **Challenge of the day**: every 2 or 3 days (the day is fixed by the user and the date, so every device agrees) one of the four tasks is a **Challenge**, shown with a small tag and worth 8 to 10 points: 2 stars in 3 different games (9), 2 games with no mistakes (8), or 2 articles one of them long (10). It is one of the four, not a fifth, and it is the day's hard task, so the other three are normal ones. A full day is worth at most 40 points (before streak bonuses), against 31 before.
- Nothing stored changes: tasks already made keep their kind, target and points, and the list of a day, once made, never changes. No migration. `GET /api/v1/tasks/today` has a new `challenge` flag on each task.

## [1.11.0] - 2026-11-08

### Added

- **My progress**: a new page (Study page, under Today's tasks, "My progress"; `/app/progress`) shows how far you have come. From the top: three big numbers (words learned, words mastered, days in a row, with the best run), and how many words are still being learned; a bar to the next goal of mastered words (50, 100, 250, 500, 1000) that says how many more words are left; a study calendar of the last 12 weeks, one square per day, darker for more cards studied, where tapping a day shows the cards reviewed, new words learned, game rounds played and points earned on it; and the last 7 days against the 7 days before for cards reviewed, new words and game rounds, with ▲ and ▼ for the change. A word is **mastered** when its review interval is 21 days or more (Anki's "mature"); only words whose details are complete are counted. Days are the learner's study days (their time zone). The numbers refresh after a rating, a game round or any other save. Nothing is compared with other learners and the goals give no points.
- **API**: `GET /api/v1/progress/summary?date=&zone=` (read-only, the signed-in user's own data; the date and zone follow the same rules as `GET /api/v1/tasks/today`). The streak is the one the daily tasks count. No migration.

## [1.10.0] - 2026-11-08

### Added

- **Search your vocabulary**: the Vocabulary page has a search box above the lists. It finds the words that contain what you type anywhere in them (`chee` finds *cheese* and *purchase*), ignoring capitals and spaces around the text, and it works together with the list you chose (All, Due today, New, …) and with the pages. It looks only at the word or phrase itself, not at its meaning or Chinese. The search waits about 0.3 s after you stop typing, goes into the address (`?q=`) so a reload or a shared link keeps it, replaces the history step instead of adding one, and starts again from the first page. A × button clears it; with no match the page says so and offers to clear the search. `%`, `_` and `\` are searched as ordinary characters. Adding a word clears the search, like the lists.
- **API**: `GET /api/v1/vocabulary` takes an optional `q` (up to 100 characters; a blank one means no search), applied to the signed-in user's own words together with `status`, `due`, `page` and `size`. No migration.

## [1.9.0] - 2026-11-08

### Added

- **Daily tasks, points and a streak**: the Study page now opens with "Today's tasks". The first task is always *finish today's study plan* (10 points); four more come from a pool, each worth 2 to 5 points, with a bar for the ones that take several steps. Tapping a task opens the place where it is done. A finished task shows a check, a ding (if game sounds are on) and a short message; finishing all of them adds 5 points. The line above the list shows the days in a row on which you finished the study plan (🔥), the points earned today and your total, and a link to the **Points** page that lists every award, newest first. Missing a day takes nothing away: the streak just starts again. Bonuses of 5, 10, 20 and 40 points come when the streak reaches 3, 7, 14 and 30 days (a new run can earn them again). Each account sees only its own tasks and points; redeeming points is not built yet.
- **What the other tasks count** (all for your study day): rate N cards (N follows your daily goal, 5 to 30); clear every review that is due; add N words to your list (2 to 5); add a word by tapping it in an article; finish an article or today's own reading passage; watch one video to the end; play any practice round; play one named game; win 2 or more stars in a round. A task is offered only when it can be done today (no review task when nothing is due, no article task without an article for your level, no game task with fewer than 5 words to play), a kind you have not completed for longer is more likely, and no two tasks are of the same kind. The list is made when the day is first opened, is the same on every device, and does not change afterwards.
- **API**: `GET /api/v1/tasks/today?date=` returns the day's tasks with progress, today's points, the balance and the streak (reading it makes the list, counts what was done and awards each finished task once); `GET /api/v1/tasks/ledger?page=&size=` pages the points ledger, newest first. Migration V19 adds `daily_task_days`, `daily_tasks` and `point_ledger`.

## [1.8.0] - 2026-11-07

### Added

- **Finished game rounds are kept on the server** (nothing changes on screen): when the results screen of Quick review, Fill in the blank, Listen and choose or Spell it appears, the round is recorded once with its game, its stars, its mistakes, how many words it had and the study day. An abandoned round is not recorded, and a failed request is ignored quietly. This is the groundwork for daily tasks such as "play a round" or "get two stars"; nothing reads it yet. Practice only: reviews and the schedule are untouched.

## [1.7.0] - 2026-11-07

### Changed

- **The practice games rotate through your words instead of repeating**: Quick review, Fill in the blank, Listen and choose and Spell it now choose their words together. A word never played in any game comes first, then the ones played longest ago, and the words of the last round come last, so a round no longer repeats the one before it. Words that were hard for you (rated Again or Hard, forgotten, or with a low ease) are favoured, but never ahead of a word you have not played yet, and words studied today get a small bonus. The pool is today's words and everything you studied in the last 30 days (it was 7), with a little randomness among near-equal words. What you played is kept on the server, so a round on your phone changes what the computer offers next. Practice only: reviews and the schedule are untouched.
- **API**: `GET /api/v1/learning/game-words?date=` returns the ranked word ids (up to 15); `POST /api/v1/learning/game-words/played` (`{wordIds}`, up to 30, your own words only, 404 otherwise) records a round. `recentlyStudied` in the study queue now covers 30 days. Migration V17 adds `game_word_plays`.

## [1.6.1] - 2026-11-07

### Changed

- **Spell it shows the memory hook first and the meanings after**: while you spell, the clues are the sound and the memory hook (emoji, scene and word parts), shown straight away instead of behind a button. The English meaning and the Chinese meaning appear once you have spelled the word (or skipped it), from the same meaning the hook belongs to; the Chinese line is left out when the meaning has none. A meaning without a memory hook shows its English meaning as the clue instead. Words with a hook are chosen first, and the round still has ten words.

## [1.6.0] - 2026-11-07

### Changed

- **Every practice game uses ten words, and tops up from the last week**: Quick review, Fill in the blank, Listen and choose and Spell it all have ten words a round (Spell it had six, the others ten but with different limits), and each is offered once you have at least five words to play with. The words are today's first (mixed up), and when today has fewer than ten they are topped up with words you studied in the last 7 days, the most recent days first, never twice. A day with seven studied words now gives a game of ten. The "not enough words" messages say so. Practice only: nothing is sent and the review schedule is untouched.
- **Study queue (API)**: `GET /api/v1/learning/study-queue` and the other queue replies carry a new `recentlyStudied` list (`userVocabularyId`, `term`, `learningStatus`): words rated in the 7 days before the study day, not today, latest first, only words whose details are complete. No migration.

## [1.5.1] - 2026-11-07

### Fixed

- **Spell it judges the word when every letter is typed**: letters just fill the underlined slots as you type, and you can change them with Backspace. When the last slot is filled, a wrong word shows its wrong letters and their lines in red (with the buzz) and keeps them there until you delete and type again; it is judged again each time the row is full, and a right word is done. A wrong row counts as one wrong try for the stars. This also works on keyboards that build a word before committing it (the field no longer waits for them to finish).
- **Spell it makes its sounds on a phone**: the ding for a finished word and the buzz for a wrong word were blocked because a typed letter is not a press. The sound is now unlocked by the presses before it (Start, Next, Show a letter, a tap on the letters).

## [1.5.0] - 2026-11-07

### Added

- **"Spell it" game**: a fourth practice game on the study-complete page (✍️, from four words studied). You hear a word, read its meaning (with the word hidden) and can open its memory hook; you never see the word. Type it into one underlined slot per letter (a phrase shows a gap; apostrophes and hyphens are filled in; capitals do not matter). When all the letters are typed, a wrong word turns its wrong letters red until you fix them. Each word is worth up to 3 stars (a wrong try or "Show a letter" costs a star, never below 1; "Skip" earns none); a round is up to 6 of today's words. Practice only: nothing is sent and the review schedule is untouched. Frontend only.

## [1.4.1] - 2026-11-06

### Changed

- **Article recordings play inside the article**: an article with a VOA recording now has a player at the top of the page, so you no longer leave the app to listen. It loads the sound only when you press play. The page's content policy (`frontend/Caddyfile`) now allows sound from `voa-audio.voanews.eu` only.

## [1.4.0] - 2026-11-06

### Added

- **Article albums**: the Reading switch is now "Passages | Videos | Articles". Articles are texts from VOA Learning English, kept inside the app and shown in the same reader as your passages: tap any word to add it (with its sentence and a link back to the article), listen to it read aloud, and see where it comes from, with a link to the original and, when VOA has one, to its recording. VOA says the text it writes itself is public domain; any article that credits or quotes a wire service (AP, Reuters, AFP) is left out, and no pictures are kept. The first three programs are Ask a Teacher (CLB 4–6), Words & Their Stories (CLB 4–6) and American Stories (CLB 5–7). Like the video albums, you see the albums for your own CLB level, or "Show all levels" with a filter by band; an album lists its articles in a Short (up to 5 minutes) and a Long list, the unread ones first. An article is marked read when you reach its end (or by hand), and "Words in This Story" lists VOA's glossary with a one-tap "+ Add" for each word. New table `article_reads` (migration V16); `GET /api/v1/articles/albums`, `GET /api/v1/articles/albums/{id}`, `GET /api/v1/articles/{id}`, `PUT/DELETE /api/v1/articles/{id}/read`. The catalog is a file (`articles/catalog.json`) kept by the developer with `scripts/article_catalog.py`; users cannot add articles.

## [1.3.0] - 2026-11-06

### Added

- **A word added by tapping it in a passage keeps the sentence it was in.** The sentence (up to 300 characters), the form that was tapped (`walked` for the word `walk`) and the passage it came from are saved on your own entry only; no other user sees them. The word's page has a "Source" block near the top: the sentence with the tapped form in bold, a button to hear it, its words tappable to add, and a link back to the passage. Adding a word again keeps the first sentence; typed words and older words have none and show no block. If the word is later saved under its base form, the sentence stays with it. New columns on `user_vocabularies` (migration V15); `POST /api/v1/vocabulary` takes optional `sentence`, `form`, `sourceTitle` and `sourceLink` (an in-app `/app/` path), and entries carry `source`.
- **The add-word panel closes by a tap anywhere outside it**, so a thumb need not reach the Close button: a tap on the page closes it, a tap inside does not, a tap on another word still switches it to that word, and the "+ Add" buttons still open it. It stays open while a word is being sent and when something has been typed in it (Close and Escape still close it). After a word is added the "Added" notice goes by itself after 3 seconds, unless the panel is touched; an error never closes it. Escape now works wherever the focus is.
- **"Quick review game" and "Fill in the blank" now play like "Listen and choose".** Each opens on a start screen with its own icon (🧩, 🎯) saying how many words and rounds; during the game a progress bar runs over all rounds, a ⭐ score (words placed right the first time) and a 🔥 streak (from two in a row) move the moment a word is placed, a right placement rings a short ding and pops the card, and a wrong one buzzes and shakes as before; a finished round shows a green bar with the next button, and the results show stars, the first-try count, the longest streak and the words to look at again. The dragging and tapping are unchanged. The three games now share their start screen, score, progress bar and stars.
- **A Chinese meaning for each meaning of a word.** Each meaning of a new word now carries a short Chinese equivalent written by the model (for example 吞咽；咽下 and 燕子 for the two meanings of swallow). A "中文" button under the definition, on the word's page and on the answer side of a study card, shows it and hides it again, and the choice stays while you move between the word's meanings; Settings can show it without tapping. The front of a study card never shows it. Words saved before this have none until they are filled in.
- **Videos remember where you stopped.** While a video plays its place is saved every 15 seconds, and also when it pauses, when you close the player or leave the page; the next time it opens from 5 seconds before that place. In an album a started video shows a thin bar on its picture and "Continue from 3:20", and comes first in the list, the one you watched last at the very top. The first 10 seconds are not kept, and from 90% on the video counts as watched; marking by hand clears the place. New table `video_positions` (migration V14).
- **Many more videos in the albums**: from 26 to 223 videos in 10 albums, all from the official channels. The two VOA Let's Learn English courses are now complete in lesson order (50 and 29 lessons), with a new album of their speaking and pronunciation practice (CLB 1–4); Everyday Grammar has 51 short videos by topic, BBC 6 Minute Grammar 21, and BBC 6 Minute English 38 (22 six-minute episodes and 16 thirty-minute collections, so its album now has both the Short and the Long list). Titles are shortened ("Lesson 1: Welcome!", "Work 2 (30 min)"). The maintenance script now uses YouTube's official Data API.
- **Video albums**: the Reading tab now has a "Passages | Videos" switch. Videos are albums of English lessons on YouTube (VOA Learning English, BBC Learning English, Learn English with Bob the Canadian, Speak English With Vanessa, TED), each with a CLB range. By default you see the albums for your own CLB level; "Show all levels" shows every album with a filter by band (CLB 1–3, 4–5, 6–7, 8+). An album lists its videos in two lists, short (up to 10 minutes) and long, with the ones you have not watched first and an "x of y watched" count; the player is YouTube's own, with captions on, and a video is marked as watched when it ends (or by hand). The catalog is maintained by the developer, not by users. New table `video_progress` (migration V13).
- On the study-complete page the practice games are now a small "Play a game" menu of tiles, each with its own icon, colour and one-line description (🧩 Quick review game, 🎯 Fill in the blank, 🎧 Listen and choose), instead of three plain buttons. A game that cannot be played yet (too few words, or no voice) is left out.
- "Listen and choose" now plays like a game: a progress bar, a streak (🔥) and a score (⭐), a big round play button that glows while the word is said, lettered answer tiles that pop when right (with a short "ding") and shake when wrong, a start screen, and a results screen with stars. The result and the Next button stay fixed at the bottom of the screen, like in the quick review, so they no longer scroll out of reach below tall answers.
- Study cards that start with the picture or the sound now ask a different meaning of a word with several meanings each review, in turn, and the answer opens on that meaning, so the second and third meanings are practised too. The sound card says "This time: meaning 2 of 3".
- A study card that starts with the sound now has "Show a hint" too: first the picture (emoji), then, with "Another hint", the scene with the word hidden. It was missing from the sound-first card.
- A "Listen and choose" exercise next to the other practice buttons on the study-complete page (on a device that can read aloud, with 4+ words studied today): it says one of today's words, you pick its meaning from four, and it shows the word after your answer and sums up how fast you were. Practice only.
- Settings: "How a study card starts" now has three choices: the word, the picture first (as before, the default), or the sound first (the word is only said, with "Hear it again", and you recall its meaning). An earlier choice to turn the picture off is kept as "the word".
- A study card whose word has a memory hook now asks "Which word is this?" with the picture (emoji) first; "Show a hint" gives the scene with the word hidden, and "Show answer" gives the word and meanings. The word is not read aloud until the answer. A switch in Settings (on this device, on by default) goes back to showing the word first; a word without a hook is unchanged.
- A "Fill in the blank" exercise next to the quick review game on the study-complete page (on a device that can read aloud, with 4+ words studied): each of today's words is a sentence with a blank (its meaning and picture as the clue), and the words are only heard: tap a numbered sound to hear it, then drag it onto the sentence it fits, or tap the sentence. A placed sound shows its word and the full sentence. Nothing asks for spelling. Practice only; it never changes the review schedule.
- A "Memory hook" card under the definition of each meaning of a new word, to help remember it: emoji that show a scene, the scene in one plain sentence (its words are tappable and it can be read aloud), and, when the word is a known word plus a common prefix or suffix, how it is built ("open + -ness"). Any part the model cannot give well is left out. Words saved before this have none yet.
- Tapping a collocation, a synonym or an antonym offers to add the whole phrase ("sign a lease") instead of one word of it; before, collocations could not be tapped at all.
- Each meaning of a new word now lists a few synonyms ("Similar words") and antonyms ("Opposites") when it has them, on the detail page and the back of a study card; their words can be tapped to add them. Only fitting ones are listed: a meaning with no good synonym or no real opposite shows nothing for it.
- On a word's detail page each example sentence has a speaker button that reads it aloud (a press again stops it). The same buttons are on the back of a study card.

### Changed

- Claude is now asked to list a word's meanings by how often people meet each one, not by dictionary order or the
  oldest sense (`manifest` listed the cargo list first). On 24 test words it put the right meaning first in about 92% of
  replies, against about 87% before; `lead` and `mean` are still often wrong. Words already saved keep their order.
- On the Study page the total no longer sits alone on a line of its own under the legend on a phone: it is now "31
  words" at the end of the progress bar.

## [1.2.0] - 2026-11-03

Words are stored under their base word, and only words with their details ready are studied.

### Changed

- A word that only inflects another one, such as a plural or a past tense (`trucks`, `walked`), is now saved as that
  word (`truck`, `walk`) once its details arrive, instead of staying under the typed form with a "Form of …" note.
  Claude says, for each such word, whether the form has a meaning of its own that the base word does not give
  (`tired`, `glasses`, `admired`); those stay as typed, and so does any word it is unsure about. A word also stays as
  typed, with its note, when you already hold the base word, the base word is still being filled in, or the word has
  already been studied.
- A word enters the daily plan only once its details are ready. One still waiting for them, or one that failed, is left
  out and joins the day's plan when it is ready, instead of showing up as a card with nothing on it.
- Reading the word aloud as a card appears is now on by default, like reading it on Show answer. The choice is still
  kept per browser, so a new browser starts with both on.

### Added

- A word saved under another name than you typed shows "you added …" in the list and on its page, for as long as the
  browser stays open. After a reload the note is gone.

### Fixed

- Typing while a word was being added ("Adding…") glued the new text onto the word being saved (`walkedlease`) or
  wiped it; in the bottom "Add a word" panel it also cancelled the confirmation of the word being saved. Both fields
  are now locked while the word is sent.
- The backend image could not be built from a fresh clone of the repository (it copied the `.mvn` folder, which is
  not in Git). The build now installs curl and lets the wrapper download Maven.
- Reading the word aloud on a computer (Chrome): the silent warm-up for iPhone ran on the first mouse click too, and
  Chrome could then drop the word spoken in that click. It now runs on touch only.
- Chrome on a computer also dropped a word spoken right after stopping another (a card read aloud, then Show answer):
  the new word now starts a moment after the stop.
- A pronunciation button could stay on "speaking" when Chrome never reported the end of a word, so every later press
  only stopped it and nothing was heard until the page was signed out and in again. A replaced or stopped word is now
  always reported as ended.

## [1.1.0] - 2026-11-01

Phone navigation, after the first weeks of daily use.

### Added

- The version number at the bottom of Settings, so the release a browser is running can be told from this file.
- This changelog, and one version number for the backend and the frontend (they were 0.1.0 and 0.0.0).

### Changed

- The top tabs stay on screen while the page is scrolled, 44px tall and 12px clear of the top edge on a phone, so a
  tab is easy to hit from anywhere on a long page.
- Swiping back no longer walks through every tab pressed. Tabs, filters and page numbers replace the current history
  entry instead of adding one, and pressing a tab starts a fresh history, so swiping back from a tab leaves the app
  rather than returning to a list or word opened from another tab. The "Back to …" links go back one step when the
  page was opened from there.
- "Add new words" on the study-complete page opens the same add-word panel as "+ Add" instead of leaving the page,
  and is offered only when there are no more words to study ("Study more new words" otherwise).
- Holding a finger on a link no longer opens iOS's link menu and address preview.

## [1.0.0] - 2026-11-01

The first version for daily use.

### Vocabulary

- Add a word or phrase; its details are filled in by Claude in the background: meanings, phonetic spelling, part of
  speech, examples, collocations, the dictionary spelling and capitals, and the base form of an inflected word
  ("Form of …"). Words with several meanings show them as tabs.
- A word that looks misspelled is stopped with a "Did you mean …?" and a "Yes, add …" button. A failed word can be
  retried or removed. The model calls are limited per user per day.
- Tap any word in a passage or an answer to add it, or use "+ Add" in the tabs.
- The list can be filtered (All, Due today, New, Learning, Familiar, Mastered) and is paged.

### Study

- A daily plan: new words up to the daily goal, plus every review that is due, shown as flashcards with Again, Hard,
  Good and Easy. Scheduling follows SM-2 as Anki applies it, with learning steps. A progress bar, a "Study more new
  words" button, and a folded "Studied today" list on the study-complete page.
- The word can be read aloud when a card appears and when the answer is shown (each a switch in Settings), with a
  speaker button beside every word and the phonetic spelling on the front of the card. Voices are the device's own.

### Reading

- Once a day, after the day's study is complete and at least 10 words were rated, a short passage is written from
  10 to 15 of them at the learner's CLB level minus one. The studied words are highlighted, any other word can be
  tapped to add it, and the passage can be read aloud (Listen, Pause, Resume, Stop, normal or slow). Passages are marked
  read or unread and listed with an Unread / Read filter.

### Quick review game

- A matching game for the day's words: each word is dragged onto its meaning (or chosen and then tapped). A right
  match says the word aloud; a wrong one turns red and buzzes (sound effects can be switched off in Settings). It is
  practice only and never changes the review schedule.

### Account and settings

- Register and sign in (an invite code can be required). Settings: CLB level, daily new-word goal, and time zone
  (the study day starts and ends at midnight in it, on every device).

### The app

- Made for a phone: tight layout, press feedback on buttons, installable to the home screen, and a "new version
  available" bar with a Reload button after an update.
- Runs with Docker Compose (MySQL, backend, and Caddy serving the frontend), with backup and restore scripts.
  GitHub Actions run the backend (including MySQL integration tests) and frontend checks on every pull request.

[1.1.0]: https://github.com/wujiajun/vocabflow/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/wujiajun/vocabflow/releases/tag/v1.0.0
