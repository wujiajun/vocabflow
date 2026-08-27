package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.ReviewCandidate;
import java.time.LocalDate;
import java.util.List;

public interface DueReviewProvider {
  List<ReviewCandidate> findDueReviews(long userId, LocalDate learningDate);
}
