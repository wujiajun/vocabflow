package com.vocabflow.push.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class WebPushCryptoTest {
  // The worked example of RFC 8291, appendix A.
  private static final String AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
  private static final String AS_PUBLIC =
      "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
  private static final String UA_PUBLIC =
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
  private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
  private static final String SALT = "DGv6ra1nlYgDCS1FRnbzlw";
  private static final String EXPECTED =
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

  @Test
  void matchesTheExampleInTheRfc() throws Exception {
    KeyPair server =
        new KeyPair(
            WebPushCrypto.publicKey(WebPushCrypto.decode(AS_PUBLIC)),
            WebPushCrypto.privateKey(WebPushCrypto.decode(AS_PRIVATE)));

    byte[] body =
        WebPushCrypto.encrypt(
            "When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8),
            WebPushCrypto.decode(UA_PUBLIC),
            WebPushCrypto.decode(AUTH),
            server,
            WebPushCrypto.decode(SALT));

    assertThat(WebPushCrypto.encode(body)).isEqualTo(EXPECTED);
  }

  @Test
  void aFreshEncryptionHasTheRecordHeaderAndAnUncompressedKey() throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
    generator.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair browser = generator.generateKeyPair();

    byte[] body =
        WebPushCrypto.encrypt(
            "hello".getBytes(StandardCharsets.UTF_8),
            WebPushCrypto.point((ECPublicKey) browser.getPublic()),
            new byte[16]);

    assertThat(body[16 + 3]).isEqualTo((byte) 0); // record size 4096 = 00 00 10 00
    assertThat(body[16 + 2]).isEqualTo((byte) 0x10);
    assertThat(body[20]).isEqualTo((byte) 65);
    assertThat(body[21]).isEqualTo((byte) 4);
    assertThat(body.length).isEqualTo(16 + 4 + 1 + 65 + "hello".length() + 1 + 16);
  }

  @Test
  void theVapidTokenCarriesTheOriginAndVerifies() throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
    generator.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair keys = generator.generateKeyPair();
    PrivateKey priv = keys.getPrivate();
    String pub = WebPushCrypto.encode(WebPushCrypto.point((ECPublicKey) keys.getPublic()));

    String header =
        WebPushCrypto.vapidHeader(
            "https://push.example.test/send/abc",
            "mailto:a@example.test",
            priv,
            pub,
            1_900_000_000L);

    assertThat(header).startsWith("vapid t=").endsWith(", k=" + pub);
    String token = header.substring("vapid t=".length(), header.indexOf(", k="));
    String[] parts = token.split("\\.");
    String claims = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
    assertThat(claims)
        .contains("\"aud\":\"https://push.example.test\"")
        .contains("\"exp\":1900000000")
        .contains("\"sub\":\"mailto:a@example.test\"");
    byte[] raw = Base64.getUrlDecoder().decode(parts[2]);
    assertThat(raw).hasSize(64);
    Signature verify = Signature.getInstance("SHA256withECDSAinP1363Format");
    verify.initVerify(
        KeyFactory.getInstance("EC")
            .generatePublic(
                new java.security.spec.X509EncodedKeySpec(keys.getPublic().getEncoded())));
    verify.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
    assertThat(verify.verify(raw)).isTrue();
  }

  @Test
  void aShortScalarIsPaddedWithZerosOnTheLeft() {
    // A private key below 2^248 has a 31-byte two's-complement form; about 1 in 256 random keys.
    BigInteger small =
        new BigInteger("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", 16);
    assertThat(small.toByteArray()).hasSize(31);

    byte[] fixed = WebPushCrypto.fixed32(small);

    assertThat(fixed).hasSize(32);
    assertThat(fixed[0]).isZero();
    assertThat(new BigInteger(1, fixed)).isEqualTo(small);
  }

  @Test
  void aScalarWithTheHighBitSetKeepsExactly32Bytes() {
    BigInteger high = BigInteger.ONE.shiftLeft(255).add(BigInteger.ONE);
    assertThat(high.toByteArray()).hasSize(33);

    byte[] fixed = WebPushCrypto.fixed32(high);

    assertThat(fixed).hasSize(32);
    assertThat(new BigInteger(1, fixed)).isEqualTo(high);
  }
}
