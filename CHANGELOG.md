# Changelog

All notable changes to VocabFlow. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/): a fix raises the last number, a new feature or a change
in how the app is used raises the middle one, and a change that breaks what was stored or how it is run raises the
first. Each release is a `vX.Y.Z` tag; the number is shown at the bottom of Settings.

## [Unreleased]

### Changed

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
