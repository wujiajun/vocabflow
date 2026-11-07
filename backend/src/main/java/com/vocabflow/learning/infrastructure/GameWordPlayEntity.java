package com.vocabflow.learning.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "game_word_plays")
public class GameWordPlayEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "user_vocabulary_id", nullable = false)
  public Long userVocabularyId;

  @Column(name = "last_played_at", nullable = false)
  public Instant lastPlayedAt;

  @Column(name = "play_count", nullable = false)
  public int playCount;
}
