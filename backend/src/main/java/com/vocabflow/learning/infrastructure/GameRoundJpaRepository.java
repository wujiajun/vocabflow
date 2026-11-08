package com.vocabflow.learning.infrastructure;

import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GameRoundJpaRepository extends JpaRepository<GameRoundEntity, Long> {
  java.util.List<GameRoundEntity> findByUserIdAndStudyDate(Long userId, LocalDate studyDate);

  int countByUserIdAndStudyDate(Long userId, LocalDate studyDate);

  @Query(
      "select coalesce(max(r.stars), 0) from GameRoundEntity r "
          + "where r.userId = :userId and r.studyDate = :date")
  int bestStars(@Param("userId") long userId, @Param("date") LocalDate date);

  @Query(
      "select r.studyDate, count(r) from GameRoundEntity r "
          + "where r.userId = :userId and r.studyDate between :from and :to "
          + "group by r.studyDate")
  java.util.List<Object[]> countByDay(
      @Param("userId") long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
