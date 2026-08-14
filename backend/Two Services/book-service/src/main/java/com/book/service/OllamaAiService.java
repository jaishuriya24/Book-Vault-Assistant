package com.book.service;

import com.book.dto.VoiceCommandRequest;
import com.book.dto.VoiceCommandResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OllamaAiService {

    @Value("${ollama.url:http://localhost:11434}")
    private String ollamaUrl;

    @Value("${ollama.model:qwen3.5:0.8b}")
    private String ollamaModel;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final Set<String> ALLOWED_ACTIONS = new HashSet<>(Arrays.asList(
            "CONVERSATION",
            "NAVIGATE",
            "OPEN_FACELOGIN",
            "OPEN_SIGNUP",
            "OPEN_SIGNIN",
            "SET_FORM_FIELD",
            "SUBMIT_SIGNUP",
            "SUBMIT_LOGIN",
            "OTP_SUBMIT",
            "LIST_BOOKS",
            "OPEN_LATEST_BOOK",
            "CONTINUE_READING",
            "NEXT_PAGE",
            "PREVIOUS_PAGE",
            "READ_PAGE",
            "PAUSE_READING",
            "PAGE_SUMMARY",
            "SEARCH_BOOK",
            "OPEN_BOOK",
            "BOOKMARK_PAGE",
            "SCAN_PAGE",
            "OPEN_LIBRARY",
            "OPEN_SETTINGS",
            "SET_VOICE_SPEED",
            "HELP",
            "UNKNOWN"
    ));

    public OllamaAiService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public VoiceCommandResponse processVoiceCommand(VoiceCommandRequest request) {
        if (request == null || request.getTranscript() == null || request.getTranscript().trim().isEmpty()) {
            return new VoiceCommandResponse("CONVERSATION", "", "", "I'm sorry, I didn't quite hear you. How can I help you with Book Vault today?", true);
        }

        String rawTranscript = request.getTranscript().trim();

        // 1. Determine actual authentication via Spring Security context
        boolean actualAuth = false;
        try {
            org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            actualAuth = auth != null && auth.isAuthenticated() && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken);
        } catch (Exception e) {
            // Unauthenticated
        }

        // 2. Security Guard for unauthenticated access to personal library data
        if (!actualAuth && !request.isAuthenticated()) {
            VoiceCommandResponse unauthGuard = checkUnauthenticatedSecurityGuard(rawTranscript);
            if (unauthGuard != null) {
                return unauthGuard;
            }
        }

        boolean isAuthEffective = actualAuth || request.isAuthenticated();

        // 3. Fast Pre-matcher for deterministic quick responses & form fields
        VoiceCommandResponse fastMatch = matchLocalRegex(rawTranscript, isAuthEffective, request);
        if (fastMatch != null) {
            return fastMatch;
        }

        // 4. Query Local Ollama (qwen3.5:0.8b) with safe application context
        try {
            String prompt = buildSystemPrompt(request, isAuthEffective);
            Map<String, Object> reqBody = new HashMap<>();
            reqBody.put("model", ollamaModel);
            reqBody.put("system", "You are the global voice assistant for Book Vault. Output ONLY a valid JSON object matching the exact schema. Do not generate thinking text or explanations.");
            reqBody.put("prompt", prompt);
            reqBody.put("stream", false);
            reqBody.put("format", "json");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(reqBody, headers);

            String endpoint = ollamaUrl + "/api/generate";
            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String responseText = root.path("response").asText("");
                VoiceCommandResponse parsed = parseAndValidateJson(responseText, isAuthEffective);
                if (parsed != null && parsed.isValid()) {
                    return parsed;
                }
            }
        } catch (Exception e) {
            System.err.println("[OllamaAiService] Ollama API call failed/offline: " + e.getMessage());
        }

        // 5. Conversational Fallback matcher
        return fallbackMatcher(rawTranscript, isAuthEffective, request);
    }

    private VoiceCommandResponse checkUnauthenticatedSecurityGuard(String transcript) {
        String lower = transcript.toLowerCase();
        if (lower.contains("my book") || lower.contains("my library") || lower.contains("reading history") ||
            lower.contains("was i reading") || lower.contains("do i have") || lower.contains("my latest book")) {
            return new VoiceCommandResponse("CONVERSATION", "", "", "You'll need to sign in first so I can access your library.", true);
        }
        return null;
    }

    private String buildSystemPrompt(VoiceCommandRequest req, boolean authenticated) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are Book Vault AI, an intelligent, friendly conversational voice assistant integrated into the Book Vault web app.\n\n");
        sb.append("MISSION:\n");
        sb.append("1. Speak naturally like ChatGPT for general questions, greetings, and chat. Provide helpful 1-2 sentence spoken answers in 'feedbackTts'.\n");
        sb.append("2. When user asks to perform website operations, map the action AND provide a friendly spoken response.\n\n");
        sb.append("ACTION MAPPING RULES:\n");
        sb.append("- SCAN / ADD BOOK: user wants to scan, capture photo, add book -> action: \"SCAN_PAGE\", feedbackTts: \"Sure! Opening the book scanner now.\"\n");
        sb.append("- VIEW LIBRARY: user asks to see books, open library, go home -> action: \"OPEN_LIBRARY\", feedbackTts: \"Opening your library.\"\n");
        sb.append("- FORM FILLING: user gives name, email, password -> action: \"SET_FORM_FIELD\", field: \"name\"|\"email\"|\"password\", value: \"<extracted>\", feedbackTts: \"Setting your <field> to <value>.\"\n");
        sb.append("- SIGN IN / SIGN UP: user wants to sign in, log in, register, create account -> action: \"OPEN_SIGNIN\" or \"OPEN_SIGNUP\", feedbackTts: \"Opening <page>.\"\n");
        sb.append("- SETTINGS: user asks to change settings, voice speed -> action: \"OPEN_SETTINGS\", feedbackTts: \"Opening settings.\"\n");
        sb.append("- READER CONTROLS: user asks for next page, previous page, read aloud, pause -> action: \"NEXT_PAGE\" / \"PREVIOUS_PAGE\" / \"READ_PAGE\" / \"PAUSE_READING\".\n");
        sb.append("- CONVERSATION / GENERAL Q&A: all other chat, questions, info -> action: \"CONVERSATION\", feedbackTts: \"<Your direct, friendly 1-2 sentence spoken reply to user's speech. DO NOT use generic fallback sentences!>\"\n\n");
        
        sb.append("CONTEXT:\n");
        sb.append("Authenticated: ").append(authenticated).append("\n");
        if (authenticated) {
            sb.append("User: ").append(req.getActiveUser() != null ? req.getActiveUser() : "Reader").append("\n");
            sb.append("Books Count: ").append(req.getBookCount() != null ? req.getBookCount() : 0).append("\n");
            if (req.getUserBookTitles() != null && !req.getUserBookTitles().isEmpty()) {
                sb.append("User Books: ").append(String.join(", ", req.getUserBookTitles())).append("\n");
            }
            if (req.getActiveBookTitle() != null) {
                sb.append("Active Book: ").append(req.getActiveBookTitle()).append(" (Page ").append(req.getActivePageNumber() != null ? req.getActivePageNumber() : 1).append(")\n");
            }
        }
        sb.append("Current View: ").append(req.getCurrentRoute() != null ? req.getCurrentRoute() : "/").append("\n");
        if (req.getPendingField() != null && !req.getPendingField().isEmpty()) {
            sb.append("Pending Form Field: ").append(req.getPendingField()).append("\n");
        }
        sb.append("\nUser Speech: \"").append(req.getTranscript()).append("\"\n\n");
        sb.append("Return ONLY a raw JSON object matching schema: {\"action\":\"<ACTION>\",\"query\":\"\",\"target\":\"\",\"field\":\"\",\"value\":\"\",\"feedbackTts\":\"<spoken reply>\"}\n");

        return sb.toString();
    }

    private VoiceCommandResponse parseAndValidateJson(String jsonText, boolean authenticated) {
        try {
            String cleanJson = jsonText.trim();
            cleanJson = cleanJson.replaceAll("(?s)<think>.*?</think>", "").trim();

            Matcher matcher = Pattern.compile("\\{[\\s\\S]*\\}").matcher(cleanJson);
            if (matcher.find()) {
                cleanJson = matcher.group();
            }

            JsonNode node = objectMapper.readTree(cleanJson);
            String action = node.path("action").asText("CONVERSATION").toUpperCase();
            String query = node.path("query").asText("");
            String target = node.path("target").asText("");
            String field = node.path("field").asText("");
            String value = node.path("value").asText("");
            String feedbackTts = node.path("feedbackTts").asText("");
            Double speed = node.has("speakingSpeed") ? node.path("speakingSpeed").asDouble(1.0) : null;

            if (!ALLOWED_ACTIONS.contains(action)) {
                action = "CONVERSATION";
            }

            if (feedbackTts.isEmpty()) {
                feedbackTts = generateDefaultTts(action, query, authenticated);
            }

            return new VoiceCommandResponse(action, query, target, field, value, feedbackTts, speed, true);
        } catch (Exception e) {
            System.err.println("[OllamaAiService] JSON parse error: " + e.getMessage());
            return null;
        }
    }

    private VoiceCommandResponse matchLocalRegex(String transcript, boolean authenticated, VoiceCommandRequest req) {
        String lower = transcript.toLowerCase();
        String currentRoute = req != null && req.getCurrentRoute() != null ? req.getCurrentRoute() : "/";

        // Form Fields & Multi-Step Interactions
        if (lower.startsWith("enter my name ") || lower.startsWith("my name is ") || lower.startsWith("name is ") || lower.startsWith("set name to ")) {
            String val = transcript.replaceAll("(?i)^(enter my name|my name is|name is|set name to)\\s+", "").trim();
            String tts = "/signup".equals(currentRoute) ? "Setting your name to " + val + ". What email address should I use?" : "Setting name to " + val;
            return new VoiceCommandResponse("SET_FORM_FIELD", "", "", "name", val, tts, null, true);
        }
        if (lower.startsWith("enter my email ") || lower.startsWith("my email is ") || lower.startsWith("email is ")) {
            String val = transcript.replaceAll("(?i)^(enter my email|my email is|email is)\\s+", "").trim();
            return new VoiceCommandResponse("SET_FORM_FIELD", "", "", "email", val, "Setting your email to " + val, null, true);
        }
        if (lower.startsWith("set my password to ") || lower.startsWith("enter password ") || lower.startsWith("password is ")) {
            String val = transcript.replaceAll("(?i)^(set my password to|enter password|password is)\\s+", "").trim();
            return new VoiceCommandResponse("SET_FORM_FIELD", "", "", "password", val, "Password entered.", null, true);
        }

        // Context-aware single word responses during form filling
        if (currentRoute.equals("/signup") && req != null && "name".equalsIgnoreCase(req.getPendingField())) {
            return new VoiceCommandResponse("SET_FORM_FIELD", "", "", "name", transcript.trim(), "Setting your name to " + transcript.trim() + ". What email address should I use?", null, true);
        }

        // Greetings & General Conversation
        if (lower.equals("hello") || lower.equals("hi") || lower.startsWith("hi ") || lower.startsWith("hello ")) {
            if (authenticated) {
                return new VoiceCommandResponse("CONVERSATION", "", "", "Hello! I'm Book Vault. I'm here to help you read and manage your books. What would you like to do?", true);
            } else {
                return new VoiceCommandResponse("CONVERSATION", "", "", "Hello! I'm Book Vault. I can help you sign in, create an account, use facial login, or guide you through the application. What would you like to do?", true);
            }
        }
        if (lower.contains("what can you do") || lower.contains("help me")) {
            if (authenticated) {
                return new VoiceCommandResponse("CONVERSATION", "", "", "I can help you navigate Book Vault, search your library, open books, turn pages, read aloud, save bookmarks, scan new pages, and adjust settings.", true);
            } else {
                return new VoiceCommandResponse("CONVERSATION", "", "", "I can help you sign in, create an account, use facial login, or guide you through Book Vault.", true);
            }
        }
        if (lower.contains("are you there")) {
            return new VoiceCommandResponse("CONVERSATION", "", "", "Yes, I'm right here! How can I help you?", true);
        }
        if (lower.contains("i'm lost") || lower.contains("im lost") || lower.contains("where am i") || lower.contains("i'm confused") || lower.contains("im confused")) {
            return new VoiceCommandResponse("CONVERSATION", "", "", "You are in Book Vault. I can help you navigate, open your books, turn pages, or read aloud. Just tell me what you'd like to do.", true);
        }
        if (lower.contains("thank you") || lower.contains("thanks")) {
            return new VoiceCommandResponse("CONVERSATION", "", "", "You're welcome! Let me know if you need anything else.", true);
        }

        // Navigation Commands
        if (lower.contains("face login") || lower.contains("facial login")) {
            return new VoiceCommandResponse("OPEN_FACELOGIN", "", "facelogin", "Of course. Opening facial login.", true);
        }
        if (lower.contains("create an account") || lower.contains("sign up") || lower.contains("register")) {
            return new VoiceCommandResponse("OPEN_SIGNUP", "", "signup", "Sure! Opening sign-up. What is your name?", true);
        }
        if (lower.contains("password login") || lower.contains("help me log in") || lower.contains("sign in") || lower.contains("i want to log in")) {
            return new VoiceCommandResponse("OPEN_SIGNIN", "", "signin", "Of course. You can use password login or facial login. Which would you prefer?", true);
        }

        // Reader Controls
        if (lower.contains("next page") || lower.contains("turn page") || lower.contains("go to the next page")) {
            return new VoiceCommandResponse("NEXT_PAGE", "", "", "Going to the next page.", true);
        }
        if (lower.contains("previous page") || lower.contains("prev page") || lower.contains("go back a page")) {
            return new VoiceCommandResponse("PREVIOUS_PAGE", "", "", "Going to previous page.", true);
        }
        if (lower.contains("pause") || lower.contains("stop reading") || lower.contains("pause reading")) {
            return new VoiceCommandResponse("PAUSE_READING", "", "", "Reading paused.", true);
        }
        if (lower.contains("read this page") || lower.contains("read page") || lower.contains("start reading")) {
            return new VoiceCommandResponse("READ_PAGE", "", "", "Starting reading.", true);
        }

        // Library & Book Management
        if (lower.contains("i want to read my book") || lower.contains("read my book")) {
            return new VoiceCommandResponse("OPEN_LATEST_BOOK", "", "reader", "Opening your latest book.", true);
        }
        if (lower.contains("what books do i have") || lower.contains("list my books") || lower.contains("show books")) {
            return new VoiceCommandResponse("LIST_BOOKS", "", "library", "Opening your library to show your saved books.", true);
        }
        if (lower.contains("latest book") || lower.contains("open my latest book") || lower.contains("most recent book")) {
            return new VoiceCommandResponse("OPEN_LATEST_BOOK", "", "reader", "Opening your most recent book.", true);
        }
        if (lower.contains("continue reading")) {
            return new VoiceCommandResponse("CONTINUE_READING", "", "reader", "Continuing from where you left off.", true);
        }
        if (lower.contains("bookmark this") || lower.contains("bookmark page")) {
            return new VoiceCommandResponse("BOOKMARK_PAGE", "", "", "Page bookmarked.", true);
        }
        if (lower.contains("scan a new book") || lower.contains("scan new book") || lower.contains("scan page") || lower.contains("open camera")) {
            return new VoiceCommandResponse("SCAN_PAGE", "", "scanner", "Opening book scanner.", true);
        }
        if (lower.contains("go back to my library") || lower.contains("open library") || lower.contains("my library") || lower.contains("open my library")) {
            return new VoiceCommandResponse("OPEN_LIBRARY", "", "library", "Opening library.", true);
        }
        if (lower.contains("take me back home") || lower.contains("go home") || lower.contains("take me home")) {
            return new VoiceCommandResponse("NAVIGATE", "", "home", "Taking you back home.", true);
        }
        if (lower.contains("open settings")) {
            return new VoiceCommandResponse("OPEN_SETTINGS", "", "settings", "Opening settings.", true);
        }
        if (lower.contains("make the voice slower") || lower.contains("slower voice") || lower.contains("read slower")) {
            return new VoiceCommandResponse("SET_VOICE_SPEED", "", "", "", "", "Slowing down voice reading speed.", 0.8, true);
        }
        if (lower.contains("make the voice faster") || lower.contains("faster voice") || lower.contains("read faster")) {
            return new VoiceCommandResponse("SET_VOICE_SPEED", "", "", "", "", "Speeding up voice reading speed.", 1.3, true);
        }
        if (lower.startsWith("search for books about ") || lower.startsWith("search ")) {
            String query = lower.replace("search for books about ", "").replace("search ", "").trim();
            return new VoiceCommandResponse("SEARCH_BOOK", query, "search", "Searching for books about " + query, true);
        }

        return null;
    }

    private VoiceCommandResponse fallbackMatcher(String transcript, boolean authenticated, VoiceCommandRequest req) {
        VoiceCommandResponse match = matchLocalRegex(transcript, authenticated, req);
        if (match != null) return match;

        return new VoiceCommandResponse(
            "CONVERSATION",
            "",
            "",
            "I'm sorry, I didn't quite understand. You can ask me to open a book, read, scan, search your library, change settings, or just talk to me.",
            true
        );
    }

    private String generateDefaultTts(String action, String query, boolean authenticated) {
        switch (action) {
            case "OPEN_FACELOGIN": return "Opening facial login.";
            case "OPEN_SIGNUP": return "Opening sign-up.";
            case "OPEN_SIGNIN": return "Opening password sign-in.";
            case "SET_FORM_FIELD": return "Updating field.";
            case "NEXT_PAGE": return "Going to next page.";
            case "PREVIOUS_PAGE": return "Going to previous page.";
            case "READ_PAGE": return "Starting reading.";
            case "PAUSE_READING": return "Reading paused.";
            case "SCAN_PAGE": return "Opening book scanner.";
            case "SEARCH_BOOK": return "Searching for " + (query.isEmpty() ? "books" : query);
            case "OPEN_BOOK": return "Opening book.";
            case "BOOKMARK_PAGE": return "Page bookmarked.";
            case "OPEN_LIBRARY": return "Opening library.";
            case "OPEN_SETTINGS": return "Opening settings.";
            default: return "I'm here to help you with Book Vault.";
        }
    }
}
