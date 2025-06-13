import { useState, useEffect } from "react";
import "./App.css";

interface Engine {
  id: string;
  name: string;
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

interface UploadedFile {
  fileId: string;
  originalName: string;
  format: string;
  stats: {
    totalEntries: number;
    totalDuration: number;
    totalCharacters: number;
  };
}

interface TranslationProgress {
  status: string;
  progress: number;
  totalEntries: number;
  processedEntries: number;
  totalCharacters: number;
  processedCharacters: number;
  startTime: number;
  currentChunk: number;
  totalChunks: number;
  estimatedTimeRemaining: number;
  averageCharsPerSecond: number;
  message: string;
}

interface TranslationStats {
  totalTime: number;
  totalTimeFormatted: string;
  totalCharacters: number;
  averageCharsPerSecond: number;
  efficiency: string;
}

interface OllamaStatus {
  status: 'online' | 'offline';
  url: string;
  models: Array<{
    name: string;
    size: number;
    sizeFormatted: string;
    modified_at: string;
  }>;
  modelCount: number;
  gpuStatus: 'gpu_accelerated' | 'cpu_mode' | 'slow_response' | 'error' | 'unknown';
  responseTime: number;
  lastChecked: string;
  error?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<string>("text");
  const [sourceLanguage, setSourceLanguage] = useState<string>("auto");
  const [targetLanguage, setTargetLanguage] = useState<string>("ko");
  const [sourceText, setSourceText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [files, setFiles] = useState<File[] | undefined>();
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isTranslated, setIsTranslated] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [engine, setEngine] = useState<string>("ollama-gemma2-sapie");
  const [engines, setEngines] = useState<Engine[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [translationDuration, setTranslationDuration] = useState<number | null>(null);
  const [translationProgress, setTranslationProgress] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>("");
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const [progressData, setProgressData] = useState<TranslationProgress | null>(null);
  
  // 고급 번역 옵션 상태
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [chunkSize, setChunkSize] = useState<number>(10);
  const [translationMode, setTranslationMode] = useState<string>('srt_direct');
  const [maxRetries, setMaxRetries] = useState<number>(5);
  const [retryDelay, setRetryDelay] = useState<number>(1000);
  const [enableFallback, setEnableFallback] = useState<boolean>(false);

  // Ollama 상태 관리
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [showOllamaStatus, setShowOllamaStatus] = useState<boolean>(false);

  // 엔진과 언어 목록 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const [enginesRes, languagesRes] = await Promise.all([
          fetch('/translation-api/translation/engines'),
          fetch('/translation-api/translation/languages')
        ]);

        if (enginesRes.ok) {
          const enginesData = await enginesRes.json();
          setEngines(enginesData.data.engines);
          // 첫 번째 엔진을 기본값으로 설정 (ollama-gemma2-sapie가 첫 번째여야 함)
          if (enginesData.data.engines.length > 0) {
            setEngine(enginesData.data.engines[0].id);
          }
        }

        if (languagesRes.ok) {
          const languagesData = await languagesRes.json();
          setLanguages(languagesData.data.languages);
        }
      } catch (error) {
        console.error('데이터 로드 오류:', error);
      }
    };

    loadData();
  }, []);

  // Ollama 상태 확인 함수
  const checkOllamaStatus = async () => {
    try {
      const response = await fetch('/translation-api/translation/ollama/status');
      const data = await response.json();
      
      if (data.success) {
        setOllamaStatus(data.data);
      } else {
        setOllamaStatus({
          status: 'offline',
          url: 'http://localhost:11434',
          models: [],
          modelCount: 0,
          gpuStatus: 'unknown',
          responseTime: 0,
          lastChecked: new Date().toISOString(),
          error: data.error
        });
      }
    } catch (error) {
      setOllamaStatus({
        status: 'offline',
        url: 'http://localhost:11434',
        models: [],
        modelCount: 0,
        gpuStatus: 'unknown',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
        error: '서버 연결 실패'
      });
    }
  };

  // 컴포넌트 마운트 시 Ollama 상태 확인
  useEffect(() => {
    checkOllamaStatus();
    // 5분마다 상태 체크
    const interval = setInterval(checkOllamaStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSwapLanguages = () => {
    if (sourceLanguage !== "auto" && targetLanguage) {
      const temp = sourceLanguage;
      setSourceLanguage(targetLanguage);
      setTargetLanguage(temp);
      
      if (isTranslated) {
        const tempText = sourceText;
        setSourceText(translatedText);
        setTranslatedText(tempText);
      }
    }
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    
    const startTime = Date.now();
    setIsTranslating(true);
    setError("");
    setTranslationDuration(null);
    
    try {
      const response = await fetch('/translation-api/translation/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sourceText,
          targetLang: targetLanguage,
          sourceLang: sourceLanguage === "auto" ? undefined : sourceLanguage,
          engine
        })
      });

      const data = await response.json();

      if (data.success) {
        setTranslatedText(data.data.translatedText);
        setIsTranslated(true);
        const endTime = Date.now();
        setTranslationDuration(endTime - startTime);
      } else {
        setError(data.error || '번역 중 오류가 발생했습니다.');
      }
    } catch (error) {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleFileTranslate = async () => {
    if (!uploadedFile) return;
    
    const startTime = Date.now();
    setIsTranslating(true);
    setError("");
    setTranslationDuration(null);
    setTranslationStats(null);
    setTranslationProgress(0);
    setProgressText("번역 준비 중...");
    setEstimatedTimeRemaining(null);
    setProgressData(null);
    
    try {
      // 번역 요청 시작
      const translatePromise = fetch('/translation-api/subtitle/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: uploadedFile.fileId,
          targetLang: targetLanguage,
          sourceLang: sourceLanguage === "auto" ? undefined : sourceLanguage,
          engine,
          outputFormat: uploadedFile.format,
          chunkSize: chunkSize,
          translationMode: translationMode,
          maxRetries: maxRetries,
          retryDelay: retryDelay,
          enableFallback: enableFallback
        })
      });

      // 실시간 진행상태 체크
      const progressInterval = setInterval(async () => {
        const progress = await checkTranslationProgress(uploadedFile.fileId);
        if (progress) {
          setProgressData(progress);
          setTranslationProgress(progress.progress);
          setProgressText(progress.message);
          setEstimatedTimeRemaining(progress.estimatedTimeRemaining);
          
          // 완료되었거나 오류가 발생한 경우 인터벌 정리
          if (progress.status === 'completed' || progress.status === 'error') {
            clearInterval(progressInterval);
          }
        }
      }, 500); // 0.5초마다 체크

      const response = await translatePromise;

      // 인터벌 정리
      clearInterval(progressInterval);

      const data = await response.json();

      if (data.success) {
        setTranslationProgress(100);
        setProgressText("번역 완료!");
        setDownloadUrl(data.data.downloadUrl);
        setIsTranslated(true);
        const endTime = Date.now();
        setTranslationDuration(endTime - startTime);
        
        // 번역 통계 정보 설정
        if (data.data.translationStats) {
          setTranslationStats(data.data.translationStats);
        }
      } else {
        setError(data.error || '번역 중 오류가 발생했습니다.');
        setTranslationProgress(0);
        setProgressText("");
      }
    } catch (error) {
      setError('서버에 연결할 수 없습니다.');
      setTranslationProgress(0);
      setProgressText("");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length === 0) return;
    
    const file = droppedFiles[0];
    setFiles([file]);
    setIsUploading(true);
    setError("");
    setUploadedFile(null);
    setDownloadUrl("");
    setIsTranslated(false);
    setTranslationDuration(null);
    setTranslationProgress(0);
    setProgressText("");
    setEstimatedTimeRemaining(null);
    setTranslationStats(null);
    setProgressData(null);

    try {
      const formData = new FormData();
      formData.append('subtitle', file);

      const response = await fetch('/translation-api/subtitle/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setUploadedFile(data.data);
      } else {
        setError(data.error || '파일 업로드 중 오류가 발생했습니다.');
      }
    } catch (error) {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const droppedFiles = Array.from(selectedFiles);
      const file = droppedFiles[0];
      setFiles([file]);
      
      setIsUploading(true);
      setError("");
      setUploadedFile(null);
      setDownloadUrl("");
      setIsTranslated(false);
      setTranslationDuration(null);
      setTranslationProgress(0);
      setProgressText("");
      setEstimatedTimeRemaining(null);
      setTranslationStats(null);
      setProgressData(null);

      const uploadFile = async () => {
        try {
          const formData = new FormData();
          formData.append('subtitle', file);

          const response = await fetch('/translation-api/subtitle/upload', {
            method: 'POST',
            body: formData
          });

          const data = await response.json();

          if (data.success) {
            setUploadedFile(data.data);
          } else {
            setError(data.error || '파일 업로드 중 오류가 발생했습니다.');
          }
        } catch (error) {
          setError('서버에 연결할 수 없습니다.');
        } finally {
          setIsUploading(false);
        }
      };

      uploadFile();
    }
  };

  const handleClearText = () => {
    setSourceText("");
    setTranslatedText("");
    setIsTranslated(false);
    setError("");
    setTranslationDuration(null);
    setTranslationProgress(0);
    setProgressText("");
    setEstimatedTimeRemaining(null);
  };

  const handleClearFiles = () => {
    setFiles(undefined);
    setUploadedFile(null);
    setIsTranslated(false);
    setDownloadUrl("");
    setError("");
    setTranslationDuration(null);
    setTranslationProgress(0);
    setProgressText("");
    setEstimatedTimeRemaining(null);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTranslationTime = (milliseconds: number) => {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}초`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
      return `${minutes}분 ${seconds}초`;
    }
  };

  // 진행상태 조회 함수
  const checkTranslationProgress = async (fileId: string): Promise<TranslationProgress | null> => {
    try {
      const response = await fetch(`/translation-api/subtitle/progress/${fileId}`);
      if (response.ok) {
        const data = await response.json();
        return data.data;
      }
    } catch (error) {
      console.error('진행상태 조회 오류:', error);
    }
    return null;
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <div className="header-content">
            <div className="header-text">
              <h1>🌐 Translation Studio</h1>
              <p>AI 기반 다국어 번역 플랫폼</p>
            </div>
            <div className="header-actions">
              <button
                onClick={() => setShowOllamaStatus(!showOllamaStatus)}
                className={`status-button ${ollamaStatus?.status === 'online' ? 'online' : 'offline'}`}
                title="Ollama API 상태"
              >
                <span className="status-dot"></span>
                Ollama {ollamaStatus?.status === 'online' ? 'Online' : 'Offline'}
                {ollamaStatus?.gpuStatus === 'gpu_accelerated' && <span className="gpu-badge">🚀 GPU</span>}
              </button>
            </div>
          </div>
        </header>

        <div className="tabs-list">
          <button
            className={`tabs-trigger ${activeTab === 'text' ? 'active' : ''}`}
            data-state={activeTab === 'text' ? 'active' : 'inactive'}
            onClick={() => setActiveTab('text')}
          >
            📝 텍스트 번역
          </button>
          <button
            className={`tabs-trigger ${activeTab === 'file' ? 'active' : ''}`}
            data-state={activeTab === 'file' ? 'active' : 'inactive'}
            onClick={() => setActiveTab('file')}
          >
            📄 자막 파일 번역
          </button>
        </div>

        {/* Ollama 상태 패널 */}
        {showOllamaStatus && ollamaStatus && (
          <div className="ollama-status-panel">
            <div className="status-header">
              <h3>🤖 Ollama API 상태</h3>
              <button 
                onClick={checkOllamaStatus}
                className="refresh-button"
                title="상태 새로고침"
              >
                🔄
              </button>
            </div>
            
            <div className="status-grid">
              <div className="status-item">
                <span className="label">연결 상태:</span>
                <span className={`value ${ollamaStatus.status}`}>
                  {ollamaStatus.status === 'online' ? '🟢 온라인' : '🔴 오프라인'}
                </span>
              </div>
              
              <div className="status-item">
                <span className="label">GPU 가속:</span>
                <span className={`value gpu-${ollamaStatus.gpuStatus}`}>
                  {ollamaStatus.gpuStatus === 'gpu_accelerated' && '🚀 GPU 가속'}
                  {ollamaStatus.gpuStatus === 'cpu_mode' && '💻 CPU 모드'}
                  {ollamaStatus.gpuStatus === 'slow_response' && '⚠️ 느린 응답'}
                  {ollamaStatus.gpuStatus === 'error' && '❌ 오류'}
                  {ollamaStatus.gpuStatus === 'unknown' && '❓ 알 수 없음'}
                </span>
              </div>
              
              <div className="status-item">
                <span className="label">응답 시간:</span>
                <span className="value">
                  {ollamaStatus.responseTime > 0 ? `${ollamaStatus.responseTime}ms` : '-'}
                </span>
              </div>
              
              <div className="status-item">
                <span className="label">모델 수:</span>
                <span className="value">{ollamaStatus.modelCount}개</span>
              </div>
            </div>

            {ollamaStatus.models.length > 0 && (
              <div className="models-section">
                <h4>📚 로드된 모델</h4>
                <div className="models-grid">
                  {ollamaStatus.models.map((model, index) => (
                    <div key={index} className="model-item">
                      <div className="model-name">{model.name}</div>
                      <div className="model-size">{model.sizeFormatted}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ollamaStatus.error && (
              <div className="error-section">
                <h4>❌ 오류</h4>
                <p>{ollamaStatus.error}</p>
              </div>
            )}

            <div className="status-footer">
              <small>마지막 확인: {new Date(ollamaStatus.lastChecked).toLocaleString()}</small>
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="card">
            <div className="language-selector">
              <div className="language-item">
                <div className="form-group">
                  <label className="form-label">번역 엔진</label>
                  <select
                    value={engine}
                    onChange={(e) => setEngine(e.target.value)}
                    className="select-input"
                  >
                    {engines.map((eng) => (
                      <option key={eng.id} value={eng.id}>
                        {eng.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="language-item">
                <div className="form-group">
                  <label className="form-label">원본 언어</label>
                  <select
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    className="select-input"
                  >
                    <option value="auto">자동 감지</option>
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                className="swap-button"
                onClick={handleSwapLanguages}
                disabled={sourceLanguage === "auto"}
              >
                🔄
              </button>

              <div className="language-item">
                <div className="form-group">
                  <label className="form-label">번역 언어</label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="select-input"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="translation-area">
              <div className="text-area-container">
                <div className="text-area-label">원본 텍스트</div>
                <textarea
                  value={sourceText}
                  onChange={(e) => {
                    setSourceText(e.target.value);
                    setIsTranslated(false);
                    setTranslationDuration(null);
                  }}
                  placeholder="번역할 텍스트를 입력하세요..."
                  className="textarea"
                  maxLength={5000}
                />
                <div style={{ textAlign: 'right', marginTop: '8px', fontSize: '0.9rem', color: '#666' }}>
                  {sourceText.length}/5000
                </div>
                {sourceText && (
                  <button
                    onClick={handleClearText}
                    className="button button-outline"
                    style={{ marginTop: '10px' }}
                  >
                    내용 지우기
                  </button>
                )}
              </div>

              <div className="translate-arrow">
                ➡️
              </div>

              <div className="text-area-container">
                <div className="text-area-label">번역 결과</div>
                <textarea
                  value={translatedText}
                  readOnly
                  placeholder="번역 결과가 여기에 표시됩니다..."
                  className="textarea"
                />
                {isTranslated && translationDuration && (
                  <div className="success-message" style={{ marginTop: '10px' }}>
                    ✅ 번역 완료 (소요시간: {formatTranslationTime(translationDuration)})
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={handleTranslate} 
              disabled={!sourceText.trim() || isTranslating}
              className="button button-primary"
              style={{ width: '100%', marginTop: '20px' }}
            >
              {isTranslating ? '🔄 번역 중...' : '🚀 번역하기'}
            </button>

            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}
          </div>
        )}

        {activeTab === 'file' && (
          <div className="card">
            <div className="language-selector">
              <div className="language-item">
                <div className="form-group">
                  <label className="form-label">번역 엔진</label>
                  <select
                    value={engine}
                    onChange={(e) => setEngine(e.target.value)}
                    className="select-input"
                  >
                    {engines.map((eng) => (
                      <option key={eng.id} value={eng.id}>
                        {eng.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="language-item">
                <div className="form-group">
                  <label className="form-label">원본 언어</label>
                  <select
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    className="select-input"
                  >
                    <option value="auto">자동 감지</option>
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                className="swap-button"
                onClick={handleSwapLanguages}
                disabled={sourceLanguage === "auto"}
              >
                🔄
              </button>

              <div className="language-item">
                <div className="form-group">
                  <label className="form-label">번역 언어</label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="select-input"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div 
              className={`dropzone ${isDragOver ? 'dropzone-active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="subtitleFile"
                accept=".srt,.vtt,.ass,.ssa,.sub,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="subtitleFile" style={{ cursor: 'pointer', display: 'block' }}>
                📁 자막 파일 선택 (.srt, .vtt, .ass, .txt)
              </label>
              <div style={{ marginTop: '10px', fontSize: '0.9rem', opacity: 0.7 }}>
                또는 파일을 여기에 드래그 앤 드롭하세요
              </div>
              
              {files && files[0] && (
                <div className="file-info">
                  <p><strong>선택된 파일:</strong> {files[0].name}</p>
                  <p><strong>크기:</strong> {(files[0].size / 1024).toFixed(2)} KB</p>
                  <p><strong>타입:</strong> {files[0].type || '알 수 없음'}</p>
                </div>
              )}
            </div>

            {isUploading && (
              <div style={{ textAlign: 'center', margin: '20px 0', color: '#6366f1' }}>
                🔄 파일 업로드 중...
              </div>
            )}

            {uploadedFile && (
              <div className="file-info">
                <h3>📊 파일 정보</h3>
                <div className="file-stats">
                  <div className="stat-item">
                    <span className="stat-value">{uploadedFile.stats.totalEntries}</span>
                    <span className="stat-label">총 자막 수</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{formatDuration(uploadedFile.stats.totalDuration)}</span>
                    <span className="stat-label">총 재생 시간</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{uploadedFile.stats.totalCharacters.toLocaleString()}</span>
                    <span className="stat-label">총 문자 수</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={handleFileTranslate} 
                disabled={!uploadedFile || isTranslating}
                className="button button-primary"
                style={{ flex: 1 }}
              >
                {isTranslating ? '🔄 번역 중...' : '🚀 파일 번역하기'}
              </button>

              <button 
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="button button-outline"
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                ⚙️ 고급 번역 옵션
              </button>
            </div>

            {/* 고급 번역 옵션 */}
            {showAdvancedOptions && (
              <div className="card" style={{ marginTop: '20px', padding: '20px', background: 'rgba(0, 123, 255, 0.05)', border: '1px solid rgba(0, 123, 255, 0.2)' }}>
                <h3 style={{ marginBottom: '20px', color: '#007bff', fontSize: '1.1rem' }}>⚙️ 고급 번역 옵션</h3>
                
                <div style={{ display: 'grid', gap: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">청크 크기 (1-500)</label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                      className="input"
                      style={{ width: '100px' }}
                    />
                    <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                      한 번에 번역할 자막 수. 큰 값일수록 빠르지만 메모리를 더 사용합니다.
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">번역 모드</label>
                    <select
                      value={translationMode}
                      onChange={(e) => setTranslationMode(e.target.value)}
                      className="select-input"
                    >
                      <option value="auto">자동 (권장)</option>
                      <option value="srt_direct">SRT 직접 모드</option>
                      <option value="delimiter">구분자 모드</option>
                    </select>
                    <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                      번역 처리 방식을 선택합니다. 자동 모드가 가장 안정적입니다.
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">최대 재시도 횟수 (0-10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(Number(e.target.value))}
                      className="input"
                      style={{ width: '100px' }}
                    />
                    <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                      번역 실패 시 재시도할 횟수. 높을수록 안정적이지만 시간이 더 걸릴 수 있습니다.
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">재시도 지연 시간 (100-10000ms)</label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      step="100"
                      value={retryDelay}
                      onChange={(e) => setRetryDelay(Number(e.target.value))}
                      className="input"
                      style={{ width: '150px' }}
                    />
                    <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                      재시도 간격 (밀리초). API 제한을 피하기 위해 충분한 시간을 설정하세요.
                    </small>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={enableFallback}
                        onChange={(e) => setEnableFallback(e.target.checked)}
                      />
                      <span>대체 엔진 사용</span>
                    </label>
                    <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                      기본 엔진 실패 시 다른 엔진으로 자동 전환합니다.
                    </small>
                  </div>
                </div>
              </div>
            )}

            {/* 번역 진행률 표시 */}
            {isTranslating && (
              <div className="translation-status translating">
                <div className="status-icon">⚙️</div>
                <div className="status-text">{progressText}</div>
                <div className="progress-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${translationProgress}%` }}
                  ></div>
                </div>
                <div className="progress-info">
                  <span className="progress-text">{Math.round(translationProgress)}% 완료</span>
                  {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
                    <span className="progress-time">
                      예상 남은 시간: {Math.round(estimatedTimeRemaining)}초
                    </span>
                  )}
                </div>
                
                {/* 상세 진행 정보 */}
                {progressData && (
                  <div className="progress-details">
                    <div className="progress-detail-row">
                      <span>청크 진행:</span>
                      <span>{progressData.currentChunk}/{progressData.totalChunks}</span>
                    </div>
                    <div className="progress-detail-row">
                      <span>자막 처리:</span>
                      <span>{progressData.processedEntries}/{progressData.totalEntries}개</span>
                    </div>
                    <div className="progress-detail-row">
                      <span>문자 처리:</span>
                      <span>{progressData.processedCharacters.toLocaleString()}/{progressData.totalCharacters.toLocaleString()}자</span>
                    </div>
                    {progressData.averageCharsPerSecond > 0 && (
                      <div className="progress-detail-row">
                        <span>번역 속도:</span>
                        <span>{progressData.averageCharsPerSecond}자/초</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {files && (
              <button
                onClick={handleClearFiles}
                className="button button-outline"
                style={{ width: '100%', marginTop: '10px' }}
              >
                파일 지우기
              </button>
            )}

            {error && (
              <div className="translation-status error">
                <div className="status-icon">❌</div>
                <div className="status-text">번역 오류</div>
                <div className="status-details">{error}</div>
              </div>
            )}

            {isTranslated && translationDuration && !error && (
              <div className="translation-status success">
                <div className="status-icon">✅</div>
                <div className="status-text">번역 완료!</div>
                <div className="status-details">
                  {translationStats ? (
                    <>
                      <div className="stats-row">
                        <span>총 소요시간: {translationStats.totalTimeFormatted}</span>
                      </div>
                      <div className="stats-row">
                        <span>번역 엔진: {engines.find(e => e.id === engine)?.name || engine}</span>
                      </div>
                      <div className="stats-row">
                        <span>처리 문자 수: {translationStats.totalCharacters.toLocaleString()}자</span>
                      </div>
                      <div className="stats-row">
                        <span>평균 번역 속도: {translationStats.efficiency}</span>
                      </div>
                      <div className="stats-row">
                        <span>총 자막 수: {uploadedFile?.stats.totalEntries}개</span>
                      </div>
                    </>
                  ) : (
                    <>
                      소요시간: {formatTranslationTime(translationDuration)} | 
                      엔진: {engines.find(e => e.id === engine)?.name || engine} | 
                      총 {uploadedFile?.stats.totalEntries}개 자막 번역됨
                    </>
                  )}
                </div>
                
                {/* 다운로드 버튼을 번역 완료 상태 안에 통합 */}
                {downloadUrl && (
                  <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(34, 197, 94, 0.3)' }}>
                    <p style={{ marginBottom: '15px', color: 'rgba(34, 197, 94, 0.8)', fontSize: '0.9rem' }}>
                      번역된 자막 파일을 다운로드하세요
                    </p>
                    <a
                      href={downloadUrl}
                      download
                      className="download-button"
                      style={{ 
                        textDecoration: 'none',
                        display: 'inline-block',
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        boxShadow: '0 4px 15px rgba(22, 163, 74, 0.3)'
                      }}
                    >
                      📥 번역 파일 다운로드
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
