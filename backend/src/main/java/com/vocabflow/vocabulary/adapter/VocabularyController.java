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

  record Create(
      @NotBlank @Size(max = 255) String term,
      @Size(max = 5000) String sentence,
      @Size(max = 255) String form,
      @Size(max = 500) String sourceTitle,
      @Size(max = 500) String sourceLink) {}

  record Source(String sentence, String form, String title, String link) {}

  record Sense(
      String partOfSpeech,
      String label,
      String phonetic,
      String definition,
      List<String> examples,
      List<String> collocations,
      List<String> synonyms,
      List<String> antonyms,
      String scene,
      String emoji,
      String parts,
      String chinese) {}

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
      String baseForm,
      String spellingSuggestion,
      String enrichmentStatus,
      String failureReason,
      String learningStatus,
      Instant createdAt,
      Source source) {}

  record PageResponse(List<Item> content, int page, int size, long totalElements, int totalPages) {}

  private Item map(UserVocabulary userVocabulary) {
    VocabularyItem item = userVocabulary.item();
    SourceContext source = userVocabulary.source();
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
                        sense.collocations(),
                        sense.synonyms(),
                        sense.antonyms(),
                        sense.scene(),
                        sense.emoji(),
                        sense.parts(),
                        sense.chinese()))
            .toList(),
        item.baseForm(),
        item.spellingSuggestion(),
        item.enrichmentStatus().name(),
        item.failureReason(),
        userVocabulary.learningStatus().name(),
        userVocabulary.createdAt(),
        source == null
            ? null
            : new Source(source.sentence(), source.form(), source.title(), source.link()));
  }

  @PostMapping
  public Item create(
      @AuthenticationPrincipal Long userId, @RequestBody @jakarta.validation.Valid Create request) {
    SourceContext source =
        SourceContext.of(
            request.sentence(), request.form(), request.sourceTitle(), request.sourceLink());
    return map(service.add(userId, request.term(), source));
  }

  @GetMapping
  public PageResponse list(
      @AuthenticationPrincipal Long userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) LearningStatus status,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate due,
      @RequestParam(required = false) String q) {
    VocabularyPage result = service.list(userId, page, size, status, due, q);
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

  @DeleteMapping("/{id}")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  public void remove(@AuthenticationPrincipal Long userId, @PathVariable long id) {
    service.remove(userId, id);
  }

  @GetMapping("/{id}")
  public Item detail(@AuthenticationPrincipal Long userId, @PathVariable long id) {
    return map(service.detail(userId, id));
  }
}
