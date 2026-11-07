package com.vocabflow.tasks.infrastructure;

import com.vocabflow.tasks.application.LedgerEntry;
import com.vocabflow.tasks.application.PointLedger;
import java.time.LocalDate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class JpaPointLedger implements PointLedger {
  private final PointLedgerJpaRepository ledger;

  public JpaPointLedger(PointLedgerJpaRepository ledger) {
    this.ledger = ledger;
  }

  @Override
  public boolean addIfAbsent(LedgerEntry entry) {
    if (ledger.existsByUserIdAndStudyDateAndEntryKey(entry.userId(), entry.date(), entry.key())) {
      return false;
    }
    PointLedgerEntity e = new PointLedgerEntity();
    e.userId = entry.userId();
    e.studyDate = entry.date();
    e.entryKey = entry.key();
    e.amount = entry.amount();
    e.reason = entry.reason();
    e.createdAt = entry.createdAt();
    try {
      ledger.saveAndFlush(e);
      return true;
    } catch (DataIntegrityViolationException exception) {
      // Another request awarded the same line at once: it is awarded, which is what was wanted.
      if (JpaDailyTaskStore.isDuplicateKeyViolation(exception)) {
        return false;
      }
      throw exception;
    }
  }

  @Override
  public int balance(long userId) {
    return (int) ledger.balance(userId);
  }

  @Override
  public int earnedOn(long userId, LocalDate date) {
    return (int) ledger.earnedOn(userId, date);
  }

  @Override
  public Page page(long userId, int page, int size) {
    var result = ledger.findByUserIdOrderByIdDesc(userId, PageRequest.of(page, size));
    return new Page(
        result.stream()
            .map(
                e ->
                    new LedgerEntry(
                        e.userId, e.studyDate, e.entryKey, e.amount, e.reason, e.createdAt))
            .toList(),
        page,
        size,
        result.getTotalElements());
  }
}
