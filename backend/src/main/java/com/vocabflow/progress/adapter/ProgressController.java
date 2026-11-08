package com.vocabflow.progress.adapter;

import com.vocabflow.progress.application.ProgressService;
import com.vocabflow.progress.application.ProgressSummary;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/progress")
public class ProgressController {
  private final ProgressService service;

  public ProgressController(ProgressService service) {
    this.service = service;
  }

  record MilestoneResponse(int previous, Integer next) {}

  record DayResponse(
      LocalDate date, int cards, int reviews, int newWords, int rounds, int points) {}

  record WeekResponse(int reviews, int newWords, int rounds) {}

  record SummaryResponse(
      LocalDate date,
      int started,
      int mastered,
      int learning,
      int streak,
      int bestStreak,
      MilestoneResponse milestone,
      List<DayResponse> days,
      WeekResponse thisWeek,
      WeekResponse lastWeek) {}

  /** The signed-in user's progress (their own today when no date is sent). */
  @GetMapping("/summary")
  public SummaryResponse summary(
      @AuthenticationPrincipal Long userId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
      @RequestParam(required = false) String zone) {
    ProgressSummary s = service.summary(userId, date, zone);
    return new SummaryResponse(
        s.date(),
        s.started(),
        s.mastered(),
        s.learning(),
        s.streak(),
        s.bestStreak(),
        new MilestoneResponse(s.milestone().previous(), s.milestone().next()),
        s.days().stream()
            .map(
                d ->
                    new DayResponse(
                        d.date(), d.cards(), d.reviews(), d.newWords(), d.rounds(), d.points()))
            .toList(),
        week(s.thisWeek()),
        week(s.lastWeek()));
  }

  private static WeekResponse week(ProgressSummary.Week w) {
    return new WeekResponse(w.reviews(), w.newWords(), w.rounds());
  }
}
