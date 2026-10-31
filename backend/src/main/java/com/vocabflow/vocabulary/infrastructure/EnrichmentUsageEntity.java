package com.vocabflow.vocabulary.infrastructure;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "enrichment_usage")
public class EnrichmentUsageEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "usage_date", nullable = false)
  public LocalDate usageDate;

  @Column(name = "request_count", nullable = false)
  public int requestCount;
}
