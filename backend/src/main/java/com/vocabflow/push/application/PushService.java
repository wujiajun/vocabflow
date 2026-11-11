package com.vocabflow.push.application;

import com.vocabflow.push.domain.ReminderSchedule;
import com.vocabflow.shared.web.BadRequestException;
import com.vocabflow.shared.web.ServiceUnavailableException;
import java.time.Clock;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PushService {
  private final PushSubscriptionStore store;
  private final WebPushSender sender;
  private final UserZones zones;
  private final Clock clock;

  public PushService(
      PushSubscriptionStore store, WebPushSender sender, UserZones zones, Clock clock) {
    this.store = store;
    this.sender = sender;
    this.zones = zones;
    this.clock = clock;
  }

  public boolean enabled() {
    return sender.enabled();
  }

  public String publicKey() {
    return sender.publicKey();
  }

  public void subscribe(
      long userId,
      String endpoint,
      String p256dh,
      String auth,
      String remindAt,
      String deviceZone) {
    if (!sender.enabled()) {
      throw new ServiceUnavailableException("Reminders are not set up on this server");
    }
    if (!endpoint.startsWith("https://")) {
      throw new BadRequestException("The push address must be an https address");
    }
    LocalTime time = parseTime(remindAt);
    ZoneId deviceZoneId = parseZone(deviceZone);
    ZoneId zone = zones.of(userId).orElse(deviceZoneId == null ? ZoneId.of("UTC") : deviceZoneId);
    // Switching on after the time has passed must not send a reminder at once.
    var alreadyPast = ReminderSchedule.alreadyPast(time, zone, clock.instant());
    store.save(
        userId,
        endpoint,
        p256dh,
        auth,
        time,
        deviceZoneId == null ? null : deviceZoneId.getId(),
        alreadyPast);
  }

  public void unsubscribe(long userId, String endpoint) {
    store.delete(userId, endpoint);
  }

  public List<PushSubscription> mine(long userId) {
    return store.findByUser(userId);
  }

  private static LocalTime parseTime(String value) {
    try {
      return LocalTime.parse(value);
    } catch (DateTimeParseException e) {
      throw new BadRequestException("The time must look like 19:00");
    }
  }

  private static ZoneId parseZone(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return ZoneId.of(value);
    } catch (RuntimeException e) {
      throw new BadRequestException("Unknown time zone");
    }
  }
}
