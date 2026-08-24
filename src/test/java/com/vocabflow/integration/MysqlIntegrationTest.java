package com.vocabflow.integration;

import com.vocabflow.identity.infrastructure.UserJpaRepository;
import com.vocabflow.vocabulary.infrastructure.UserVocabularyJpaRepository;
import com.vocabflow.vocabulary.infrastructure.VocabularyItemJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;

@SpringBootTest
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class MysqlIntegrationTest {
  static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4");

  static {
    MYSQL.start();
  }

  @Autowired protected UserJpaRepository users;
  @Autowired protected VocabularyItemJpaRepository vocabularyItems;
  @Autowired protected UserVocabularyJpaRepository userVocabularies;

  @DynamicPropertySource
  static void configureDataSource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
    registry.add("spring.datasource.username", MYSQL::getUsername);
    registry.add("spring.datasource.password", MYSQL::getPassword);
  }

  @BeforeEach
  void clearDatabase() {
    userVocabularies.deleteAll();
    vocabularyItems.deleteAll();
    users.deleteAll();
  }
}
