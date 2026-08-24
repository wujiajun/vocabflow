package com.vocabflow.domain;

import static org.junit.jupiter.api.Assertions.*;

import com.vocabflow.identity.domain.*;
import com.vocabflow.vocabulary.domain.*;
import org.junit.jupiter.api.Test;

class DomainTest {
  @Test
  void normalizesTerm() {
    assertEquals("Figure Out", new VocabularyTerm(" Figure   Out ").value());
    assertEquals("figure out", new VocabularyTerm(" Figure Out ").normalized());
  }

  @Test
  void rejectsInvalidGoal() {
    assertThrows(IllegalArgumentException.class, () -> new DailyVocabularyGoal(101));
  }

  @Test
  void validatesClb() {
    assertEquals(ClbLevel.CLB_7, ClbLevel.from("clb-7"));
    assertThrows(IllegalArgumentException.class, () -> ClbLevel.from("CLB_13"));
  }
}
