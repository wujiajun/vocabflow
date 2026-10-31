package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.vocabulary.application.EnrichmentScheduler;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ThreadPoolEnrichmentScheduler implements EnrichmentScheduler {
  private static final Logger log = LoggerFactory.getLogger(ThreadPoolEnrichmentScheduler.class);

  private final boolean inline;
  private final ThreadPoolExecutor executor =
      new ThreadPoolExecutor(
          2,
          2,
          0,
          TimeUnit.SECONDS,
          new ArrayBlockingQueue<>(200),
          runnable -> {
            Thread thread = new Thread(runnable, "vocabulary-enrichment");
            thread.setDaemon(true);
            return thread;
          });

  public ThreadPoolEnrichmentScheduler(
      @Value("${vocabflow.enrichment.inline:false}") boolean inline) {
    this.inline = inline;
  }

  @Override
  public boolean schedule(Runnable task) {
    if (inline) {
      task.run();
      return true;
    }
    try {
      executor.execute(task);
      return true;
    } catch (RejectedExecutionException full) {
      log.warn("Enrichment queue is full");
      return false;
    }
  }

  @PreDestroy
  void shutdown() {
    executor.shutdownNow();
  }
}
