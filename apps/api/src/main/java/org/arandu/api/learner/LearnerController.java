package org.arandu.api.learner;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.arandu.api.auth.Account;
import org.arandu.api.auth.AuthService;
import org.arandu.api.planner.LearnerModel;
import org.arandu.api.planner.Planner;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class LearnerController {

    public record CreateLearner(@NotBlank @Size(max = 40) String nickname) {
    }

    public record LearnerView(UUID id, String nickname) {
    }

    public record MeView(String email, List<LearnerView> learners) {
    }

    public record SkillMastery(String skill, String label, int attempts, int successes, double mastery,
                               String status, String lastDetail, String lastExercise, String lastConfidence) {
    }

    public record EvidenceView(String skill, String label, boolean ok, String confidence, String exercise,
                               String detail, String quote, Instant at) {
    }

    private final AuthService auth;
    private final LearnerRepository learners;
    private final LearnerService service;

    public LearnerController(AuthService auth, LearnerRepository learners, LearnerService service) {
        this.auth = auth;
        this.learners = learners;
        this.service = service;
    }

    @GetMapping("/me")
    public MeView me(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Account a = auth.require(authorization);
        return new MeView(a.getEmail(), learners.findByAccountIdOrderByNicknameAsc(a.getId()).stream()
                .map(l -> new LearnerView(l.getId(), l.getNickname())).toList());
    }

    @PostMapping("/learners")
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerView create(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                              @Valid @RequestBody CreateLearner body) {
        Account a = auth.require(authorization);
        Learner l = learners.save(new Learner(a.getId(), body.nickname().trim()));
        return new LearnerView(l.getId(), l.getNickname());
    }

    /** Deletes the profile and, by cascade, all of its evidence. */
    @DeleteMapping("/learners/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                       @PathVariable UUID id) {
        learners.delete(service.requireOwned(authorization, id));
    }

    @GetMapping("/learners/{id}/mastery")
    public List<SkillMastery> mastery(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                      @PathVariable UUID id) {
        service.requireOwned(authorization, id);
        return service.model(id).skills().stream()
                .map(s -> new SkillMastery(s.skill(), Planner.label(s.skill()), s.attempts(), s.successes(),
                        s.mastery(), s.status().name().toLowerCase(), s.lastDetail(), s.lastExercise(),
                        s.lastConfidence()))
                .toList();
    }

    @GetMapping("/learners/{id}/evidence")
    public List<EvidenceView> evidence(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                       @PathVariable UUID id) {
        service.requireOwned(authorization, id);
        List<Evidence> all = service.history(id);
        return all.subList(Math.max(0, all.size() - 30), all.size()).reversed().stream()
                .map(e -> new EvidenceView(e.getSkill(), Planner.label(e.getSkill()), e.isOk(), e.getConfidence(),
                        e.getSourceExercise(), e.getDetail(), e.getQuote(), e.getCreatedAt()))
                .toList();
    }

    @GetMapping("/learners/{id}/next")
    public Planner.Plan next(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                             @PathVariable UUID id) {
        service.requireOwned(authorization, id);
        LearnerModel model = service.model(id);
        return Planner.next(model);
    }
}
