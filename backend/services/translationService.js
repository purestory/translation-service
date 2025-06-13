const axios = require('axios');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Translator } = require('deepl-node');

class TranslationService {
  constructor() {
    // Initialize translation engines
    this.deeplTranslator = process.env.DEEPL_API_KEY ? 
      new Translator(process.env.DEEPL_API_KEY) : null;
    
    this.openai = process.env.OPENAI_API_KEY ? 
      new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    
    console.log('Anthropic API Key exists:', !!process.env.ANTHROPIC_API_KEY);
    this.anthropic = process.env.ANTHROPIC_API_KEY ? 
      new Anthropic({ 
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultHeaders: {
          'anthropic-version': '2023-06-01'
        }
      }) : null;
    console.log('Anthropic client initialized:', !!this.anthropic);
    
    this.gemini = process.env.GEMINI_API_KEY ? 
      new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

    // Groq 클라이언트 추가
    this.groq = process.env.GROQ_API_KEY ? 
      new OpenAI({ 
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1'
      }) : null;
    console.log('Groq client initialized:', !!this.groq);

    // Ollama 클라이언트 추가 (로컬 도커 컨테이너)
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    console.log('Ollama URL:', this.ollamaUrl);
  }

  // 지원 언어 매핑
  getLanguageMapping() {
    return {
      deepl: {
        'ko': 'KO',
        'en': 'EN',
        'ja': 'JA',
        'zh': 'ZH',
        'es': 'ES',
        'fr': 'FR',
        'de': 'DE',
        'it': 'IT',
        'pt': 'PT',
        'ru': 'RU'
      },
      general: {
        'ko': 'Korean',
        'en': 'English',
        'ja': 'Japanese',
        'zh': 'Chinese',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian'
      }
    };
  }

  // 공통 프롬프트 생성 함수
  generatePrompts(text, targetLang, sourceLang = null) {
    const langMap = this.getLanguageMapping().general;
    const targetLanguage = langMap[targetLang] || targetLang;
    const sourceLanguage = sourceLang ? (langMap[sourceLang] || sourceLang) : '자동 감지';

    // SRT 직접 번역인지 확인
    const isSRTDirectTranslation = text.match(/^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m);
    
    // 자막 번역인지 확인
    const isSubtitleTranslation = text.includes('---SUBTITLE_SEPARATOR---');
    
    let systemPrompt, prompt;
    
    if (isSRTDirectTranslation) {
      // SRT 직접 번역
      systemPrompt = `You are a professional subtitle translator specializing in SRT format.

      🔴 CRITICAL RULES - FOLLOW EXACTLY:
      1. NEVER modify subtitle numbers (1, 2, 3, etc.)
      2. NEVER modify timestamps (00:00:01,000 --> 00:00:03,000)
      3. NEVER modify the SRT structure or formatting
      4. ONLY translate the text content lines
      5. Keep empty lines exactly as they are
      6. Maintain the exact same number of subtitle entries
      7. Output the complete SRT format with translated text

      📝 TRANSLATION QUALITY:
      - Use natural, conversational language for subtitles
      - Keep translations concise and readable
      - Preserve emotional tone and context
      - Use culturally appropriate expressions
      - Maintain consistency throughout`;

      prompt = sourceLang && sourceLang !== 'auto'
      ? `Translate the subtitle text content from ${sourceLanguage} to ${targetLanguage}.
      
      Keep ALL numbers and timestamps EXACTLY as they are.
      Only translate the text lines.
      Maintain the exact SRT format.
      
      ${text}`
      : `Translate ALL subtitle text content to ${targetLanguage}.

      Keep ALL numbers and timestamps EXACTLY as they are.
      Only translate the text lines.
      Maintain the exact SRT format.
      
      ${text}`;
      
    } else if (isSubtitleTranslation) {
      // 구분자 방식 자막 번역
      systemPrompt = `You are a professional subtitle translator. 
CRITICAL RULES:
1. NEVER modify, remove, or change the "---SUBTITLE_SEPARATOR---" markers
2. ALWAYS preserve the exact separator format: "---SUBTITLE_SEPARATOR---"
3. Translate each subtitle segment individually
4. Maintain the exact same number of segments
5. Do NOT summarize or combine subtitles
6. Do NOT add explanations or commentary
7. Output ONLY the translated text with separators preserved

IMPORTANT: Each subtitle is separated by "---SUBTITLE_SEPARATOR---".
You must keep these separators EXACTLY as they are between translated segments.`;

      prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}. 
IMPORTANT: Each subtitle is separated by "---SUBTITLE_SEPARATOR---". 
You must translate each subtitle individually and keep the exact same separators.
Do not summarize or combine subtitles. Translate each segment separately and maintain the exact structure.
Only return the translated text with the same separators:

${text}`;
    } else {
      // 일반 텍스트 번역
      systemPrompt = 'You are a professional translator. Translate the following text accurately and naturally while preserving the original meaning and tone.';
      
      prompt = sourceLang && sourceLang !== 'auto'
      ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Only return the translated text without any explanations:\n\n${text}`
      : `Translate the following text to ${targetLanguage}. Only return the translated text without any explanations:\n\n${text}`;
    }

    return { systemPrompt, prompt };
  }

  // DeepL 번역
  async translateWithDeepL(text, targetLang, sourceLang = null) {
    if (!this.deeplTranslator) {
      throw new Error('DeepL API 키가 설정되지 않았습니다.');
    }

    try {
      const langMap = this.getLanguageMapping().deepl;
      const target = langMap[targetLang];
      const source = sourceLang ? langMap[sourceLang] : null;

      if (!target) {
        throw new Error(`DeepL에서 지원하지 않는 언어입니다: ${targetLang}`);
      }

      const result = await this.deeplTranslator.translateText(
        text,
        source,
        target
      );

      return {
        translatedText: result.text,
        detectedSourceLang: result.detectedSourceLang,
        engine: 'deepl'
      };
    } catch (error) {
      console.error('DeepL 번역 오류:', error);
      throw new Error(`DeepL 번역 실패: ${error.message}`);
    }
  }

  // OpenAI GPT 번역
  async translateWithOpenAI(text, targetLang, sourceLang = null) {
    if (!this.openai) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    try {
      const { systemPrompt, prompt } = this.generatePrompts(text, targetLang, sourceLang);

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 4000
      });

      return {
        translatedText: completion.choices[0].message.content.trim(),
        detectedSourceLang: null,
        engine: 'openai'
      };
    } catch (error) {
      console.error('OpenAI 번역 오류:', error);
      throw new Error(`OpenAI 번역 실패: ${error.message}`);
    }
  }

  // Google Gemini 번역
  async translateWithGemini(text, targetLang, sourceLang = null) {
    if (!this.gemini) {
      throw new Error('Gemini API 키가 설정되지 않았습니다.');
    }

    try {
      const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const { systemPrompt, prompt } = this.generatePrompts(text, targetLang, sourceLang);

      const result = await model.generateContent(`${systemPrompt}\n\n${prompt}`);
      const response = await result.response;
      const translatedText = response.text();

      return {
        translatedText: translatedText.trim(),
        detectedSourceLang: null,
        engine: 'gemini'
      };
    } catch (error) {
      console.error('Gemini 번역 오류:', error);
      throw new Error(`Gemini 번역 실패: ${error.message}`);
    }
  }

  // Anthropic Claude 번역
  async translateWithClaude(text, targetLang, sourceLang = null) {
    console.log('translateWithClaude called');
    console.log('this.anthropic:', !!this.anthropic);
    console.log('this.anthropic.messages:', !!this.anthropic?.messages);
    
    if (!this.anthropic) {
      throw new Error('Anthropic API 키가 설정되지 않았습니다.');
    }

    try {
      const { systemPrompt, prompt } = this.generatePrompts(text, targetLang, sourceLang);

      console.log('About to call anthropic.messages.create');
      const message = await this.anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      return {
        translatedText: message.content[0].text.trim(),
        detectedSourceLang: null,
        engine: 'claude'
      };
    } catch (error) {
      console.error('Claude 번역 오류:', error);
      throw new Error(`Claude 번역 실패: ${error.message}`);
    }
  }

  // Groq 번역 (Llama 모델 사용)
  async translateWithGroq(text, targetLang, sourceLang = null) {
    if (!this.groq) {
      throw new Error('Groq API 키가 설정되지 않았습니다.');
    }

    try {
      const { systemPrompt, prompt } = this.generatePrompts(text, targetLang, sourceLang);

      const completion = await this.groq.chat.completions.create({
        model: "llama-3.3-70b-versatile", // 가장 성능 좋은 Groq 모델 사용
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      });

      return {
        translatedText: completion.choices[0].message.content.trim(),
        detectedSourceLang: null,
        engine: 'groq'
      };
    } catch (error) {
      console.error('Groq 번역 오류:', error);
      throw new Error(`Groq 번역 실패: ${error.message}`);
    }
  }

  // Ollama 번역 (로컬 모델 사용)
  async translateWithOllama(text, targetLang, sourceLang = null, model = 'gemma2:9b', engineName = 'ollama') {
    try {
      const { systemPrompt, prompt } = this.generatePrompts(text, targetLang, sourceLang);

      console.log(`Ollama 번역 시작: ${model} 모델 사용`);
      
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: model,
        prompt: `${systemPrompt}\n\n${prompt}`,
        stream: false,
        options: {
          temperature: 0.3,
          top_k: 40,
          top_p: 0.9,
          num_predict: 4000
        }
      }, {
        timeout: 300000, // 5분 타임아웃
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const translatedText = response.data.response.trim();

      return {
        translatedText: translatedText,
        detectedSourceLang: null,
        engine: engineName,
        model: model
      };
    } catch (error) {
      console.error('Ollama 번역 오류:', error);
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama 서버에 연결할 수 없습니다. Docker 컨테이너가 실행 중인지 확인해주세요.');
      }
      throw new Error(`Ollama 번역 실패: ${error.message}`);
    }
  }

  // Ollama Gemma2 모델 번역
  async translateWithOllamaGemma2(text, targetLang, sourceLang = null) {
    return this.translateWithOllama(text, targetLang, sourceLang, 'gemma2:9b', 'ollama-gemma2');
  }

  // Ollama Gemma2 Sapie 모델 번역 (한국어 특화)
  async translateWithOllamaGemma2Sapie(text, targetLang, sourceLang = null) {
    return this.translateWithOllama(text, targetLang, sourceLang, 'sapie:latest', 'ollama-gemma2-sapie');
  }

  // Ollama Exaone3.5 모델 번역 (한국어 특화)
  async translateWithOllamaExaone35(text, targetLang, sourceLang = null) {
    return this.translateWithOllama(text, targetLang, sourceLang, 'exaone3.5:latest', 'ollama-exaone3.5');
  }

  // Ollama HyperCLOVAX 모델 번역 (네이버 하이퍼클로바X)
  async translateWithOllamaHyperClovax(text, targetLang, sourceLang = null) {
    return this.translateWithOllama(text, targetLang, sourceLang, 'hyperclovax:latest', 'ollama-hyperclovax');
  }

  // Ollama HyperCLOVAX 1.5B 모델 번역 (경량화 버전)
  async translateWithOllamaHyperClovax15B(text, targetLang, sourceLang = null) {
    return this.translateWithOllama(text, targetLang, sourceLang, 'hyperclovax-1.5b:latest', 'ollama-hyperclovax-1.5b');
  }

  // Ollama Kanana 1.5-8B 모델 번역 (Kakao Corp. 한국어 특화 모델)
  async translateWithOllamaKanana15(text, targetLang, sourceLang = null) {
    return this.translateWithOllama(text, targetLang, sourceLang, 'kanana-1.5:latest', 'ollama-kanana-1.5');
  }



  // 대체 엔진 순서 정의 (ollama 5가지 모델 사용)
  getFallbackEngines(primaryEngine) {
    const fallbackOrder = {
      'ollama-gemma2-sapie': ['ollama-kanana-1.5', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'],
      'ollama-kanana-1.5': ['ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'],
      'ollama-exaone3.5': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'],
      'ollama-gemma2': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'],
      'ollama-hyperclovax': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax-1.5b'],
      'ollama-hyperclovax-1.5b': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax'],
      'gemini': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'],
      'groq': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'],
      'openai': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'],
      'deepl': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'],
      'claude': ['ollama-kanana-1.5', 'ollama-gemma2-sapie', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b']
    };

    return fallbackOrder[primaryEngine] || ['ollama-gemma2-sapie', 'ollama-kanana-1.5', 'ollama-exaone3.5', 'ollama-gemma2', 'ollama-hyperclovax', 'ollama-hyperclovax-1.5b'];
  }

  // 단일 엔진으로 번역 시도
  async translateWithSingleEngine(text, targetLang, sourceLang, engine) {
    switch (engine.toLowerCase()) {
      case 'deepl':
        return await this.translateWithDeepL(text, targetLang, sourceLang);
      case 'openai':
        return await this.translateWithOpenAI(text, targetLang, sourceLang);
      case 'gemini':
        return await this.translateWithGemini(text, targetLang, sourceLang);
      case 'claude':
        return await this.translateWithClaude(text, targetLang, sourceLang);
      case 'groq':
        return await this.translateWithGroq(text, targetLang, sourceLang);
      case 'ollama-gemma2':
        return await this.translateWithOllamaGemma2(text, targetLang, sourceLang);
      case 'ollama-gemma2-sapie':
        return await this.translateWithOllamaGemma2Sapie(text, targetLang, sourceLang);
      case 'ollama-exaone3.5':
        return await this.translateWithOllamaExaone35(text, targetLang, sourceLang);
      case 'ollama-hyperclovax':
        return await this.translateWithOllamaHyperClovax(text, targetLang, sourceLang);
      case 'ollama-hyperclovax-1.5b':
        return await this.translateWithOllamaHyperClovax15B(text, targetLang, sourceLang);
      case 'ollama-kanana-1.5':
        return await this.translateWithOllamaKanana15(text, targetLang, sourceLang);
      default:
        throw new Error(`지원하지 않는 번역 엔진입니다: ${engine}`);
    }
  }

  // 일반 번역 함수 (자동 대체 엔진 지원)
  async translate(text, targetLang, sourceLang = null, engine = 'ollama-gemma2-sapie', enableFallback = true) {
    // 텍스트 유효성 검사
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.error('❌ 번역 실패: 유효하지 않은 텍스트');
      console.error(`   📝 입력값: "${text}"`);
      console.error(`   📏 길이: ${text ? text.length : 'null/undefined'}자`);
      throw new Error('유효한 텍스트를 입력해주세요.');
    }

    // 번역 요청 상세 로그
    const startTime = Date.now();
    console.log(`\n🔄 번역 서비스 호출:`);
    console.log(`   🤖 주 엔진: ${engine} ${enableFallback ? '(대체 엔진 활성화)' : ''}`);
    console.log(`   🎯 번역: ${sourceLang || 'auto'} → ${targetLang}`);
    console.log(`   📝 텍스트 길이: ${text.length.toLocaleString()}자`);
    console.log(`   📋 텍스트 미리보기: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    console.log(`   ⏰ 시작 시간: ${new Date(startTime).toISOString()}`);

    // 시도할 엔진 목록 구성
    const enginesToTry = [engine];
    if (enableFallback) {
      const fallbackEngines = this.getFallbackEngines(engine);
      // 사용 가능한 엔진만 필터링
      const availableEngines = this.getAvailableEngines();
      const availableFallbacks = fallbackEngines.filter(e => 
        availableEngines.includes(e) && e !== engine
      );
      enginesToTry.push(...availableFallbacks);
    }

    let lastError = null;
    let attemptCount = 0;

    for (const currentEngine of enginesToTry) {
      attemptCount++;
      
      try {
        console.log(`   🎯 시도 ${attemptCount}: ${currentEngine} 엔진 호출...`);
        
        const result = await this.translateWithSingleEngine(text, targetLang, sourceLang, currentEngine);
        
        const duration = Date.now() - startTime;
        
        // 번역 성공 로그
        console.log(`   ✅ 번역 완료! (${duration}ms, ${attemptCount}번째 시도)`);
        console.log(`   📤 결과 길이: ${result.translatedText.length.toLocaleString()}자`);
        console.log(`   📋 결과 미리보기: "${result.translatedText.substring(0, 100)}${result.translatedText.length > 100 ? '...' : ''}"`);
        console.log(`   📊 처리 속도: ${Math.round(text.length / (duration / 1000))}자/초`);
        console.log(`   🔍 감지된 언어: ${result.detectedSourceLang || '없음'}`);
        console.log(`   ⚙️ 사용된 엔진: ${result.engine}`);
        
        if (currentEngine !== engine) {
          console.log(`   🔄 대체 엔진 사용됨: ${engine} → ${currentEngine}`);
        }

        return result;
        
      } catch (error) {
        console.error(`   ❌ ${currentEngine} 엔진 실패: ${error.message}`);
        lastError = error;
        
        // 마지막 엔진이 아니면 다음 엔진 시도
        if (attemptCount < enginesToTry.length) {
          console.log(`   🔄 다음 대체 엔진으로 시도 중...`);
          continue;
        }
      }
    }

    // 모든 엔진이 실패한 경우
    const duration = Date.now() - startTime;
    console.error(`\n💥 모든 번역 엔진 실패! (${duration}ms)`);
    console.error(`   🤖 시도한 엔진들: ${enginesToTry.join(', ')}`);
    console.error(`   🎯 번역: ${sourceLang || 'auto'} → ${targetLang}`);
    console.error(`   📝 텍스트 길이: ${text.length}자`);
    console.error(`   ❌ 마지막 오류: ${lastError?.message}`);
    
    throw new Error(`모든 번역 엔진이 실패했습니다. 마지막 오류: ${lastError?.message}`);
  }

  // 사용 가능한 번역 엔진 목록 (실제 사용 가능한지 확인)
  getAvailableEngines() {
    const engines = [];
    
    // Ollama 로컬 모델들을 최우선으로 배치 (서버 연결시에만 사용 가능)
    // 실제 운영에서는 ollama 서버 상태를 체크해야 하지만, 
    // 여기서는 단순화해서 항상 추가
    engines.push('ollama-gemma2-sapie');     // 한국어 특화 sapie (기본값)
    engines.push('ollama-kanana-1.5');       // Kakao Kanana 1.5-8B (최신 한국어 특화 모델)
    engines.push('ollama-exaone3.5');       // 한국어 특화 exaone3.5
    engines.push('ollama-gemma2');           // 명시적 gemma2:9b
    engines.push('ollama-hyperclovax');      // 네이버 하이퍼클로바X 3B (한국어 특화)
    engines.push('ollama-hyperclovax-1.5b'); // 네이버 하이퍼클로바X 1.5B (경량화)
    
    if (this.gemini) engines.push('gemini');
    if (this.groq) engines.push('groq');
    if (this.openai) engines.push('openai');
    if (this.anthropic) engines.push('claude');
    if (this.deeplTranslator) engines.push('deepl');
    
    return engines;
  }

  // 대체 엔진 없이 번역 (기존 동작)
  async translateSingleEngine(text, targetLang, sourceLang = null, engine = 'ollama-gemma2-sapie') {
    return this.translate(text, targetLang, sourceLang, engine, false);
  }

  // 지원하는 언어 목록
  getSupportedLanguages() {
    return [
      { code: 'ko', name: '한국어' },
      { code: 'en', name: 'English' },
      { code: 'ja', name: '日本語' },
      { code: 'zh', name: '中문' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'it', name: 'Italiano' },
      { code: 'pt', name: 'Português' },
      { code: 'ru', name: 'Русский' }
    ];
  }

  // Ollama API 상태 확인
  async checkOllamaStatus() {
    try {
      // Ollama 서비스 상태 확인
      const statusResponse = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: 5000
      });

      // 모델 목록과 상태 가져오기
      const models = statusResponse.data.models || [];
      
      // 각 모델의 상세 정보 수집 (처음 3개만)
      const modelDetails = await Promise.all(
        models.slice(0, 3).map(async (model) => {
          try {
            const infoResponse = await axios.post(`${this.ollamaUrl}/api/show`, {
              name: model.name
            }, { timeout: 3000 });
            
            return {
              name: model.name,
              size: model.size,
              sizeFormatted: this.formatBytes(model.size),
              modified_at: model.modified_at,
              details: infoResponse.data
            };
          } catch (error) {
            return {
              name: model.name,
              size: model.size,
              sizeFormatted: this.formatBytes(model.size),
              modified_at: model.modified_at,
              error: error.message
            };
          }
        })
      );

      // GPU 사용량 확인 (간단한 테스트 요청)
      let gpuStatus = 'unknown';
      let responseTime = 0;
      try {
        const testStart = Date.now();
        await axios.post(`${this.ollamaUrl}/api/generate`, {
          model: 'sapie:latest',
          prompt: 'GPU 테스트',
          stream: false
        }, { timeout: 15000 });
        const testEnd = Date.now();
        responseTime = testEnd - testStart;
        
        // 응답 시간으로 GPU 사용 여부 추정
        if (responseTime < 5000) {
          gpuStatus = 'gpu_accelerated';
        } else if (responseTime < 15000) {
          gpuStatus = 'cpu_mode';
        } else {
          gpuStatus = 'slow_response';
        }
      } catch (error) {
        gpuStatus = 'error';
      }

      return {
        status: 'online',
        url: this.ollamaUrl,
        models: modelDetails,
        modelCount: models.length,
        gpuStatus: gpuStatus,
        responseTime: responseTime,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      console.error('Ollama 상태 확인 오류:', error);
      return {
        status: 'offline',
        url: this.ollamaUrl,
        error: error.message,
        models: [],
        modelCount: 0,
        gpuStatus: 'unknown',
        responseTime: 0,
        lastChecked: new Date().toISOString()
      };
    }
  }

  // 바이트를 사람이 읽기 쉬운 형태로 변환
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = TranslationService; 