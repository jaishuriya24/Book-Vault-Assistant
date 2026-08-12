package com.book.service;

import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import jakarta.annotation.PostConstruct;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.net.URL;

@Service
public class OcrService {

    private String tessDataPath;

    @PostConstruct
    public void init() {
        // Determine the safest tessdata path regardless of how the app is launched
        String userDir = System.getProperty("user.dir");
        tessDataPath = userDir + File.separator + "tessdata";
        
        File tessDataFolder = new File(tessDataPath);
        if (!tessDataFolder.exists()) {
            tessDataFolder.mkdirs();
        }

        File engDataFile = new File(tessDataFolder, "eng.traineddata");
        if (!engDataFile.exists()) {
            System.out.println("Downloading eng.traineddata from official Tesseract repository...");
            try {
                URL url = new URL("https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata");
                try (InputStream in = url.openStream()) {
                    Files.copy(in, engDataFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    System.out.println("Successfully downloaded eng.traineddata to " + engDataFile.getAbsolutePath());
                }
            } catch (Exception e) {
                System.err.println("Failed to download eng.traineddata: " + e.getMessage());
                // Don't crash startup, but OCR will fail later if called
            }
        }
    }

    public String extractTextFromImage(MultipartFile file) throws Exception {
        Tesseract tesseract = new Tesseract();
        
        File engDataFile = new File(tessDataPath, "eng.traineddata");
        if (!engDataFile.exists()) {
             throw new Exception("eng.traineddata is missing from " + tessDataPath + ". Please ensure your internet connection is active on startup to download it automatically, or place it manually.");
        }

        tesseract.setDatapath(tessDataPath);
        tesseract.setLanguage("eng");

        try (InputStream in = file.getInputStream()) {
            BufferedImage image = ImageIO.read(in);
            if (image == null) {
                throw new IllegalArgumentException("Invalid image file provided. Could not read image.");
            }
            return tesseract.doOCR(image);
        } catch (TesseractException e) {
            throw new Exception("OCR processing failed: " + e.getMessage(), e);
        }
    }
}
