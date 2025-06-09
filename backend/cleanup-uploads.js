const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');

// uploads 폴더 정리 함수
function cleanupUploads() {
  try {
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ 삭제됨: ${file}`);
        }
      }
      
      console.log(`✅ uploads 폴더 정리 완료 (${files.length}개 파일 삭제)`);
    } else {
      // uploads 폴더가 없으면 생성
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📁 uploads 폴더 생성됨');
    }
  } catch (error) {
    console.error('❌ uploads 폴더 정리 중 오류:', error.message);
  }
}

// 스크립트가 직접 실행될 때
if (require.main === module) {
  console.log('🧹 uploads 폴더 정리 시작...');
  cleanupUploads();
}

module.exports = cleanupUploads; 