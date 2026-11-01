package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.vocabulary.application.MisspelledTermException;
import com.vocabflow.vocabulary.application.VocabularyEnrichmentProvider;
import com.vocabflow.vocabulary.domain.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    name = "vocabflow.enrichment.provider",
    havingValue = "fake",
    matchIfMissing = true)
public class FakeVocabularyEnrichmentAdapter implements VocabularyEnrichmentProvider {
  @Override
  public String source() {
    return "fake";
  }

  @Override
  public EnrichmentResult enrich(VocabularyTerm t) {
    String n = t.normalized();
    if (n.equals("resume"))
      return EnrichmentResult.ofSenses(
          VocabularyType.WORD,
          List.of(
              new VocabularySense(
                  "noun",
                  "document",
                  "/ˈrezəmeɪ/",
                  "A short document listing your education and work experience.",
                  List.of("Please send me your resume."),
                  List.of("update a resume")),
              new VocabularySense(
                  "verb",
                  "start again",
                  "/rɪˈzuːm/",
                  "To begin again after stopping.",
                  List.of("The meeting will resume after lunch."),
                  List.of("resume work"))));
    if (n.equals("recieve")) throw new MisspelledTermException("receive");
    if (n.equals("leases"))
      return new EnrichmentResult(
              VocabularyType.WORD,
              "/liːs/",
              "noun",
              "A contract to rent a property for a set time.",
              List.of("We signed a lease for the apartment."),
              List.of("sign a lease"))
          .withBaseForm("lease")
          .withTerm("leases");
    if (n.equals("overwhelmed"))
      return new EnrichmentResult(
          VocabularyType.WORD,
          "/ˌoʊvərˈwelmd/",
          "adjective",
          "Feeling unable to deal with a situation because it is too difficult or there is too much to do.",
          List.of(
              "I felt overwhelmed during my first week at work.",
              "She was overwhelmed by the amount of paperwork."),
          List.of("feel overwhelmed", "completely overwhelmed", "overwhelmed by"));
    if (n.equals("figure out"))
      return new EnrichmentResult(
          VocabularyType.PHRASAL_VERB,
          "/ˈfɪɡjər aʊt/",
          "phrasal verb",
          "To understand or solve something.",
          List.of("I need to figure out this problem."),
          List.of("figure out how", "figure it out"));
    boolean phrase = n.contains(" ");
    return new EnrichmentResult(
        phrase ? VocabularyType.PHRASE : VocabularyType.WORD,
        null,
        phrase ? "phrase" : "noun",
        "A development definition for '" + t.value() + "'.",
        List.of("I encountered '" + t.value() + "' in a sentence."),
        List.of(t.value() + " usage"));
  }
}
