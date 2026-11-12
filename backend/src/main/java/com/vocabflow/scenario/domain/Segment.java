package com.vocabflow.scenario.domain;

import java.util.List;

/**
 * A part of a scenario: a {@code scene} (who and where) or a {@code text} (a tip) is plain text; a
 * {@code dialogue} is a list of lines, each with the speaker's name.
 */
public record Segment(String kind, String text, List<Line> lines) {
  public record Line(String speaker, String text) {
    public Line {
      if (speaker == null || speaker.isBlank() || text == null || text.isBlank()) {
        throw new IllegalArgumentException("A dialogue line needs a speaker and text");
      }
      if (speaker.contains(":")) {
        throw new IllegalArgumentException("A speaker name cannot contain a colon: " + speaker);
      }
    }
  }

  public Segment {
    switch (kind == null ? "" : kind) {
      case "scene", "text" -> {
        if (text == null || text.isBlank()) {
          throw new IllegalArgumentException("A " + kind + " segment needs text");
        }
        lines = List.of();
      }
      case "dialogue" -> {
        if (lines == null || lines.isEmpty()) {
          throw new IllegalArgumentException("A dialogue segment needs lines");
        }
        lines = List.copyOf(lines);
        text = null;
      }
      default -> throw new IllegalArgumentException("Unknown segment kind: " + kind);
    }
  }

  /** The paragraphs the reader shows: one for text, one per spoken line ("Name: words"). */
  public List<String> paragraphs() {
    if (lines.isEmpty()) {
      return List.of(text);
    }
    return lines.stream().map(line -> line.speaker() + ": " + line.text()).toList();
  }
}
