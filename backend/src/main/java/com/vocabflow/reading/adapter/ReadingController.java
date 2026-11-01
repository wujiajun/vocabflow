package com.vocabflow.reading.adapter;

import com.vocabflow.reading.application.ReadingService;
import com.vocabflow.reading.domain.ReadingPage;
import com.vocabflow.reading.domain.ReadingPassage;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reading")
public class ReadingController {
  private final ReadingService service;

  public ReadingController(ReadingService service) {
    this.service = service;
  }

  record GenerateRequest(@NotNull(message = "Date is required") LocalDate date) {}

  record ReadRequest(@NotNull(message = "read is required") Boolean read) {}

  record Passage(
      long id,
      LocalDate studyDate,
      Instant createdAt,
      String title,
      String text,
      List<String> words,
      boolean read,
      Instant readAt) {}

  record Summary(
      long id, LocalDate studyDate, Instant createdAt, String title, int wordCount, boolean read) {}

  record PageResponse(
      List<Summary> content, int page, int size, long totalElements, int totalPages) {}

  record Today(Long passageId) {}

  @PostMapping("/passages")
  public Passage generate(
      @AuthenticationPrincipal Long userId,
      @RequestBody @jakarta.validation.Valid GenerateRequest request) {
    return map(service.generate(userId, request.date()));
  }

  @GetMapping("/today")
  public Today today(
      @AuthenticationPrincipal Long userId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    return new Today(service.forDate(userId, date).map(ReadingPassage::id).orElse(null));
  }

  @GetMapping("/passages")
  public PageResponse list(
      @AuthenticationPrincipal Long userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) Boolean read) {
    ReadingPage result = service.list(userId, read, page, size);
    return new PageResponse(
        result.content().stream().map(this::summary).toList(),
        result.page(),
        result.size(),
        result.totalElements(),
        result.totalPages());
  }

  @GetMapping("/passages/{id}")
  public Passage detail(@AuthenticationPrincipal Long userId, @PathVariable long id) {
    return map(service.detail(userId, id));
  }

  @PutMapping("/passages/{id}/read")
  public Passage setRead(
      @AuthenticationPrincipal Long userId,
      @PathVariable long id,
      @RequestBody @jakarta.validation.Valid ReadRequest request) {
    return map(service.setRead(userId, id, request.read()));
  }

  private Passage map(ReadingPassage passage) {
    return new Passage(
        passage.id(),
        passage.studyDate(),
        passage.createdAt(),
        passage.title(),
        passage.body(),
        passage.words(),
        passage.read(),
        passage.readAt());
  }

  private Summary summary(ReadingPassage passage) {
    return new Summary(
        passage.id(),
        passage.studyDate(),
        passage.createdAt(),
        passage.title(),
        passage.words().size(),
        passage.read());
  }
}
