package com.vocabflow.scenario.domain;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * One scene of life in Canada, written for the app: a short dialogue or text, the words worth
 * learning from it and a small quiz. {@code verify} lists facts that need a person's check; it is
 * for reviewers and is never shown to a learner.
 */
public record Scenario(
    String id,
    String title,
    String titleZh,
    int clb,
    int readingMinutes,
    String summary,
    String summaryZh,
    String canadaNoteZh,
    List<String> verify,
    List<Segment> segments,
    List<Keyword> keywords,
    List<QuizQuestion> quiz) {
  private static final Pattern SLUG = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");

  /**
   * Phone numbers, prices and the like must not be invented, so the text may not hold them. The
   * emergency number 911 is the one exception.
   */
  private static final Pattern NUMBERS = Pattern.compile("[$€£]|\\d{3}");

  public Scenario {
    if (id == null || !SLUG.matcher(id).matches() || id.length() > 60) {
      throw new IllegalArgumentException("Not a scenario id: " + id);
    }
    if (blank(title) || blank(titleZh) || blank(summary) || blank(summaryZh)) {
      throw new IllegalArgumentException("Scenario " + id + " needs titles and summaries");
    }
    if (clb < 1 || clb > 12) {
      throw new IllegalArgumentException("Scenario " + id + " has an impossible CLB level");
    }
    if (readingMinutes < 1) {
      throw new IllegalArgumentException("Scenario " + id + " needs a reading time");
    }
    if (segments == null || segments.isEmpty()) {
      throw new IllegalArgumentException("Scenario " + id + " needs text");
    }
    if (keywords == null || keywords.isEmpty()) {
      throw new IllegalArgumentException("Scenario " + id + " needs keywords");
    }
    canadaNoteZh = canadaNoteZh == null ? "" : canadaNoteZh;
    verify = verify == null ? List.of() : List.copyOf(verify);
    segments = List.copyOf(segments);
    keywords = List.copyOf(keywords);
    quiz = quiz == null ? List.of() : List.copyOf(quiz);

    String text = text(segments).toLowerCase(Locale.ROOT);
    if (NUMBERS.matcher(text.replace("911", "")).find()) {
      throw new IllegalArgumentException(
          "Scenario " + id + " has a price or a number that looks like a phone number");
    }
    for (Keyword keyword : keywords) {
      if (!text.contains(keyword.word().toLowerCase(Locale.ROOT))) {
        throw new IllegalArgumentException(
            "Scenario " + id + ": keyword '" + keyword.word() + "' is not in the text");
      }
    }
    var seen = new java.util.HashSet<String>();
    for (Keyword keyword : keywords) {
      if (!seen.add(keyword.word().toLowerCase(Locale.ROOT))) {
        throw new IllegalArgumentException(
            "Scenario " + id + " lists keyword '" + keyword.word() + "' twice");
      }
    }
  }

  private static boolean blank(String value) {
    return value == null || value.isBlank();
  }

  private static String text(List<Segment> segments) {
    return String.join("\n\n", segments.stream().flatMap(s -> s.paragraphs().stream()).toList());
  }

  /** The text as the reader takes it: paragraphs separated by a blank line. */
  public String text() {
    return text(segments);
  }
}
