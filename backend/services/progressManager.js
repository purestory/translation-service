class ProgressManager {
  constructor() {
    this.progressData = {};
  }

  initializeProgress(fileId, totalEntries, totalCharacters) {
    this.progressData[fileId] = {
      status: 'processing',
      progress: 0,
      totalEntries: totalEntries,
      processedEntries: 0,
      totalCharacters: totalCharacters,
      processedCharacters: 0,
      startTime: Date.now(),
      currentChunk: 0,
      totalChunks: 0,
      estimatedTimeRemaining: 0,
      averageCharsPerSecond: 0,
      message: '번역 준비 중...'
    };
    
    console.log(`📊 진행 상태 초기화: ${fileId} (${totalEntries}개 자막, ${totalCharacters}자)`);
    return this.progressData[fileId];
  }

  updateProgress(fileId, options) {
    if (!this.progressData[fileId]) {
      console.warn(`⚠️ 진행 상태 없음: ${fileId}`);
      return;
    }

    const {
      processedEntries,
      processedCharacters,
      currentChunk,
      totalChunks,
      customMessage
    } = options;

    const progress = this.progressData[fileId];
    
    if (processedEntries !== undefined) {
      progress.processedEntries = processedEntries;
    }
    
    if (processedCharacters !== undefined) {
      progress.processedCharacters = processedCharacters;
    }
    
    if (currentChunk !== undefined) {
      progress.currentChunk = currentChunk;
    }
    
    if (totalChunks !== undefined) {
      progress.totalChunks = totalChunks;
    }

    // 진행률 계산
    progress.progress = Math.round((progress.processedEntries / progress.totalEntries) * 100);
    
    // 성능 통계 계산
    const elapsedTime = Date.now() - progress.startTime;
    progress.averageCharsPerSecond = Math.round(progress.processedCharacters / (elapsedTime / 1000));
    
    const remainingChars = progress.totalCharacters - progress.processedCharacters;
    progress.estimatedTimeRemaining = progress.averageCharsPerSecond > 0 
      ? Math.round(remainingChars / progress.averageCharsPerSecond) 
      : 0;

    // 메시지 업데이트
    if (customMessage) {
      progress.message = customMessage;
    } else {
      progress.message = `진행률: ${progress.progress}% (${progress.processedEntries}/${progress.totalEntries}개) - 평균 ${progress.averageCharsPerSecond}자/초`;
    }

    console.log(`📈 진행 상태 업데이트: ${progress.progress}% (${progress.averageCharsPerSecond}자/초, 예상 남은 시간: ${progress.estimatedTimeRemaining}초)`);
    
    return progress;
  }

  setChunkStatus(fileId, chunkIndex, totalChunks, chunkSize, chunkChars) {
    if (this.progressData[fileId]) {
      this.progressData[fileId].currentChunk = chunkIndex;
      this.progressData[fileId].totalChunks = totalChunks;
      this.progressData[fileId].message = `청크 ${chunkIndex}/${totalChunks} 번역 중... (${chunkSize}개 자막, ${chunkChars}자)`;
    }
  }

  completeProgress(fileId, totalTime, finalCharsPerSecond) {
    if (!this.progressData[fileId]) {
      console.warn(`⚠️ 진행 상태 없음: ${fileId}`);
      return;
    }

    this.progressData[fileId] = {
      ...this.progressData[fileId],
      status: 'completed',
      progress: 100,
      processedEntries: this.progressData[fileId].totalEntries,
      processedCharacters: this.progressData[fileId].totalCharacters,
      totalTime: totalTime,
      averageCharsPerSecond: finalCharsPerSecond,
      message: '번역 완료'
    };

    console.log(`✅ 번역 완료: ${fileId} (${totalTime}ms, ${finalCharsPerSecond}자/초)`);

    // 24시간 후 진행 상태 정보 삭제
    setTimeout(() => {
      delete this.progressData[fileId];
      console.log(`🗑️ 진행 상태 자동 삭제: ${fileId}`);
    }, 86400000); // 24시간

    return this.progressData[fileId];
  }

  setError(fileId, errorMessage) {
    if (this.progressData[fileId]) {
      this.progressData[fileId].status = 'error';
      this.progressData[fileId].message = errorMessage;
      console.error(`❌ 번역 오류: ${fileId} - ${errorMessage}`);
    }
  }

  getProgress(fileId) {
    return this.progressData[fileId] || null;
  }

  getAllProgress() {
    return this.progressData;
  }

  clearProgress(fileId) {
    if (this.progressData[fileId]) {
      delete this.progressData[fileId];
      console.log(`🗑️ 진행 상태 삭제: ${fileId}`);
    }
  }
}

// 싱글톤 인스턴스 생성
const progressManager = new ProgressManager();

module.exports = progressManager; 