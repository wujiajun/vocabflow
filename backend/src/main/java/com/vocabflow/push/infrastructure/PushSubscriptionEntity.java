package com.vocabflow.push.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "push_subscriptions")
public class PushSubscriptionEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(nullable = false, length = 512)
  public String endpoint;

  @Column(nullable = false, length = 128)
  public String p256dh;

  @Column(nullable = false, length = 64)
  public String auth;

  @Column(name = "remind_at", nullable = false)
  public LocalTime remindAt;

  @Column(name = "device_zone", length = 64)
  public String deviceZone;

  @Column(name = "last_sent_date")
  public LocalDate lastSentDate;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;
}
