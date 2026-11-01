package org.arandu.api.learner;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearnerRepository extends JpaRepository<Learner, UUID> {

    List<Learner> findByAccountIdOrderByNicknameAsc(UUID accountId);
}
