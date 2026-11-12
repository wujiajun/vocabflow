package com.vocabflow.push.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import com.vocabflow.push.application.PushSubscription;
import com.vocabflow.push.application.WebPushSender.Result;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Clock;
import java.time.LocalTime;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Talks to a server on this machine only; nothing leaves it. */
class JdkWebPushSenderTest {
  private HttpServer server;
  private final AtomicInteger answer = new AtomicInteger(201);
  private final AtomicReference<String> authorization = new AtomicReference<>();
  private final AtomicReference<String> encoding = new AtomicReference<>();
  private JdkWebPushSender sender;
  private PushSubscription subscription;

  @BeforeEach
  void start() throws Exception {
    server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    server.createContext(
        "/push",
        exchange -> {
          authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
          encoding.set(exchange.getRequestHeaders().getFirst("Content-Encoding"));
          exchange.getRequestBody().readAllBytes();
          exchange.sendResponseHeaders(answer.get(), -1);
          exchange.close();
        });
    server.start();

    KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
    generator.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair vapid = generator.generateKeyPair();
    KeyPair browser = generator.generateKeyPair();
    sender =
        new JdkWebPushSender(
            WebPushCrypto.encode(WebPushCrypto.point((ECPublicKey) vapid.getPublic())),
            WebPushCrypto.encode(
                java.util.Arrays.copyOfRange(
                    ((java.security.interfaces.ECPrivateKey) vapid.getPrivate())
                        .getS()
                        .toByteArray(),
                    ((java.security.interfaces.ECPrivateKey) vapid.getPrivate())
                            .getS()
                            .toByteArray()
                            .length
                        - 32,
                    ((java.security.interfaces.ECPrivateKey) vapid.getPrivate())
                        .getS()
                        .toByteArray()
                        .length)),
            "mailto:test@example.test",
            Clock.systemUTC());
    subscription =
        new PushSubscription(
            1,
            1,
            "http://127.0.0.1:" + server.getAddress().getPort() + "/push",
            WebPushCrypto.encode(WebPushCrypto.point((ECPublicKey) browser.getPublic())),
            WebPushCrypto.encode(new byte[16]),
            LocalTime.of(19, 0),
            null,
            null);
  }

  @AfterEach
  void stop() {
    server.stop(0);
  }

  @Test
  void aCreatedAnswerIsSentAndTheRequestIsSigned() {
    assertThat(sender.enabled()).isTrue();

    assertThat(sender.send(subscription, "{\"body\":\"hi\"}")).isEqualTo(Result.SENT);

    assertThat(authorization.get()).startsWith("vapid t=").contains(", k=");
    assertThat(encoding.get()).isEqualTo("aes128gcm");
  }

  @Test
  void notFoundAndGoneMeanTheSubscriptionIsGone() {
    answer.set(404);
    assertThat(sender.send(subscription, "{}")).isEqualTo(Result.GONE);
    answer.set(410);
    assertThat(sender.send(subscription, "{}")).isEqualTo(Result.GONE);
  }

  @Test
  void otherAnswersAreFailures() {
    answer.set(503);
    assertThat(sender.send(subscription, "{}")).isEqualTo(Result.FAILED);
  }

  @Test
  void withoutKeysTheSenderIsOffAndSendsNothing() {
    var off = new JdkWebPushSender("", "", "", Clock.systemUTC());

    assertThat(off.enabled()).isFalse();
    assertThat(off.send(subscription, "{}")).isEqualTo(Result.FAILED);
    assertThat(authorization.get()).isNull();
  }

  @Test
  void badKeysTurnTheSenderOffInsteadOfFailingStartup() {
    var broken = new JdkWebPushSender("nonsense", "nonsense", "mailto:a@b.test", Clock.systemUTC());

    assertThat(broken.enabled()).isFalse();
  }
}
