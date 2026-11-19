package com.vocabflow.quickadd.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "quick_add_keys")
public class QuickAddKeyEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "key_hash", nullable = false, length = 64)
  public String keyHash;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;

  @Column(name = "last_used_at")
  public Instant lastUsedAt;
}
