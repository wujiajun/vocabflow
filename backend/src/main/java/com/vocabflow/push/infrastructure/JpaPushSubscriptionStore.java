package com.vocabflow.push.infrastructure;

import com.vocabflow.push.application.PushSubscription;
import com.vocabflow.push.application.PushSubscriptionStore;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JpaPushSubscriptionStore implements PushSubscriptionStore {
  private final PushSubscriptionJpaRepository repository;

  public JpaPushSubscriptionStore(PushSubscriptionJpaRepository repository) {
    this.repository = repository;
  }

  @Override
  @Transactional
  public void save(
      long userId,
      String endpoint,
      String p256dh,
      String auth,
      LocalTime remindAt,
      String deviceZone,
      LocalDate lastSentDate) {
    PushSubscriptionEntity e =
        repository
            .findByEndpoint(endpoint)
            .orElseGet(
                () -> {
                  PushSubscriptionEntity fresh = new PushSubscriptionEntity();
                  fresh.endpoint = endpoint;
                  fresh.createdAt = Instant.now();
                  return fresh;
                });
    e.userId = userId;
    e.p256dh = p256dh;
    e.auth = auth;
    e.remindAt = remindAt;
    e.deviceZone = deviceZone;
    e.lastSentDate = lastSentDate;
    repository.save(e);
  }

  @Override
  public boolean delete(long userId, String endpoint) {
    return repository.deleteByUserIdAndEndpoint(userId, endpoint) > 0;
  }

  @Override
  public List<PushSubscription> findByUser(long userId) {
    return repository.findByUserIdOrderById(userId).stream().map(this::map).toList();
  }

  @Override
  public List<PushSubscription> findAll() {
    return repository.findAll().stream().map(this::map).toList();
  }

  @Override
  public boolean claim(long id, LocalDate date) {
    return repository.claim(id, date) > 0;
  }

  @Override
  public void deleteById(long id) {
    repository.deleteById(id);
  }

  private PushSubscription map(PushSubscriptionEntity e) {
    return new PushSubscription(
        e.id, e.userId, e.endpoint, e.p256dh, e.auth, e.remindAt, e.deviceZone, e.lastSentDate);
  }
}
