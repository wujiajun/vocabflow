package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.ReviewCardRepository;
import com.vocabflow.learning.application.StoredCard;
import com.vocabflow.vocabulary.application.DueVocabularyQuery;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

@Component
public class CardDueVocabularyQuery implements DueVocabularyQuery {
  private final ReviewCardRepository cards;

  public CardDueVocabularyQuery(ReviewCardRepository cards) {
    this.cards = cards;
  }

  @Override
  public List<Long> findDueIds(long userId, LocalDate date) {
    return Stream.concat(
            cards.findInLearning(userId).stream(), cards.findDueReviews(userId, date).stream())
        .map(StoredCard::userVocabularyId)
        .toList();
  }
}
