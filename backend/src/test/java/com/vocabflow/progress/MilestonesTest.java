package com.vocabflow.progress;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.progress.domain.Milestones;
import org.junit.jupiter.api.Test;

class MilestonesTest {
  @Test
  void theNextGoalIsTheFirstAboveTheCount() {
    assertThat(Milestones.next(0).getAsInt()).isEqualTo(50);
    assertThat(Milestones.next(49).getAsInt()).isEqualTo(50);
    assertThat(Milestones.next(50).getAsInt()).isEqualTo(100);
    assertThat(Milestones.next(999).getAsInt()).isEqualTo(1000);
    assertThat(Milestones.next(1000)).isEmpty();
  }

  @Test
  void thePreviousGoalIsTheHighestReached() {
    assertThat(Milestones.previous(49)).isZero();
    assertThat(Milestones.previous(50)).isEqualTo(50);
    assertThat(Milestones.previous(260)).isEqualTo(250);
    assertThat(Milestones.previous(5000)).isEqualTo(1000);
  }
}
