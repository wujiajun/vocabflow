package com.vocabflow.identity.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users")
public class UserEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false, unique = true)
  public String email;

  @Column(name = "password_hash", nullable = false)
  public String passwordHash;

  @Column(name = "clb_level", nullable = false)
  public String clbLevel;

  @Column(name = "daily_new_vocabulary_goal", nullable = false)
  public int dailyGoal;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;

  @Column(name = "time_zone")
  public String timeZone;
}
