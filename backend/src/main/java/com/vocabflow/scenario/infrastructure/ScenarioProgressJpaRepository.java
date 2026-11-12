package com.vocabflow.scenario.infrastructure;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface ScenarioProgressJpaRepository extends JpaRepository<ScenarioProgressEntity, Long> {
  List<ScenarioProgressEntity> findByUserId(Long userId);

  boolean existsByUserIdAndScenarioId(Long userId, String scenarioId);

  @Modifying
  @Transactional
  @Query(
      "update ScenarioProgressEntity e set e.bestScore = :score "
          + "where e.userId = :userId and e.scenarioId = :scenarioId "
          + "and (e.bestScore is null or e.bestScore < :score)")
  int raiseBestScore(
      @Param("userId") Long userId,
      @Param("scenarioId") String scenarioId,
      @Param("score") int score);

  @Modifying
  @Transactional
  @Query(
      "update ScenarioProgressEntity e set e.speakingScore = :score, e.spokenAt = :at "
          + "where e.userId = :userId and e.scenarioId = :scenarioId")
  int setSpeaking(
      @Param("userId") Long userId,
      @Param("scenarioId") String scenarioId,
      @Param("score") int score,
      @Param("at") Instant at);
}
