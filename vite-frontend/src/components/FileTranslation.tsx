import { useState, useEffect, useRef } from 'react'

interface Engine {
  id: string
  name: string
}

interface Language {
  code: string
  name: string
  nativeName: string
}

interface UploadedFile {
  fileId: string
  originalName: string
  format: string
  stats: {
    totalEntries: number
    totalDuration: number
    totalCharacters: number
  }
  preview: Array<{
    index: number
    startTime: string
    endTime: string
    text: string
  }>
}

export default function FileTranslation() {
  const [engines, setEngines] = useState<Engine[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState('')
  const [translationProgress, setTranslationProgress] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  
  // 번역 설정
  const [sourceLang, setSourceLang] = useState('')
  const [targetLang, setTargetLang] = useState('ko')
  const [engine, setEngine] = useState('ollama-alma')
  const [outputFormat, setOutputFormat] = useState('')

  // 번역 옵션 추가
  const [chunkSize, setChunkSize] = useState(50)
  const [translationMode, setTranslationMode] = useState('auto')
  const [maxRetries, setMaxRetries] = useState(5)
  const [retryDelay, setRetryDelay] = useState(1000)
  const [enableFallback, setEnableFallback] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 엔진과 언어 목록 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const [enginesRes, languagesRes] = await Promise.all([
          fetch('/translation-api/translation/engines'),
          fetch('/translation-api/translation/languages')
        ])

        if (enginesRes.ok) {
          const enginesData = await enginesRes.json()
          setEngines(enginesData.data.engines)
          // 첫 번째 엔진을 기본값으로 설정
          if (enginesData.data.engines.length > 0) {
            setEngine(enginesData.data.engines[0].id)
          }
        }

        if (languagesRes.ok) {
          const languagesData = await languagesRes.json()
          setLanguages(languagesData.data.languages)
        }
      } catch (error) {
        console.error('데이터 로드 오류:', error)
      }
    }

    loadData()
  }, [])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 파일 형식 검증
    const allowedExtensions = ['.srt', '.smi', '.vtt']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!allowedExtensions.includes(fileExtension)) {
      setError('지원하지 않는 파일 형식입니다. SRT, SMI, VTT 파일만 업로드 가능합니다.')
      return
    }

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.')
      return
    }

    setIsUploading(true)
    setError('')
    setUploadedFile(null)
    setDownloadUrl('')
    setTranslationProgress('')
    setIsTranslating(false)

    try {
      const formData = new FormData()
      formData.append('subtitle', file)

      const response = await fetch('/translation-api/subtitle/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setUploadedFile(data.data)
        setOutputFormat(data.data.format) // 기본값으로 원본 형식 설정
      } else {
        setError(data.error || '파일 업로드 중 오류가 발생했습니다.')
      }
    } catch (error) {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleTranslate = async () => {
    if (!uploadedFile) return

    setIsTranslating(true)
    setError('')
    setTranslationProgress('번역 준비 중...')

    try {
      const response = await fetch('/translation-api/subtitle/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: uploadedFile.fileId,
          targetLang,
          sourceLang: sourceLang || undefined,
          engine,
          outputFormat: outputFormat || uploadedFile.format,
          chunkSize,
          translationMode,
          maxRetries,
          retryDelay,
          enableFallback
        })
      })

      const data = await response.json()

      if (data.success) {
        setDownloadUrl(data.data.downloadUrl)
        setTranslationProgress('번역 완료!')
      } else {
        setError(data.error || '번역 중 오류가 발생했습니다.')
        setTranslationProgress('')
      }
    } catch (error) {
      setError('서버에 연결할 수 없습니다.')
      setTranslationProgress('')
    } finally {
      setIsTranslating(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl space-y-8">
      {/* 파일 업로드 영역 */}
      <div>
        <h3 className="text-slate-200 font-bold text-2xl mb-6 flex items-center space-x-3">
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>자막파일 업로드</span>
        </h3>
        
        <div className="relative group">
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.smi,.vtt"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {!uploadedFile ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600/50 hover:border-purple-500/50 rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 group hover:bg-slate-800/20"
            >
              <div className="text-6xl mb-6 text-slate-400 group-hover:text-purple-400 transition-colors duration-300">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-slate-200 text-xl font-semibold mb-3 group-hover:text-white transition-colors duration-300">
                파일을 선택하거나 드래그하여 업로드
              </p>
              <p className="text-slate-400 mb-6">
                지원 형식: <span className="text-purple-300 font-medium">SRT</span>, 
                <span className="text-blue-300 font-medium"> SMI</span>, 
                <span className="text-green-300 font-medium"> VTT</span>
              </p>
              <div className="inline-flex items-center space-x-2 text-sm text-slate-400 bg-slate-800/50 px-4 py-2 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>최대 10MB</span>
              </div>
              
              {isUploading && (
                <div className="mt-6 flex items-center justify-center space-x-3">
                  <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                  <span className="text-purple-300">업로드 중...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-slate-200 font-bold text-xl flex items-center space-x-2">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>업로드 완료</span>
                </h4>
                <button
                  onClick={() => {
                    setUploadedFile(null)
                    setDownloadUrl('')
                    setTranslationProgress('')
                    setIsTranslating(false)
                    setError('')
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="text-red-400 hover:text-red-300 bg-red-500/20 hover:bg-red-500/30 px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">파일명:</span>
                    <span className="text-slate-200 font-medium">{uploadedFile.originalName}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">형식:</span>
                    <span className="text-purple-300 font-bold">{uploadedFile.format.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">자막 수:</span>
                    <span className="text-blue-300 font-bold">{uploadedFile.stats.totalEntries}개</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">총 길이:</span>
                    <span className="text-green-300 font-bold">{formatDuration(uploadedFile.stats.totalDuration)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">문자 수:</span>
                    <span className="text-orange-300 font-bold">{uploadedFile.stats.totalCharacters.toLocaleString()}자</span>
                  </div>
                </div>
              </div>

              {/* 미리보기 */}
              {uploadedFile.preview.length > 0 && (
                <div>
                  <h5 className="text-slate-200 font-semibold mb-4 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>미리보기</span>
                  </h5>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {uploadedFile.preview.map((entry, index) => (
                      <div key={index} className="bg-slate-900/50 border border-slate-700/30 p-4 rounded-xl">
                        <div className="text-xs text-slate-400 mb-2 font-mono">
                          {entry.startTime} → {entry.endTime}
                        </div>
                        <div className="text-slate-200">{entry.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 번역 설정 */}
      <div className="animate-fadeIn">
        <h3 className="text-slate-200 font-bold text-2xl mb-6 flex items-center space-x-3">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>번역 설정</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* 번역 엔진 */}
          <div className="group">
            <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
              번역 엔진
            </label>
            <div className="relative">
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-700/50"
              >
                {engines.map((eng) => (
                  <option key={eng.id} value={eng.id} className="bg-slate-800 text-white">
                    {eng.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 원본 언어 */}
          <div className="group">
            <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
              원본 언어
            </label>
            <div className="relative">
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-700/50"
              >
                <option value="" className="bg-slate-800 text-white">자동 감지</option>
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-800 text-white">
                    {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 번역 언어 */}
          <div className="group">
            <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
              번역 언어
            </label>
            <div className="relative">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-700/50"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-800 text-white">
                    {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 출력 형식 */}
          <div className="group">
            <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
              출력 형식
            </label>
            <div className="relative">
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-700/50"
              >
                <option value="srt" className="bg-slate-800 text-white">SRT</option>
                <option value="smi" className="bg-slate-800 text-white">SMI</option>
                <option value="vtt" className="bg-slate-800 text-white">VTT</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 고급 번역 옵션 토글 */}
        <div className="mt-8 border-t border-slate-700/50 pt-6">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center justify-between w-full px-4 py-3 bg-slate-800/30 hover:bg-slate-700/30 border border-slate-700/50 rounded-xl transition-all duration-300 group"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              <span className="text-slate-200 font-semibold">고급 번역 옵션</span>
            </div>
            <svg 
              className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showAdvancedOptions ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 고급 옵션 영역 */}
          {showAdvancedOptions && (
            <div className="mt-6 space-y-6 animate-fadeIn border-t border-slate-700/50 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 청크 크기 */}
                <div className="group">
                  <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                    청크 크기
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Math.max(1, Math.min(500, parseInt(e.target.value) || 50)))}
                      min="1"
                      max="500"
                      className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 hover:bg-slate-700/50"
                    />
                    <div className="mt-2 text-xs text-slate-400">
                      한 번에 번역할 자막 개수 (1-500)
                    </div>
                  </div>
                </div>

                {/* 번역 모드 */}
                <div className="group">
                  <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                    번역 모드
                  </label>
                  <div className="relative">
                    <select
                      value={translationMode}
                      onChange={(e) => setTranslationMode(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-700/50"
                    >
                      <option value="auto" className="bg-slate-800 text-white">자동</option>
                      <option value="srt_direct" className="bg-slate-800 text-white">SRT 직접</option>
                      <option value="separator" className="bg-slate-800 text-white">구분자 방식</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      번역 처리 방식을 선택
                    </div>
                  </div>
                </div>

                {/* 최대 재시도 */}
                <div className="group">
                  <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                    최대 재시도
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(Math.max(0, Math.min(10, parseInt(e.target.value) || 5)))}
                      min="0"
                      max="10"
                      className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 hover:bg-slate-700/50"
                    />
                    <div className="mt-2 text-xs text-slate-400">
                      번역 실패 시 재시도 횟수 (0-10)
                    </div>
                  </div>
                </div>

                {/* 재시도 지연시간 */}
                <div className="group">
                  <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                    재시도 지연 (ms)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={retryDelay}
                      onChange={(e) => setRetryDelay(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000)))}
                      min="100"
                      max="10000"
                      step="100"
                      className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 hover:bg-slate-700/50"
                    />
                    <div className="mt-2 text-xs text-slate-400">
                      재시도 간격 (100-10000ms)
                    </div>
                  </div>
                </div>

                {/* 대체 엔진 사용 */}
                <div className="group">
                  <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                    대체 엔진
                  </label>
                  <div className="relative">
                    <label className="flex items-center space-x-3 px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-700/50 transition-all duration-300">
                      <input
                        type="checkbox"
                        checked={enableFallback}
                        onChange={(e) => setEnableFallback(e.target.checked)}
                        className="w-5 h-5 text-cyan-500 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                      />
                      <span className="text-white font-medium">
                        {enableFallback ? '활성화' : '비활성화'}
                      </span>
                    </label>
                    <div className="mt-2 text-xs text-slate-400">
                      번역 실패 시 다른 엔진 사용
                    </div>
                  </div>
                </div>
              </div>

              {/* 옵션 설명 */}
              <div className="bg-slate-800/20 border border-slate-700/30 rounded-xl p-4">
                <h5 className="text-slate-200 font-semibold mb-3 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>옵션 설명</span>
                </h5>
                <div className="space-y-2 text-sm text-slate-300">
                  <div><span className="text-cyan-300 font-medium">자동:</span> 청크 크기와 텍스트 길이에 따라 최적 방식 선택</div>
                  <div><span className="text-green-300 font-medium">SRT 직접:</span> SRT 형식 그대로 번역 (빠르고 정확)</div>
                  <div><span className="text-orange-300 font-medium">구분자 방식:</span> 기존 방식 (안정적, 하위 호환)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 번역 버튼 및 진행상황 */}
      <div className="text-center animate-fadeIn">
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
          <button
            onClick={uploadedFile ? handleTranslate : () => setError('파일을 먼저 업로드해주세요.')}
            disabled={isTranslating}
            className="relative inline-flex items-center justify-center px-12 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            
            {isTranslating ? (
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>번역 중...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>번역 시작</span>
              </div>
            )}
          </button>

          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-lg rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/50 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              <span>고급 옵션</span>
            </div>
          </button>
        </div>

        {/* 고급 옵션 영역 */}
        {showAdvancedOptions && (
          <div className="mt-6 space-y-6 animate-fadeIn border border-slate-700/50 rounded-2xl p-6 bg-slate-800/20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 청크 크기 */}
              <div className="group">
                <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                  청크 크기
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Math.max(1, Math.min(500, parseInt(e.target.value) || 50)))}
                    min="1"
                    max="500"
                    className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 hover:bg-slate-700/50"
                  />
                  <div className="mt-2 text-xs text-slate-400">
                    한 번에 번역할 자막 개수 (1-500)
                  </div>
                </div>
              </div>

              {/* 번역 모드 */}
              <div className="group">
                <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                  번역 모드
                </label>
                <div className="relative">
                  <select
                    value={translationMode}
                    onChange={(e) => setTranslationMode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-700/50"
                  >
                    <option value="auto" className="bg-slate-800 text-white">자동</option>
                    <option value="srt_direct" className="bg-slate-800 text-white">SRT 직접</option>
                    <option value="separator" className="bg-slate-800 text-white">구분자 방식</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    번역 처리 방식을 선택
                  </div>
                </div>
              </div>

              {/* 최대 재시도 */}
              <div className="group">
                <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                  최대 재시도
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Math.max(0, Math.min(10, parseInt(e.target.value) || 5)))}
                    min="0"
                    max="10"
                    className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 hover:bg-slate-700/50"
                  />
                  <div className="mt-2 text-xs text-slate-400">
                    번역 실패 시 재시도 횟수 (0-10)
                  </div>
                </div>
              </div>

              {/* 재시도 지연시간 */}
              <div className="group">
                <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                  재시도 지연 (ms)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={retryDelay}
                    onChange={(e) => setRetryDelay(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000)))}
                    min="100"
                    max="10000"
                    step="100"
                    className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 hover:bg-slate-700/50"
                  />
                  <div className="mt-2 text-xs text-slate-400">
                    재시도 간격 (100-10000ms)
                  </div>
                </div>
              </div>

              {/* 대체 엔진 사용 */}
              <div className="group">
                <label className="block text-slate-200 font-semibold mb-3 text-sm uppercase tracking-wider">
                  대체 엔진
                </label>
                <div className="relative">
                  <label className="flex items-center space-x-3 px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-700/50 transition-all duration-300">
                    <input
                      type="checkbox"
                      checked={enableFallback}
                      onChange={(e) => setEnableFallback(e.target.checked)}
                      className="w-5 h-5 text-cyan-500 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    <span className="text-white font-medium">
                      {enableFallback ? '활성화' : '비활성화'}
                    </span>
                  </label>
                  <div className="mt-2 text-xs text-slate-400">
                    번역 실패 시 다른 엔진 사용
                  </div>
                </div>
              </div>
            </div>

            {/* 옵션 설명 */}
            <div className="bg-slate-800/20 border border-slate-700/30 rounded-xl p-4">
              <h5 className="text-slate-200 font-semibold mb-3 flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>옵션 설명</span>
              </h5>
              <div className="space-y-2 text-sm text-slate-300">
                <div><span className="text-cyan-300 font-medium">자동:</span> 청크 크기와 텍스트 길이에 따라 최적 방식 선택</div>
                <div><span className="text-green-300 font-medium">SRT 직접:</span> SRT 형식 그대로 번역 (빠르고 정확)</div>
                <div><span className="text-orange-300 font-medium">구분자 방식:</span> 기존 방식 (안정적, 하위 호환)</div>
              </div>
            </div>
          </div>
        )}

        {translationProgress && (
          <div className="mt-6 p-4 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 text-blue-200 rounded-2xl animate-fadeIn">
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{translationProgress}</span>
            </div>
          </div>
        )}

        {downloadUrl && (
          <div className="mt-6 animate-fadeIn">
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>번역된 파일 다운로드</span>
            </a>
          </div>
        )}
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-200 rounded-2xl animate-fadeIn">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L5.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="font-semibold">{error}</span>
          </div>
        </div>
      )}
    </div>
  )
} 