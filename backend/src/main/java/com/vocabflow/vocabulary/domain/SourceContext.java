package com.vocabflow.vocabulary.domain;

import com.vocabflow.shared.web.BadRequestException;
import java.util.regex.Pattern;

/**
 * The sentence a user tapped a word in when adding it, kept on that user's own entry. {@code form}
 * is the word as it was written there, which may differ from the saved word (walked, walk).
 */
public record SourceContext(String sentence, String form, String title, String link) {
  public static final int MAX_SENTENCE = 300;
  private static final int MAX_FORM = 255;
  private static final int MAX_TITLE = 120;
  private static final int MAX_LINK = 255;
  private static final Pattern IN_APP_PATH = Pattern.compile("/app/[A-Za-z0-9/_\\-.?=&%#]*");

  /** Null when there is no sentence. A link that is not a relative /app/ path is refused. */
  public static SourceContext of(String sentence, String form, String title, String link) {
    String cleaned = sentence == null ? "" : sentence.trim().replaceAll("\\s+", " ");
    if (cleaned.isEmpty()) {
      return null;
    }
    return new SourceContext(
        cut(cleaned, MAX_SENTENCE),
        blankToNull(form, MAX_FORM),
        blankToNull(title, MAX_TITLE),
        checkedLink(link));
  }

  private static String checkedLink(String link) {
    if (link == null || link.isBlank()) {
      return null;
    }
    String trimmed = link.trim();
    if (trimmed.length() > MAX_LINK
        || !IN_APP_PATH.matcher(trimmed).matches()
        || trimmed.contains("..")
        || trimmed.contains("//")) {
      throw new BadRequestException("The source link must be a path inside the app");
    }
    return trimmed;
  }

  private static String blankToNull(String value, int max) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim().replaceAll("\\s+", " ");
    return trimmed.isEmpty() ? null : cut(trimmed, max);
  }

  // A text over the limit is cut at the last space that leaves room for the ellipsis.
  private static String cut(String text, int max) {
    if (text.length() <= max) {
      return text;
    }
    int end = text.lastIndexOf(' ', max - 1);
    if (end < max / 2) {
      end = max - 1;
    }
    return text.substring(0, end).stripTrailing() + "…";
  }
}
