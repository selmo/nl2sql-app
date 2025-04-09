import json
from datasets import load_dataset

def convert_ko_text2sql_to_json(output_file="examples.json"):
    # 1) Hugging Face에서 selmoch/ko_text2sql 데이터셋 로드
    dataset = load_dataset("selmoch/ko_text2sql")

    # 만약 전체 split 중 'train'만 사용하고 싶다면 아래와 같이 사용:
    # dataset = load_dataset("selmoch/ko_text2sql", split="train")

    # 2) 변환된 결과를 담을 리스트
    results = []

    # 데이터셋 구조에 따라 실제 필드명이 다를 수 있으니,
    # selmoch/ko_text2sql의 컬럼명이 무엇인지 확인 후 아래 코드를 수정하세요.
    # (예: row["db_schema"], row["question"], row["sql"] 등)
    for row in dataset['train']:
        # 예시로, row에 'db_schema', 'question', 'sql' 필드가 있다고 가정
        db_schema = row.get("context", "")  # 실제 필드명에 맞춰 수정
        question = row.get("question", "")  # 실제 필드명에 맞춰 수정
        sql = row.get("answer", "")  # 실제 필드명에 맞춰 수정

        # 3) 원하는 JSON 구조에 맞게 딕셔너리 구성
        converted = {
            "db_schema": db_schema,
            "question": question,
            "sql": sql
        }

        results.append(converted)

    # 4) JSON 파일로 저장
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    convert_ko_text2sql_to_json("examples.json")