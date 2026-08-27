package com.vocabflow.security;

import com.vocabflow.identity.infrastructure.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TokenService {
  private final String secret;
  private final int hours;
  private final RevokedTokenRepository revoked;

  public TokenService(
      @Value("${vocabflow.auth.secret}") String s,
      @Value("${vocabflow.auth.token-hours}") int h,
      RevokedTokenRepository r) {
    secret = s;
    hours = h;
    revoked = r;
  }

  public String issue(long id, String email) {
    long exp = Instant.now().plus(Duration.ofHours(hours)).getEpochSecond();
    String body = b64(id + ":" + email + ":" + exp);
    return body + "." + sig(body);
  }

  public Long verify(String token) {
    try {
      String[] p = token.split("\\.");
      if (p.length != 2
          || !MessageDigest.isEqual(sig(p[0]).getBytes(), p[1].getBytes())
          || revoked.existsById(hash(token))) return null;
      String[] v =
          new String(Base64.getUrlDecoder().decode(p[0]), StandardCharsets.UTF_8).split(":", 3);
      return Long.parseLong(v[2]) > Instant.now().getEpochSecond() ? Long.parseLong(v[0]) : null;
    } catch (Exception e) {
      return null;
    }
  }

  public void revoke(String t) {
    Long id = verify(t);
    if (id != null) {
      RevokedTokenEntity e = new RevokedTokenEntity();
      e.tokenHash = hash(t);
      e.expiresAt = Instant.now().plus(Duration.ofHours(hours));
      revoked.save(e);
    }
  }

  private String b64(String s) {
    return b64(s.getBytes(StandardCharsets.UTF_8));
  }

  private String b64(byte[] s) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(s);
  }

  private String sig(String b) {
    try {
      Mac m = Mac.getInstance("HmacSHA256");
      m.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return b64(m.doFinal(b.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private String hash(String x) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(x.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
