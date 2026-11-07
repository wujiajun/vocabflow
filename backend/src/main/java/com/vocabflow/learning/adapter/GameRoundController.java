package com.vocabflow.learning.adapter;

import com.vocabflow.learning.application.GameRoundService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/game-rounds")
public class GameRoundController {
  private final GameRoundService rounds;

  public GameRoundController(GameRoundService rounds) {
    this.rounds = rounds;
  }

  record RoundRequest(
      @NotNull(message = "Game is required") String game,
      @NotNull(message = "Stars are required") Integer stars,
      @NotNull(message = "Mistakes are required") Integer mistakes,
      @NotNull(message = "Word count is required") Integer wordCount,
      @NotNull(message = "Date is required") LocalDate date) {}

  record RoundResponse(long id) {}

  /** Logs a finished round of a practice game for the signed-in user. */
  @PostMapping
  public ResponseEntity<RoundResponse> record(
      @AuthenticationPrincipal Long userId, @RequestBody @Valid RoundRequest request) {
    long id =
        rounds.record(
            userId,
            request.game(),
            request.stars(),
            request.mistakes(),
            request.wordCount(),
            request.date());
    return ResponseEntity.status(201).body(new RoundResponse(id));
  }
}
