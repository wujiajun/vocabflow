package com.vocabflow.identity.adapter;

import com.vocabflow.identity.application.*;
import com.vocabflow.identity.domain.User;
import com.vocabflow.security.BearerTokenExtractor;
import com.vocabflow.security.TokenService;
import com.vocabflow.shared.web.BadRequestException;
import com.vocabflow.shared.web.UnauthorizedException;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class IdentityController {
  final IdentityService service;
  final TokenService tokens;
  final InviteCodeGate inviteCodes;

  public IdentityController(IdentityService s, TokenService t, InviteCodeGate i) {
    service = s;
    tokens = t;
    inviteCodes = i;
  }

  record Register(
      @Email String email,
      @NotBlank @Size(min = 8) String password,
      String clbLevel,
      @Min(1) @Max(100) Integer dailyNewVocabularyGoal,
      String inviteCode) {}

  /** Either field may be given; whatever is left out stays as it is. */
  record UpdateSettings(
      @Min(value = 1, message = "Daily goal must be between 1 and 100")
          @Max(value = 100, message = "Daily goal must be between 1 and 100")
          Integer dailyNewVocabularyGoal,
      String clbLevel,
      String timeZone) {}

  record Login(@Email String email, @NotBlank String password) {}

  record UserResponse(
      long id, String email, String clbLevel, int dailyNewVocabularyGoal, String timeZone) {}

  record LoginResponse(String accessToken, UserResponse user) {}

  private UserResponse map(User u) {
    return new UserResponse(
        u.id(),
        u.email().value(),
        u.clbLevel().name(),
        u.dailyVocabularyGoal().value(),
        u.timeZone() == null ? null : u.timeZone().getId());
  }

  @PostMapping("/register")
  public UserResponse register(@RequestBody @jakarta.validation.Valid Register r) {
    inviteCodes.check(r.inviteCode);
    return map(
        service.register(
            r.email,
            r.password,
            r.clbLevel,
            r.dailyNewVocabularyGoal == null ? 10 : r.dailyNewVocabularyGoal));
  }

  @PostMapping("/login")
  public LoginResponse login(@RequestBody @jakarta.validation.Valid Login r) {
    User u = service.authenticate(r.email, r.password);
    return new LoginResponse(tokens.issue(u.id(), u.email().value()), map(u));
  }

  @PostMapping("/logout")
  public void logout(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    tokens.revoke(
        BearerTokenExtractor.extract(authorization)
            .orElseThrow(() -> new UnauthorizedException("Authentication is required")));
  }

  @PatchMapping("/me")
  public UserResponse updateSettings(
      @AuthenticationPrincipal Long id, @RequestBody @jakarta.validation.Valid UpdateSettings r) {
    if (r.dailyNewVocabularyGoal == null && r.clbLevel == null && r.timeZone == null) {
      throw new BadRequestException("Give a daily goal, a CLB level or a time zone");
    }
    return map(service.updateSettings(id, r.dailyNewVocabularyGoal, r.clbLevel, r.timeZone));
  }

  @GetMapping("/me")
  public UserResponse me(@AuthenticationPrincipal Long id) {
    return map(service.current(id));
  }
}
