const TranslationService = require('./translationService');
const SubtitleParser = require('../utils/subtitleParser');

class ChunkTranslator {
  constructor() {
    this.translationService = new TranslationService();
  }

  async translateChunk(chunk, options, chunkIndex, totalChunks) {
    const {
      targetLang,
      sourceLang,
      engine,
      translationMode,
      maxRetries,
      retryDelay,
      enableFallback,
      parsed
    } = options;

    const chunkStartTime = Date.now();
    console.log(`🔄 청크 ${chunkIndex}/${totalChunks} 번역 시작 (${chunk.length}개 자막)`);

    let translatedTexts = [];
    let shouldUseSrtDirect = false;
    let shouldUseSeparator = false;

    // 번역 모드 결정
    if (translationMode === 'srt_direct' && (parsed.format === 'srt' || parsed.format === 'vtt')) {
      shouldUseSrtDirect = true;
    } else if (translationMode === 'separator') {
      shouldUseSeparator = true;
    } else {
      // auto 모드
      if (parsed.format === 'srt' && chunk.length <= 10) {
        shouldUseSrtDirect = true;
      } else {
        shouldUseSeparator = true;
      }
    }

    try {
      if (shouldUseSrtDirect) {
        translatedTexts = await this.translateSrtDirect(chunk, options, chunkIndex);
      } else {
        translatedTexts = await this.translateWithSeparator(chunk, options, chunkIndex);
      }

      const chunkEndTime = Date.now();
      const chunkDuration = chunkEndTime - chunkStartTime;
      const chunkChars = chunk.reduce((sum, entry) => sum + entry.text.length, 0);
      
      console.log(`✅ 청크 ${chunkIndex} 완료 (${chunkDuration}ms, ${Math.round(chunkChars / (chunkDuration / 1000))}자/초)`);

      return {
        success: true,
        translatedTexts,
        duration: chunkDuration,
        chars: chunkChars
      };

    } catch (error) {
      console.error(`❌ 청크 ${chunkIndex} 번역 실패:`, error);
      
      // enableFallback이 true면 대체 엔진 시도
      if (enableFallback) {
        console.log(`🛡️ 대체 엔진으로 재시도 중...`);
        const fallbackResult = await this.tryFallbackTranslation(chunk, options, chunkIndex);
        if (fallbackResult.success) {
          return fallbackResult;
        }
      }
      
      // 원본 텍스트 반환
      const fallbackTexts = chunk.map(entry => `[번역실패] ${entry.text}`);
      return {
        success: false,
        translatedTexts: fallbackTexts,
        error: error.message
      };
    }
  }

  async translateSrtDirect(chunk, options, chunkIndex) {
    const { targetLang, sourceLang, engine, maxRetries, retryDelay } = options;
    
    const srtChunk = SubtitleParser.generateSubtitle(chunk, 'srt');
    console.log(`🎯 SRT 직접 번역 (청크 ${chunkIndex}): ${srtChunk.length}자`);

    let retryCount = 0;
    while (retryCount <= maxRetries) {
      try {
        const result = await this.translationService.translate(
          srtChunk,
          targetLang,
          sourceLang,
          engine
        );

        const translatedTexts = this.extractTextsFromSrt(result.translatedText);
        
        if (translatedTexts.length === chunk.length) {
          console.log(`✅ SRT 직접 번역 성공: ${translatedTexts.length}개 텍스트 추출`);
          return translatedTexts;
        } else {
          throw new Error(`텍스트 개수 불일치: 예상=${chunk.length}, 실제=${translatedTexts.length}`);
        }

      } catch (error) {
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`🔄 SRT 재시도 중... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw error;
        }
      }
    }
  }

  async translateWithSeparator(chunk, options, chunkIndex) {
    const { targetLang, sourceLang, engine, maxRetries, retryDelay } = options;
    
    const texts = chunk.map(entry => entry.text);
    const combinedText = texts.join('\n---SUBTITLE_SEPARATOR---\n');
    
    console.log(`🔀 구분자 번역 (청크 ${chunkIndex}): ${combinedText.length}자`);

    let retryCount = 0;
    while (retryCount <= maxRetries) {
      try {
        const result = await this.translationService.translate(
          combinedText,
          targetLang,
          sourceLang,
          engine
        );

        let translatedTexts = [];
        
        if (result.translatedText.includes('\n---SUBTITLE_SEPARATOR---\n')) {
          translatedTexts = result.translatedText.split('\n---SUBTITLE_SEPARATOR---\n');
        } else if (result.translatedText.includes('---SUBTITLE_SEPARATOR---')) {
          translatedTexts = result.translatedText.split('---SUBTITLE_SEPARATOR---');
        } else {
          // 구분자가 없으면 개별 번역
          console.warn(`⚠️ 구분자 없음 - 개별 번역으로 전환`);
          translatedTexts = await this.translateIndividually(texts, options);
        }

        if (translatedTexts.length === chunk.length) {
          console.log(`✅ 구분자 번역 성공: ${translatedTexts.length}개 텍스트 추출`);
          return translatedTexts;
        } else {
          throw new Error(`텍스트 개수 불일치: 예상=${chunk.length}, 실제=${translatedTexts.length}`);
        }

      } catch (error) {
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`🔄 구분자 재시도 중... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // 최대 재시도 초과시 개별 번역 시도
          console.warn(`⚠️ 최대 재시도 초과 - 개별 번역으로 전환`);
          return await this.translateIndividually(texts, options);
        }
      }
    }
  }

  async translateIndividually(texts, options) {
    const { targetLang, sourceLang, engine } = options;
    const translatedTexts = [];

    for (const text of texts) {
      try {
        const result = await this.translationService.translate(
          text,
          targetLang,
          sourceLang,
          engine
        );
        translatedTexts.push(result.translatedText);
      } catch (error) {
        console.error(`개별 번역 실패: ${error.message}`);
        translatedTexts.push(`[번역실패] ${text}`);
      }
    }

    return translatedTexts;
  }

  extractTextsFromSrt(srtContent) {
    console.log(`🔍 SRT 파싱 시작: ${srtContent.length}자, ${srtContent.split('\n').length}줄`);
    console.log(`📋 원본 SRT 내용:`);
    console.log('=====================================');
    console.log(srtContent);
    console.log('=====================================');
    
    const lines = srtContent.split('\n');
    const texts = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 숫자로 시작하는 자막 번호 찾기
      if (/^\d+$/.test(line)) {
        console.log(`📍 자막 번호 발견: ${line}`);
        i++;
        
        // 타임스탬프 줄 건너뛰기
        if (i < lines.length && lines[i].includes('-->')) {
          console.log(`⏰ 타임스탬프: ${lines[i].trim()}`);
          i++;
          
          // 텍스트 라인들 수집
          const textLines = [];
          while (i < lines.length) {
            const currentLine = lines[i].trim();
            
            // 빈 줄이거나 숫자(다음 자막 번호)면 중단
            if (currentLine === '' || /^\d+$/.test(currentLine)) {
              break;
            }
            
            // 타임스탬프 줄이면 중단
            if (currentLine.includes('-->')) {
              i--; // 다음 자막을 위해 한 줄 뒤로
              break;
            }
            
            textLines.push(currentLine);
            i++;
          }
          
          if (textLines.length > 0) {
            const extractedText = textLines.join('\n');
            texts.push(extractedText);
            console.log(`📝 텍스트 추출: ${extractedText.substring(0, 50)}...`);
          }
          
          i--; // for 루프에서 i++하므로 하나 빼기
        } else {
          console.log(`⚠️ 타임스탬프 없음: ${i < lines.length ? lines[i] : 'EOF'}`);
        }
      }
    }
    
    console.log(`✅ SRT 파싱 완료: ${texts.length}개 텍스트 추출`);
    return texts;
  }

  async tryFallbackTranslation(chunk, options, chunkIndex) {
    const { targetLang, sourceLang, engine } = options;
    const engines = ['groq', 'gemini', 'openai'];
    const fallbackEngines = engines.filter(e => e !== engine);
    
    console.log(`🛡️ 대체 번역 시도: ${engine} → [${fallbackEngines.join(', ')}]`);
    
    for (const fallbackEngine of fallbackEngines) {
      try {
        const fallbackOptions = { ...options, engine: fallbackEngine };
        
        let translatedTexts = [];
        
        if (options.translationMode === 'srt_direct') {
          translatedTexts = await this.translateSrtDirect(chunk, fallbackOptions, chunkIndex);
        } else {
          translatedTexts = await this.translateWithSeparator(chunk, fallbackOptions, chunkIndex);
        }
        
        const chunkEndTime = Date.now();
        const chunkDuration = chunkEndTime - Date.now();
        const chunkChars = chunk.reduce((sum, entry) => sum + entry.text.length, 0);
        
        console.log(`✅ ${fallbackEngine} 엔진 대체 번역 성공!`);
        return {
          success: true,
          translatedTexts,
          duration: chunkDuration,
          chars: chunkChars,
          usedEngine: fallbackEngine
        };
        
      } catch (error) {
        console.error(`❌ ${fallbackEngine} 엔진 대체 번역 실패: ${error.message}`);
        continue;
      }
    }
    
    console.error(`💥 모든 대체 엔진 실패!`);
    return { success: false };
  }
}

module.exports = ChunkTranslator; 