package com.vocabflow.learning.infrastructure;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LearningConfiguration {
  @Bean
  Clock learningClock() {
    return Clock.systemUTC();
  }
}
