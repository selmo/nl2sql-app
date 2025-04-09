// main.js
document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------
  // (A) 서버 주소 정규화 함수
  // ---------------------------
  function unifyServerUrl(input) {
    if (!input || !input.trim()) {
      return 'http://localhost:11434';
    }
    let url = input.trim();
    if (url.toLowerCase() === 'localhost') {
      return 'http://localhost:11434';
    }
    if (!/^http:\/\//i.test(url) && !/^https:\/\//i.test(url)) {
      url = 'http://' + url;
    }
    try {
      const parsed = new URL(url);
      if (!parsed.port) {
        parsed.port = '11434';
      }
      return parsed.toString();
    } catch (err) {
      console.warn('URL 파싱 실패:', err);
      return 'http://localhost:11434';
    }
  }

  // ---------------------------
  // (B) HTML 요소 참조
  // ---------------------------
  // 스키마, 질문, (GT)예상 SQL
  const dbSchemaEl = document.getElementById('dbSchema');
  const userQuestionEl = document.getElementById('userQuestion');
  const expectedSqlEl = document.getElementById('expectedSql');

  // 생성된 SQL
  const sqlResultEl = document.getElementById('sqlResult');

  // 모델 선택: 생성용
  const modelSelectEl = document.getElementById('modelSelect');
  const updateModelsBtn = document.getElementById('updateModelsBtn');

  // 모델 선택: 비교용 (새로 추가)
  const compareModelSelectEl = document.getElementById('compareModelSelect');
  const updateCompareModelsBtn = document.getElementById('updateCompareModelsBtn');

  // 버튼: SQL 생성, 예제 불러오기, 비교(LLM), 초기화, 응답지우기
  const generateBtn = document.getElementById('generateBtn');
  const clearInputsBtn = document.getElementById('clearInputsBtn');
  const clearOutputBtn = document.getElementById('clearOutputBtn');
  const loadExamplesBtn = document.getElementById('loadExamplesBtn');
  const compareLLMBtn = document.getElementById('compareLLMBtn');

  // 디버그/출력
  const debugRequestEl = document.getElementById('debugRequest');
  const debugResponseEl = document.getElementById('debugResponse');
  const compareResultEl = document.getElementById('compareResult');
  const serverUrlEl = document.getElementById('serverUrl');

  // 페이지 로드 시, serverUrl 기본값
  serverUrlEl.value = 'localhost';

  // ---------------------------
  // (C) 생성 모델 업데이트
  // ---------------------------
  updateModelsBtn.addEventListener('click', () => {
    const unifiedUrl = unifyServerUrl(serverUrlEl.value);

    fetch(`/models?serverUrl=${encodeURIComponent(unifiedUrl)}`)
      .then(res => {
        if (!res.ok) throw new Error('HTTP Error: ' + res.status);
        return res.json();
      })
      .then(data => {
        console.log('[DEBUG] 생성 모델 목록:', data);
        modelSelectEl.innerHTML = '';
        data.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.name;
          opt.textContent = m.name;
          modelSelectEl.appendChild(opt);
        });
      })
      .catch(err => {
        console.error('생성 모델 로딩 실패:', err);
        alert('생성 모델 로딩 실패: ' + err.message);
      });
  });

  // ---------------------------
  // (D) 비교 모델 업데이트
  // ---------------------------
  updateCompareModelsBtn.addEventListener('click', () => {
    const unifiedUrl = unifyServerUrl(serverUrlEl.value);

    // 예시: /models?serverUrl=... 에서 목록을 받아, "비교 모델" select에 표시
    fetch(`/models?serverUrl=${encodeURIComponent(unifiedUrl)}`)
      .then(res => {
        if (!res.ok) throw new Error('HTTP Error: ' + res.status);
        return res.json();
      })
      .then(data => {
        console.log('[DEBUG] 비교 모델 목록:', data);
        compareModelSelectEl.innerHTML = '';
        data.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.name;
          opt.textContent = m.name;
          compareModelSelectEl.appendChild(opt);
        });
      })
      .catch(err => {
        console.error('비교 모델 로딩 실패:', err);
        alert('비교 모델 로딩 실패: ' + err.message);
      });
  });

  // ---------------------------
  // (E) 기본 모델 목록 로딩
  // ---------------------------
  function loadModels() {
    // 서버 쪽에서 기본값(예: localhost:11434)으로 모델 목록
    fetch('/models')
      .then(res => {
        if (!res.ok) throw new Error('HTTP Error: ' + res.status);
        return res.json();
      })
      .then(data => {
        console.log('[DEBUG] 기본 생성 모델 목록:', data);
        modelSelectEl.innerHTML = '';
        data.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.name;
          opt.textContent = m.name;
          modelSelectEl.appendChild(opt);
        });
      })
      .catch(err => {
        console.error('기본 모델 로딩 실패:', err);
      });

    // 비교 모델도 비슷하게 로딩 가능 (원한다면)
    // 여기는 필요 시 자동 로딩하거나, "비교 모델 업데이트" 버튼을 눌러 수동으로 로딩
  }

  // ---------------------------
  // (F) SQL 생성 (기존 로직)
  // ---------------------------
  generateBtn.addEventListener('click', () => {
    // 1) server_url 추가
    const unifiedUrl = unifyServerUrl(serverUrlEl.value);

    const payload = {
      db_schema: dbSchemaEl.value.trim(),
      question: userQuestionEl.value.trim(),
      model_name: modelSelectEl.value,
      server_url: unifiedUrl   // 여기 추가
    };

    debugRequestEl.textContent = JSON.stringify(payload, null, 2);

    fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) {
          throw new Error('HTTP Error: ' + res.status);
        }
        const rawText = await res.text();
        debugResponseEl.textContent = rawText;

        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          console.error('JSON 파싱 오류:', e);
          sqlResultEl.value = 'JSON 파싱 오류: ' + e.message;
          return;
        }
        return data;
      })
      .then(data => {
        if (!data) return;
        if (data.error) {
          sqlResultEl.value = '에러: ' + data.error;
        } else if (data.sql) {
          sqlResultEl.value = data.sql;
        } else {
          sqlResultEl.value = '(SQL이 없습니다)';
        }
      })
      .catch(err => {
        console.error('생성 요청 실패:', err);
        sqlResultEl.value = '생성 실패: ' + err.message;
      });
  });

  // ---------------------------
  // (G) 무작위 예제 불러오기
  // ---------------------------
  loadExamplesBtn.addEventListener('click', () => {
    fetch('/examples')
      .then(res => {
        if (!res.ok) throw new Error('HTTP Error: ' + res.status);
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          alert('예제가 없습니다!');
          return;
        }
        const idx = Math.floor(Math.random() * data.length);
        const ex = data[idx];
        dbSchemaEl.value = ex.db_schema || '';
        userQuestionEl.value = ex.question || '';
        // "예상 SQL"로 ex.sql 사용
        expectedSqlEl.value = ex.sql || '';
      })
      .catch(err => {
        console.error('예제 로딩 실패:', err);
        alert('예제 로딩 실패: ' + err.message);
      });
  });

  // ---------------------------
  // (H) LLM 비교 버튼
  // ---------------------------
  compareLLMBtn.addEventListener('click', () => {
     // 1) server_url 추가
    const payload = {
      db_schema: dbSchemaEl.value.trim(),
      question: userQuestionEl.value.trim(),
      model_name: modelSelectEl.value,
      server_url: unifyServerUrl(serverUrlEl.value),
      gtSql: expectedSqlEl.value.trim(),
      genSql: sqlResultEl.value.trim()
    };


    debugRequestEl.textContent = JSON.stringify(payload, null, 2);

    // /compareLLM 라우팅 예시로 호출
    fetch('/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(async res => {
      if (!res.ok) {
        throw new Error('HTTP Error: ' + res.status);
      }
      const rawText = await res.text();
      debugResponseEl.textContent = rawText;

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error('JSON 파싱 오류:', e);
        compareResultEl.textContent = 'JSON 파싱 오류: ' + e.message;
        return;
      }
      return data;
    })
    .then(data => {
      if (!data) return;
      // data는 예: {"resolve_yn":"yes"} 또는 {"resolve_yn":"no"}
      if (data.resolve_yn === 'yes') {
        compareResultEl.textContent = '✅ LLM 비교 결과: 동일(기능적으로 같음).';
      } else if (data.resolve_yn === 'no') {
        compareResultEl.textContent = '❌ LLM 비교 결과: 다름.';
      } else {
        compareResultEl.textContent = '결과 해석 불가: ' + JSON.stringify(data);
      }
    })
    .catch(err => {
      console.error('LLM 비교 요청 실패:', err);
      compareResultEl.textContent = 'LLM 비교 실패: ' + err.message;
    });
  });

  // ---------------------------
  // (I) 입력창 초기화
  // ---------------------------
  clearInputsBtn.addEventListener('click', () => {
    dbSchemaEl.value = '';
    userQuestionEl.value = '';
    expectedSqlEl.value = '';
    sqlResultEl.value = '';
    compareResultEl.textContent = '';
  });

  // ---------------------------
  // (J) 응답 지우기
  // ---------------------------
  clearOutputBtn.addEventListener('click', () => {
    sqlResultEl.value = '';
    debugRequestEl.textContent = '';
    debugResponseEl.textContent = '';
    compareResultEl.textContent = '';
  });

  // ---------------------------
  // (K) 페이지 로드 시 기본 모델 목록 불러오기
  // ---------------------------
  loadModels();
});