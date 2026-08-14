package com.book.controller;

import com.book.dto.VoiceCommandRequest;
import com.book.dto.VoiceCommandResponse;
import com.book.service.OllamaAiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AiVoiceController {

    private final OllamaAiService ollamaAiService;

    public AiVoiceController(OllamaAiService ollamaAiService) {
        this.ollamaAiService = ollamaAiService;
    }

    @PostMapping("/parse-voice")
    public ResponseEntity<VoiceCommandResponse> parseVoiceCommand(@RequestBody VoiceCommandRequest request) {
        VoiceCommandResponse response = ollamaAiService.processVoiceCommand(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/parse-intent")
    public ResponseEntity<VoiceCommandResponse> parseIntentFallback(@RequestBody VoiceCommandRequest request) {
        VoiceCommandResponse response = ollamaAiService.processVoiceCommand(request);
        return ResponseEntity.ok(response);
    }
}
