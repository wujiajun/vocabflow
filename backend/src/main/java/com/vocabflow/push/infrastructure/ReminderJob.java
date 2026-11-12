package com.vocabflow.push.infrastructure;

import com.vocabflow.push.application.ReminderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Looks for due reminders once a minute. Only exists when the VAPID keys are configured. */
@Component
@EnableScheduling
@ConditionalOnExpression("!'${vocabflow.push.private-key:}'.isBlank()")
public class ReminderJob {
  private static final Logger log = LoggerFactory.getLogger(ReminderJob.class);

  private final ReminderService reminders;

  public ReminderJob(ReminderService reminders) {
    this.reminders = reminders;
  }

  @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
  public void run() {
    try {
      int sent = reminders.sendDue();
      if (sent > 0) {
        log.info("Sent {} daily reminders", sent);
      }
    } catch (RuntimeException e) {
      log.warn("The reminder check failed: {}", e.getClass().getSimpleName());
    }
  }
}
