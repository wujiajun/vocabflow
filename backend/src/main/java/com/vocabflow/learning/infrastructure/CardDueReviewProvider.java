package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.DueReviewProvider;
import com.vocabflow.learning.application.ReviewCardRepository;
import com.vocabflow.learning.application.StoredCard;
import com.vocabflow.learning.domain.ReviewCandidate;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import com.vocabflow.vocabulary.domain.StudyContent;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CardDueReviewProvider implements DueReviewProvider {
  private final ReviewCardRepository cards;
  private final LearningVocabularyQuery vocabulary;

  public CardDueReviewProvider(ReviewCardRepository cards, LearningVocabularyQuery vocabulary) {
    this.cards = cards;
    this.vocabulary = vocabulary;
  }

  @Override
  public List<ReviewCandidate> findDueReviews(long userId, LocalDate learningDate) {
    List<Long> ids =
        cards.findDueReviews(userId, learningDate).stream()
            .map(StoredCard::userVocabularyId)
            .toList();
    Map<Long, StudyContent> contents = vocabulary.findStudyContent(userId, ids);
    return ids.stream()
        .map(contents::get)
        .map(
            content ->
                new ReviewCandidate(
                    content.userVocabularyId(),
                    content.vocabularyItemId(),
                    content.term(),
                    content.type()))
        .toList();
  }
}
