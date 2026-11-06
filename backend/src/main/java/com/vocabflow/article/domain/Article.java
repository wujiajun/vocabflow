package com.vocabflow.article.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.regex.Pattern;

/**
 * One article kept in the app: public-domain text of VOA Learning English, with the address of the
 * original for credit. The paragraphs are plain text; no images are kept.
 */
public record Article(
    String id,
    String title,
    LocalDate publishedOn,
    int readingMinutes,
    String sourceUrl,
    String audioUrl,
    List<String> paragraphs,
    List<GlossaryWord> glossary) {
  private static final Pattern ID = Pattern.compile("[0-9]{1,15}");

  public Article {
    if (id == null || !ID.matcher(id).matches()) {
      throw new IllegalArgumentException("Not an article id: " + id);
    }
    if (title == null || title.isBlank()) {
      throw new IllegalArgumentException("Article " + id + " needs a title");
    }
    if (publishedOn == null) {
      throw new IllegalArgumentException("Article " + id + " needs a date");
    }
    if (readingMinutes < 1) {
      throw new IllegalArgumentException("Article " + id + " needs a reading time");
    }
    if (sourceUrl == null || !sourceUrl.startsWith("https://learningenglish.voanews.com/")) {
      throw new IllegalArgumentException(
          "Article " + id + " must link back to VOA Learning English");
    }
    if (audioUrl != null && !audioUrl.startsWith("https://")) {
      throw new IllegalArgumentException("Article " + id + " has an odd audio address");
    }
    if (paragraphs == null
        || paragraphs.isEmpty()
        || paragraphs.stream().anyMatch(String::isBlank)) {
      throw new IllegalArgumentException("Article " + id + " needs text");
    }
    paragraphs = List.copyOf(paragraphs);
    glossary = glossary == null ? List.of() : List.copyOf(glossary);
  }

  /** The text as the reader takes it: paragraphs separated by a blank line. */
  public String text() {
    return String.join("\n\n", paragraphs);
  }
}
