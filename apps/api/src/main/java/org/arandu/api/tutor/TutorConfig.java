package org.arandu.api.tutor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class TutorConfig implements WebMvcConfigurer {

    @Value("${arandu.web-origin}")
    private String webOrigin;

    @Bean
    TutorModel tutorModel(@Value("${arandu.meta.base-url}") String baseUrl,
                          @Value("${arandu.meta.api-key}") String apiKey,
                          @Value("${arandu.meta.model}") String model,
                          @Value("${arandu.meta.reasoning-effort}") String reasoningEffort,
                          @Value("${arandu.meta.max-tokens}") int maxTokens) {
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
