package org.arandu.api.tutor;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class TutorConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(TutorConfig.class)
            .withPropertyValues("arandu.web-origin=http://localhost", "arandu.meta.base-url=http://localhost:1",
                    "arandu.meta.api-key=k", "arandu.meta.model=m");

    @Test
    void effortAndBudgetArePerRole() {
        runner.withPropertyValues("arandu.meta.tutor.reasoning-effort=low", "arandu.meta.tutor.max-tokens=1500",
                        "arandu.meta.judge.reasoning-effort=minimal", "arandu.meta.judge.max-tokens=800")
                .run(ctx -> {
                    var tutor = (OpenAiCompatibleTutorModel) ctx.getBean(TutorModel.class);
                    var judge = (OpenAiCompatibleTutorModel) ctx.getBean(TutorConfig.JUDGE, TutorModel.class);
                    assertThat(tutor.reasoningEffort()).isEqualTo("low");
                    assertThat(tutor.maxTokens()).isEqualTo(1500);
                    assertThat(judge.reasoningEffort()).isEqualTo("minimal");
                    assertThat(judge.maxTokens()).isEqualTo(800);
                });
    }

    @Test
    void blankEffortIsOmitted() {
        runner.withPropertyValues("arandu.meta.tutor.reasoning-effort=", "arandu.meta.tutor.max-tokens=1",
                        "arandu.meta.judge.reasoning-effort=", "arandu.meta.judge.max-tokens=1")
                .run(ctx -> assertThat(((OpenAiCompatibleTutorModel) ctx.getBean(TutorModel.class))
                        .reasoningEffort()).isNull());
    }

    @Test
    void noKeyMeansMockForBothRoles() {
        assertThat(TutorConfig.create("u", "", "m", "low", 1)).isInstanceOf(MockTutorModel.class);
    }
}
