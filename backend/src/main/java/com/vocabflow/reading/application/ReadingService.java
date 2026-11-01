package com.vocabflow.reading.application;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.identity.domain.User;
import com.vocabflow.reading.domain.*;
import com.vocabflow.shared.web.*;
import com.vocabflow.vocabulary.application.EnrichmentRejectedException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Deliberately not @Transactional: the model call takes seconds and must not hold a connection, and
 * the repository's saveIfAbsent catches a duplicate-key error, which a shared transaction would
 * poison.
 */
@Service
public class ReadingService {
  private static final Logger log = LoggerFactory.getLogger(ReadingService.class);

  static final int MIN_WORDS = 10;
  static final int MAX_WORDS = 15;

  private final ReadingPassageRepository passages;
  private final StudiedWords studied;
  private final UserRepository users;
  private final ReadingProvider provider;
  private final ModelQuota quota;

  public ReadingService(
      ReadingPassageRepository passages,
      StudiedWords studied,
      UserRepository users,
      ReadingProvider provider,
      ModelQuota quota) {
    this.passages = passages;
    this.studied = studied;
    this.users = users;
    this.provider = provider;
    this.quota = quota;
  }

  /**
   * Writes the day's passage, once: asking again for a day that has one returns it. Only after the
   * day's study has ended, and only when enough words were studied. A failure uses up nothing the
   * user could count on, so they can ask again.
   */
  public ReadingPassage generate(long userId, LocalDate date) {
    Optional<ReadingPassage> existing = passages.findByUserIdAndStudyDate(userId, date);
    if (existing.isPresent()) {
      return existing.get();
    }
    if (!studied.isFinished(userId, date)) {
      throw new ConflictException("Finish today's study before writing a passage");
    }
    List<StudiedWord> words = studied.studiedOn(userId, date);
    if (words.size() < MIN_WORDS) {
      throw new ConflictException(
          "You studied "
              + words.size()
              + (words.size() == 1 ? " word or phrase" : " words or phrases")
              + " today. A passage needs at least "
              + MIN_WORDS
              + ".");
    }
    List<StudiedWord> picked = ReadingWordPicker.pick(words, MAX_WORDS);
    User user = users.findById(userId).orElseThrow();
    // One level below the learner's own, so the passage reads easily and the new words stand out.
    int level = Math.max(1, user.clbLevel().ordinal());
    if (!quota.tryConsume(userId)) {
      throw new TooManyRequestsException("Daily enrichment limit reached");
    }
    ReadingContent content = write(level, picked);
    ReadingPassage fresh =
        new ReadingPassage(
            0,
            userId,
            date,
            content.title(),
            content.body(),
            content.words(),
            null,
            Instant.now(),
            provider.source());
    // Another request may have written the day's passage in the meantime; that one stands.
    return passages
        .saveIfAbsent(fresh)
        .orElseGet(() -> passages.findByUserIdAndStudyDate(userId, date).orElseThrow());
  }

  // A reply that cannot be used, such as one naming a word it did not write, is asked for again
  // once; the user's allowance was used for the passage, not for each try.
  private ReadingContent write(int level, List<StudiedWord> picked) {
    List<TargetWord> targets =
        picked.stream().map(word -> new TargetWord(word.term(), word.meanings())).toList();
    try {
      try {
        return provider.write(level, targets);
      } catch (EnrichmentRejectedException rejected) {
        log.warn("A passage was rejected, trying once more: {}", rejected.getMessage());
        return provider.write(level, targets);
      }
    } catch (RuntimeException exception) {
      // The class name only: provider messages can echo request details.
      log.warn("Writing a passage failed: {}", exception.getClass().getSimpleName());
      throw new ServiceUnavailableException(
          "A passage could not be written just now. Please try again in a moment.");
    }
  }

  public Optional<ReadingPassage> forDate(long userId, LocalDate date) {
    return passages.findByUserIdAndStudyDate(userId, date);
  }

  public ReadingPage list(long userId, Boolean read, int page, int size) {
    return passages.list(userId, read, Math.max(page, 0), Math.min(Math.max(size, 1), 100));
  }

  public ReadingPassage detail(long userId, long id) {
    return passages
        .findByIdAndUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("Passage was not found"));
  }

  public ReadingPassage setRead(long userId, long id, boolean read) {
    ReadingPassage passage = detail(userId, id);
    if (passage.read() == read) {
      return passage;
    }
    return passages.save(passage.withReadAt(read ? Instant.now() : null));
  }
}
