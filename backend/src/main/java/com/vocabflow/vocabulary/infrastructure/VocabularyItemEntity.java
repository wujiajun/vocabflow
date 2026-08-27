package com.vocabflow.vocabulary.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "vocabulary_items")
public class VocabularyItemEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "normalized_term", unique = true, nullable = false)
  public String normalizedTerm;

  @Column(nullable = false)
  public String term;

  public String type;
  public String phonetic;

  @Column(name = "part_of_speech")
  public String partOfSpeech;

  @Column(name = "definition_text")
  public String definition;

  @Column(name = "examples_json")
  public String examples;

  @Column(name = "collocations_json")
  public String collocations;

  @Column(name = "enrichment_status", nullable = false)
  public String enrichmentStatus;

  @Column(name = "failure_reason")
  public String failureReason;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;
}
