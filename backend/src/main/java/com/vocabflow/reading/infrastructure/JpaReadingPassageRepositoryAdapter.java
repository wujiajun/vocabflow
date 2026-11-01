package com.vocabflow.reading.infrastructure;

import com.vocabflow.reading.application.ReadingPassageRepository;
import com.vocabflow.reading.domain.ReadingPage;
import com.vocabflow.reading.domain.ReadingPassage;
import com.vocabflow.shared.infrastructure.JsonSupport;
import java.sql.SQLIntegrityConstraintViolationException;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class JpaReadingPassageRepositoryAdapter implements ReadingPassageRepository {
  private final ReadingPassageJpaRepository passages;

  public JpaReadingPassageRepositoryAdapter(ReadingPassageJpaRepository passages) {
    this.passages = passages;
  }

  @Override
  public Optional<ReadingPassage> saveIfAbsent(ReadingPassage passage) {
    try {
      return Optional.of(map(passages.saveAndFlush(entity(passage))));
    } catch (DataIntegrityViolationException exception) {
      if (isDuplicateKeyViolation(exception)) {
        return Optional.empty();
      }
      throw exception;
    }
  }

  @Override
  public Optional<ReadingPassage> findByUserIdAndStudyDate(long userId, LocalDate studyDate) {
    return passages.findByUserIdAndStudyDate(userId, studyDate).map(this::map);
  }

  @Override
  public Optional<ReadingPassage> findByIdAndUserId(long id, long userId) {
    return passages.findByIdAndUserId(id, userId).map(this::map);
  }

  @Override
  public ReadingPage list(long userId, Boolean read, int page, int size) {
    PageRequest request = PageRequest.of(page, size);
    Page<ReadingPassageEntity> result =
        read == null
            ? passages.findByUserIdOrderByCreatedAtDescIdDesc(userId, request)
            : read
                ? passages.findByUserIdAndReadAtIsNotNullOrderByCreatedAtDescIdDesc(userId, request)
                : passages.findByUserIdAndReadAtIsNullOrderByCreatedAtDescIdDesc(userId, request);
    return new ReadingPage(
        result.getContent().stream().map(this::map).toList(),
        result.getNumber(),
        result.getSize(),
        result.getTotalElements(),
        result.getTotalPages());
  }

  @Override
  public ReadingPassage save(ReadingPassage passage) {
    return map(passages.save(entity(passage)));
  }

  private ReadingPassageEntity entity(ReadingPassage passage) {
    ReadingPassageEntity entity =
        passage.id() == 0
            ? new ReadingPassageEntity()
            : passages.findById(passage.id()).orElseThrow();
    entity.userId = passage.userId();
    entity.studyDate = passage.studyDate();
    entity.title = passage.title();
    entity.body = passage.body();
    entity.wordsJson = JsonSupport.write(passage.words());
    entity.readAt = passage.readAt();
    entity.createdAt = passage.createdAt();
    entity.source = passage.source();
    return entity;
  }

  private ReadingPassage map(ReadingPassageEntity entity) {
    return new ReadingPassage(
        entity.id,
        entity.userId,
        entity.studyDate,
        entity.title,
        entity.body,
        JsonSupport.read(entity.wordsJson),
        entity.readAt,
        entity.createdAt,
        entity.source);
  }

  private boolean isDuplicateKeyViolation(DataIntegrityViolationException exception) {
    for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
      if (cause instanceof SQLIntegrityConstraintViolationException sqlException
          && (sqlException.getErrorCode() == 1062 || "23505".equals(sqlException.getSQLState()))) {
        return true;
      }
    }
    return false;
  }
}
