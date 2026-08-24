package com.vocabflow.vocabulary.adapter;

import com.vocabflow.shared.infrastructure.JsonSupport;
import com.vocabflow.vocabulary.application.VocabularyService;
import com.vocabflow.vocabulary.infrastructure.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Page;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/vocabulary")
public class VocabularyController {
  final VocabularyService service;

  public VocabularyController(VocabularyService s) {
    service = s;
  }

  record Create(@NotBlank @Size(max = 255) String term) {}

  record Item(
      long id,
      String term,
      String type,
      String phonetic,
      String partOfSpeech,
      String definition,
      List<String> examples,
      List<String> collocations,
      String enrichmentStatus,
      String learningStatus,
      Instant createdAt) {}

  record PageResponse(List<Item> content, int page, int size, long totalElements, int totalPages) {}

  private Item map(UserVocabularyEntity u) {
    var i = u.item;
    return new Item(
        u.id,
        i.term,
        i.type,
        i.phonetic,
        i.partOfSpeech,
        i.definition,
        JsonSupport.read(i.examples),
        JsonSupport.read(i.collocations),
        i.enrichmentStatus,
        u.learningStatus,
        u.createdAt);
  }

  @PostMapping
  public Item create(
      @AuthenticationPrincipal Long id, @RequestBody @jakarta.validation.Valid Create r) {
    return map(service.add(id, r.term));
  }

  @GetMapping
  public PageResponse list(
      @AuthenticationPrincipal Long id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Page<UserVocabularyEntity> p = service.list(id, page, size);
    return new PageResponse(
        p.map(this::map).getContent(),
        p.getNumber(),
        p.getSize(),
        p.getTotalElements(),
        p.getTotalPages());
  }

  @GetMapping("/{id}")
  public Item detail(@AuthenticationPrincipal Long userId, @PathVariable long id) {
    return map(service.detail(userId, id));
  }
}
