package com.vocabflow.identity.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "revoked_tokens")
public class RevokedTokenEntity {
  @Id
  @Column(name = "token_hash")
  public String tokenHash;

  @Column(name = "expires_at")
  public Instant expiresAt;
}
