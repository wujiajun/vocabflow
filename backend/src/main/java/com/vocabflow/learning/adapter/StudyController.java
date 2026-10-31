package com.vocabflow.learning.adapter;

import com.vocabflow.learning.application.StudyQueue;
import com.vocabflow.learning.application.StudyService;
import com.vocabflow.learning.domain.CardState;
import com.vocabflow.learning.domain.Rating;
import com.vocabflow.learning.domain.ReviewCard;
import com.vocabflow.vocabulary.domain.StudyContent;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning")
public class StudyController {
  private final StudyService study;

  public StudyController(StudyService study) {
    this.study = study;
  }

  record ReviewRequest(
      @NotNull(message = "Rating is required") Rating rating,
      @NotNull(message = "Version is required") @Min(0) Integer version,
      @NotNull(message = "Date is required") LocalDate date) {}

  /** Exactly one of minutes and days is set: when the card comes back after this rating. */
  record RatingOption(String rating, Long intervalMinutes, Integer intervalDays) {}

  record Card(
      long userVocabularyId,
      String term,
      String type,
      String phonetic,
      String partOfSpeech,
      String definition,
      List<String> examples,
      List<String> collocations,
      String state,
      int version,
      List<RatingOption> options) {}

  record QueueResponse(
      LocalDate date,
      int learningCount,
      int reviewCount,
      int newCount,
      int unavailableCount,
      Card nextCard,
      Instant nextDueAt) {}

  @GetMapping("/study-queue")
  public QueueResponse queue(
      @AuthenticationPrincipal Long userId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate date) {
    return map(study.next(userId, date));
  }

  @PostMapping("/cards/{userVocabularyId}/reviews")
  public QueueResponse review(
      @AuthenticationPrincipal Long userId,
      @PathVariable long userVocabularyId,
      @RequestBody @Valid ReviewRequest request) {
    return map(
        study.review(
            userId, userVocabularyId, request.rating(), request.version(), request.date()));
  }

  private QueueResponse map(StudyQueue queue) {
    return new QueueResponse(
        queue.date(),
        queue.learningCount(),
        queue.reviewCount(),
        queue.newCount(),
        queue.unavailable(),
        queue.nextCard() == null ? null : map(queue.nextCard()),
        queue.nextDueAt());
  }

  private Card map(StudyQueue.NextCard next) {
    StudyContent content = next.content();
    return new Card(
        content.userVocabularyId(),
        content.term(),
        content.type() == null ? null : content.type().name(),
        content.phonetic(),
        content.partOfSpeech(),
        content.definition(),
        content.examples(),
        content.collocations(),
        next.card().state().name(),
        next.version(),
        Arrays.stream(Rating.values())
            .map(rating -> option(rating, next.outcomes().get(rating), next))
            .toList());
  }

  private RatingOption option(Rating rating, ReviewCard outcome, StudyQueue.NextCard next) {
    return outcome.state() == CardState.REVIEW
        ? new RatingOption(rating.name(), null, outcome.intervalDays())
        : new RatingOption(
            rating.name(), Duration.between(next.scheduledAt(), outcome.dueAt()).toMinutes(), null);
  }
}
