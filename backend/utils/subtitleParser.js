const fs = require('fs');
const path = require('path');

class SubtitleParser {
  // SRT 파일 파싱
  static parseSRT(content) {
    const entries = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        const index = parseInt(lines[0]);
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
        
        if (timeMatch) {
          const startTime = timeMatch[1];
          const endTime = timeMatch[2];
          const text = lines.slice(2).join('\n');
          
          entries.push({
            index,
            startTime,
            endTime,
            text: text.trim()
          });
        }
      }
    }

    return entries;
  }

  // SRT 파일 생성
  static generateSRT(entries) {
    return entries.map(entry => {
      return `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}\n`;
    }).join('\n');
  }

  // SMI 파일 파싱
  static parseSMI(content) {
    const entries = [];
    
    // SMI 태그 정규식
    const syncPattern = /<SYNC Start=(\d+)>/gi;
    const pPattern = /<P[^>]*>(.*?)<\/P>/gis;
    
    let match;
    const syncPoints = [];
    
    // SYNC 태그와 시간 정보 추출
    while ((match = syncPattern.exec(content)) !== null) {
      syncPoints.push({
        time: parseInt(match[1]),
        position: match.index
      });
    }

    // P 태그 내용 추출
    let pMatches = [];
    let pMatch;
    while ((pMatch = pPattern.exec(content)) !== null) {
      pMatches.push({
        text: pMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim(),
        position: pMatch.index
      });
    }

    // SYNC와 P 태그 매칭
    for (let i = 0; i < syncPoints.length; i++) {
      const currentSync = syncPoints[i];
      const nextSync = syncPoints[i + 1];
      
      // 현재 SYNC와 다음 SYNC 사이의 P 태그 찾기
      const relevantP = pMatches.find(p => 
        p.position > currentSync.position && 
        (!nextSync || p.position < nextSync.position)
      );

      if (relevantP && relevantP.text) {
        entries.push({
          index: i + 1,
          startTime: this.msToSRTTime(currentSync.time),
          endTime: nextSync ? this.msToSRTTime(nextSync.time) : this.msToSRTTime(currentSync.time + 3000),
          text: relevantP.text,
          originalStartMs: currentSync.time,
          originalEndMs: nextSync ? nextSync.time : currentSync.time + 3000
        });
      }
    }

    return entries;
  }

  // SMI 파일 생성
  static generateSMI(entries, title = 'Translated Subtitle') {
    let smi = `<SAMI>
<HEAD>
<TITLE>${title}</TITLE>
<STYLE TYPE="text/css">
<!--
P { margin-left:8pt; margin-right:8pt; margin-bottom:2pt; margin-top:2pt;
    font-size:12pt; text-align:center; font-family:굴림, Arial;
    font-weight:normal; color:white; }
.KRCC { Name:한국어; lang: ko-KR; SAMIType: CC; }
-->
</STYLE>
</HEAD>
<BODY>
`;

    for (const entry of entries) {
      const startMs = entry.originalStartMs || this.srtTimeToMs(entry.startTime);
      smi += `<SYNC Start=${startMs}><P Class=KRCC>${entry.text.replace(/\n/g, '<br>')}</P></SYNC>\n`;
    }

    smi += '</BODY>\n</SAMI>';
    return smi;
  }

  // VTT 파일 파싱
  static parseVTT(content) {
    const entries = [];
    const lines = content.split('\n');
    let currentEntry = null;
    let index = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 시간 코드 라인 확인
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);
      if (timeMatch) {
        if (currentEntry) {
          entries.push(currentEntry);
        }
        
        currentEntry = {
          index: index++,
          startTime: timeMatch[1].replace('.', ','), // SRT 형식으로 변환
          endTime: timeMatch[2].replace('.', ','),
          text: ''
        };
      } else if (currentEntry && line && !line.startsWith('NOTE') && line !== 'WEBVTT') {
        // 텍스트 라인
        if (currentEntry.text) {
          currentEntry.text += '\n' + line;
        } else {
          currentEntry.text = line;
        }
      } else if (line === '' && currentEntry) {
        // 빈 라인은 엔트리 끝
        entries.push(currentEntry);
        currentEntry = null;
      }
    }

    // 마지막 엔트리 추가
    if (currentEntry) {
      entries.push(currentEntry);
    }

    return entries;
  }

  // VTT 파일 생성
  static generateVTT(entries) {
    let vtt = 'WEBVTT\n\n';
    
    for (const entry of entries) {
      const startTime = entry.startTime.replace(',', '.');
      const endTime = entry.endTime.replace(',', '.');
      vtt += `${startTime} --> ${endTime}\n${entry.text}\n\n`;
    }

    return vtt;
  }

  // 파일 형식 자동 감지 및 파싱
  static parseSubtitle(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.srt':
        return { format: 'srt', entries: this.parseSRT(content) };
      case '.smi':
        return { format: 'smi', entries: this.parseSMI(content) };
      case '.vtt':
        return { format: 'vtt', entries: this.parseVTT(content) };
      default:
        throw new Error(`지원하지 않는 파일 형식: ${ext}`);
    }
  }

  // 자막 파일 생성
  static generateSubtitle(entries, format, options = {}) {
    switch (format.toLowerCase()) {
      case 'srt':
        return this.generateSRT(entries);
      case 'smi':
        return this.generateSMI(entries, options.title);
      case 'vtt':
        return this.generateVTT(entries);
      default:
        throw new Error(`지원하지 않는 출력 형식: ${format}`);
    }
  }

  // 시간 변환 유틸리티
  static msToSRTTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  static srtTimeToMs(timeStr) {
    const [time, ms] = timeStr.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + parseInt(ms);
  }

  // 자막 통계 정보
  static getSubtitleStats(entries) {
    const totalDuration = entries.length > 0 ? 
      this.srtTimeToMs(entries[entries.length - 1].endTime) - this.srtTimeToMs(entries[0].startTime) : 0;
    
    const totalChars = entries.reduce((sum, entry) => sum + entry.text.length, 0);
    const totalWords = entries.reduce((sum, entry) => sum + entry.text.split(/\s+/).length, 0);

    return {
      totalEntries: entries.length,
      totalDuration: Math.round(totalDuration / 1000), // seconds
      totalCharacters: totalChars,
      totalWords: totalWords,
      averageCharactersPerEntry: Math.round(totalChars / entries.length) || 0,
      averageWordsPerEntry: Math.round(totalWords / entries.length) || 0
    };
  }
}

module.exports = SubtitleParser; 