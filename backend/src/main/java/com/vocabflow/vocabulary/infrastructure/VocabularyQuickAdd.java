package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.quickadd.application.QuickAddWords;
import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.vocabulary.application.VocabularyService;
import com.vocabflow.vocabulary.domain.UserVocabulary;
import org.springframework.stereotype.Component;

/**
 * Lets the quick-add module add a word through the normal add path (not transactional, like the
 * service).
 */
@Component
public class VocabularyQuickAdd implements QuickAddWords {
  private final VocabularyService service;

  public VocabularyQuickAdd(VocabularyService service) {
    this.service = service;
  }

  @Override
  public Result add(long userId, String term) {
    try {
      UserVocabulary saved = service.add(userId, term);
      return new Result(saved.item().term().value(), true);
    } catch (ConflictException alreadyThere) {
      return new Result(term.strip(), false);
    }
  }
}
