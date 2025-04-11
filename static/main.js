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

  // 서버 URL 및 체크박스
  const serverUrlEl = document.getElementById('serverUrl');
  const evalUrlEl = document.getElementById('evalUrl');
  const useSameUrlCheckbox = document.getElementById('useSameUrl');

  // 모델 선택: 생성용
  const modelSelectEl = document.getElementById('modelSelect');
  const updateModelsBtn = document.getElementById('updateModelsBtn');
  const updateEvalModelsBtn = document.getElementById('updateEvalModelsBtn');
  const updateAllModelsBtn = document.getElementById('updateAllModelsBtn');

  // 모델 선택: 비교용
  const compareModelSelectEl = document.getElementById('compareModelSelect');

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

  // 페이지 로드 시, serverUrl 기본값
  serverUrlEl.value = 'localhost';
  evalUrlEl.value = 'localhost';

  // ---------------------------
  // (C) URL 동기화 체크박스 처리
  // ---------------------------
  useSameUrlCheckbox.addEventListener('change', () => {
    if (useSameUrlCheckbox.checked) {
      // 생성용 URL을 검증용 URL에 복사
      evalUrlEl.value = serverUrlEl.value;
      evalUrlEl.disabled = true;
    } else {
      evalUrlEl.disabled = false;
    }
  });

  // 생성용 URL이 변경될 때 체크박스 상태에 따라 검증용 URL도 업데이트
  serverUrlEl.addEventListener('input', () => {
    if (useSameUrlCheckbox.checked) {
      evalUrlEl.value = serverUrlEl.value;
    }
  });

  // ---------------------------
  // (C) 모델 업데이트 함수
  // ---------------------------
  // 모델 리스트를 가져오는 공통 함수
  async function fetchModelList(serverUrl, targetSelect) {
    const unifiedUrl = unifyServerUrl(serverUrl);

    try {
      const res = await fetch(`/models?serverUrl=${encodeURIComponent(unifiedUrl)}`);
      if (!res.ok) throw new Error('HTTP Error: ' + res.status);

      const data = await res.json();
      console.log(`[DEBUG] 모델 목록 (${serverUrl}):`, data);

      // 기존 옵션 지우기
      targetSelect.innerHTML = '';

      // 새 옵션 추가
      data.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        targetSelect.appendChild(opt);
      });

      return true;
    } catch (err) {
      console.error(`모델 로딩 실패 (${serverUrl}):`, err);
      alert(`모델 로딩 실패 (${serverUrl}): ${err.message}`);
      return false;
    }
  }

  // ---------------------------
  // (D) 생성 모델 업데이트
  // ---------------------------
  updateModelsBtn.addEventListener('click', () => {
    fetchModelList(serverUrlEl.value, modelSelectEl);
  });

  // ---------------------------
  // (E) 검증 모델 업데이트
  // ---------------------------
  updateEvalModelsBtn.addEventListener('click', () => {
    // 체크박스 상태에 따라 서버 URL 선택
    const serverUrl = useSameUrlCheckbox.checked ? serverUrlEl.value : evalUrlEl.value;
    fetchModelList(serverUrl, compareModelSelectEl);
  });

  // ---------------------------
  // (F) 모든 모델 업데이트
  // ---------------------------
  updateAllModelsBtn.addEventListener('click', async () => {
    // 생성 모델 업데이트
    await fetchModelList(serverUrlEl.value, modelSelectEl);

    // 검증 모델 업데이트 (체크박스 상태에 따라 서버 URL 선택)
    const evalServer = useSameUrlCheckbox.checked ? serverUrlEl.value : evalUrlEl.value;
    await fetchModelList(evalServer, compareModelSelectEl);
  });

  // ---------------------------
  // (G) 기본 모델 목록 로딩
  // ---------------------------
  function loadModels() {
    // 서버 쪽에서 기본값(예: localhost:11434)으로 모델 목록
    fetchModelList('localhost', modelSelectEl);
    fetchModelList('localhost', compareModelSelectEl);
  }

  // ---------------------------
  // (H) SQL 생성
  // ---------------------------
  generateBtn.addEventListener('click', () => {
    debugRequestEl.textContent = '';
    debugResponseEl.textContent = '';

    const unifiedUrl = unifyServerUrl(serverUrlEl.value);

    const payload = {
      db_schema: dbSchemaEl.value.trim(),
      question: userQuestionEl.value.trim(),
      model_name: modelSelectEl.value,
      server_url: unifiedUrl
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
  // (I) 무작위 예제 불러오기
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
  // (J) LLM 비교 버튼
  // ---------------------------
  compareLLMBtn.addEventListener('click', () => {
    debugRequestEl.textContent = '';
    debugResponseEl.textContent = '';

    // 체크박스 상태에 따라 서버 URL 선택
    const evalServer = useSameUrlCheckbox.checked ? serverUrlEl.value : evalUrlEl.value;
    const unifiedEvalUrl = unifyServerUrl(evalServer);

    const payload = {
      db_schema: dbSchemaEl.value.trim(),
      question: userQuestionEl.value.trim(),
      model_name: compareModelSelectEl.value,  // 검증 모델 사용
      server_url: unifiedEvalUrl,  // 검증 서버 URL 사용
      gtSql: expectedSqlEl.value.trim(),
      genSql: sqlResultEl.value.trim()
    };

    debugRequestEl.textContent = JSON.stringify(payload, null, 2);

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
  // (K) 입력창 초기화
  // ---------------------------
  clearInputsBtn.addEventListener('click', () => {
    dbSchemaEl.value = '';
    userQuestionEl.value = '';
    expectedSqlEl.value = '';
    sqlResultEl.value = '';
    compareResultEl.textContent = '';
  });

  // ---------------------------
  // (L) 응답 지우기
  // ---------------------------
  clearOutputBtn.addEventListener('click', () => {
    sqlResultEl.value = '';
    debugRequestEl.textContent = '';
    debugResponseEl.textContent = '';
    compareResultEl.textContent = '';
  });

  // ---------------------------
  // (M) 페이지 로드 시 기본 모델 목록 불러오기
  // ---------------------------
  loadModels();
});