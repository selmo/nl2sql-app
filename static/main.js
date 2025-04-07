document.addEventListener('DOMContentLoaded', () => {
  // ① HTML 요소 참조
  const dbSchemaEl = document.getElementById('dbSchema');
  const userQuestionEl = document.getElementById('userQuestion');
  const modelSelectEl = document.getElementById('modelSelect');
  const generateBtn = document.getElementById('generateBtn');
  const clearInputsBtn = document.getElementById('clearInputsBtn');
  const clearOutputBtn = document.getElementById('clearOutputBtn');
  const loadExamplesBtn = document.getElementById('loadExamplesBtn');
  const examplesContainerEl = document.getElementById('examplesContainer');
  const sqlResultEl = document.getElementById('sqlResult');
  const debugRequestEl = document.getElementById('debugRequest');
  const debugResponseEl = document.getElementById('debugResponse');

  // ② 페이지 로드 시, 모델 목록 미리 불러오기
  loadModels();

  // ③ "SQL 생성" 버튼 클릭 시 로직
  generateBtn.addEventListener('click', () => {
    // 3-1) 사용자 입력값 수집
    const dbSchema = dbSchemaEl.value.trim();
    const userQuestion = userQuestionEl.value.trim();
    const modelName = modelSelectEl.value;

    // 3-2) Request payload (서버에 보낼 JSON)
    const payload = {
      db_schema: dbSchema,
      question: userQuestion,
      model_name: modelName
    };

    // 3-3) 디버그용: Request 출력
    debugRequestEl.textContent = JSON.stringify(payload, null, 2);

    // 3-4) /generate 요청
    fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP Error: ${res.status}`);
        }
        const rawText = await res.text();
        // 디버그: Raw Response
        debugResponseEl.textContent = rawText;

        // JSON 파싱 시도
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (err) {
          console.error('JSON 파싱 오류:', err);
          sqlResultEl.value = 'JSON 파싱 오류: ' + err.message;
          return;
        }
        return data;
      })
      .then((data) => {
        if (!data) return; // 이전 단계에서 에러가 있었을 수도 있음

        if (data.error) {
          sqlResultEl.value = '에러: ' + data.error;
        } else if (data.sql) {
          sqlResultEl.value = data.sql;
        } else {
          sqlResultEl.value = '(SQL이 없습니다)';
        }
      })
      .catch((err) => {
        console.error('fetch 요청 실패:', err);
        sqlResultEl.value = '요청 실패: ' + err.message;
      });
  });

  // ④ "입력창 초기화" 버튼 클릭 시
  clearInputsBtn.addEventListener('click', () => {
    dbSchemaEl.value = '';
    userQuestionEl.value = '';
  });

  // ⑤ "응답 지우기" 버튼 클릭 시
  clearOutputBtn.addEventListener('click', () => {
    sqlResultEl.value = '';
    debugRequestEl.textContent = '';
    debugResponseEl.textContent = '';
  });

  // ⑥ "예제 보기" 버튼 클릭 시
  loadExamplesBtn.addEventListener('click', () => {
    // 토글 방식: 예제 영역 열려 있으면 닫고, 닫혀 있으면 불러오기
    if (examplesContainerEl.style.display === 'none') {
      examplesContainerEl.style.display = 'block';
      fetchExamples(); // 이 때 예제를 로딩
    } else {
      examplesContainerEl.style.display = 'none';
    }
  });

  // ⑦ 예제 불러오기
  function fetchExamples() {
    fetch('/examples')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('[DEBUG] Examples:', data);
        renderExamples(data);
      })
      .catch(err => {
        console.error('예제 로딩 실패:', err);
      });
  }

  function renderExamples(examples) {
    examplesContainerEl.innerHTML = '';
    examples.forEach((ex, idx) => {
      const button = document.createElement('button');
      button.textContent = `예제 ${idx + 1}`;
      button.addEventListener('click', () => {
        dbSchemaEl.value = ex.db_schema;
        userQuestionEl.value = ex.question;
      });
      examplesContainerEl.appendChild(button);
      examplesContainerEl.appendChild(document.createElement('br'));
    });
  }

  // ⑧ 모델 불러오기
  function loadModels() {
    fetch('/models')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log('[DEBUG] Models:', data);
      // 예: select 요소에 옵션 추가
      data.forEach(modelInfo => {
        const option = document.createElement('option');
        option.value = modelInfo.name;      // e.g. "phi4:14b"
        option.textContent = modelInfo.name;
        modelSelectEl.appendChild(option);
      });
    })
    .catch(err => {
      console.error('모델 로딩 실패:', err);
    });
  }
});
