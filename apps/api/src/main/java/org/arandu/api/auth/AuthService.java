package org.arandu.api.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Email + password accounts with opaque bearer tokens (only their hash is stored). */
@Service
public class AuthService {

    private static final Duration SESSION_TTL = Duration.ofDays(30);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccountRepository accounts;
    private final JdbcClient jdbc;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(AccountRepository accounts, JdbcClient jdbc) {
        this.accounts = accounts;
        this.jdbc = jdbc;
    }

    static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public String signup(String email, String password) {
        String e = normalize(email);
        if (accounts.existsByEmail(e)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
        }
        Account a = accounts.saveAndFlush(new Account(e, encoder.encode(password)));
        return newSession(a.getId());
    }

    @Transactional
    public String login(String email, String password) {
        Account a = accounts.findByEmail(normalize(email))
                .filter(acc -> encoder.matches(password, acc.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials"));
        return newSession(a.getId());
    }

    public void logout(String authorization) {
        String token = bearer(authorization);
        if (token != null) {
            jdbc.sql("DELETE FROM session WHERE token_hash = ?").param(hash(token)).update();
        }
    }

    /** Resolves the account behind an {@code Authorization: Bearer} header or fails with 401. */
    public Account require(String authorization) {
        String token = bearer(authorization);
        if (token == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing token");
        }
        UUID id = jdbc.sql("SELECT account_id FROM session WHERE token_hash = ? AND expires_at > now()")
                .param(hash(token))
                .query(UUID.class)
                .optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid token"));
        return accounts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid token"));
    }

    private String newSession(UUID accountId) {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        jdbc.sql("INSERT INTO session (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
                .params(hash(token), accountId, Timestamp.from(Instant.now().plus(SESSION_TTL)))
                .update();
        return token;
    }

    private static String bearer(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        String t = authorization.substring(7).trim();
        return t.isEmpty() ? null : t;
    }

    private static String hash(String token) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
