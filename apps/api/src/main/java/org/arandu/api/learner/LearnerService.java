package org.arandu.api.learner;

import java.util.List;
import java.util.UUID;
import org.arandu.api.auth.Account;
import org.arandu.api.auth.AuthService;
import org.arandu.api.planner.LearnerModel;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LearnerService {

    private final AuthService auth;
    private final LearnerRepository learners;
    private final EvidenceRepository evidence;

    public LearnerService(AuthService auth, LearnerRepository learners, EvidenceRepository evidence) {
        this.auth = auth;
        this.learners = learners;
        this.evidence = evidence;
    }

    /** The learner, if it belongs to the account behind the token; 404 otherwise (no existence leak). */
    public Learner requireOwned(String authorization, UUID learnerId) {
        Account a = auth.require(authorization);
        return learners.findById(learnerId)
                .filter(l -> a.getId().equals(l.getAccountId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "learner not found"));
    }

    public List<Evidence> history(UUID learnerId) {
        return evidence.findByLearnerIdOrderByCreatedAtAsc(learnerId);
    }

    public LearnerModel model(UUID learnerId) {
        return LearnerModel.of(history(learnerId).stream()
                .map(e -> new LearnerModel.Observation(e.getSkill(), e.isOk(), e.getConfidence(),
                        e.getSourceExercise(), e.getDetail(), e.getCreatedAt()))
                .toList());
    }
}
