package com.vocabflow.tasks.adapter;

import com.vocabflow.shared.web.BadRequestException;
import com.vocabflow.tasks.application.PointLedger;
import com.vocabflow.tasks.application.TaskDay;
import com.vocabflow.tasks.application.TaskService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {
  private final TaskService service;

  public TaskController(TaskService service) {
    this.service = service;
  }

  record TaskResponse(
      String key,
      String type,
      String category,
      String game,
      int target,
      int current,
      int points,
      boolean completed,
      Instant completedAt) {}

  record DayResponse(
      LocalDate date,
      List<TaskResponse> tasks,
      boolean allDone,
      int earnedToday,
      int balance,
      int streak,
      int bestStreak) {}

  record LedgerLine(LocalDate date, String key, int amount, String reason, Instant createdAt) {}

  record LedgerResponse(
      List<LedgerLine> entries, int page, int size, long totalElements, int totalPages) {}

  /** The signed-in user's tasks for the day (their own today when no date is sent). */
  @GetMapping("/today")
  public DayResponse today(
      @AuthenticationPrincipal Long userId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate date) {
    TaskDay day = service.day(userId, date);
    return new DayResponse(
        day.date(),
        day.tasks().stream()
            .map(
                i ->
                    new TaskResponse(
                        i.task().key(),
                        i.task().type().name(),
                        i.task().type().category().name(),
                        i.task().param(),
                        i.task().target(),
                        i.current(),
                        i.task().points(),
                        i.task().completed(),
                        i.task().completedAt()))
            .toList(),
        day.allDone(),
        day.earnedToday(),
        day.balance(),
        day.streak(),
        day.bestStreak());
  }

  @GetMapping("/ledger")
  public LedgerResponse ledger(
      @AuthenticationPrincipal Long userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    if (page < 0 || size < 1 || size > 100) {
      throw new BadRequestException("Page or size is out of range");
    }
    PointLedger.Page result = service.ledger(userId, page, size);
    return new LedgerResponse(
        result.entries().stream()
            .map(e -> new LedgerLine(e.date(), e.key(), e.amount(), e.reason(), e.createdAt()))
            .toList(),
        result.page(),
        result.size(),
        result.totalElements(),
        (int) Math.ceil(result.totalElements() / (double) result.size()));
  }
}
