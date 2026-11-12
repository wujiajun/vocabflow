package com.vocabflow.push.application;

import java.time.ZoneId;
import java.util.Optional;

/** The time zone a user chose for the study day; implemented by the identity module. */
public interface UserZones {
  Optional<ZoneId> of(long userId);
}
