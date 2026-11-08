package com.vocabflow.reading.infrastructure;

import com.vocabflow.tasks.application.PassageActivity;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class PassageTaskActivity implements PassageActivity {
  private final ReadingPassageJpaRepository passages;

  public PassageTaskActivity(ReadingPassageJpaRepository passages) {
    this.passages = passages;
  }

  @Override
  public int readBetween(long userId, Instant from, Instant to) {
    return passages.countByUserIdAndReadAtGreaterThanEqualAndReadAtLessThan(userId, from, to);
  }
}
