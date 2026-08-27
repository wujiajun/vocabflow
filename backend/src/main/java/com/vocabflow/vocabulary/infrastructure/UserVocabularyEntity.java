package com.vocabflow.vocabulary.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "user_vocabularies",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_user_vocabulary",
            columnNames = {"user_id", "vocabulary_item_id"}))
public class UserVocabularyEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "vocabulary_item_id", nullable = false)
  public VocabularyItemEntity item;

  @Column(name = "learning_status", nullable = false)
  public String learningStatus;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;
}
