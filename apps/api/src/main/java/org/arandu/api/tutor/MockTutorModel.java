package org.arandu.api.tutor;

import java.util.List;

/** Offline stand-in used when META_API_KEY is empty. */
public class MockTutorModel implements TutorModel {

    @Override
    public String complete(List<Message> messages) {
        return "Mirá bien las partes de tu barra: ¿te parece que todas tienen el mismo tamaño?";
    }
}
