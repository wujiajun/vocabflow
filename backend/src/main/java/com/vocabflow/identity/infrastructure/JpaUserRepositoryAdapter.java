package com.vocabflow.identity.infrastructure;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.identity.domain.*;
import java.time.ZoneId;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class JpaUserRepositoryAdapter implements UserRepository {
  private final UserJpaRepository users;

  public JpaUserRepositoryAdapter(UserJpaRepository users) {
    this.users = users;
  }

  @Override
  public boolean existsByEmail(Email email) {
    return users.existsByEmail(email.value());
  }

  @Override
  public User save(User user) {
    UserEntity entity = new UserEntity();
    entity.id = user.id() == 0 ? null : user.id();
    entity.email = user.email().value();
    entity.passwordHash = user.passwordHash();
    entity.clbLevel = user.clbLevel().name();
    entity.dailyGoal = user.dailyVocabularyGoal().value();
    entity.createdAt = user.createdAt();
    entity.timeZone = user.timeZone() == null ? null : user.timeZone().getId();
    return toDomain(users.save(entity));
  }

  @Override
  public Optional<User> findByEmail(Email email) {
    return users.findByEmail(email.value()).map(this::toDomain);
  }

  @Override
  public Optional<User> findById(long id) {
    return users.findById(id).map(this::toDomain);
  }

  @Override
  public boolean existsById(long id) {
    return users.existsById(id);
  }

  private User toDomain(UserEntity entity) {
    return new User(
        entity.id,
        new Email(entity.email),
        entity.passwordHash,
        ClbLevel.from(entity.clbLevel),
        new DailyVocabularyGoal(entity.dailyGoal),
        entity.createdAt,
        entity.timeZone == null ? null : ZoneId.of(entity.timeZone));
  }
}
