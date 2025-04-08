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
  // [추가] 서버URL 입력 필드, 모델 업데이트 버튼
  const serverUrlEl = document.getElementById('serverUrl');
  const updateModelsBtn = document.getElementById('updateModelsBtn');

  // 페이지 로드 시, 일단 기본 모델 목록 불러오기
  // (원래 loadModels()가 172.16.15.112:11434 고정으로 응답하던 상황이라면
  //  서버 쪽에서 그 부분을 수정해주면 됨. 아래 예시는 serverUrl 없이 호출)
  loadModels();

  // ① “모델 업데이트” 버튼 클릭 시
  updateModelsBtn.addEventListener('click', () => {
    const userInputUrl = serverUrlEl.value.trim();
    if (!userInputUrl) {
      alert('서버 URL(또는 IP)을 입력해주세요.');
      return;
    }
    // 쿼리 파라미터로 전달
    fetch(`/models?serverUrl=${encodeURIComponent(userInputUrl)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('[DEBUG] Models from user-input server:', data);
        // select 요소 비우고 새로 채움
        modelSelectEl.innerHTML = '';
        data.forEach(modelInfo => {
          const option = document.createElement('option');
          option.value = modelInfo.name;
          option.textContent = modelInfo.name;
          modelSelectEl.appendChild(option);
        });
      })
      .catch(err => {
        console.error('모델 로딩 실패:', err);
        alert('모델 목록 로딩 실패: ' + err.message);
      });
  });

  // ② 기존에 있던 loadModels() 함수 (기본 서버에서 모델 불러오기)
  function loadModels() {
    fetch('/models') // 여기서는 serverUrl 파라미터 없이, 로컬서버 기본 설정 사용
      .then(res => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('[DEBUG] Models:', data);
        data.forEach(modelInfo => {
          const option = document.createElement('option');
          option.value = modelInfo.name;
          option.textContent = modelInfo.name;
          modelSelectEl.appendChild(option);
        });
      })
      .catch(err => {
        console.error('모델 로딩 실패:', err);
      });
  }

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
