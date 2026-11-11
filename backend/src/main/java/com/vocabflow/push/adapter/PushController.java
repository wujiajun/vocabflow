package com.vocabflow.push.adapter;

import com.vocabflow.push.application.PushService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/push")
public class PushController {
  private final PushService service;

  public PushController(PushService service) {
    this.service = service;
  }

  record Config(boolean enabled, String publicKey) {}

  record Subscription(String endpoint, String remindAt) {}

  record SubscribeRequest(
      @NotBlank @Size(max = 512) String endpoint,
      @NotBlank @Size(max = 128) String p256dh,
      @NotBlank @Size(max = 64) String auth,
      @NotBlank String remindAt,
      @Size(max = 64) String deviceZone) {}

  record UnsubscribeRequest(@NotBlank @Size(max = 512) String endpoint) {}

  @GetMapping("/config")
  public Config config() {
    return new Config(service.enabled(), service.enabled() ? service.publicKey() : null);
  }

  @GetMapping("/subscription")
  public List<Subscription> mine(@AuthenticationPrincipal Long userId) {
    return service.mine(userId).stream()
        .map(s -> new Subscription(s.endpoint(), s.remindAt().toString()))
        .toList();
  }

  @PostMapping("/subscription")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void subscribe(
      @AuthenticationPrincipal Long userId, @Valid @RequestBody SubscribeRequest r) {
    service.subscribe(userId, r.endpoint(), r.p256dh(), r.auth(), r.remindAt(), r.deviceZone());
  }

  @DeleteMapping("/subscription")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void unsubscribe(
      @AuthenticationPrincipal Long userId, @Valid @RequestBody UnsubscribeRequest r) {
    service.unsubscribe(userId, r.endpoint());
  }
}
