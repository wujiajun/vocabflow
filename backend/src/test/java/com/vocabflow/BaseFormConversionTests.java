package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vocabflow.vocabulary.application.StudyRecords;
import com.vocabflow.vocabulary.application.UserVocabularyRepository;
import com.vocabflow.vocabulary.application.VocabularyItemRepository;
import com.vocabflow.vocabulary.application.VocabularyService;
import com.vocabflow.vocabulary.domain.EnrichmentResult;
import com.vocabflow.vocabulary.domain.EnrichmentStatus;
import com.vocabflow.vocabulary.domain.SourceContext;
import com.vocabflow.vocabulary.domain.UserVocabulary;
import com.vocabflow.vocabulary.domain.VocabularyItem;
import com.vocabflow.vocabulary.domain.VocabularyTerm;
import com.vocabflow.vocabulary.domain.VocabularyType;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Turning an item that only inflects another word into that word, and when it must refuse. The
 * words here are plain to the fake provider, so each starts as an ordinary completed item and the
 * conversion is asked for directly.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BaseFormConversionTests {
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired VocabularyService vocabulary;
  @Autowired VocabularyItemRepository items;
  @Autowired UserVocabularyRepository userItems;
  @MockitoBean StudyRecords studyRecords;

  @Test
  void renamesTheItemInPlaceWhenNoItemOfTheBaseWordExists() throws Exception {
    long user = user("rename@example.com");
    UserVocabulary entry = vocabulary.add(user, "jogs1");

    assertThat(convert(entry, "jog1")).isTrue();

    VocabularyItem item = items.findById(entry.item().id()).orElseThrow();
    assertThat(item.term().value()).isEqualTo("jog1");
    assertThat(item.term().normalized()).isEqualTo("jog1");
    assertThat(item.baseForm()).isNull();
    assertThat(item.enrichmentStatus()).isEqualTo(EnrichmentStatus.COMPLETED);
    assertThat(items.findByNormalizedTerm("jogs1")).isEmpty();
    // The same entry, so cards and history that point at it stay valid.
    assertThat(userItems.findByIdAndUserId(entry.id(), user)).isPresent();
  }

  @Test
  void movesEveryEntryToTheExistingBaseItemAndDeletesTheOldOne() throws Exception {
    long owner = user("move-owner@example.com");
    long follower = user("move-follower@example.com");
    long other = user("move-other@example.com");
    UserVocabulary base = vocabulary.add(owner, "swim2");
    UserVocabulary mine = vocabulary.add(follower, "swims2");
    UserVocabulary alsoMine = vocabulary.add(other, "swims2");

    assertThat(convert(mine, "swim2")).isTrue();

    assertThat(items.findByNormalizedTerm("swims2")).isEmpty();
    for (UserVocabulary moved :
        List.of(
            userItems.findByIdAndUserId(mine.id(), follower).orElseThrow(),
            userItems.findByIdAndUserId(alsoMine.id(), other).orElseThrow())) {
      assertThat(moved.item().id()).isEqualTo(base.item().id());
    }
    assertThat(userItems.findByIdAndUserId(base.id(), owner).orElseThrow().item().id())
        .isEqualTo(base.item().id());
  }

  @Test
  void everyHolderKeepsItsOwnSentenceWhenRenamedOrMerged() throws Exception {
    long first = user("src-first@example.com");
    long second = user("src-second@example.com");
    long third = user("src-third@example.com");
    SourceContext one = SourceContext.of("She jogs7 daily.", "jogs7", "Story", "/app/reading/1");
    SourceContext two = SourceContext.of("He jogs7 too.", "jogs7", null, null);
    UserVocabulary mine = vocabulary.add(first, "jogs7", one);
    UserVocabulary theirs = vocabulary.add(second, "jogs7", two);
    UserVocabulary typed = vocabulary.add(third, "jogs7");

    // Renamed in place: the entries stay, and so do their sentences.
    assertThat(convert(mine, "jog7")).isTrue();
    assertThat(userItems.findByIdAndUserId(mine.id(), first).orElseThrow().source()).isEqualTo(one);
    assertThat(userItems.findByIdAndUserId(theirs.id(), second).orElseThrow().source())
        .isEqualTo(two);
    assertThat(userItems.findByIdAndUserId(typed.id(), third).orElseThrow().source()).isNull();

    // Merged into an existing base item: the entries move, each keeping its own sentence.
    long fourth = user("src-fourth@example.com");
    long fifth = user("src-fifth@example.com");
    vocabulary.add(fourth, "swim7");
    SourceContext three = SourceContext.of("Fish swims7 fast.", "swims7", null, null);
    SourceContext four = SourceContext.of("A duck swims7 here.", "swims7", null, null);
    UserVocabulary a = vocabulary.add(fifth, "swims7", three);
    long sixth = user("src-sixth@example.com");
    UserVocabulary b = vocabulary.add(sixth, "swims7", four);
    assertThat(convert(a, "swim7")).isTrue();
    assertThat(userItems.findByIdAndUserId(a.id(), fifth).orElseThrow().source()).isEqualTo(three);
    assertThat(userItems.findByIdAndUserId(b.id(), sixth).orElseThrow().source()).isEqualTo(four);
  }

  @Test
  void refusesWhenAnEntryHolderAlreadyHasTheBaseWord() throws Exception {
    long user = user("holds-base@example.com");
    vocabulary.add(user, "sing3");
    UserVocabulary inflected = vocabulary.add(user, "sings3");

    assertThat(convert(inflected, "sing3")).isFalse();

    assertThat(items.findByNormalizedTerm("sings3")).isPresent();
    assertThat(userItems.findByIdAndUserId(inflected.id(), user).orElseThrow().item().id())
        .isEqualTo(inflected.item().id());
  }

  @Test
  void refusesWhenTheBaseItemIsNotCompleted() throws Exception {
    long user = user("base-pending@example.com");
    items.saveIfAbsent(
        new VocabularyItem(
            0,
            new VocabularyTerm("dance4"),
            null,
            null,
            null,
            null,
            null,
            null,
            EnrichmentStatus.PENDING,
            null,
            Instant.now()));
    UserVocabulary inflected = vocabulary.add(user, "dances4");

    assertThat(convert(inflected, "dance4")).isFalse();

    assertThat(items.findByNormalizedTerm("dances4")).isPresent();
  }

  @Test
  void refusesWhenAnyHolderHasStudiedTheWordOrHasItInAPlan() throws Exception {
    long user = user("studied@example.com");
    UserVocabulary inflected = vocabulary.add(user, "reads5");
    when(studyRecords.isInUse(anyLong(), anyLong())).thenReturn(true);

    assertThat(convert(inflected, "read5")).isFalse();

    assertThat(items.findByNormalizedTerm("reads5")).isPresent();
    assertThat(items.findByNormalizedTerm("read5")).isEmpty();
  }

  @Test
  void refusesWhenTheBaseFormIsTheTextItself() throws Exception {
    long user = user("same@example.com");
    UserVocabulary entry = vocabulary.add(user, "same6");

    assertThat(convert(entry, "SAME6")).isFalse();
  }

  private boolean convert(UserVocabulary entry, String baseForm) {
    EnrichmentResult result =
        new EnrichmentResult(
                VocabularyType.WORD,
                null,
                "verb",
                "A definition.",
                List.of("An example."),
                List.of("a collocation"))
            .withBaseForm(baseForm);
    return items.completeAsBaseForm(entry.item().id(), result, "fake", Instant.now());
  }

  private long user(String email) throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":10}"))
        .andExpect(status().isOk());
    return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
  }
}
