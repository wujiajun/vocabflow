package com.vocabflow.push.infrastructure;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * The two pieces of Web Push, written with the JDK's own crypto so that no library has to be added:
 * the message encryption of RFC 8291 (aes128gcm, RFC 8188) and the VAPID token of RFC 8292.
 */
final class WebPushCrypto {
  private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
  private static final ECParameterSpec P256 = p256();

  private WebPushCrypto() {}

  static byte[] decode(String base64Url) {
    return Base64.getUrlDecoder().decode(base64Url);
  }

  static String encode(byte[] bytes) {
    return B64.encodeToString(bytes);
  }

  /** Encrypts for the browser's keys with a fresh key pair and salt. */
  static byte[] encrypt(byte[] payload, byte[] browserPublic, byte[] authSecret)
      throws GeneralSecurityException {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
    generator.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair pair = generator.generateKeyPair();
    byte[] salt = new byte[16];
    new SecureRandom().nextBytes(salt);
    return encrypt(payload, browserPublic, authSecret, pair, salt);
  }

  /** The same with the key pair and salt given (the RFC's example fixes them). */
  static byte[] encrypt(
      byte[] payload, byte[] browserPublic, byte[] authSecret, KeyPair server, byte[] salt)
      throws GeneralSecurityException {
    byte[] serverPublic = point((ECPublicKey) server.getPublic());
    KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
    agreement.init(server.getPrivate());
    agreement.doPhase(publicKey(browserPublic), true);
    byte[] shared = agreement.generateSecret();

    byte[] keyInfo =
        concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), browserPublic, serverPublic);
    byte[] ikm = expand(extract(authSecret, shared), keyInfo, 32);
    byte[] prk = extract(salt, ikm);
    byte[] cek =
        expand(prk, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
    byte[] nonce = expand(prk, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

    // One record: the payload, then 0x02 marking it as the last.
    byte[] plain = concat(payload, new byte[] {2});
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(
        Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
    byte[] encrypted = cipher.doFinal(plain);

    ByteArrayOutputStream out = new ByteArrayOutputStream();
    out.writeBytes(salt);
    out.writeBytes(new byte[] {0, 0, 0x10, 0}); // record size 4096
    out.write(serverPublic.length);
    out.writeBytes(serverPublic);
    out.writeBytes(encrypted);
    return out.toByteArray();
  }

  /** The value of the Authorization header for a push service address. */
  static String vapidHeader(
      String endpoint, String subject, PrivateKey key, String publicKey, long expiresAtSeconds)
      throws GeneralSecurityException {
    URI uri = URI.create(endpoint);
    String audience = uri.getScheme() + "://" + uri.getAuthority();
    String header = encode("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
    String claims =
        encode(
            ("{\"aud\":\""
                    + audience
                    + "\",\"exp\":"
                    + expiresAtSeconds
                    + ",\"sub\":\""
                    + subject
                    + "\"}")
                .getBytes(StandardCharsets.UTF_8));
    String signing = header + "." + claims;
    Signature signature = Signature.getInstance("SHA256withECDSA");
    signature.initSign(key);
    signature.update(signing.getBytes(StandardCharsets.US_ASCII));
    String token = signing + "." + encode(derToRaw(signature.sign()));
    return "vapid t=" + token + ", k=" + publicKey;
  }

  static PrivateKey privateKey(byte[] scalar) throws GeneralSecurityException {
    return KeyFactory.getInstance("EC")
        .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, scalar), P256));
  }

  static PublicKey publicKey(byte[] uncompressed) throws GeneralSecurityException {
    if (uncompressed.length != 65 || uncompressed[0] != 4) {
      throw new GeneralSecurityException("Not an uncompressed P-256 point");
    }
    BigInteger x = new BigInteger(1, Arrays.copyOfRange(uncompressed, 1, 33));
    BigInteger y = new BigInteger(1, Arrays.copyOfRange(uncompressed, 33, 65));
    return KeyFactory.getInstance("EC")
        .generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
  }

  static byte[] point(ECPublicKey key) {
    byte[] out = new byte[65];
    out[0] = 4;
    copyFixed(key.getW().getAffineX(), out, 1);
    copyFixed(key.getW().getAffineY(), out, 33);
    return out;
  }

  private static void copyFixed(BigInteger value, byte[] target, int offset) {
    byte[] raw = value.toByteArray();
    int length = Math.min(raw.length, 32);
    System.arraycopy(raw, raw.length - length, target, offset + 32 - length, length);
  }

  // HKDF (RFC 5869) with SHA-256; the outputs here are at most one block long.
  private static byte[] extract(byte[] salt, byte[] ikm) throws GeneralSecurityException {
    return hmac(salt, ikm);
  }

  private static byte[] expand(byte[] prk, byte[] info, int length)
      throws GeneralSecurityException {
    byte[] block = hmac(prk, concat(info, new byte[] {1}));
    return Arrays.copyOf(block, length);
  }

  private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(key, "HmacSHA256"));
    return mac.doFinal(data);
  }

  private static byte[] concat(byte[]... parts) {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    for (byte[] part : parts) {
      out.writeBytes(part);
    }
    return out.toByteArray();
  }

  /** ECDSA signatures come as DER from the JDK; a JWT wants the two 32-byte numbers joined. */
  private static byte[] derToRaw(byte[] der) {
    int offset = 2;
    if ((der[1] & 0xff) == 0x81) {
      offset = 3;
    }
    int rLength = der[offset + 1];
    BigInteger r = new BigInteger(1, Arrays.copyOfRange(der, offset + 2, offset + 2 + rLength));
    int sOffset = offset + 2 + rLength;
    int sLength = der[sOffset + 1];
    BigInteger s = new BigInteger(1, Arrays.copyOfRange(der, sOffset + 2, sOffset + 2 + sLength));
    byte[] out = new byte[64];
    copyFixed(r, out, 0);
    copyFixed(s, out, 32);
    return out;
  }

  private static ECParameterSpec p256() {
    try {
      AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
      parameters.init(new ECGenParameterSpec("secp256r1"));
      return parameters.getParameterSpec(ECParameterSpec.class);
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }
}
