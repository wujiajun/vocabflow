package com.vocabflow.video.infrastructure;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.video.application.VideoCatalog;
import com.vocabflow.video.domain.VideoAlbum;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Reads the albums from {@code videos/catalog.json} on the classpath once, at startup. A file that
 * is not valid stops the application, so a bad edit is found when the tests run, not by a learner.
 */
@Component
public class JsonVideoCatalog implements VideoCatalog {
  private static final String PATH = "videos/catalog.json";

  @JsonIgnoreProperties(ignoreUnknown = true)
  record File(List<VideoAlbum> albums) {}

  private final List<VideoAlbum> albums;

  public JsonVideoCatalog() {
    try (InputStream stream = new ClassPathResource(PATH).getInputStream()) {
      albums = parse(stream);
    } catch (IOException exception) {
      throw new IllegalStateException("Cannot read " + PATH, exception);
    }
  }

  static List<VideoAlbum> parse(InputStream stream) throws IOException {
    File file = new ObjectMapper().readValue(stream, File.class);
    if (file.albums() == null || file.albums().isEmpty()) {
      throw new IllegalStateException("The video catalog has no albums");
    }
    var ids = new java.util.HashSet<String>();
    for (VideoAlbum album : file.albums()) {
      if (!ids.add(album.id())) {
        throw new IllegalStateException("The video catalog lists album " + album.id() + " twice");
      }
    }
    return List.copyOf(file.albums());
  }

  @Override
  public List<VideoAlbum> albums() {
    return albums;
  }
}
