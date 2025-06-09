const express = require('express');
const router = express.Router();
const TranslationService = require('../services/translationService');

const translationService = new TranslationService();

// 텍스트 번역 API
router.post('/text', async (req, res) => {
  try {
    const { text, targetLang, sourceLang, engine = 'ollama-gemma2-sapie' } = req.body;

    // 입력 검증
    if (!text || !targetLang) {
      return res.status(400).json({
        error: '필수 매개변수가 누락되었습니다.',
        required: ['text', 'targetLang'],
        optional: ['sourceLang', 'engine']
      });
    }

    // 텍스트 길이 검증 (최대 5000자)
    if (text.length > 5000) {
      return res.status(400).json({
        error: '텍스트가 너무 깁니다. 최대 5000자까지 입력 가능합니다.'
      });
    }

    console.log(`번역 요청: ${engine} 엔진으로 "${text.substring(0, 50)}..." → ${targetLang}`);

    // 번역 실행
    const result = await translationService.translate(text, targetLang, sourceLang, engine);

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText: result.translatedText,
        sourceLang: sourceLang || result.detectedSourceLang,
        targetLang,
        engine: result.engine,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('번역 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '번역 중 오류가 발생했습니다.'
    });
  }
});

// 사용 가능한 번역 엔진 목록
router.get('/engines', (req, res) => {
  try {
    const engineIds = translationService.getAvailableEngines();
    
    // 엔진 이름 매핑
    const engineNames = {
      'gemini': 'Google Gemini',
      'groq': 'Groq Llama',
      'openai': 'OpenAI GPT',
      'claude': 'Anthropic Claude',
      'deepl': 'DeepL',
      'ollama-kanana-1.5': 'Ollama Kanana 1.5-8B (Kakao Corp. Korean)',
      'ollama-hyperclovax': 'Ollama HyperCLOVAX 3B (Naver Korean)',
      'ollama-hyperclovax-1.5b': 'Ollama HyperCLOVAX 1.5B (Naver Korean Lite)',
      'ollama-gemma2': 'Ollama Gemma2',
      'ollama-gemma2-sapie': 'Ollama Gemma2 Sapie (Korean)',
      'ollama-exaone3.5': 'Ollama Exaone3.5 (Korean)'
    };
    
    // 프론트엔드가 기대하는 형식으로 변환
    const engines = engineIds.map(id => ({
      id,
      name: engineNames[id] || id
    }));
    
    res.json({
      success: true,
      data: {
        engines,
        total: engines.length
      }
    });
  } catch (error) {
    console.error('엔진 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '엔진 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// 지원 언어 목록
router.get('/languages', (req, res) => {
  try {
    const languages = translationService.getSupportedLanguages();
    res.json({
      success: true,
      data: {
        languages,
        total: languages.length
      }
    });
  } catch (error) {
    console.error('언어 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '언어 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// 배치 번역 (여러 텍스트 동시 번역)
router.post('/batch', async (req, res) => {
  try {
    const { texts, targetLang, sourceLang, engine = 'ollama-gemma2-sapie' } = req.body;

    // 입력 검증
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: 'texts 배열이 필요합니다.'
      });
    }

    if (!targetLang) {
      return res.status(400).json({
        error: 'targetLang이 필요합니다.'
      });
    }

    // 배치 크기 제한 (최대 20개)
    if (texts.length > 20) {
      return res.status(400).json({
        error: '한 번에 최대 20개의 텍스트만 번역할 수 있습니다.'
      });
    }

    console.log(`배치 번역 요청: ${texts.length}개 텍스트를 ${engine} 엔진으로 ${targetLang}로 번역`);

    // 병렬 번역 실행
    const translationPromises = texts.map(async (text, index) => {
      try {
        const result = await translationService.translate(text, targetLang, sourceLang, engine);
        return {
          index,
          success: true,
          originalText: text,
          translatedText: result.translatedText,
          engine: result.engine
        };
      } catch (error) {
        return {
          index,
          success: false,
          originalText: text,
          error: error.message
        };
      }
    });

    const results = await Promise.all(translationPromises);

    // 성공/실패 분리
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: texts.length,
          successful: successful.length,
          failed: failed.length
        },
        targetLang,
        sourceLang,
        engine,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('배치 번역 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '배치 번역 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 