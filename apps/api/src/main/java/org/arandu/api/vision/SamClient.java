package org.arandu.api.vision;

/** Segments an image with SAM 3.1 and returns the raw model output text (the token grammar). */
public interface SamClient {

    /**
     * @param image the encoded image, kept only in memory
     * @param mediaType image/jpeg, image/png or image/webp
     * @param prompt a short noun phrase ("pizza slice")
     */
    String segment(byte[] image, String mediaType, String prompt);

    /** Thrown when SAM is not configured or fails; mapped to 502/503 by the controller. */
    class SamUnavailableException extends RuntimeException {
        public SamUnavailableException(String message) {
            super(message);
        }
    }
}
