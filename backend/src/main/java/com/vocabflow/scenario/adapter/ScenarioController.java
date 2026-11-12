package com.vocabflow.scenario.adapter;

import com.vocabflow.scenario.application.ScenarioProgressRepository.Progress;
import com.vocabflow.scenario.application.ScenarioService;
import com.vocabflow.scenario.domain.Scenario;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/scenarios")
public class ScenarioController {
  private final ScenarioService service;

  public ScenarioController(ScenarioService service) {
    this.service = service;
  }

  record Summary(
      String id,
      String title,
      String titleZh,
      int clb,
      int readingMinutes,
      String summary,
      String summaryZh,
      int keywordCount,
      boolean completed,
      Integer bestScore,
      int quizSize) {}

  record Keyword(String word, String zh, String definition, String example) {}

  record Question(String question, List<String> options, int answer, String explainZh) {}

  record Detail(
      String id,
      String title,
      String titleZh,
      int clb,
      int readingMinutes,
      String summary,
      String summaryZh,
      String canadaNoteZh,
      String text,
      List<Keyword> keywords,
      List<Question> quiz,
      boolean completed,
      Instant completedAt,
      Integer bestScore) {}

  record CompleteRequest(Integer score) {}

  @GetMapping
  public List<Summary> list(@AuthenticationPrincipal Long userId) {
    return service.list(userId).stream()
        .map(
            entry -> {
              Scenario s = entry.scenario();
              Progress p = entry.progress();
              return new Summary(
                  s.id(),
                  s.title(),
                  s.titleZh(),
                  s.clb(),
                  s.readingMinutes(),
                  s.summary(),
                  s.summaryZh(),
                  s.keywords().size(),
                  p != null,
                  p == null ? null : p.bestScore(),
                  s.quiz().size());
            })
        .toList();
  }

  @GetMapping("/{id}")
  public Detail get(@AuthenticationPrincipal Long userId, @PathVariable String id) {
    ScenarioService.Entry entry = service.get(userId, id);
    Scenario s = entry.scenario();
    Progress p = entry.progress();
    return new Detail(
        s.id(),
        s.title(),
        s.titleZh(),
        s.clb(),
        s.readingMinutes(),
        s.summary(),
        s.summaryZh(),
        s.canadaNoteZh(),
        s.text(),
        s.keywords().stream()
            .map(k -> new Keyword(k.word(), k.zh(), k.definition(), k.example()))
            .toList(),
        s.quiz().stream()
            .map(q -> new Question(q.question(), q.options(), q.answer(), q.explainZh()))
            .toList(),
        p != null,
        p == null ? null : p.completedAt(),
        p == null ? null : p.bestScore());
  }

  @PutMapping("/{id}/complete")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void complete(
      @AuthenticationPrincipal Long userId,
      @PathVariable String id,
      @RequestBody(required = false) CompleteRequest request) {
    service.complete(userId, id, request == null ? null : request.score());
  }
}
