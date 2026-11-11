package com.vocabflow.identity.infrastructure;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.identity.domain.User;
import com.vocabflow.push.application.UserZones;
import java.time.ZoneId;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Gives the reminders the time zone the user chose in Settings. */
@Component
public class IdentityUserZones implements UserZones {
  private final UserRepository users;

  public IdentityUserZones(UserRepository users) {
    this.users = users;
  }

  @Override
  public Optional<ZoneId> of(long userId) {
    return users.findById(userId).map(User::timeZone);
  }
}
