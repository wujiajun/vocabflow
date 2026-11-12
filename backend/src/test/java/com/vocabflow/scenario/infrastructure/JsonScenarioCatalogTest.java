package com.vocabflow.scenario.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.scenario.domain.Scenario;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class JsonScenarioCatalogTest {
  private static String scenario(String id) {
    return "{\"id\":\""
        + id
        + "\",\"title\":\"T\",\"titleZh\":\"题\",\"clb\":6,\"readingMinutes\":2,"
        + "\"summary\":\"S\",\"summaryZh\":\"概\",\"segments\":[{\"kind\":\"scene\","
        + "\"text\":\"Hello there.\"}],\"keywords\":[{\"word\":\"hello\",\"zh\":\"你好\","
        + "\"definition\":\"d\",\"example\":\"e\"}],\"quiz\":[]}";
  }

  @Test
  void theCatalogFileInTheAppIsValid() {
    JsonScenarioCatalog catalog = new JsonScenarioCatalog();

    assertThat(catalog.scenarios()).isNotEmpty();
    assertThat(catalog.scenarios()).extracting(Scenario::id).doesNotHaveDuplicates();
    assertThat(catalog.scenario(catalog.scenarios().getFirst().id())).isPresent();
    assertThat(catalog.scenario("nope")).isEmpty();
    assertThat(catalog.scenarios())
        .allSatisfy(
            s -> {
              assertThat(s.quiz()).as(s.id() + " quiz").hasSizeGreaterThanOrEqualTo(3);
              assertThat(s.keywords()).as(s.id() + " keywords").hasSizeGreaterThanOrEqualTo(8);
              assertThat(s.verify()).as(s.id() + " verify").isNotEmpty();
              assertThat(s.text()).doesNotContain("[[");
            });
  }

  @Test
  void aCatalogWithADuplicateOrNoScenarioIsRefused() {
    assertThatThrownBy(() -> parse("{\"scenarios\":[" + scenario("a") + "," + scenario("a") + "]}"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> parse("{\"scenarios\":[]}")).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void aValidCatalogIsRead() throws Exception {
    assertThat(JsonScenarioCatalog.parse(stream("{\"scenarios\":[" + scenario("a") + "]}")))
        .hasSize(1);
  }

  private static ByteArrayInputStream stream(String json) {
    return new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8));
  }

  private static void parse(String json) throws Exception {
    JsonScenarioCatalog.parse(stream(json));
  }
}
