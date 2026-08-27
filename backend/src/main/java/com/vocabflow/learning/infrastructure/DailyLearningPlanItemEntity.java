package com.vocabflow.learning.infrastructure;

import jakarta.persistence.*;

@Entity
@Table(name = "daily_learning_plan_items")
public class DailyLearningPlanItemEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "daily_learning_plan_id", nullable = false)
  public DailyLearningPlanEntity plan;

  @Column(name = "user_vocabulary_id", nullable = false)
  public Long userVocabularyId;

  @Column(name = "vocabulary_item_id", nullable = false)
  public Long vocabularyItemId;

  @Column(name = "item_type", nullable = false)
  public String itemType;

  @Column(name = "item_order", nullable = false)
  public int itemOrder;

  @Column(nullable = false)
  public String term;

  public String type;
}
