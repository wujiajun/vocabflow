package com.vocabflow.reading.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.identity.domain.*;
import com.vocabflow.reading.domain.*;
import com.vocabflow.shared.web.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ReadingServiceTest {
  private static final LocalDate DAY = LocalDate.of(2026, 12, 3);

  private final ReadingPassageRepository passages = mock(ReadingPassageRepository.class);
  private final StudiedWords studied = mock(StudiedWords.class);
  private final UserRepository users = mock(UserRepository.class);
  private final ReadingProvider provider = mock(ReadingProvider.class);
  private final ModelQuota quota = mock(ModelQuota.class);
  private final ReadingService service =
      new ReadingService(passages, studied, users, provider, quota);

  ReadingServiceTest() {
    when(studied.isFinished(2L, DAY)).thenReturn(true);
    when(users.findById(2L)).thenReturn(Optional.of(user(ClbLevel.CLB_5)));
    when(quota.tryConsume(2L)).thenReturn(true);
    when(provider.source()).thenReturn("test-model");
    when(passages.findByUserIdAndStudyDate(2L, DAY)).thenReturn(Optional.empty());
    when(passages.saveIfAbsent(any())).thenAnswer(call -> Optional.of(call.getArgument(0)));
  }

  @Test
  void picksUpToFifteenWordsAtOneLevelBelowTheLearnersAndStoresTheResult() {
    when(studied.studiedOn(2L, DAY)).thenReturn(words(20));
    when(provider.write(anyInt(), any()))
        .thenReturn(new ReadingContent("A title", "A text.", List.of("w0", "w1")));

    ReadingPassage passage = service.generate(2L, DAY);

    ArgumentCaptor<List<TargetWord>> targets = ArgumentCaptor.forClass(List.class);
    verify(provider).write(eq(4), targets.capture());
    assertThat(targets.getValue()).hasSize(15);
    assertThat(passage.title()).isEqualTo("A title");
    assertThat(passage.words()).containsExactly("w0", "w1");
    assertThat(passage.studyDate()).isEqualTo(DAY);
    assertThat(passage.source()).isEqualTo("test-model");
    assertThat(passage.read()).isFalse();
  }

  @Test
  void theEasiestLevelStaysThere() {
    when(users.findById(2L)).thenReturn(Optional.of(user(ClbLevel.CLB_1)));
    when(studied.studiedOn(2L, DAY)).thenReturn(words(10));
    when(provider.write(anyInt(), any()))
        .thenReturn(new ReadingContent("T", "text", List.of("w0")));

    service.generate(2L, DAY);

    verify(provider).write(eq(1), any());
  }

  @Test
  void aDayThatAlreadyHasAPassageGetsThatOneBackWithoutAnotherCall() {
    ReadingPassage existing = passage(7);
    when(passages.findByUserIdAndStudyDate(2L, DAY)).thenReturn(Optional.of(existing));

    assertThat(service.generate(2L, DAY)).isSameAs(existing);
    verifyNoInteractions(provider, quota);
  }

  @Test
  void refusesBeforeTheDaysStudyHasEnded() {
    when(studied.isFinished(2L, DAY)).thenReturn(false);

    assertThatThrownBy(() -> service.generate(2L, DAY))
        .isInstanceOf(ConflictException.class)
        .hasMessage("Finish today's study before writing a passage");
    verifyNoInteractions(provider, quota);
  }

  @Test
  void tooFewWordsSaysHowManyThereWereAndUsesNothing() {
    when(studied.studiedOn(2L, DAY)).thenReturn(words(9));

    assertThatThrownBy(() -> service.generate(2L, DAY))
        .isInstanceOf(ConflictException.class)
        .hasMessage("You studied 9 words or phrases today. A passage needs at least 10.");
    verifyNoInteractions(provider, quota);
    verify(passages, never()).saveIfAbsent(any());
  }

  @Test
  void stopsWhenTheDailyAllowanceIsUsedUp() {
    when(studied.studiedOn(2L, DAY)).thenReturn(words(10));
    when(quota.tryConsume(2L)).thenReturn(false);

    assertThatThrownBy(() -> service.generate(2L, DAY))
        .isInstanceOf(TooManyRequestsException.class);
    verifyNoInteractions(provider);
  }

  @Test
  void aFailedWritingStoresNothingSoTheUserCanAskAgain() {
    when(studied.studiedOn(2L, DAY)).thenReturn(words(10));
    when(provider.write(anyInt(), any())).thenThrow(new IllegalStateException("model down"));

    assertThatThrownBy(() -> service.generate(2L, DAY))
        .isInstanceOf(ServiceUnavailableException.class);
    verify(passages, never()).saveIfAbsent(any());
  }

  @Test
  void whenAnotherRequestWroteTheDaysPassageFirstThatOneStands() {
    when(studied.studiedOn(2L, DAY)).thenReturn(words(10));
    when(provider.write(anyInt(), any()))
        .thenReturn(new ReadingContent("Mine", "text", List.of("w0")));
    ReadingPassage winner = passage(9);
    doReturn(Optional.empty()).when(passages).saveIfAbsent(any());
    when(passages.findByUserIdAndStudyDate(2L, DAY))
        .thenReturn(Optional.empty(), Optional.of(winner));

    assertThat(service.generate(2L, DAY)).isSameAs(winner);
  }

  @Test
  void marksAPassageReadAndUnreadAndLeavesAnotherUsersAlone() {
    ReadingPassage unread = passage(5);
    when(passages.findByIdAndUserId(5L, 2L)).thenReturn(Optional.of(unread));
    when(passages.findByIdAndUserId(5L, 3L)).thenReturn(Optional.empty());
    when(passages.save(any())).thenAnswer(call -> call.getArgument(0));

    ReadingPassage read = service.setRead(2L, 5L, true);

    assertThat(read.read()).isTrue();
    assertThat(read.readAt()).isNotNull();
    assertThat(service.setRead(2L, 5L, false)).isSameAs(unread);
    verify(passages, times(1)).save(any());
    assertThatThrownBy(() -> service.setRead(3L, 5L, true)).isInstanceOf(NotFoundException.class);
  }

  private static List<StudiedWord> words(int count) {
    return IntStream.range(0, count)
        .mapToObj(i -> new StudiedWord(i, "w" + i, List.of("a meaning"), i % 5 == 0, i % 2 == 0))
        .toList();
  }

  private static ReadingPassage passage(long id) {
    return new ReadingPassage(
        id,
        2,
        DAY,
        "Title",
        "Text",
        List.of("w0"),
        null,
        Instant.parse("2026-12-03T20:00:00Z"),
        "x");
  }

  private static User user(ClbLevel level) {
    return new User(
        2,
        new Email("reader@example.com"),
        "hash",
        level,
        new DailyVocabularyGoal(10),
        Instant.parse("2026-01-01T00:00:00Z"));
  }
}
