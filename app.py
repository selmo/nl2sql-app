from flask import Flask, request, jsonify, render_template
import json
import requests

app = Flask(__name__)

with open('examples.json', 'r', encoding='utf-8') as f:
    EXAMPLES = json.load(f)


@app.route('/')
def index():
    # 메인 페이지 로드
    return render_template('index.html')


@app.route('/models', methods=['GET'])
def get_models():
    """
    기존에는 특정 IP(172.16.15.112:11434)를 호출했으나,
    쿼리 파라미터로 전달된 serverUrl이 있으면 그 쪽을 우선 사용.
    """
    server_url = request.args.get('serverUrl', 'http://localhost:11434').strip()
    if not server_url:
        # serverUrl 파라미터가 없으면 기본값 사용 (예: 기존 IP)
        server_url = "http://172.16.15.112:11434"

    # 실제 호출할 엔드포인트
    ollama_endpoint = f"{server_url}/api/tags"

    try:
        resp = requests.get(ollama_endpoint, timeout=5)
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        print("[ERROR] ollama 서버 /api/tags 요청 실패:", e)
        return jsonify({"error": f"ollama 서버와 통신 중 문제가 발생했습니다: {str(e)}"}), 500

    # ollama 서버 응답이 {"models": [...]} 구조라면:
    tags_data = resp.json()
    # tags_data 내부 구조에 맞게 가공
    processed = []
    if "models" in tags_data:
        for item in tags_data["models"]:
            processed.append({"name": item["name"]})
    else:
        # 혹시 구조가 다르면 필요한 대로 파싱
        processed = tags_data  # 임시

    return jsonify(processed)


@app.route('/examples', methods=['GET'])
def get_examples():
    # 예: examples.json.bak 파일 읽어서 반환
    with open('examples.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)


@app.route('/generate', methods=['POST'])
def generate_sql():
    """
    1) 프론트엔드에서 db_schema, question, model_name 등을 받음
    2) LLM 서버로 POST (요청 형식: model, stream, prompt, format)
    3) LLM 서버 응답(raw_text)을 디버그용으로 서버 콘솔에 출력
    4) JSON 파싱(이중 JSON)하여 최종 gen_sql 추출
    5) {"sql": "...", "debug_response": "..."} 형태로 프론트엔드에 전송
    """
    data = request.json
    db_schema = data.get('db_schema', '')
    user_question = data.get('question', '')
    model_name = data.get('model_name', '')

    # 1) 추가: server_url 받기
    server_url = data.get('server_url', 'http://localhost:11434')

    # 1) Prompt 문자열 구성
    prompt_str = f"""You are a SQL generator. Convert natural language to SQL.
INPUT:
- Question: {user_question}
- Schema: {db_schema}

RULES:
- Return ONLY valid JSON with the SQL query
- Use only tables and columns from the schema
- No explanations or comments

EXAMPLE:
Question: "Find employees in Sales department"
Schema: 
CREATE TABLE employees (id INTEGER PRIMARY KEY, name VARCHAR(100), department_id INTEGER);
CREATE TABLE departments (id INTEGER PRIMARY KEY, name VARCHAR(50));

Output:
{{
  "gen_sql": "SELECT e.* FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.name = 'Sales'"
}}

OUTPUT FORMAT:
{{
  "gen_sql": "<SQL query>"
}}"""

    # 2) LLM 서버로 보낼 request payload
    request_payload = {
        "model": model_name,
        "stream": False,
        "prompt": prompt_str,
        "format": {
            "type": "object",
            "properties": {
                "gen_sql": {"type": "string"}
            },
            "required": ["gen_sql"]
        }
    }

    # 3) LLM 서버 엔드포인트 (예시)
    llm_endpoint = f"{server_url}/api/generate"

    print(f"[DEBUG] LLM Request: server={llm_endpoint}, payload={request_payload}")  # 서버 콘솔(터미널)에 출력

    # 4) LLM 서버에 POST 요청
    try:
        llm_response = requests.post(llm_endpoint, json=request_payload)
        llm_response.raise_for_status()  # 2xx 아닌 경우 예외
    except requests.exceptions.RequestException as e:
        print("[ERROR] LLM 서버 요청 실패:", e)
        return jsonify({"error": "LLM 서버 요청 중 오류가 발생했습니다."}), 500

    # 5) LLM 서버에서 받은 응답(raw) 확인
    raw_text = llm_response.text
    print("[DEBUG] Raw LLM Response:", raw_text)  # 서버 콘솔(터미널)에 출력

    # 6) 이중 JSON 파싱
    #   - 최상위 JSON → 내부 "response" 필드 → 실제 {"gen_sql":"..."} 형태
    try:
        top_level_data = json.loads(raw_text)  # 최상위 JSON 파싱
    except json.JSONDecodeError as e:
        print("[ERROR] 최상위 JSON 파싱 실패:", e)
        return jsonify({
            "error": "LLM 응답 JSON 파싱 실패",
            "debug_response": raw_text
        }), 500

    gen_sql = ""
    nested_json_str = top_level_data.get("response", "")
    if nested_json_str:
        try:
            nested_data = json.loads(nested_json_str)  # 내부 JSON 파싱
            gen_sql = nested_data.get("gen_sql", "")
        except json.JSONDecodeError as e:
            print("[ERROR] nested 'response' 파싱 실패:", e)

    # 7) 최종 결과 구성: {"sql": "...", "debug_response": "..."}
    result = {
        "sql": gen_sql,
        "debug_response": raw_text
    }

    # 프론트엔드로 반환
    return jsonify(result)

@app.route('/compare', methods=['POST'])
def compare_sql():
    """
    1) 프론트엔드에서 db_schema, question, model_name 등을 받음
    2) LLM 서버로 POST (요청 형식: model, stream, prompt, format)
    3) LLM 서버 응답(raw_text)을 디버그용으로 서버 콘솔에 출력
    4) JSON 파싱(이중 JSON)하여 최종 gen_sql 추출
    5) {"sql": "...", "debug_response": "..."} 형태로 프론트엔드에 전송
    """
    data = request.json
    schema = data.get('db_schema', '')
    question = data.get('question', '')
    model_name = data.get('model_name', '')
    gt_sql = data.get('gt_sql', '')
    gen_sql = data.get('gen_sql', '')

    # 1) 추가: server_url 받기
    server_url = data.get('server_url', 'http://localhost:11434')

    # 1) Prompt 문자열 구성
    prompt_str = f"""Based on below DDL and Question, evaluate if gen_sql correctly resolves the Question.
If gen_sql and gt_sql produce the same results (functionally equivalent), return "yes" else return "no". 
Note that SQL queries might have different syntax but still return the same results.
Output JSON Format: {{"resolve_yn": ""}}

DDL: {schema}
Question: {question}
gt_sql (ground truth): {gt_sql}
gen_sql (generated): {gen_sql}"""

    # 2) LLM 서버로 보낼 request payload
    request_payload = {
        "model": model_name,
        "stream": False,
        "prompt": prompt_str,
        "format": {
            "type": "object",
            "properties": {
                "resolve_yn": {"type": "string"}
            },
            "required": ["resolve_yn"]
        }
    }

    # 3) LLM 서버 엔드포인트 (예시)
    llm_endpoint = f"{server_url}/api/generate"

    print(f"[DEBUG] LLM Request: server={llm_endpoint}, payload={request_payload}")  # 서버 콘솔(터미널)에 출력
    # 4) LLM 서버에 POST 요청
    try:
        llm_response = requests.post(llm_endpoint, json=request_payload)
        llm_response.raise_for_status()  # 2xx 아닌 경우 예외
    except requests.exceptions.RequestException as e:
        print("[ERROR] LLM 서버 요청 실패:", e)
        return jsonify({"error": "LLM 서버 요청 중 오류가 발생했습니다."}), 500

    # 5) LLM 서버에서 받은 응답(raw) 확인
    raw_text = llm_response.text
    print("[DEBUG] Raw LLM Response:", raw_text)  # 서버 콘솔(터미널)에 출력

    # 6) 이중 JSON 파싱
    #   - 최상위 JSON → 내부 "response" 필드 → 실제 {"gen_sql":"..."} 형태
    try:
        top_level_data = json.loads(raw_text)  # 최상위 JSON 파싱
    except json.JSONDecodeError as e:
        print("[ERROR] 최상위 JSON 파싱 실패:", e)
        return jsonify({
            "error": "LLM 응답 JSON 파싱 실패",
            "debug_response": raw_text
        }), 500

    gen_sql = ""
    nested_json_str = top_level_data.get("response", "")
    if nested_json_str:
        try:
            nested_data = json.loads(nested_json_str)  # 내부 JSON 파싱
            resolve_yn = nested_data.get("resolve_yn", "")
        except json.JSONDecodeError as e:
            print("[ERROR] nested 'response' 파싱 실패:", e)

    # 7) 최종 결과 구성: {"sql": "...", "debug_response": "..."}
    result = {
        "resolve_yn": resolve_yn,
        "debug_response": raw_text
    }

    # 프론트엔드로 반환
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5001)
