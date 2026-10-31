package com.vocabflow.identity.application;

import com.vocabflow.shared.web.ForbiddenException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Limits registration to people given the code. With no code configured, anyone may register. */
@Component
public class InviteCodeGate {
  private final byte[] expected;

  public InviteCodeGate(@Value("${vocabflow.auth.invite-code:}") String inviteCode) {
    expected = inviteCode.getBytes(StandardCharsets.UTF_8);
  }

  public void check(String provided) {
    if (expected.length == 0) {
      return;
    }
    byte[] actual = (provided == null ? "" : provided).getBytes(StandardCharsets.UTF_8);
    if (!MessageDigest.isEqual(expected, actual)) {
      throw new ForbiddenException("That invite code is not valid");
    }
  }
}
