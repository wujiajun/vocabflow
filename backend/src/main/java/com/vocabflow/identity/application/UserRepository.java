package com.vocabflow.identity.application;

import com.vocabflow.identity.domain.Email;
import com.vocabflow.identity.domain.User;
import java.util.Optional;

public interface UserRepository {
  boolean existsByEmail(Email email);

  User save(User user);

  Optional<User> findByEmail(Email email);

  Optional<User> findById(long id);

  boolean existsById(long id);
}
