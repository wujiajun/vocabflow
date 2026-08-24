package com.vocabflow.identity.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RevokedTokenRepository extends JpaRepository<RevokedTokenEntity, String> {}
