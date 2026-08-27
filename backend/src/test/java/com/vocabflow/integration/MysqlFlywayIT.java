package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class MysqlFlywayIT extends MysqlIntegrationTest {
  @Autowired private Flyway flyway;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void appliesAllMigrationsAndCreatesExpectedMysqlSchema() {
    assertThat(flyway.info().all())
        .hasSize(4)
        .allSatisfy(migration -> assertThat(migration.getState().isApplied()).isTrue());
    assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Integer.class)).isZero();
    assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM vocabulary_items", Integer.class))
        .isZero();
    assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.statistics "
                    + "WHERE table_schema = DATABASE() AND table_name = 'user_vocabularies' "
                    + "AND index_name = 'ix_user_vocabularies_user_created'",
                Integer.class))
        .isEqualTo(2);
  }
}
