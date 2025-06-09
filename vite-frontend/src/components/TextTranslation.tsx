import { useState, useEffect } from 'react'

interface Engine {
  id: string
  name: string
}

interface Language {
  code: string
  name: string
  nativeName: string
}

export default function TextTranslation() {
  const [text, setText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('')
  const [targetLang, setTargetLang] = useState('ko')
  const [engine, setEngine] = useState('ollama-alma')
  const [engines, setEngines] = useState<Engine[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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

  const handleTranslate = async () => {
    if (!text.trim()) {
      setError('번역할 텍스트를 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/translation-api/translation/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          targetLang,
          sourceLang: sourceLang || undefined,
          engine
        })
      })

      const data = await response.json()

      if (data.success) {
        setTranslatedText(data.data.translatedText)
      } else {
        setError(data.error || '번역 중 오류가 발생했습니다.')
      }
    } catch (error) {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwapLanguages = () => {
    if (sourceLang && targetLang) {
      const temp = sourceLang
      setSourceLang(targetLang)
      setTargetLang(temp)
      setText(translatedText)
      setTranslatedText(text)
    }
  }

  return (
    <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
      {/* 설정 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                  {lang.name} ({lang.nativeName})
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
                  {lang.name} ({lang.nativeName})
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
      </div>

      {/* 번역 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 원본 텍스트 */}
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <label className="text-slate-200 font-semibold text-lg flex items-center space-x-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>원본 텍스트</span>
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full">
                {text.length}/5000
              </span>
            </div>
          </div>
          <div className="relative group">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="번역할 텍스트를 입력하세요..."
              maxLength={5000}
              className="w-full h-80 px-6 py-4 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 resize-none group-hover:bg-slate-800/40"
            />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          </div>
        </div>

        {/* 번역 결과 */}
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <label className="text-slate-200 font-semibold text-lg flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>번역 결과</span>
            </label>
            <div className="flex items-center space-x-2">
              {translatedText && (
                <button
                  onClick={() => {
                    const engineName = engines.find(e => e.id === engine)?.name.replace(/Ollama\s/g, '').replace(/\s*\([^)]*\)/g, '') || engine;
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const filename = `translation_${sourceLang || 'auto'}_to_${targetLang}_${engineName}_${timestamp}.txt`;
                    const content = `Original Text (${sourceLang || 'auto'}):\n${text}\n\n---\n\nTranslated Text (${targetLang}):\n${translatedText}\n\nTranslation Engine: ${engines.find(e => e.id === engine)?.name || engine}\nTimestamp: ${new Date().toISOString()}`;
                    const blob = new Blob([content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center space-x-2 text-sm text-green-300 hover:text-green-200 bg-green-600/20 hover:bg-green-600/30 px-3 py-1 rounded-full transition-all duration-300 hover:scale-105"
                  title="번역 결과 저장"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>저장</span>
                </button>
              )}
              {sourceLang && targetLang && (
                <button
                  onClick={handleSwapLanguages}
                  className="flex items-center space-x-2 text-sm text-purple-300 hover:text-purple-200 bg-purple-600/20 hover:bg-purple-600/30 px-3 py-1 rounded-full transition-all duration-300 hover:scale-105"
                  title="언어 바꾸기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>바꾸기</span>
                </button>
              )}
            </div>
          </div>
          <div className="relative group">
            <textarea
              value={translatedText}
              readOnly
              placeholder="번역 결과가 여기에 표시됩니다..."
              className="w-full h-80 px-6 py-4 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl text-white placeholder-slate-400 resize-none cursor-default"
            />
            {translatedText && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-500/10 to-blue-500/10 opacity-100 pointer-events-none"></div>
            )}
          </div>
        </div>
      </div>

      {/* 번역 버튼 */}
      <div className="mt-8 text-center">
        <button
          onClick={handleTranslate}
          disabled={isLoading || !text.trim()}
          className="relative inline-flex items-center justify-center px-12 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-lg rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
          
          {isLoading ? (
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>번역 중...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>번역하기</span>
            </div>
          )}
        </button>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="mt-6 p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-200 rounded-2xl animate-fadeIn">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L5.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  )
} 