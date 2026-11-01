package org.arandu.api.tutor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Two model clients on the same endpoint: Musi (the tutor) and the rubric judge. Each role has its own
 * reasoning effort and token budget, since the turn latency is almost all LLM time.
 */
@Configuration
public class TutorConfig implements WebMvcConfigurer {

    public static final String JUDGE = "judgeModel";

    @Value("${arandu.web-origin}")
    private String webOrigin;

    @Bean
    @Primary
    TutorModel tutorModel(@Value("${arandu.meta.base-url}") String baseUrl,
                          @Value("${arandu.meta.api-key}") String apiKey,
                          @Value("${arandu.meta.model}") String model,
                          @Value("${arandu.meta.tutor.reasoning-effort}") String reasoningEffort,
                          @Value("${arandu.meta.tutor.max-tokens}") int maxTokens) {
        return create(baseUrl, apiKey, model, reasoningEffort, maxTokens);
    }

    @Bean(JUDGE)
    TutorModel judgeModel(@Value("${arandu.meta.base-url}") String baseUrl,
                          @Value("${arandu.meta.api-key}") String apiKey,
                          @Value("${arandu.meta.model}") String model,
                          @Value("${arandu.meta.judge.reasoning-effort}") String reasoningEffort,
                          @Value("${arandu.meta.judge.max-tokens}") int maxTokens) {
        return create(baseUrl, apiKey, model, reasoningEffort, maxTokens);
    }

    static TutorModel create(String baseUrl, String apiKey, String model, String reasoningEffort, int maxTokens) {
        if (apiKey == null || apiKey.isBlank()) {
            return new MockTutorModel();
        }
        return new OpenAiCompatibleTutorModel(baseUrl, apiKey, model, reasoningEffort, maxTokens);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(webOrigin.split("\\s*,\\s*"))
                .allowedMethods("GET", "POST", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
