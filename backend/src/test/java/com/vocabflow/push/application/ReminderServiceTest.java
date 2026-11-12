package com.vocabflow.push.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ReminderServiceTest {
  // 2026-11-11 03:05 UTC = 2026-11-10 19:05 at UTC-8
  private static final Instant NOW = Instant.parse("2026-11-11T03:05:00Z");
  private static final LocalDate LOCAL_DAY = LocalDate.of(2026, 11, 10);

  private final FakeStore store = new FakeStore();
  private final FakeSender sender = new FakeSender();
  private boolean done = false;
  private int streak = 0;
  private Optional<ZoneId> userZone = Optional.of(ZoneId.of("Etc/GMT+8"));
  private Instant now = NOW;

  private ReminderService service() {
    return new ReminderService(
        store,
        sender,
        new ReminderProgress() {
          public boolean studyDone(long userId, LocalDate date) {
            return done;
          }

          public int streak(long userId, LocalDate today) {
            return streak;
          }
        },
        userId -> userZone,
        Clock.fixed(now, ZoneOffset.UTC));
  }

  private PushSubscription subscription(String zone, LocalDate lastSent) {
    var sub =
        new PushSubscription(
            1, 7, "https://p.test/1", "k", "a", LocalTime.of(19, 0), zone, lastSent);
    store.rows.add(sub);
    return sub;
  }

  @Test
  void sendsOnceWhenDueAndNothingWasStudied() {
    subscription(null, null);
    streak = 4;

    assertThat(service().sendDue()).isEqualTo(1);
    assertThat(service().sendDue()).isZero(); // the next minute: already claimed

    assertThat(sender.payloads).hasSize(1);
    assertThat(sender.payloads.getFirst())
        .contains("Your 4-day streak is waiting")
        .contains("\"url\":\"/app/study\"");
    assertThat(store.claimed).containsExactly(LOCAL_DAY);
  }

  @Test
  void aFinishedDayGetsNoReminder() {
    subscription(null, null);
    done = true;

    assertThat(service().sendDue()).isZero();
    assertThat(sender.payloads).isEmpty();
  }

  @Test
  void usesTheDeviceZoneWhenTheUserHasNone() {
    userZone = Optional.empty();
    subscription("Etc/GMT+8", null);

    assertThat(service().sendDue()).isEqualTo(1);
  }

  @Test
  void notDueBeforeTheTimeInTheUsersZone() {
    now = Instant.parse("2026-11-11T01:00:00Z"); // 17:00 local
    subscription(null, null);

    assertThat(service().sendDue()).isZero();
  }

  @Test
  void aGoneSubscriptionIsRemoved() {
    subscription(null, null);
    sender.result = WebPushSender.Result.GONE;

    assertThat(service().sendDue()).isZero();

    assertThat(store.rows).isEmpty();
  }

  @Test
  void aFailedSendKeepsTheSubscriptionAndDoesNotRetryToday() {
    subscription(null, null);
    sender.result = WebPushSender.Result.FAILED;

    service().sendDue();
    service().sendDue();

    assertThat(store.rows).hasSize(1);
    assertThat(sender.payloads).hasSize(1);
  }

  @Test
  void aBrokenSubscriptionDoesNotStopTheOthers() {
    subscription(null, null);
    store.rows.add(
        new PushSubscription(2, 8, "https://p.test/2", "k", "a", LocalTime.of(19, 0), null, null));
    sender.failFirst = true;

    assertThat(service().sendDue()).isEqualTo(1);
  }

  @Test
  void withoutKeysNothingIsDone() {
    subscription(null, null);
    sender.enabled = false;

    assertThat(service().sendDue()).isZero();
    assertThat(sender.payloads).isEmpty();
  }

  @Test
  void aFirstDayHasAPlainMessage() {
    subscription(null, null);
    streak = 1;

    service().sendDue();

    assertThat(sender.payloads.getFirst()).contains("Today's words are ready");
  }

  static class FakeSender implements WebPushSender {
    boolean enabled = true;
    boolean failFirst = false;
    Result result = Result.SENT;
    final List<String> payloads = new ArrayList<>();

    public boolean enabled() {
      return enabled;
    }

    public String publicKey() {
      return "pub";
    }

    public Result send(PushSubscription subscription, String payload) {
      if (failFirst) {
        failFirst = false;
        throw new IllegalStateException("boom");
      }
      payloads.add(payload);
      return result;
    }
  }

  static class FakeStore implements PushSubscriptionStore {
    final List<PushSubscription> rows = new ArrayList<>();
    final List<LocalDate> claimed = new ArrayList<>();
    private final List<String> claims = new ArrayList<>();

    public void save(long u, String e, String p, String a, LocalTime r, String z, LocalDate l) {}

    public boolean delete(long userId, String endpoint) {
      return false;
    }

    public List<PushSubscription> findByUser(long userId) {
      return List.of();
    }

    public List<PushSubscription> findAll() {
      return List.copyOf(rows);
    }

    public boolean claim(long id, LocalDate date) {
      if (claims.contains(id + ":" + date)) {
        return false;
      }
      claims.add(id + ":" + date);
      claimed.add(date);
      return true;
    }

    public void deleteById(long id) {
      rows.removeIf(r -> r.id() == id);
    }
  }
}
