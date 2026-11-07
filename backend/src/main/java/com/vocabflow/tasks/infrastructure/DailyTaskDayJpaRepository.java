package com.vocabflow.tasks.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyTaskDayJpaRepository extends JpaRepository<DailyTaskDayEntity, Long> {}
