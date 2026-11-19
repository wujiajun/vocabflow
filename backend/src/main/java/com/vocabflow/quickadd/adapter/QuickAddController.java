package com.vocabflow.quickadd.adapter;

import com.vocabflow.quickadd.application.QuickAddKeyService;
import com.vocabflow.quickadd.application.QuickAddWords;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/quick-add")
public class QuickAddController {
  private final QuickAddKeyService keys;
  private final QuickAddWords words;

  public QuickAddController(QuickAddKeyService keys, QuickAddWords words) {
    this.keys = keys;
    this.words = words;
  }

  record KeyStatus(boolean exists, Instant createdAt, Instant lastUsedAt) {}

  record NewKey(String key, Instant createdAt) {}

  record AddRequest(@NotBlank @Size(max = 255) String term) {}

  record Added(String term, boolean added, String message) {}

  @GetMapping("/key")
  public KeyStatus status(@AuthenticationPrincipal Long userId) {
    return keys.status(userId)
        .map(status -> new KeyStatus(true, status.createdAt(), status.lastUsedAt()))
        .orElse(new KeyStatus(false, null, null));
  }

  /** Makes a new key (the one before stops working) and shows it this once. */
  @PostMapping("/key")
  public NewKey create(@AuthenticationPrincipal Long userId) {
    QuickAddKeyService.Created created = keys.create(userId);
    return new NewKey(created.key(), created.createdAt());
  }

  @DeleteMapping("/key")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void revoke(@AuthenticationPrincipal Long userId) {
    keys.revoke(userId);
  }

  /**
   * Adds a word. Sent with the quick-add key (header {@code X-Quick-Add-Key}) or a normal sign-in.
   */
  @PostMapping
  public Added add(@AuthenticationPrincipal Long userId, @RequestBody @Valid AddRequest request) {
    QuickAddWords.Result result = words.add(userId, request.term());
    return new Added(
        result.term(),
        result.added(),
        result.added()
            ? "Added “" + result.term() + "”"
            : "“" + result.term() + "” is already in your list");
  }
}
