package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.DueReviewProvider;
import com.vocabflow.learning.domain.ReviewCandidate;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class EmptyDueReviewProvider implements DueReviewProvider {
  @Override
  public List<ReviewCandidate> findDueReviews(long userId, LocalDate learningDate) {
    return List.of();
  }
}
