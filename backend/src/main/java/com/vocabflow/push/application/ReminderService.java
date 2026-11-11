package com.vocabflow.push.application;

import com.vocabflow.push.domain.ReminderMessage;
import com.vocabflow.push.domain.ReminderSchedule;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Sends the daily reminders that are due. Not transactional: a send takes a while and must not hold
 * a connection; the claim is one conditional update.
 */
@Service
public class ReminderService {
  private static final Logger log = LoggerFactory.getLogger(ReminderService.class);

  private final PushSubscriptionStore store;
  private final WebPushSender sender;
  private final ReminderProgress progress;
  private final UserZones zones;
  private final Clock clock;

  public ReminderService(
      PushSubscriptionStore store,
      WebPushSender sender,
      ReminderProgress progress,
      UserZones zones,
      Clock clock) {
    this.store = store;
    this.sender = sender;
    this.progress = progress;
    this.zones = zones;
    this.clock = clock;
  }

  /** Looks at every subscription once; returns how many reminders were sent. */
  public int sendDue() {
    if (!sender.enabled()) {
      return 0;
    }
    int sent = 0;
    for (PushSubscription sub : store.findAll()) {
      try {
        if (remind(sub)) {
          sent++;
        }
      } catch (RuntimeException e) {
        log.warn("Reminder for subscription {} failed: {}", sub.id(), e.getClass().getSimpleName());
      }
    }
    return sent;
  }

  private boolean remind(PushSubscription sub) {
    ZoneId zone = zoneOf(sub);
    LocalDate date =
        ReminderSchedule.dueDate(sub.remindAt(), zone, clock.instant(), sub.lastSentDate());
    if (date == null || progress.studyDone(sub.userId(), date)) {
      return false;
    }
    if (!store.claim(sub.id(), date)) {
      return false;
    }
    String payload = payload(ReminderMessage.body(progress.streak(sub.userId(), date)));
    WebPushSender.Result result = sender.send(sub, payload);
    if (result == WebPushSender.Result.GONE) {
      store.deleteById(sub.id());
    }
    return result == WebPushSender.Result.SENT;
  }

  private ZoneId zoneOf(PushSubscription sub) {
    return zones
        .of(sub.userId())
        .orElseGet(
            () -> {
              try {
                return sub.deviceZone() == null ? ZoneId.of("UTC") : ZoneId.of(sub.deviceZone());
              } catch (RuntimeException e) {
                return ZoneId.of("UTC");
              }
            });
  }

  static String payload(String body) {
    return "{\"title\":\""
        + ReminderMessage.TITLE
        + "\",\"body\":\""
        + body.replace("\\", "\\\\").replace("\"", "\\\"")
        + "\",\"url\":\""
        + ReminderMessage.URL
        + "\"}";
  }
}
