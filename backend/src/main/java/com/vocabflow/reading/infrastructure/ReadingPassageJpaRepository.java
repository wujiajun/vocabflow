package com.vocabflow.reading.infrastructure;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingPassageJpaRepository extends JpaRepository<ReadingPassageEntity, Long> {
  Optional<ReadingPassageEntity> findByUserIdAndStudyDate(Long userId, LocalDate studyDate);

  int countByUserIdAndReadAtGreaterThanEqualAndReadAtLessThan(
      Long userId, java.time.Instant from, java.time.Instant to);

  Optional<ReadingPassageEntity> findByIdAndUserId(Long id, Long userId);

  Page<ReadingPassageEntity> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable pageable);

  Page<ReadingPassageEntity> findByUserIdAndReadAtIsNotNullOrderByCreatedAtDescIdDesc(
      Long userId, Pageable pageable);

  Page<ReadingPassageEntity> findByUserIdAndReadAtIsNullOrderByCreatedAtDescIdDesc(
      Long userId, Pageable pageable);
}
