package com.vocabflow.article.infrastructure;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.article.application.ArticleCatalog;
import com.vocabflow.article.domain.ArticleAlbum;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Reads the albums from {@code articles/catalog.json} on the classpath once, at startup. A file
 * that is not valid stops the application, so a bad edit is found when the tests run, not by a
 * learner.
 */
@Component
public class JsonArticleCatalog implements ArticleCatalog {
  private static final String PATH = "articles/catalog.json";

  /** Text from a wire service is not public domain and must never be in the catalog. */
  private static final Pattern WIRE_SERVICE =
      Pattern.compile("\\b(AP|Reuters|AFP|Associated Press|Agence France)\\b");

  @JsonIgnoreProperties(ignoreUnknown = true)
  record File(List<ArticleAlbum> albums) {}

  private final List<ArticleAlbum> albums;

  public JsonArticleCatalog() {
    try (InputStream stream = new ClassPathResource(PATH).getInputStream()) {
      albums = parse(stream);
    } catch (IOException exception) {
      throw new IllegalStateException("Cannot read " + PATH, exception);
    }
  }

  static List<ArticleAlbum> parse(InputStream stream) throws IOException {
    ObjectMapper mapper =
        new ObjectMapper()
            .findAndRegisterModules()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    File file = mapper.readValue(stream, File.class);
    if (file.albums() == null || file.albums().isEmpty()) {
      throw new IllegalStateException("The article catalog has no albums");
    }
    var albumIds = new HashSet<String>();
    var articleIds = new HashSet<String>();
    for (ArticleAlbum album : file.albums()) {
      if (!albumIds.add(album.id())) {
        throw new IllegalStateException("The article catalog lists album " + album.id() + " twice");
      }
      for (var article : album.articles()) {
        if (!articleIds.add(article.id())) {
          throw new IllegalStateException("Article " + article.id() + " is in two albums");
        }
        if (WIRE_SERVICE.matcher(article.text()).find()) {
          throw new IllegalStateException(
              "Article " + article.id() + " mentions a wire service; it is not public domain");
        }
      }
    }
    return List.copyOf(file.albums());
  }

  @Override
  public List<ArticleAlbum> albums() {
    return albums;
  }
}
