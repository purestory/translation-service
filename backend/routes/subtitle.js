const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const TranslationService = require('../services/translationService');
const SubtitleParser = require('../utils/subtitleParser');
const ChunkTranslator = require('../services/chunkTranslator');
const progressManager = require('../services/progressManager');

const translationService = new TranslationService();
const chunkTranslator = new ChunkTranslator();

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.srt', '.smi', '.vtt', '.ass'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('지원하지 않는 파일 형식입니다. SRT, SMI, VTT 파일만 업로드 가능합니다.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

// 자막 파일 업로드 및 분석
router.post('/upload', upload.single('subtitle'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    console.log(`자막 파일 업로드: ${req.file.originalname} (${req.file.size} bytes)`);

    // 원본 파일명 정보를 메타 파일로 저장
    const metaPath = path.join(__dirname, '../uploads', req.file.filename + '.meta');
    const metaData = {
      originalName: req.file.originalname,
      uploadTime: new Date().toISOString(),
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    };
    fs.writeFileSync(metaPath, JSON.stringify(metaData), 'utf8');

    // 파일 파싱
    const parsed = SubtitleParser.parseSubtitle(req.file.path);
    const stats = SubtitleParser.getSubtitleStats(parsed.entries);

    // 파일 정보 응답
    res.json({
      success: true,
      data: {
        fileId: req.file.filename,
        originalName: req.file.originalname,
        format: parsed.format,
        stats: stats,
        preview: parsed.entries.slice(0, 3), // 처음 3개 엔트리 미리보기
        uploadTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('파일 업로드 오류:', error);
    
    // 업로드된 파일 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || '파일 처리 중 오류가 발생했습니다.'
    });
  }
});

// 진행 상태 조회 엔드포인트
router.get('/progress/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const progress = progressManager.getProgress(fileId);
  
  if (!progress) {
    return res.status(404).json({
      success: false,
      error: '진행 중인 번역을 찾을 수 없습니다.'
    });
  }
  
  res.json({
    success: true,
    data: progress
  });
});

// 대체 번역 엔진 시도 함수
async function tryFallbackTranslation(text, targetLang, sourceLang, currentEngine) {
  const engines = ['groq', 'gemini'];
  const fallbackEngines = engines.filter(engine => engine !== currentEngine);
  
  console.log(`🛡️ 대체 번역 시도: ${currentEngine} → [${fallbackEngines.join(', ')}]`);
  
  for (const fallbackEngine of fallbackEngines) {
    try {
      const result = await translationService.translate(
        text,
        targetLang,
        sourceLang,
        fallbackEngine
      );
      
      if (result && result.translatedText && result.translatedText.trim()) {
        console.log(`✅ ${fallbackEngine} 엔진 대체 번역 성공!`);
        return result.translatedText;
      }
    } catch (error) {
      console.error(`❌ ${fallbackEngine} 엔진 대체 번역 실패: ${error.message}`);
      continue;
    }
  }
  
  console.error(`💥 모든 대체 엔진 실패!`);
  return `[번역실패] ${text}`;
}

// 자막 파일 번역
router.post('/translate', async (req, res) => {
  try {
    const { 
      fileId, 
      targetLang, 
      sourceLang, 
      engine = 'gemini', 
      outputFormat,
      chunkSize = 50,
      translationMode = 'auto',
      maxRetries = 5,
      retryDelay = 1000,
      enableFallback = true
    } = req.body;

    console.log('\n='.repeat(80));
    console.log('🎯 번역 요청 시작');
    console.log('='.repeat(80));
    console.log(`📂 파일 ID: ${fileId}`);
    console.log(`🌐 ${sourceLang || 'auto'} → ${targetLang}`);
    console.log(`🤖 엔진: ${engine}, 청크: ${chunkSize}, 모드: ${translationMode}`);
    console.log('='.repeat(80));

    if (!fileId || !targetLang) {
      return res.status(400).json({
        success: false,
        error: '필수 매개변수가 누락되었습니다.',
        required: ['fileId', 'targetLang']
      });
    }

    // 파일 확인
    const filePath = path.join(__dirname, '../uploads', fileId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '파일을 찾을 수 없습니다.'
      });
    }

    // 원본 파일명 가져오기
    const metaPath = path.join(__dirname, '../uploads', fileId + '.meta');
    let originalName = fileId;
    if (fs.existsSync(metaPath)) {
      try {
        const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        originalName = metaData.originalName || fileId;
      } catch (error) {
        console.warn(`⚠️ 메타 파일 읽기 오류: ${error.message}`);
      }
    }

    // 파일 파싱
    const parsed = SubtitleParser.parseSubtitle(filePath);
    const entries = parsed.entries;
    
    if (entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: '자막 엔트리가 없습니다.'
      });
    }

    const totalCharacters = entries.reduce((sum, entry) => sum + entry.text.length, 0);
    console.log(`📊 자막 통계: ${entries.length}개 엔트리, ${totalCharacters.toLocaleString()}자`);

    // 진행 상태 초기화
    progressManager.initializeProgress(fileId, entries.length, totalCharacters);

    // 번역 옵션 검증
    const validatedChunkSize = Math.max(1, Math.min(parseInt(chunkSize) || 50, 1000));
    const validatedMaxRetries = Math.max(1, Math.min(parseInt(maxRetries) || 5, 10));
    const validatedRetryDelay = Math.max(100, Math.min(parseInt(retryDelay) || 1000, 10000));
    const validTranslationModes = ['auto', 'srt_direct', 'separator'];
    const validatedTranslationMode = validTranslationModes.includes(translationMode) ? translationMode : 'auto';

    // 청크별 번역 실행
    const maxChunkSize = validatedChunkSize;
    const totalChunks = Math.ceil(entries.length / maxChunkSize);
    
    progressManager.updateProgress(fileId, { totalChunks });
    
    const translatedEntries = [];
    let totalProcessed = 0;
    let totalProcessedChars = 0;
    const startTime = Date.now();

    console.log(`🚀 배치 번역 시작: ${totalChunks}개 청크 (청크당 ${maxChunkSize}개)`);

    for (let i = 0; i < entries.length; i += maxChunkSize) {
      const chunkIndex = Math.floor(i / maxChunkSize) + 1;
      const chunk = entries.slice(i, i + maxChunkSize);
      const chunkChars = chunk.reduce((sum, entry) => sum + entry.text.length, 0);
      
      // 진행 상태 업데이트
      progressManager.setChunkStatus(fileId, chunkIndex, totalChunks, chunk.length, chunkChars);

      // 번역 옵션 설정
      const options = {
        targetLang,
        sourceLang,
        engine,
        translationMode: validatedTranslationMode,
        maxRetries: validatedMaxRetries,
        retryDelay: validatedRetryDelay,
        enableFallback,
        parsed
      };

      try {
        // 청크 번역 실행
        const result = await chunkTranslator.translateChunk(chunk, options, chunkIndex, totalChunks);
        
        // 번역된 텍스트를 각 자막 항목에 할당
        for (let j = 0; j < chunk.length; j++) {
          if (j < result.translatedTexts.length) {
            const translatedText = result.translatedTexts[j].trim();
            
            // 한국어가 남아있는지 확인 (영어 번역시)
            if (targetLang === 'en' && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(translatedText)) {
              console.warn(`⚠️ 한국어 감지됨, 재번역 시도`);
              
              try {
                const reTranslationResult = await translationService.translate(
                  chunk[j].text,
                  targetLang,
                  sourceLang,
                  engine
                );
                translatedEntries.push({
                  ...chunk[j],
                  text: reTranslationResult.translatedText.trim()
                });
              } catch (reTranslationError) {
                console.error(`재번역 실패:`, reTranslationError);
                if (enableFallback) {
                  const fallbackResult = await tryFallbackTranslation(chunk[j].text, targetLang, sourceLang, engine);
                  translatedEntries.push({
                    ...chunk[j],
                    text: fallbackResult
                  });
                } else {
                  translatedEntries.push({
                    ...chunk[j],
                    text: `[번역실패] ${chunk[j].text}`
                  });
                }
              }
            } else {
              translatedEntries.push({
                ...chunk[j],
                text: translatedText
              });
            }
          } else {
            console.warn(`번역 텍스트 부족: 원본 유지`);
            translatedEntries.push(chunk[j]);
          }
        }

        totalProcessed += chunk.length;
        totalProcessedChars += chunkChars;
        
        // 진행 상태 업데이트
        progressManager.updateProgress(fileId, {
          processedEntries: totalProcessed,
          processedCharacters: totalProcessedChars
        });

      } catch (error) {
        console.error(`청크 ${chunkIndex} 번역 실패:`, error);
        
        // 실패시 원본 텍스트 유지
        for (const entry of chunk) {
          translatedEntries.push({
            ...entry,
            text: `[번역실패] ${entry.text}`
          });
        }
        
        totalProcessed += chunk.length;
        totalProcessedChars += chunkChars;
        
        progressManager.updateProgress(fileId, {
          processedEntries: totalProcessed,
          processedCharacters: totalProcessedChars,
          customMessage: `청크 ${chunkIndex} 실패 - 원본 텍스트 유지`
        });
      }

      // API 호출 간 지연
      if (i + maxChunkSize < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const totalTime = Date.now() - startTime;
    const finalCharsPerSecond = Math.round(totalCharacters / (totalTime / 1000));

    // 진행 상태 완료 처리
    progressManager.completeProgress(fileId, totalTime, finalCharsPerSecond);

    // 번역된 파일 생성
    const finalOutputFormat = outputFormat || parsed.format;
    const translatedContent = SubtitleParser.generateSubtitle(
      translatedEntries, 
      finalOutputFormat,
      { title: `Translated to ${targetLang}` }
    );

    const nameWithoutExt = path.parse(originalName).name;
    const engineForFileName = engine.replace('ollama-', ''); // ollama- 접두사 제거
    const outputFileName = `${nameWithoutExt}_translated_${targetLang}_${engineForFileName}_${Date.now()}.${finalOutputFormat}`;
    const outputPath = path.join(__dirname, '../uploads', outputFileName);
    fs.writeFileSync(outputPath, translatedContent, 'utf8');

    // 번역된 파일의 메타 정보 저장
    const translatedMetaPath = path.join(__dirname, '../uploads', outputFileName + '.meta');
    const translatedMetaData = {
      originalName: `${nameWithoutExt}_translated_${targetLang}.${finalOutputFormat}`,
      sourceFile: originalName,
      translationEngine: engine,
      targetLang: targetLang,
      timestamp: new Date().toISOString(),
      translationStats: {
        totalTime: totalTime,
        totalCharacters: totalCharacters,
        averageCharsPerSecond: finalCharsPerSecond,
        totalEntries: entries.length
      }
    };
    fs.writeFileSync(translatedMetaPath, JSON.stringify(translatedMetaData), 'utf8');

    // 통계 정보
    const stats = SubtitleParser.getSubtitleStats(translatedEntries);

    res.json({
      success: true,
      data: {
        originalFileId: fileId,
        translatedFileId: outputFileName,
        originalFormat: parsed.format,
        outputFormat: finalOutputFormat,
        stats: stats,
        translationEngine: engine,
        sourceLang: sourceLang || 'auto',
        targetLang: targetLang,
        totalEntries: translatedEntries.length,
        translationOptions: {
          chunkSize: validatedChunkSize,
          translationMode: validatedTranslationMode,
          maxRetries: validatedMaxRetries,
          retryDelay: validatedRetryDelay,
          enableFallback: enableFallback
        },
        translationStats: {
          totalTime: totalTime,
          totalTimeFormatted: `${Math.floor(totalTime / 60000)}분 ${Math.floor((totalTime % 60000) / 1000)}초`,
          totalCharacters: totalCharacters,
          averageCharsPerSecond: finalCharsPerSecond,
          efficiency: `${finalCharsPerSecond}자/초`
        },
        preview: translatedEntries.slice(0, 3),
        downloadUrl: `/translation-api/subtitle/download/${outputFileName}`,
        timestamp: new Date().toISOString()
      }
    });

    console.log('✅ 번역 완료!');

  } catch (error) {
    console.error('자막 번역 오류:', error);
    
    if (req.body.fileId) {
      progressManager.setError(req.body.fileId, error.message);
    }
    
    res.status(500).json({
      success: false,
      error: error.message || '자막 번역 중 오류가 발생했습니다.'
    });
  }
});

// 번역된 파일 다운로드
router.get('/download/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    const filePath = path.join(__dirname, '../uploads', fileId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '파일을 찾을 수 없습니다.'
      });
    }

    const ext = path.extname(fileId);
    const mimeTypes = {
      '.srt': 'text/plain',
      '.smi': 'text/plain',
      '.vtt': 'text/vtt'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${fileId}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // 다운로드 후 파일 삭제 (1시간 후)
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`임시 파일 삭제: ${fileId}`);
      }
    }, 3600000);

  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '파일 다운로드 중 오류가 발생했습니다.'
    });
  }
});

// 업로드된 파일 정보 조회
router.get('/info/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    const filePath = path.join(__dirname, '../uploads', fileId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '파일을 찾을 수 없습니다.'
      });
    }

    const parsed = SubtitleParser.parseSubtitle(filePath);
    const stats = SubtitleParser.getSubtitleStats(parsed.entries);

    res.json({
      success: true,
      data: {
        fileId: fileId,
        format: parsed.format,
        stats: stats,
        entries: parsed.entries
      }
    });

  } catch (error) {
    console.error('파일 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '파일 정보 조회 중 오류가 발생했습니다.'
    });
  }
});

// 지원 형식 목록
router.get('/formats', (req, res) => {
  res.json({
    success: true,
    data: {
      supportedFormats: [
        { 
          extension: 'srt', 
          name: 'SubRip Subtitle',
          description: '가장 널리 사용되는 자막 형식'
        },
        { 
          extension: 'smi', 
          name: 'SAMI Subtitle',
          description: '삼성/MS에서 개발한 자막 형식'
        },
        { 
          extension: 'vtt', 
          name: 'WebVTT',
          description: '웹 비디오 텍스트 트랙 형식'
        }
      ]
    }
  });
});

module.exports = router; 