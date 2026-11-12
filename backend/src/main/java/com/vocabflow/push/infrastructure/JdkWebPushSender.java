package com.vocabflow.push.infrastructure;

import com.vocabflow.push.application.PushSubscription;
import com.vocabflow.push.application.WebPushSender;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;
import java.time.Clock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Sends Web Push messages with the JDK's HTTP client. Off (and quiet) when the VAPID keys are not
 * set. The private key and the payload are never logged.
 */
@Component
public class JdkWebPushSender implements WebPushSender {
  private static final Logger log = LoggerFactory.getLogger(JdkWebPushSender.class);

  private final String publicKey;
  private final PrivateKey privateKey;
  private final String subject;
  private final Clock clock;
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  public JdkWebPushSender(
      @Value("${vocabflow.push.public-key:}") String publicKey,
      @Value("${vocabflow.push.private-key:}") String privateKey,
      @Value("${vocabflow.push.subject:}") String subject,
      Clock clock) {
    this.clock = clock;
    PrivateKey key = null;
    String usable = "";
    if (!publicKey.isBlank() && !privateKey.isBlank() && !subject.isBlank()) {
      try {
        WebPushCrypto.publicKey(WebPushCrypto.decode(publicKey));
        key = WebPushCrypto.privateKey(WebPushCrypto.decode(privateKey));
        usable = publicKey;
      } catch (Exception e) {
        log.warn("The push keys are not valid, so daily reminders are off");
      }
    }
    this.publicKey = usable;
    this.privateKey = key;
    this.subject = subject;
  }

  @Override
  public boolean enabled() {
    return privateKey != null;
  }

  @Override
  public String publicKey() {
    return publicKey;
  }

  @Override
  public Result send(PushSubscription subscription, String payload) {
    if (!enabled()) {
      return Result.FAILED;
    }
    try {
      byte[] body =
          WebPushCrypto.encrypt(
              payload.getBytes(StandardCharsets.UTF_8),
              WebPushCrypto.decode(subscription.p256dh()),
              WebPushCrypto.decode(subscription.auth()));
      String authorization =
          WebPushCrypto.vapidHeader(
              subscription.endpoint(),
              subject,
              privateKey,
              publicKey,
              clock.instant().getEpochSecond() + Duration.ofHours(12).toSeconds());
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(subscription.endpoint()))
              .timeout(Duration.ofSeconds(20))
              .header("Content-Encoding", "aes128gcm")
              .header("Content-Type", "application/octet-stream")
              .header("Authorization", authorization)
              .header("TTL", "7200")
              .header("Urgency", "normal")
              .POST(HttpRequest.BodyPublishers.ofByteArray(body))
              .build();
      int status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
      if (status >= 200 && status < 300) {
        return Result.SENT;
      }
      if (status == 404 || status == 410) {
        return Result.GONE;
      }
      log.warn("The push service answered {}", status);
      return Result.FAILED;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return Result.FAILED;
    } catch (Exception e) {
      log.warn("Sending a push failed: {}", e.getClass().getSimpleName());
      return Result.FAILED;
    }
  }
}
