package com.vocabflow.learning.adapter;

import com.vocabflow.learning.application.GameWordService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/game-words")
public class GameWordController {
  private final GameWordService words;

  public GameWordController(GameWordService words) {
    this.words = words;
  }

  record RankedResponse(LocalDate date, List<Long> wordIds) {}

  record PlayedRequest(
      @NotEmpty(message = "Word ids are required")
          @Size(max = GameWordService.MAX_PLAYED_AT_ONCE, message = "Too many words")
          List<@NotNull(message = "Word id is required") Long> wordIds) {}

  /** The words the next game round should draw from, best first. */
  @GetMapping
  public RankedResponse ranked(
      @AuthenticationPrincipal Long userId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate date) {
    if (date == null) {
      throw new com.vocabflow.shared.web.BadRequestException("Date is required");
    }
    return new RankedResponse(date, words.ranked(userId, date));
  }

  /** The words a round really used, so the next rounds rotate away from them. */
  @PostMapping("/played")
  public ResponseEntity<Void> played(
      @AuthenticationPrincipal Long userId, @RequestBody @Valid PlayedRequest request) {
    words.played(userId, request.wordIds());
    return ResponseEntity.noContent().build();
  }
}
