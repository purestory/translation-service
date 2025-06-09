# 번역 서비스 (Translation Service)

AI 기반 다중 엔진 번역 웹 서비스 - GPU 가속 로컬 AI 모델 특화

## 🌐 서비스 접속

- **웹 사이트**: http://itsmyzone.iptime.org/translation/
- **API**: http://itsmyzone.iptime.org/translation-api/

## 🏗️ 서비스 구조

```
번역 서비스
├── 프론트엔드: React + Vite → nginx (포트 80/443)
├── 백엔드: Node.js Express → systemd (포트 3501)
└── AI 모델: Ollama Docker Container → GPU 가속 (포트 11434)
```

## 🤖 지원 번역 엔진

### GPU 가속 Ollama 모델 (우선순위)
1. **ollama-gemma2-sapie** (기본값) - 한국어 특화 Sapie 모델
2. **ollama-kanana-1.5** - Kakao Corp. Kanana 1.5-8B (BF16+Q8_0, 9.5GB)
3. **ollama-exaone3.5** - LG AI Research Exaone 3.5 (한국어 특화)
4. **ollama-gemma2** - Google Gemma2 9B
5. **ollama-hyperclovax** - Naver HyperCLOVAX 3B (한국어 특화)
6. **ollama-hyperclovax-1.5b** - Naver HyperCLOVAX 1.5B (경량화)

### 클라우드 API 모델 (대체 엔진)
- **Google Gemini** - 고품질 다국어 번역
- **Groq Llama** - 고속 추론
- **OpenAI GPT** - 자연스러운 번역
- **Anthropic Claude** - 문맥 이해 우수
- **DeepL** - 전문 번역 서비스

## 🔧 하드웨어 사양

### GPU 정보
- **모델**: NVIDIA RTX 3090
- **VRAM**: 24GB
- **CUDA**: 12.8
- **컴퓨트 능력**: 8.6 (BF16 지원)

### AI 모델 현황
```bash
# 설치된 모델 확인
curl -s http://localhost:11434/api/tags | jq '.models[].name'

# GPU 사용량 확인
nvidia-smi
```

## 🔧 서비스 관리

### 상태 확인
```bash
# 번역 서비스 상태
sudo systemctl status translation-service

# Ollama 컨테이너 상태
sudo docker ps | grep ollama

# GPU 사용량
nvidia-smi

# 서비스 로그
sudo journalctl -u translation-service -f --no-pager
```

### 서비스 제어
```bash
# 번역 서비스 재시작
sudo systemctl restart translation-service

# Ollama 컨테이너 재시작
sudo docker restart ollama

# 전체 시스템 재시작
sudo systemctl restart translation-service
sudo docker restart ollama
sudo nginx -s reload
```

## 🛠️ 개발 및 배포

### 1. 프론트엔드 수정시
```bash
cd /home/purestory/translation-service/vite-frontend
# 코드 수정 후
npm run build
cd .. && sudo nginx -s reload
```

### 2. 백엔드 수정시
```bash
cd /home/purestory/translation-service/backend
# 코드 수정 후
sudo systemctl restart translation-service
```

### 3. AI 모델 추가시
```bash
# 새 모델 다운로드
sudo docker exec ollama ollama pull <model_name>

# 커스텀 모델 등록
sudo docker exec ollama ollama create <custom_name> -f /path/to/Modelfile

# 백엔드에서 엔진 추가 후 재시작 필요
```

## 📁 프로젝트 구조

```
/home/purestory/translation-service/
├── backend/               # Node.js 백엔드
│   ├── server.js         # 메인 서버
│   ├── routes/           # API 라우트
│   │   └── translation.js # 번역 API
│   ├── services/         # 번역 서비스
│   │   └── translationService.js # 메인 번역 로직
│   └── uploads/          # 업로드 파일
├── vite-frontend/        # React 프론트엔드
│   ├── src/              # 소스 코드
│   │   └── App.tsx       # 메인 컴포넌트
│   └── dist/             # 빌드 결과 (nginx 서빙)
├── /home/purestory/ollama/models/ # AI 모델 저장소
└── README.md
```

## 🚨 문제 해결

### 번역이 안될 때
1. 서비스 상태 확인: `sudo systemctl status translation-service`
2. Ollama 상태 확인: `sudo docker ps | grep ollama`
3. GPU 메모리 확인: `nvidia-smi`
4. 로그 확인: `sudo journalctl -u translation-service -n 20`
5. 서비스 재시작: `sudo systemctl restart translation-service`

### GPU 메모리 부족시
```bash
# GPU 메모리 사용량 확인
nvidia-smi

# Ollama 컨테이너 재시작 (모델 언로드)
sudo docker restart ollama

# 무거운 모델 제거
sudo docker exec ollama ollama rm <heavy_model>
```

### 웹사이트가 안 열릴 때
1. nginx 상태 확인: `sudo systemctl status nginx`
2. 빌드 파일 확인: `ls -la /home/purestory/translation-service/vite-frontend/dist/`
3. 포트 확인: `lsof -i :80,443,3501`
4. nginx 재로드: `sudo nginx -s reload`

### 모델이 로드되지 않을 때
```bash
# 모델 목록 확인
curl -s http://localhost:11434/api/tags

# 특정 모델 정보 확인
curl -s http://localhost:11434/api/show -d '{"name": "model_name"}'

# 모델 강제 로드
curl -s http://localhost:11434/api/generate -d '{"model": "model_name", "prompt": "test"}'
```

## 📊 현재 운영 상황

### 🎯 활성 설정
- **기본 엔진**: `ollama-gemma2-sapie` (한국어 특화)
- **기본 청크 크기**: 10
- **기본 번역 모드**: srt_direct
- **최대 파일 크기**: 10MB
- **대체 엔진**: 활성화 (자동 폴백)

### 🚀 성능 최적화
- **GPU 가속**: RTX 3090 (24GB VRAM)
- **BF16 정밀도**: 지원됨
- **동시 번역**: 청크 단위 병렬 처리
- **실시간 진행률**: WebSocket 스타일 폴링

### 📈 모델 성능 순위 (한국어)
1. **Kanana 1.5** - Kakao (코딩/수학/함수호출 특화)
2. **Sapie** - 한국어 특화 Gemma2 튜닝
3. **Exaone 3.5** - LG AI Research (한국어)
4. **HyperCLOVAX** - Naver (한국어)

## ⚠️ 중요 운영 규칙

### ✅ 해야 할 것
- 코드 수정 후 반드시 테스트
- 절대 경로 사용 (`/home/purestory/...`)
- systemd로 서비스 관리
- Docker로 Ollama 관리
- GPU 메모리 모니터링

### ❌ 하지 말 것
- `~` 경로 사용 (의도치 않은 폴더 생성)
- pm2 사용 (systemd 사용 중)
- 포트 번호 임의 변경
- Ollama 모델을 직접 삭제
- GPU 오버클럭 (안정성 우선)

## 🔑 지원 기능

### 번역 기능
- **다중 엔진**: 6개 로컬 AI + 5개 클라우드 API
- **자동 대체**: 엔진 실패시 자동 폴백
- **실시간 진행률**: 청크별 진행상황 표시
- **배치 번역**: 대용량 파일 안정 처리

### 자막 지원
- **파일 형식**: SRT, VTT, ASS
- **번역 모드**: 자동, SRT 직접, 구분자
- **타임스탬프**: 원본 유지
- **인코딩**: UTF-8 자동 변환

### API 기능
- **텍스트 번역**: `/translation-api/translation/text`
- **파일 번역**: `/translation-api/subtitle/translate`
- **엔진 목록**: `/translation-api/translation/engines`
- **언어 목록**: `/translation-api/translation/languages`
- **배치 번역**: `/translation-api/translation/batch`

## 🔄 업데이트 히스토리

### 2025-06-07 (최신)
- ✅ Kakao Kanana 1.5-8B 모델 추가 (BF16+Q8_0, 9.5GB)
- ✅ 기본 엔진을 sapie로 변경
- ✅ GPU BF16 지원 확인 및 최적화
- ✅ 엔진 우선순위 재조정 (한국어 특화 모델 우선)
- ✅ 대체 엔진 시스템 개선

### 2025-06-06
- ✅ Ollama GPU 마이그레이션 완료
- ✅ 복수 한국어 특화 모델 추가
- ✅ 실시간 번역 진행률 표시
- ✅ 청크 단위 안정적 번역 시스템

---

**마지막 업데이트**: 2025-06-07  
**버전**: 2.0.0  
**서버**: itsmyzone.iptime.org  
**GPU**: RTX 3090 24GB (CUDA 12.8) 