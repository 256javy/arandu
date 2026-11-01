package org.arandu.api.learner;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/learners")
public class LearnerController {

    public record CreateLearner(@NotBlank @Size(max = 40) String nickname) {
    }

    public record LearnerView(UUID id, String nickname) {
    }

    public record SkillMastery(String skill, int attempts, int successes, double mastery, String lastDetail) {
    }

    private final LearnerRepository learners;
    private final EvidenceRepository evidence;

    public LearnerController(LearnerRepository learners, EvidenceRepository evidence) {
        this.learners = learners;
        this.evidence = evidence;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerView create(@Valid @RequestBody CreateLearner body) {
        Learner l = learners.save(new Learner(body.nickname().trim()));
        return new LearnerView(l.getId(), l.getNickname());
    }

    @GetMapping("/{id}/mastery")
    public List<SkillMastery> mastery(@PathVariable UUID id) {
        if (!learners.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "learner not found");
        }
        Map<String, int[]> counts = new LinkedHashMap<>();
        Map<String, String> last = new LinkedHashMap<>();
        for (Evidence e : evidence.findByLearnerIdOrderByCreatedAtAsc(id)) {
            int[] c = counts.computeIfAbsent(e.getSkill(), k -> new int[2]);
            c[0]++;
            if (e.isOk()) {
                c[1]++;
            }
            last.put(e.getSkill(), e.getDetail());
        }
        return counts.entrySet().stream()
                .map(en -> new SkillMastery(en.getKey(), en.getValue()[0], en.getValue()[1],
                        (double) en.getValue()[1] / en.getValue()[0], last.get(en.getKey())))
                .toList();
    }
}
