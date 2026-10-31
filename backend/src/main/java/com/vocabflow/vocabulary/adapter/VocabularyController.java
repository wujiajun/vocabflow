package com.vocabflow.vocabulary.adapter;

import com.vocabflow.vocabulary.application.VocabularyService;
import com.vocabflow.vocabulary.domain.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/vocabulary")
public class VocabularyController {
  private final VocabularyService service;

  public VocabularyController(VocabularyService service) {
    this.service = service;
  }

  record Create(@NotBlank @Size(max = 255) String term) {}

  record Sense(
      String partOfSpeech,
      String label,
      String phonetic,
      String definition,
      List<String> examples,
      List<String> collocations) {}

  record Item(
      long id,
      String term,
      String type,
      String phonetic,
      String partOfSpeech,
      String definition,
      List<String> examples,
      List<String> collocations,
      List<Sense> senses,
      String enrichmentStatus,
      String failureReason,
      String learningStatus,
      Instant createdAt) {}

  record PageResponse(List<Item> content, int page, int size, long totalElements, int totalPages) {}

  private Item map(UserVocabulary userVocabulary) {
    VocabularyItem item = userVocabulary.item();
    return new Item(
        userVocabulary.id(),
        item.term().value(),
        item.type() == null ? null : item.type().name(),
        item.phonetic(),
        item.partOfSpeech(),
        item.definition(),
        item.examples(),
        item.collocations(),
        item.displaySenses().stream()
            .map(
                sense ->
                    new Sense(
                        sense.partOfSpeech(),
                        sense.label(),
                        sense.phonetic(),
                        sense.definition(),
                        sense.examples(),
                        sense.collocations()))
            .toList(),
        item.enrichmentStatus().name(),
        item.failureReason(),
        userVocabulary.learningStatus().name(),
        userVocabulary.createdAt());
  }

  @PostMapping
  public Item create(
      @AuthenticationPrincipal Long userId, @RequestBody @jakarta.validation.Valid Create request) {
    return map(service.add(userId, request.term()));
  }

  @GetMapping
  public PageResponse list(
      @AuthenticationPrincipal Long userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) LearningStatus status,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate due) {
    VocabularyPage result = service.list(userId, page, size, status, due);
    return new PageResponse(
        result.content().stream().map(this::map).toList(),
        result.page(),
        result.size(),
        result.totalElements(),
        result.totalPages());
  }

  @PostMapping("/{id}/enrichment/retry")
  public Item retryEnrichment(@AuthenticationPrincipal Long userId, @PathVariable long id) {
    return map(service.retryEnrichment(userId, id));
  }

  @GetMapping("/{id}")
  public Item detail(@AuthenticationPrincipal Long userId, @PathVariable long id) {
    return map(service.detail(userId, id));
  }
}
