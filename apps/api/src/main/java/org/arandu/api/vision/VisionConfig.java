package org.arandu.api.vision;

import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class VisionConfig {

    @Bean
    SamClient samClient(@Value("${arandu.meta.base-url}") String baseUrl,
                        @Value("${arandu.meta.api-key}") String apiKey,
                        @Value("${arandu.vision.timeout:20s}") Duration timeout) {
        if (apiKey == null || apiKey.isBlank() || baseUrl == null || baseUrl.isBlank()) {
            return (image, mediaType, prompt) -> {
                throw new SamClient.SamUnavailableException("META_API_KEY or META_API_BASE_URL not set");
            };
        }
        return new MetaSamClient(baseUrl, apiKey, timeout);
    }

    @Bean
    HourlyRateLimiter visionRateLimiter(@Value("${arandu.vision.photos-per-hour:20}") int perHour,
                                        @Value("${arandu.vision.max-in-flight:2}") int maxInFlight) {
        return new HourlyRateLimiter(perHour, maxInFlight, Clock.systemUTC());
    }
}
